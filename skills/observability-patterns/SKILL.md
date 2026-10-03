---
description: Observability Patterns - RED/USE metrics, structured logs, traces, alertas actionable, SLO/SLI, continuous profiling. Full observability stack.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Observability Patterns - Full Stack Observability Skill

## Purpose
Defines observability patterns: RED/USE metrics, structured logging, distributed tracing, actionable alerting with runbooks, SLO/SLI definitions, and continuous profiling.

## When to Invoke
- Setting up observability for new services (used by `trevor`, `performance-engineer`, `niamaia`, `towards`)
- Defining SLOs/SLIs
- Creating alerting rules
- Incident response improvement
- Cost optimization of observability stack

---

## Observability Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Metrics** | Prometheus + Grafana | RED/USE metrics, dashboards, alerting |
| **Logs** | Loki + Grafana | Structured logs, log-based metrics |
| **Traces** | Tempo + Grafana | Distributed tracing, service map |
| **Profiling** | Pyroscope | Continuous profiling (CPU, memory, locks) |
| **Alerting** | Alertmanager + Grafana OnCall | Route, group, inhibit, notify |
| **SLO** | Grafana SLO / Nobl9 | Error budget tracking, burn rate alerting |
| **Cost** | Grafana Cloud / Self-hosted | Retention, cardinality management |

---

## Metrics: RED + USE

### RED Metrics (Request/Error/Duration) - For Services
```promql
# Rate: Requests per second
rate(http_requests_total{job="orders-service"}[5m])

# Errors: Error rate (5xx)
rate(http_requests_total{job="orders-service", status=~"5.."}[5m])
/
rate(http_requests_total{job="orders-service"}[5m])

# Duration: Latency percentiles
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{job="orders-service"}[5m]))
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="orders-service"}[5m]))
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{job="orders-service"}[5m]))
```

### USE Metrics (Utilization/Saturation/Errors) - For Resources
```promql
# CPU Utilization
rate(container_cpu_usage_seconds_total{container="orders-service"}[5m])
/
container_spec_cpu_quota{container="orders-service"} / container_spec_cpu_period{container="orders-service"}

# Memory Utilization
container_memory_working_set_bytes{container="orders-service"}
/
container_spec_memory_limit_bytes{container="orders-service"}

# Disk Saturation
rate(container_fs_writes_bytes_total{container="orders-service"}[5m])
/
node_disk_write_bytes_total

# Network Saturation
rate(container_network_receive_bytes_total{container="orders-service"}[5m])
/
node_network_speed_bytes
```

---

## Structured Logging (JSON + OpenTelemetry)

```typescript
// Shared logger (Pino + OpenTelemetry)
import pino from 'pino';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'orders-service',
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
  },
});

// Contextual logging with trace correlation
function createChildLogger(context: Record<string, any>) {
  const span = trace.getActiveSpan();
  return logger.child({
    ...context,
    trace_id: span?.spanContext().traceId,
    span_id: span?.spanContext().spanId,
  });
}

// Usage
const log = createChildLogger({ userId, orderId, tenantId });
log.info({ event: 'order_created', amount: order.total }, 'Order created successfully');
log.error({ err: error, event: 'payment_failed' }, 'Payment processing failed');
log.warn({ event: 'retry_attempt', attempt: 2 }, 'Retrying payment');
```

### Log Schema (Enforced)
```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "info",
  "service": "orders-service",
  "version": "1.2.3",
  "environment": "production",
  "trace_id": "a1b2c3d4e5f6...",
  "span_id": "f6e5d4c3b2a1...",
  "event": "order_created",
  "user_id": "usr_abc123",
  "tenant_id": "ten_xyz789",
  "order_id": "ord_123",
  "amount": 10000,
  "currency": "BRL",
  "duration_ms": 45
}
```

### Log Sanitization (PII Protection)
```typescript
// Redact sensitive fields
const redacted = {
  ...logObj,
  email: hashPII(logObj.email),
  credit_card: maskCC(logObj.credit_card),
  password: '[REDACTED]',
  authorization: '[REDACTED]',
};
```

