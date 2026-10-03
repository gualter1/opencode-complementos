---
description: Capacity Planning - Growth modeling, bottleneck prediction, cost optimization, scaling triggers. Mathematical models for infrastructure planning.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Capacity Planning - Growth Modeling & Scaling Skill

## Purpose
Defines capacity planning patterns: growth modeling, bottleneck prediction, cost optimization, scaling triggers, and automated scaling policies.

## When to Invoke
- Pre-scaling events (Black Friday, launches) (used by `performance-engineer`, `trevor`, `niamaia`)
- Budget planning
- Architecture scaling decisions
- Cost optimization
- Incident prevention

---

## Growth Modeling

### Basic Projection Model

```python
# capacity_planning/model.py
import numpy as np
from dataclasses import dataclass
from typing import List, Dict, Optional
from enum import Enum

class GrowthModel(Enum):
    LINEAR = "linear"
    EXPONENTIAL = "exponential"
    LOGISTIC = "logistic"  # S-curve with saturation
    SEASONAL = "seasonal"

@dataclass
class CapacityProjection:
    months: List[int]           # [0, 1, 2, ..., 12]
    projected_rps: List[float]  # Requests per second
    required_capacity: List[float]  # With headroom
    cost_estimate: List[float]  # Monthly cost
    bottlenecks: List[str]      # Predicted bottlenecks

@dataclass
class CapacityConfig:
    current_rps: float
    growth_rate_monthly: float  # e.g., 0.15 for 15% MoM
    target_headroom: float = 2.0  # 2x capacity
    months_ahead: int = 12
    model: GrowthModel = GrowthModel.EXPONENTIAL
    seasonal_factors: Optional[Dict[int, float]] = None  # month -> multiplier

def project_capacity(config: CapacityConfig) -> CapacityProjection:
    months = list(range(config.months_ahead + 1))
    
    if config.model == GrowthModel.LINEAR:
        projected = [config.current_rps * (1 + config.growth_rate_monthly * m) for m in months]
    elif config.model == GrowthModel.EXPONENTIAL:
        projected = [config.current_rps * (1 + config.growth_rate_monthly) ** m for m in months]
    elif config.model == GrowthModel.LOGISTIC:
        # Logistic: saturates at carrying_capacity
        carrying_capacity = config.current_rps * 100  # Assume 100x max
        projected = [
            carrying_capacity / (1 + (carrying_capacity / config.current_rps - 1) * np.exp(-config.growth_rate_monthly * m))
            for m in months
        ]
    elif config.model == GrowthModel.SEASONAL:
        base = [config.current_rps * (1 + config.growth_rate_monthly) ** m for m in months]
        projected = [
            base[m] * (config.seasonal_factors.get(m % 12, 1.0) if config.seasonal_factors else 1.0)
            for m in months
        ]
    else:
        projected = [config.current_rps * (1 + config.growth_rate_monthly) ** m for m in months]
    
    # Apply headroom
    required = [r * config.target_headroom for r in projected]
    
    # Cost estimation (simplified)
    cost = estimate_cost(required)
    
    # Identify bottlenecks
    bottlenecks = identify_bottlenecks(required, config.current_rps)
    
    return CapacityProjection(
        months=months,
        projected_rps=projected,
        required_capacity=required,
        cost_estimate=cost,
        bottlenecks=bottlenecks,
    )

def estimate_cost(required_rps: List[float]) -> List[float]:
    """Simplified cost model - replace with actual cloud pricing"""
    # Assume: $0.0001 per RPS-hour for compute, plus fixed costs
    compute_cost_per_rps_hour = 0.0001
    hours_per_month = 730
    fixed_monthly = 5000  # Base infrastructure
    
    return [
        fixed_monthly + rps * compute_cost_per_rps_hour * hours_per_month
        for rps in required_rps
    ]

def identify_bottlenecks(required: List[float], current: float) -> List[str]:
    bottlenecks = []
    max_required = max(required)
    
    if max_required > current * 10:
        bottlenecks.append("Database connection pool (current max 100, need 1000+)")
    if max_required > current * 5:
        bottlenecks.append("Redis memory (current 10GB, need 50GB+)")
    if max_required > current * 3:
        bottlenecks.append("API Gateway rate limits (current 10k/min, need 30k+)")
    if max_required > current * 2:
        bottlenecks.append("Kubernetes pod limits (current 10 pods, need 20+)")
    
    return bottlenecks
```

