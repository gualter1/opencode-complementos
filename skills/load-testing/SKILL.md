---
description: Load Testing - k6, Gatling, Artillery, test design, CI integration. Smoke, load, stress, soak, spike, breakpoint testing.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Load Testing - k6 & Performance Testing Skill

## Purpose
Defines load testing patterns using k6 (primary), Gatling, and Artillery. Covers test design, CI integration, thresholds, and result analysis for smoke, load, stress, soak, spike, and breakpoint testing.

## When to Invoke
- Performance validation (used by `performance-engineer`, `qualy`, `trevor`, `release-manager`)
- Pre-release validation
- Capacity planning
- Regression detection
- Chaos engineering

---

## Tool Selection

| Tool | Best For | Language | Learning Curve |
|------|----------|----------|----------------|
| **k6** | API, Web, gRPC, WebSocket | JavaScript/TypeScript | Low |
| **Gatling** | Complex scenarios, HTTP, WebSocket, JMS | Scala/Java | Medium |
| **Artillery** | Quick scripts, WebSocket, Socket.io | YAML/JS | Low |
| **Locust** | Python teams, distributed | Python | Low |

**Default: k6** - Modern, TypeScript support, excellent CI integration, Grafana k6 cloud.

---

## k6 Test Structure

### Project Layout
```
load-test/
├── package.json
├── k6.config.ts
├── scenarios/
│   ├── smoke.ts
│   ├── load.ts
│   ├── stress.ts
│   ├── soak.ts
│   ├── spike.ts
│   └── breakpoint.ts
├── lib/
│   ├── helpers.ts
│   ├── data.ts
│   ├── assertions.ts
│   └── selectors.ts
├── data/
│   ├── users.csv
│   ├── products.json
│   └── tokens.txt
└── reports/
    └── (generated)
```

### Base Configuration

```typescript
// k6.config.ts
import { defineConfig } from 'k6';

export const options = {
  // Global thresholds (can be overridden per scenario)
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'iteration_duration': ['p(95)<1000'],
  },
  
  // Default tags for all requests
  tags: {
    test_run_id: __ENV.TEST_RUN_ID || 'local',
    environment: __ENV.ENVIRONMENT || 'staging',
    version: __ENV.APP_VERSION || 'unknown',
  },
  
  // Output
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)'],
};

export default defineConfig(options);
```

---

## Test Scenarios

### 1. Smoke Test (PR Gate - Fast)
```typescript
// scenarios/smoke.ts
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      tags: { test_type: 'smoke' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

const BASE_URL = __ENV.BASE_URL || 'https://staging.example.com';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`, { headers });
    check(res, { 'health 200': (r) => r.status === 200 }) || errorRate.add(1);
    apiLatency.add(res.timings.duration);
  });

  group('Auth Validate', () => {
    const res = http.get(`${BASE_URL}/api/auth/me`, { headers });
    check(res, { 'auth 200': (r) => r.status === 200 }) || errorRate.add(1);
  });

  group('Critical API - List Orders', () => {
    const res = http.get(`${BASE_URL}/api/orders?limit=10`, { headers });
    check(res, { 'orders 200': (r) => r.status === 200 }) || errorRate.add(1);
    apiLatency.add(res.timings.duration);
  });

  sleep(1);
}
```

### 2. Load Test (Release Gate - Realistic)
```typescript
// scenarios/load.ts
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Test data loaded once, shared across VUs
const users = new SharedArray('users', () => {
  return JSON.parse(open('../data/users.json'));
});

const products = new SharedArray('products', () => {
  return JSON.parse(open('../data/products.json'));
});

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '10m', target: 100 }, // Sustained load
        { duration: '2m', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
      tags: { test_type: 'load' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'business_transaction_success': ['rate>0.98'],
  },
};

const errorRate = new Rate('errors');
const businessTx = new Counter('business_transactions');
const apiLatency = new Trend('api_latency');

const BASE_URL = __ENV.BASE_URL || 'https://staging.example.com';

function getAuthHeaders(user: any) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`,
  };
}

export default function () {
  const user = users[__ITER % users.length];
  const headers = getAuthHeaders(user);
  
  group('Browse Products', () => {
    const product = products[__ITER % products.length];
    const res = http.get(`${BASE_URL}/api/products/${product.id}`, { headers });
    check(res, { 'product 200': (r) => r.status === 200 }) || errorRate.add(1);
    apiLatency.add(res.timings.duration);
  });
  
  sleep(Math.random() * 2 + 1); // Think time 1-3s
  
  group('Add to Cart', () => {
    const product = products[__ITER % products.length];
    const payload = JSON.stringify({ productId: product.id, quantity: 1 });
    const res = http.post(`${BASE_URL}/api/cart/items`, payload, { headers });
    check(res, { 'cart add 200': (r) => r.status === 200 }) || errorRate.add(1);
    apiLatency.add(res.timings.duration);
  });
  
  sleep(Math.random() * 2 + 1);
  
  group('Checkout', () => {
    const payload = JSON.stringify({
      paymentMethodId: 'pm_test_card',
      shippingAddressId: user.defaultAddressId,
    });
    const res = http.post(`${BASE_URL}/api/checkout`, payload, { headers });
    const success = check(res, { 'checkout 201': (r) => r.status === 201 });
    businessTx.add(success ? 1 : 0);
    success || errorRate.add(1);
    apiLatency.add(res.timings.duration);
  });
  
  sleep(3);
}
```