---

## Distributed Tracing (OpenTelemetry)

```typescript
// instrumentation.ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { KafkaJSInstrumentation } from '@opentelemetry/instrumentation-kafkajs';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'orders-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
  }),
});

provider.addSpanProcessor(
  new BatchSpanProcessor(new OTLPTraceExporter())
);

provider.register();

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation({ ignoreIncomingPaths: ['/health', '/metrics'] }),
    new ExpressInstrumentation(),
    new PgInstrumentation(),
    new KafkaJSInstrumentation(),
  ],
});
```

### Custom Spans (Business Logic)
```typescript
// services/order.service.ts
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('orders-service');

async function createOrder(input: CreateOrderInput): Promise<Order> {
  return tracer.startActiveSpan('OrderService.createOrder', { kind: SpanKind.INTERNAL }, async (span) => {
    try {
      span.setAttribute('user.id', input.userId);
      span.setAttribute('tenant.id', input.tenantId);
      span.setAttribute('order.item_count', input.items.length);
      span.setAttribute('order.total', input.total);
      
      const order = await repo.save(order);
      
      span.setAttribute('order.id', order.id);
      span.setStatus({ code: SpanStatusCode.OK });
      return order;
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error.message 
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

---

## Alerting: Actionable with Runbooks

### Alert Rules (PrometheusRule)

```yaml
# monitoring/alerts/orders-service.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: orders-service-alerts
  labels:
    team: platform
    service: orders-service
spec:
  groups:
  - name: orders-service.rules
    interval: 30s
    rules:
    
    # RED Alerts
    - alert: OrdersServiceHighErrorRate
      expr: |
        (
          rate(http_requests_total{job="orders-service", status=~"5.."}[5m])
          /
          rate(http_requests_total{job="orders-service"}[5m])
        ) > 0.05
      for: 2m
      labels:
        severity: critical
        runbook: "https://runbooks.example.com/orders-high-error-rate"
      annotations:
        summary: "Orders service error rate > 5%"
        description: "Error rate is {{ $value | humanizePercentage }} for {{ $labels.instance }}"
    
    - alert: OrdersServiceHighLatency
      expr: |
        histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="orders-service"}[5m])) > 1
      for: 5m
      labels:
        severity: warning
        runbook: "https://runbooks.example.com/orders-high-latency"
      annotations:
        summary: "Orders service p99 latency > 1s"
        description: "p99 latency is {{ $value }}s"
    
    - alert: OrdersServiceLowTraffic
      expr: |
        rate(http_requests_total{job="orders-service"}[5m]) < 0.1
      for: 15m
      labels:
        severity: info
        runbook: "https://runbooks.example.com/orders-low-traffic"
      annotations:
        summary: "Orders service traffic dropped significantly"
    
    # USE Alerts (Infrastructure)
    - alert: OrdersServiceHighCPU
      expr: |
        (rate(container_cpu_usage_seconds_total{container="orders-service"}[5m])
        /
        (container_spec_cpu_quota{container="orders-service"} / container_spec_cpu_period{container="orders-service"})) > 0.8
      for: 10m
      labels:
        severity: warning
        runbook: "https://runbooks.example.com/high-cpu"
      annotations:
        summary: "Orders service CPU > 80%"
    
    - alert: OrdersServiceHighMemory
      expr: |
        (container_memory_working_set_bytes{container="orders-service"}
        /
        container_spec_memory_limit_bytes{container="orders-service"}) > 0.85
      for: 10m
      labels:
        severity: warning
        runbook: "https://runbooks.example.com/high-memory"
      annotations:
        summary: "Orders service memory > 85%"
    
    # SLO Burn Rate Alerts
    - alert: OrdersServiceSLOBurnRateFast
      expr: |
        (1 - (rate(http_requests_total{job="orders-service", status!~"5.."}[5m]) / rate(http_requests_total{job="orders-service"}[5m]))) 
        > (1 - 0.999) * 14.4  # 2% error budget consumed in 1h (14.4x burn rate)
      for: 5m
      labels:
        severity: critical
        runbook: "https://runbooks.example.com/slo-burn-rate"
      annotations:
        summary: "Orders service SLO burn rate critical (2% budget in 1h)"