### Advanced: Monte Carlo Simulation

```python
# capacity_planning/monte_carlo.py
import numpy as np
from typing import Tuple

def monte_carlo_capacity(
    current_rps: float,
    growth_mean: float,
    growth_std: float,
    months: int = 12,
    simulations: int = 1000,
    headroom: float = 2.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Returns: (p50, p90, p99) capacity projections across simulations
    """
    results = np.zeros((simulations, months + 1))
    
    for i in range(simulations):
        # Sample monthly growth rates
        monthly_growth = np.random.normal(growth_mean, growth_std, months)
        monthly_growth = np.maximum(monthly_growth, -0.5)  # Floor at -50%
        
        # Project
        rps = current_rps
        results[i, 0] = rps
        for m in range(1, months + 1):
            rps *= (1 + monthly_growth[m - 1])
            results[i, m] = rps
    
    # Apply headroom
    results *= headroom
    
    # Percentiles
    p50 = np.percentile(results, 50, axis=0)
    p90 = np.percentile(results, 90, axis=0)
    p99 = np.percentile(results, 99, axis=0)
    
    return p50, p90, p99

# Usage
p50, p90, p99 = monte_carlo_capacity(
    current_rps=1000,
    growth_mean=0.15,
    growth_std=0.05,
    months=12,
    simulations=1000,
)

print(f"Month 12 - P50: {p50[12]:.0f} RPS, P90: {p90[12]:.0f} RPS, P99: {p99[12]:.0f} RPS")
# Provision for P90 or P99 depending on risk tolerance
```

---

## Bottleneck Prediction

### Resource Utilization Models

```python
# capacity_planning/bottlenecks.py
from dataclasses import dataclass
from typing import Dict, List

@dataclass
class ResourceLimit:
    name: str
    current_usage: float
    current_capacity: float
    max_capacity: float
    scaling_increment: float
    cost_per_increment: float
    lead_time_days: int

@dataclass
class BottleneckPrediction:
    resource: str
    predicted_exhaustion_month: int
    current_utilization: float
    recommended_action: str
    cost_to_resolve: float
    lead_time_days: int

RESOURCE_LIMITS = {
    "database_connections": ResourceLimit(
        name="PostgreSQL Connections",
        current_usage=60,
        current_capacity=100,
        max_capacity=500,  # With PgBouncer
        scaling_increment=100,
        cost_per_increment=50,  # $/month per 100 connections
        lead_time_days=0,  # Config change
    ),
    "database_cpu": ResourceLimit(
        name="Primary DB CPU",
        current_usage=45,  # %
        current_capacity=100,
        max_capacity=100,  # Vertical scaling limit
        scaling_increment=0,  # Vertical only
        cost_per_increment=2000,  # $/month for next instance class
        lead_time_days=7,  # Instance resize + failover
    ),
    "redis_memory": ResourceLimit(
        name="Redis Memory",
        current_usage=8,  # GB
        current_capacity=10,
        max_capacity=100,  # Cluster mode
        scaling_increment=10,
        cost_per_increment=100,
        lead_time_days=1,
    ),
    "k8s_pods": ResourceLimit(
        name="Kubernetes Pods (orders-service)",
        current_usage=8,
        current_capacity=10,
        max_capacity=100,  # HPA max
        scaling_increment=5,
        cost_per_increment=50,
        lead_time_days=0,  # HPA automatic
    ),
    "api_gateway_rate_limit": ResourceLimit(
        name="API Gateway Rate Limit",
        current_usage=5000,  # req/min
        current_capacity=10000,
        max_capacity=100000,
        scaling_increment=10000,
        cost_per_increment=10,
        lead_time_days=0,
    ),
    "cdn_bandwidth": ResourceLimit(
        name="CDN Bandwidth",
        current_usage=2,  # Gbps
        current_capacity=10,
        max_capacity=100,
        scaling_increment=10,
        cost_per_increment=500,
        lead_time_days=0,
    ),
}

def predict_bottlenecks(
    projected_rps: List[float],
    current_rps: float,
    resource_limits: Dict[str, ResourceLimit] = RESOURCE_LIMITS,
) -> List[BottleneckPrediction]:
    predictions = []
    
    for month, rps in enumerate(projected_rps):
        scale_factor = rps / current_rps
        
        for name, limit in resource_limits.items():
            projected_usage = limit.current_usage * scale_factor
            utilization = projected_usage / limit.current_capacity * 100
            
            if utilization >= 80 and limit.current_usage / limit.current_capacity * 100 < 80:
                # New bottleneck predicted this month
                increments_needed = max(0, int(np.ceil((projected_usage - limit.current_capacity * 0.7) / limit.scaling_increment)))
                cost = increments_needed * limit.cost_per_increment
                
                action = f"Scale {limit.name} by {increments_needed} increments"
                if limit.lead_time_days > 0:
                    action += f" (lead time: {limit.lead_time_days} days)"
                
                predictions.append(BottleneckPrediction(
                    resource=name,
                    predicted_exhaustion_month=month,
                    current_utilization=limit.current_usage / limit.current_capacity * 100,
                    recommended_action=action,
                    cost_to_resolve=cost,
                    lead_time_days=limit.lead_time_days,
                ))
    
    return sorted(predictions, key=lambda p: p.predicted_exhaustion_month)
```