### 3. Stress Test (Breaking Point)
```typescript
// scenarios/stress.ts
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 200 },
        { duration: '10m', target: 500 },
        { duration: '5m', target: 1000 }, // Push beyond expected
        { duration: '5m', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },
  },
  thresholds: {
    // Relaxed thresholds for stress - we're looking for breaking point
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.10'], // Allow up to 10% errors
    checks: ['rate>0.90'],
  },
};
```

### 4. Soak Test (Stability - Nightly)
```typescript
// scenarios/soak.ts
export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: 50,
      duration: '4h',
      tags: { test_type: 'soak' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    // Memory leak detection: iteration duration should not grow
    'iteration_duration': ['p(99)<2000'],
  },
};
```

### 5. Spike Test (Sudden Traffic)
```typescript
// scenarios/spike.ts
export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '10s', target: 500 }, // Sudden spike
        { duration: '1m', target: 500 },  // Sustain
        { duration: '10s', target: 10 },  // Drop
      ],
      tags: { test_type: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<3000'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
};
```

### 6. Breakpoint Test (Capacity Limit)
```typescript
// scenarios/breakpoint.ts
export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 2000,
      stages: [
        { duration: '5m', target: 200 },
        { duration: '5m', target: 400 },
        { duration: '5m', target: 600 },
        { duration: '5m', target: 800 },
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 1200 },
        // Continue until system breaks
      ],
      tags: { test_type: 'breakpoint' },
    },
  },
  thresholds: {
    // No thresholds - we want to find the limit
  },
};
```

---

## Advanced Patterns

### Authentication Flow
```typescript
// lib/auth.ts
import http from 'k6/http';
import { check } from 'k6';

export function login(email: string, password: string): string {
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(res, { 'login 200': (r) => r.status === 200 });
  
  const body = res.json();
  return body.accessToken;
}

export function refreshToken(refreshToken: string): string {
  const res = http.post(`${BASE_URL}/api/auth/refresh`, JSON.stringify({ refreshToken }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(res, { 'refresh 200': (r) => r.status === 200 });
  return res.json().accessToken;
}
```

### Data Parameterization
```typescript
// lib/data.ts
import { SharedArray } from 'k6/data';
import { Random } from 'k6/encoding';

// CSV for large datasets
export const users = new SharedArray('users', () => {
  const csv = open('../data/users.csv');
  return parseCSV(csv); // Implement or use papaparse
});

// Dynamic data generation
export function generateOrder(): Order {
  return {
    items: Array.from({ length: Random.int(1, 5) }, () => ({
      productId: `prod_${Random.int(1, 1000)}`,
      quantity: Random.int(1, 3),
    })),
    shippingAddressId: `addr_${Random.int(1, 100)}`,
    paymentMethodId: 'pm_test_card',
  };
}
```

### Custom Metrics & Checks
```typescript
// lib/assertions.ts
import { Check, Rate, Trend, Counter } from 'k6/metrics';

export const apiLatency = new Trend('api_latency');
export const businessSuccess = new Rate('business_success');
export const businessErrors = new Counter('business_errors');

export function assertApiResponse(res: any, expectedStatus: number, name: string): boolean {
  const success = res.status === expectedStatus;
  Check.add(success, { [`${name} status ${expectedStatus}`: () => success }]);
  apiLatency.add(res.timings.duration);
  return success;
}

export function assertBusinessResult(res: any, name: string): boolean {
  const body = res.json();
  const success = body.success === true;
  businessSuccess.add(success);
  if (!success) businessErrors.add(1);
  Check.add(success, { [`${name} business success`]: () => success });
  return success;
}
```

---

## CI/CD Integration

```yaml
# .github/workflows/load-test.yml
name: Load Testing
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      scenario:
        type: choice
        options: [smoke, load, stress, soak, spike, breakpoint]
        default: smoke
      environment:
        type: choice
        options: [staging, prod]
        default: staging

jobs:
  load-test:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    env:
      BASE_URL: ${{ secrets.STAGING_URL }}
      AUTH_TOKEN: ${{ secrets.STAGING_API_TOKEN }}
      TEST_RUN_ID: ${{ github.run_id }}
      APP_VERSION: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v4
      - name: Setup k6
        uses: grafana/k6-action@v0.2.0
      
      - name: Run Load Test
        run: |
          SCENARIO=${{ github.event.inputs.scenario || 'smoke' }}
          k6 run --out json=results.json scenarios/${SCENARIO}.ts
      
      - name: Check Thresholds
        run: |
          # k6 exits non-zero if thresholds fail
          # But we also want to parse results for reporting
          cat results.json | jq '.metrics'
      
      - name: Upload Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: k6-results-${{ github.event.inputs.scenario || 'smoke' }}
          path: results.json
      
      - name: Comment PR with Summary
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('results.json', 'utf8'));
            const summary = `