```

### Runbook Template

```markdown
# Runbook: Orders Service High Error Rate

## Alert
`OrdersServiceHighErrorRate` - Error rate > 5% for 2m

## Triage Steps (5 minutes)

### 1. Check Dashboard
- Open: https://grafana.example.com/d/orders-service/orders-service-red
- Look for: Spike in 5xx, specific endpoint, correlation with deploy

### 2. Check Recent Deploys
```bash
# Last 3 deploys
gh run list --workflow=deploy.yml --limit=3 --json conclusion,createdAt,headBranch

# Check if deploy correlates with alert start time
```

### 3. Check Logs
```bash
# Loki query in Grafana or CLI
logcli query '{service="orders-service"} |= "error" | json | level="error"' --since=10m --limit=100
```

### 4. Check Dependencies
- Payments service: `curl https://payments.example.com/health`
- Inventory service: `curl https://inventory.example.com/health`
- Database: `pg_stat_activity` for long queries

### 5. Quick Mitigations
| Scenario | Action |
|----------|--------|
| Recent deploy | `gh workflow run rollback.yml -f environment=prod` |
| Downstream dependency | Enable circuit breaker, serve cached/stale data |
| DB overload | Scale read replicas, kill long queries |
| Traffic spike | Enable rate limiting, scale HPA |

## Escalation
- **5 min**: On-call acknowledges
- **15 min**: No mitigation → Page secondary
- **30 min**: No resolution → Page team lead + incident commander

## Post-Incident
- Create incident report within 24h
- Add regression test for root cause
- Update runbook if gaps found
```

---

## SLO/SLI Definitions

```yaml
# monitoring/slos/orders-service.yaml
apiVersion: slo.grafana.com/v1
kind: SLO
metadata:
  name: orders-service-availability
  labels:
    service: orders-service
    tier: 1  # Critical path
spec:
  service: orders-service
  indicator:
    name: availability
    type: ratio
    ratio:
      good:
        # Successful requests (non-5xx)
        metric: http_requests_total
        filter: 'job="orders-service" AND status!~"5.."'
      total:
        metric: http_requests_total
        filter: 'job="orders-service"'
  objectives:
    - target: 0.999  # 99.9% availability
      timeWindow:
        rolling:
          period: 30d
    - target: 0.9999  # 99.99% for critical endpoints
      timeWindow:
        rolling:
          period: 30d
      filter: 'endpoint="/api/orders" OR endpoint="/api/payments"'
  
  budgeting:
    alerting:
      - name: fast-burn
        budgetBurnRate: 14.4  # 2% budget in 1h
        window: 5m
      - name: slow-burn
        budgetBurnRate: 6     # 10% budget in 6h
        window: 1h
      - name: very-slow-burn
        budgetBurnRate: 1     # 100% budget in 30d
        window: 6h
```

```yaml
# Latency SLO
apiVersion: slo.grafana.com/v1
kind: SLO
metadata:
  name: orders-service-latency
spec:
  service: orders-service
  indicator:
    name: latency
    type: threshold
    threshold:
      metric: http_request_duration_seconds
      filter: 'job="orders-service"'
      threshold: 0.5  # 500ms
  objectives:
    - target: 0.95  # 95% of requests < 500ms
      timeWindow:
        rolling:
          period: 30d
```

---

## Continuous Profiling (Pyroscope)

```typescript
// pyroscope.ts
import { Pyroscope } from '@pyroscope/nodejs';