---

## Scaling Policies

### Horizontal Pod Autoscaler (Kubernetes)

```yaml
# k8s/hpa-orders-service.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: orders-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orders-service
  minReplicas: 3
  maxReplicas: 100
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # 5 min
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Min
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
  metrics:
  # CPU-based scaling
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  # Memory-based scaling
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  # Custom metric: Request latency
  - type: Pods
    pods:
      metric:
        name: http_request_duration_seconds_p99
      target:
        type: AverageValue
        averageValue: "500m"  # 500ms
  # Custom metric: Queue depth
  - type: External
    external:
      metric:
        name: kafka_consumer_group_lag
        selector:
          matchLabels:
            consumer_group: orders-service
      target:
        type: Value
        value: "1000"
```

### Cluster Autoscaler (Karpenter)

```yaml
# k8s/karpenter-nodepool.yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: general-purpose
spec:
  template:
    metadata:
      labels:
        workload-type: general
    spec:
      nodeClassRef:
        name: default
      requirements:
      - key: "karpenter.sh/capacity-type"
        operator: In
        values: ["spot", "on-demand"]
      - key: "kubernetes.io/arch"
        operator: In
        values: ["amd64", "arm64"]
      - key: "topology.kubernetes.io/zone"
        operator: In
        values: ["us-east-1a", "us-east-1b", "us-east-1c"]
      expireAfter: 720h  # 30 days
  limits:
    cpu: 1000
    memory: 4000Gi
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 30s
    budgets:
    - nodes: "10%"
```

### Database Scaling

```yaml
# Read Replicas (Terraform)
resource "aws_db_instance" "replica" {
  count                   = var.read_replica_count
  identifier              = "${var.db_name}-replica-${count.index + 1}"
  replicate_source_db     = aws_db_instance.primary.identifier
  instance_class          = var.replica_instance_class
  monitoring_interval     = 60
  performance_insights_enabled = true
  
  # Promote to primary on failure
  promotion_tier = 1
}

# PgBouncer for Connection Pooling
resource "kubernetes_deployment" "pgbouncer" {
  metadata {
    name = "pgbouncer"
    namespace = "database"
  }
  spec {
    replicas = 3
    selector { match_labels = { app = "pgbouncer" } }
    template {
      metadata { labels = { app = "pgbouncer" } }
      spec {
        container {
          name  = "pgbouncer"
          image = "edoburu/pgbouncer:1.21"
          env {
            name  = "DATABASE_URL"
            value = "postgres://user:pass@primary-db:5432/db"
          }
          env {
            name  = "POOL_MODE"
            value = "transaction"
          }
          env {
            name  = "MAX_CLIENT_CONN"
            value = "1000"
          }
          env {
            name  = "DEFAULT_POOL_SIZE"
            value = "20"
          }
        }
      }
    }
  }
}
```

---

## Cost Optimization

### Right-Sizing Analysis