## Load Test Results (${{ github.event.inputs.scenario || 'smoke' }})

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| http_req_duration (p95) | ${results.metrics.http_req_duration.values['p(95)']}ms | < 500ms | ${results.metrics.http_req_duration.values['p(95)'] < 500 ? '✅' : '❌'} |
| http_req_failed rate | ${(results.metrics.http_req_failed.values.rate * 100).toFixed(2)}% | < 1% | ${results.metrics.http_req_failed.values.rate < 0.01 ? '✅' : '❌'} |
| checks pass rate | ${(results.metrics.checks.values.rate * 100).toFixed(2)}% | > 99% | ${results.metrics.checks.values.rate > 0.99 ? '✅' : '❌'} |
| iterations | ${results.metrics.iterations.values.count} | - | - |
| VUs max | ${results.metrics.vus_max.values.max} | - | - |
            `;
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: summary
            });
```

---

## Result Analysis

### k6 Summary Output
```
          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     /   /  /     
   /          \   |  |  \  /  /      
  /  __________\  |__|   \/__/       

  execution: local
     script: scenarios/load.ts
     output: -

  scenarios: (100.00%) 1 scenario, 100 max VUs, 14m30s max duration (incl. graceful stop):
           * load: 100 looping VUs for 10m0s (ramping up over 2m0s, down over 2m0s)

  ✓ checks.........................: 99.87% (14980/15000)
  ✓ http_req_duration..............: avg=234.2ms min=45.1ms med=198.3ms max=1.2s p(90)=387.2ms p(95)=456.1ms p(99)=789.3ms
  ✓ http_req_failed................: 0.13%  (20/15000)
  ✓ iterations.....................: 15000 17.6/s
  ✓ vus............................: 100    min=100 max=100
  ✓ vus_max........................: 100    min=100 max=100

  ✓ threshold: http_req_duration p(95)<500
  ✓ threshold: http_req_failed rate<0.01
  ✓ threshold: checks rate>0.99
```

### Grafana Dashboard (k6 Results)
```json
{
  "dashboard": {
    "title": "k6 Load Test Results",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{ "expr": "rate(k6_http_requests_total[1m])" }]
      },
      {
        "title": "Latency Percentiles",
        "targets": [
          { "expr": "histogram_quantile(0.50, rate(k6_http_request_duration_seconds_bucket[1m]))", "legendFormat": "p50" },
          { "expr": "histogram_quantile(0.95, rate(k6_http_request_duration_seconds_bucket[1m]))", "legendFormat": "p95" },
          { "expr": "histogram_quantile(0.99, rate(k6_http_request_duration_seconds_bucket[1m]))", "legendFormat": "p99" }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [{ "expr": "rate(k6_http_requests_failed_total[1m])" }]
      },
      {
        "title": "Business Transaction Success",
        "targets": [{ "expr": "rate(k6_business_transactions_total{success=\"true\"}[1m])" }]
      }
    ]
  }
}
```

---

## Test Data Management

```typescript
// test-data/generator.ts
// Generate realistic test data

export function generateUsers(count: number): User[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `usr_${i.toString(36).padStart(16, '0')}`,
    email: `loadtest${i}@example.com`,
    password: 'LoadTest123!',
    token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`, // Pre-generated JWT
    defaultAddressId: `addr_${i % 100}`,
    tier: i % 10 === 0 ? 'premium' : 'standard',
  }));
}

export function generateProducts(count: number): Product[] {
  const categories = ['electronics', 'clothing', 'books', 'home', 'sports'];
  return Array.from({ length: count }, (_, i) => ({
    id: `prod_${i.toString(36).padStart(12, '0')}`,
    name: `Product ${i}`,
    price: Math.floor(Math.random() * 100000) + 100,
    category: categories[i % categories.length],
    inStock: Math.random() > 0.1,
  }));
}
```

---

## Output Format (for agent using this skill)
```
## Load Test Results
- Scenario: [smoke/load/stress/soak/spike/breakpoint]
- Duration: [X minutes]
- Max VUs: [N]
- Request Rate: [X req/s peak]
- Latency: p50 [Xms], p95 [Yms], p99 [Zms]
- Error Rate: [X%]
- Business Success Rate: [X%]
- Thresholds: [PASS/FAIL - details]
- Bottlenecks: [identified from profiles]
- Recommendations: [scaling, optimization, fix]
```