Pyroscope.init({
  serverAddress: process.env.PYROSCOPE_URL || 'http://pyroscope:4040',
  appName: 'orders-service',
  tags: {
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
    region: process.env.AWS_REGION,
  },
  profileTypes: [
    Pyroscope.ProfileType.CPU,
    Pyroscope.ProfileType.HEAP,
    Pyroscope.ProfileType.BLOCK,
    Pyroscope.ProfileType.MUTEX,
  ],
});
```

### Profiling Queries (Grafana)
```promql
# Top CPU functions
topk(10, sum by (function) (rate(pyroscope_samples_total{profile_type="cpu", app="orders-service"}[5m])))

# Memory allocation hotspots
topk(10, sum by (function) (rate(pyroscope_samples_total{profile_type="heap", app="orders-service"}[5m])))

# Lock contention
topk(10, sum by (function) (rate(pyroscope_samples_total{profile_type="block", app="orders-service"}[5m])))
```

---

## Cardinality Management

```yaml
# Prometheus relabel configs to control cardinality
- job_name: 'kubernetes-pods'
  metric_relabel_configs:
  # Drop high-cardinality labels
  - action: labeldrop
    regex: '(pod|container|namespace|pod_template_generation|pod_template_hash)'
  # Keep only actionable labels
  - action: labelkeep
    regex: '(job|service|endpoint|namespace|pod|container|instance|le)'
  # Hash high-cardinality values
  - action: hashmod
    source_labels: ['request_id']
    target_label: 'request_id_hash'
    modulus: 1000
```

---

## Dashboard Standards (Grafana)

```json
{
  "dashboard": {
    "title": "Orders Service - RED Dashboard",
    "tags": ["orders-service", "red", "tier-1"],
    "timezone": "utc",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          { "expr": "rate(http_requests_total{job=\"orders-service\"}[5m])", "legendFormat": "{{method}} {{endpoint}}" }
        ],
        "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 }
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          { "expr": "rate(http_requests_total{job=\"orders-service\",status=~\"5..\"}[5m]) / rate(http_requests_total{job=\"orders-service\"}[5m])", "legendFormat": "Error Rate" }
        ],
        "gridPos": { "x": 12, "y": 0, "w": 12, "h": 8 }
      },
      {
        "title": "Latency (p50, p95, p99)",
        "type": "graph",
        "targets": [
          { "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{job=\"orders-service\"}[5m]))", "legendFormat": "p50" },
          { "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"orders-service\"}[5m]))", "legendFormat": "p95" },
          { "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{job=\"orders-service\"}[5m]))", "legendFormat": "p99" }
        ],
        "gridPos": { "x": 0, "y": 8, "w": 24, "h": 8 }
      }
    ]
  }
}
```

---

## Cost Optimization

```yaml
# Retention policies
metrics:
  # High resolution (1m) for 14 days
  - matchers: '{__name__=~"http_request.*"}'
    retention: 14d
    resolution: 1m
  # Low resolution (1h) for 1 year
  - matchers: '{__name__=~"http_request.*"}'
    retention: 1y
    resolution: 1h

logs:
  # Structured logs: 30 days
  - stream: '{service=~".+"}'
    retention: 30d
  # Debug logs: 7 days
  - stream: '{level="debug"}'
    retention: 7d

traces:
  # 100% sampling for errors, 10% for success
  - sampling:
      rate: 0.1
      policies:
        - type: probabilistic
          rate: 0.1
        - type: rate_limiting
          max_traces_per_second: 1000
    retention: 14d
```

---

## Output Format (for agent using this skill)
```
## Observability Implementation
- Service: [name]
- RED Metrics: [implemented - dashboard URL]
- USE Metrics: [implemented - dashboard URL]
- Structured Logs: [format, correlation IDs, PII redaction]
- Traces: [instrumentation, sampling rate]
- Profiling: [Pyroscope enabled, profile types]
- Alerts: [count, runbook URLs]
- SLOs: [availability, latency - targets]
- Cost: [estimated monthly, retention policy]
```