```python
# capacity_planning/rightsizing.py
from dataclasses import dataclass
from typing import List

@dataclass
class InstanceSpec:
    name: str
    vcpu: int
    memory_gb: float
    cost_per_hour: float
    network_gbps: float

# AWS EC2 Instance Types (simplified)
INSTANCE_TYPES = [
    InstanceSpec("t3.micro", 2, 1, 0.0104, 0.1),
    InstanceSpec("t3.small", 2, 2, 0.0208, 0.1),
    InstanceSpec("t3.medium", 2, 4, 0.0416, 0.1),
    InstanceSpec("t3.large", 2, 8, 0.0832, 0.1),
    InstanceSpec("t3.xlarge", 4, 16, 0.1664, 0.1),
    InstanceSpec("t3.2xlarge", 8, 32, 0.3328, 0.1),
    InstanceSpec("m6i.large", 2, 8, 0.096, 12.5),
    InstanceSpec("m6i.xlarge", 4, 16, 0.192, 12.5),
    InstanceSpec("m6i.2xlarge", 8, 32, 0.384, 12.5),
    InstanceSpec("m6i.4xlarge", 16, 64, 0.768, 12.5),
    InstanceSpec("m6i.8xlarge", 32, 128, 1.536, 12.5),
    InstanceSpec("c6i.large", 2, 4, 0.077, 12.5),
    InstanceSpec("c6i.xlarge", 4, 8, 0.154, 12.5),
    InstanceSpec("r6i.large", 2, 16, 0.126, 12.5),
    InstanceSpec("r6i.xlarge", 4, 32, 0.252, 12.5),
]

@dataclass
class RightsizingRecommendation:
    current: InstanceSpec
    recommended: InstanceSpec
    monthly_savings: float
    utilization_after: Dict[str, float]
    risk: str

def recommend_instance(
    current: InstanceSpec,
    cpu_utilization: float,      # 0-100
    memory_utilization: float,   # 0-100
    target_utilization: float = 70,
    headroom: float = 1.3,
) -> RightsizingRecommendation:
    # Calculate required resources
    required_vcpu = current.vcpu * (cpu_utilization / 100) * headroom
    required_memory = current.memory_gb * (memory_utilization / 100) * headroom
    
    # Find cheapest instance that meets requirements
    candidates = [
        inst for inst in INSTANCE_TYPES
        if inst.vcpu >= required_vcpu and inst.memory_gb >= required_memory
    ]
    
    if not candidates:
        # Need larger than available - recommend largest
        recommended = max(INSTANCE_TYPES, key=lambda x: x.vcpu * x.memory_gb)
    else:
        recommended = min(candidates, key=lambda x: x.cost_per_hour)
    
    monthly_savings = (current.cost_per_hour - recommended.cost_per_hour) * 730
    utilization_after = {
        "cpu": (required_vcpu / recommended.vcpu) * 100,
        "memory": (required_memory / recommended.memory_gb) * 100,
    }
    
    risk = "LOW"
    if utilization_after["cpu"] > 85 or utilization_after["memory"] > 85:
        risk = "HIGH"
    elif utilization_after["cpu"] > 75 or utilization_after["memory"] > 75:
        risk = "MEDIUM"
    
    return RightsizingRecommendation(
        current=current,
        recommended=recommended,
        monthly_savings=monthly_savings,
        utilization_after=utilization_after,
        risk=risk,
    )
```

### Spot Instance Strategy

```yaml
# EC2 Spot Fleet for Batch/Async Workloads
resource "aws_ec2_fleet" "batch_workers" {
  launch_template_config {
    launch_template_specification {
      launch_template_id = aws_launch_template.batch_worker.id
      version            = "$Latest"
    }
    override {
      instance_type = "m6i.xlarge"
      weighted_capacity = 1
    }
    override {
      instance_type = "m6i.2xlarge"
      weighted_capacity = 2
    }
    override {
      instance_type = "m5.xlarge"
      weighted_capacity = 1
    }
    override {
      instance_type = "m5.2xlarge"
      weighted_capacity = 2
    }
  }
  
  target_capacity_specification {
    total_target_capacity = 100
    on_demand_target_capacity = 20  # 20% on-demand baseline
    default_target_capacity_type = "vcpu"
  }
  
  spot_options {
    allocation_strategy = "diversified"
    instance_interruption_behavior = "terminate"
    max_price = "0.08"  # 80% of on-demand
  }
  
  tag_specifications {
    resource_type = "fleet"
    tags = {
      Name        = "batch-workers"
      Workload    = "async-processing"
      ManagedBy   = "terraform"
    }
  }
}
```

---

## Scaling Triggers & Automation

```yaml
# GitHub Actions: Auto-scale for predicted load
# .github/workflows/auto-scale.yml
name: Predictive Auto-Scale
on:
  schedule:
    - cron: '0 * * * *'  # Hourly
  workflow_dispatch:

jobs:
  predict-and-scale:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Capacity Prediction
        id: predict
        run: |
          python scripts/capacity_predict.py \
            --current-rps 1000 \
            --growth-rate 0.15 \
            --months 1 \
            --output prediction.json
      
      - name: Check Scaling Needed
        id: check
        run: |
          PREDICTED=$(jq '.required_capacity[-1]' prediction.json)
          CURRENT=$(kubectl get hpa orders-service-hpa -o jsonpath='{.status.currentReplicas}')
          MAX=$(kubectl get hpa orders-service-hpa -o jsonpath='{.spec.maxReplicas}')
          
          REQUIRED_REPLICAS=$((PREDICTED / 100))  # ~100 RPS per pod
          
          if [ $REQUIRED_REPLICAS -gt $MAX ]; then
            echo "scale_needed=true" >> $GITHUB_OUTPUT
            echo "required=$REQUIRED_REPLICAS" >> $GITHUB_OUTPUT
            echo "current_max=$MAX" >> $GITHUB_OUTPUT
          fi
      
      - name: Scale HPA Max
        if: steps.check.outputs.scale_needed == 'true'
        run: |
          kubectl patch hpa orders-service-hpa \
            -p '{"spec":{"maxReplicas":${{ steps.check.outputs.required }}}}'
      
      - name: Alert if Lead Time Needed
        if: steps.check.outputs.scale_needed == 'true'
        run: |
          # Check if any bottleneck has lead time > 0
          python scripts/check_lead_times.py prediction.json
          # If lead time > 0, create urgent issue
```

---

## Capacity Planning Dashboard

```json
{
  "dashboard": {
    "title": "Capacity Planning",
    "panels": [
      {
        "title": "RPS Projection (P50/P90/P99)",
        "type": "graph",
        "targets": [
          { "expr": "capacity_projected_rps_p50", "legendFormat": "P50" },
          { "expr": "capacity_projected_rps_p90", "legendFormat": "P90" },
          { "expr": "capacity_projected_rps_p99", "legendFormat": "P99" }
        ]
      },
      {
        "title": "Resource Utilization vs Capacity",
        "type": "graph",
        "targets": [
          { "expr": "db_connections_usage / db_connections_limit", "legendFormat": "DB Connections" },
          { "expr": "redis_memory_usage / redis_memory_limit", "legendFormat": "Redis Memory" },
          { "expr": "k8s_pods_usage / k8s_pods_limit", "legendFormat": "K8s Pods" },
          { "expr": "api_gateway_rate_usage / api_gateway_rate_limit", "legendFormat": "API Gateway" }
        ]
      },
      {
        "title": "Monthly Cost Projection",
        "type": "graph",
        "targets": [
          { "expr": "capacity_cost_estimate", "legendFormat": "Projected" },
          { "expr": "current_monthly_cost", "legendFormat": "Current" }
        ]
      },
      {
        "title": "Bottleneck Timeline",
        "type": "table",
        "targets": [
          { "expr": "capacity_bottleneck_predictions", "format": "table" }
        ]
      }
    ]
  }
}
```

---

## Output Format (for agent using this skill)
```
## Capacity Plan
- Current RPS: [X]
- Growth Model: [Linear/Exponential/Logistic/Seasonal]
- Growth Rate: [X% MoM]
- 12-Month Projection: P50 [X], P90 [Y], P99 [Z] RPS
- Required Capacity (2x headroom): [X RPS]
- Bottlenecks Predicted: [count] - [resource: month, action, cost, lead time]
- Scaling Policies: [HPA, Cluster Autoscaler, DB replicas, PgBouncer]
- Cost Projection: Current $[X]/mo -> Month 12 $[Y]/mo
- Rightsizing Opportunities: [count] - [savings]
- Risk Items: [lead time items needing early action]
```