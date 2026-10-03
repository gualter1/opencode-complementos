---
description: Profiling Patterns - CPU/memory profiling, flame graphs, continuous profiling, regression detection. Performance debugging and optimization.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Profiling Patterns - Performance Profiling Skill

## Purpose
Defines profiling patterns for CPU, memory, lock contention, and continuous profiling. Used for performance debugging, regression detection, and optimization.

## When to Invoke
- Performance regression investigation (used by `performance-engineer`, `towards`, `tranquilao`)
- Continuous profiling setup
- Production debugging
- Capacity planning

---

## Profiling Types & Tools

| Type | What It Shows | Tools | Overhead |
|------|---------------|-------|----------|
| **CPU** | Function time, hot paths | Pyroscope, 0x, clinic.js, perf, pprof | Low (sampling) |
| **Memory** | Allocations, leaks, GC pressure | Pyroscope, heap snapshots, memlab | Medium |
| **Lock/Block** | Contention, deadlocks | Pyroscope, perf, Go pprof | Low |
| **Async/Event Loop** | Promise chains, microtasks | clinic.js, 0x, Node --inspect | Low |
| **Database** | Slow queries, plans, locks | pg_stat_statements, explain.depesz.com | None (DB-side) |
| **Frontend** | LCP, INP, CLS, bundle, hydration | Lighthouse, WebPageTest, Chrome DevTools | None (client) |

---

## Continuous Profiling (Pyroscope - Recommended)

### Setup

```yaml
# docker-compose.pyroscope.yml
version: '3.8'
services:
  pyroscope:
    image: grafana/pyroscope:1.6.0
    ports:
      - "4040:4040"
    environment:
      - STORAGE_TYPE=filesystem
      - RETENTION=30d
    volumes:
      - pyroscope-data:/var/lib/pyroscope

volumes:
  pyroscope-data:
```

### Application Integration

```typescript
// pyroscope.ts (Node.js/TypeScript)
import { Pyroscope } from '@pyroscope/nodejs';

Pyroscope.init({
  serverAddress: process.env.PYROSCOPE_URL || 'http://pyroscope:4040',
  appName: 'orders-service',
  tags: {
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
    region: process.env.AWS_REGION,
    hostname: require('os').hostname(),
  },
  profileTypes: [
    Pyroscope.ProfileType.CPU,
    Pyroscope.ProfileType.HEAP,
    Pyroscope.ProfileType.BLOCK,
    Pyroscope.ProfileType.MUTEX,
  ],
  // Custom labels for business context
  logger: {
    info: (msg) => console.log(`[Pyroscope] ${msg}`),
    error: (msg) => console.error(`[Pyroscope] ${msg}`),
  },
});

// Custom business context
function profileOrderCreation(orderId: string, tenantId: string) {
  return Pyroscope.wrap(async () => {
    // This scope will be tagged in profiles
    Pyroscope.tagWrapper({ orderId, tenantId });
    return await createOrder(orderId);
  });
}
```

```python
# pyroscope.py (Python/FastAPI)
import pyroscope

pyroscope.configure(
    application_name="orders-service",
    server_address="http://pyroscope:4040",
    tags={
        "version": os.getenv("APP_VERSION"),
        "environment": os.getenv("ENVIRONMENT"),
    },
    profile_types=[
        pyroscope.ProfileType.CPU,
        pyroscope.ProfileType.MEMORY,
        pyroscope.ProfileType.BLOCK,
        pyroscope.ProfileType.MUTEX,
    ],
)

# FastAPI middleware for request tagging
@app.middleware("http")
async def pyroscope_middleware(request: Request, call_next):
    pyroscope.tag_wrapper({
        "route": request.url.path,
        "method": request.method,
        "user_id": request.headers.get("x-user-id"),
    })
    response = await call_next(request)
    return response
```

```go
// pyroscope.go (Go)
import (
    "github.com/grafana/pyroscope-go"
)

func init() {
    pyroscope.Start(pyroscope.Config{
        ApplicationName: "orders-service",
        ServerAddress:   "http://pyroscope:4040",
        Tags: map[string]string{
            "version":     os.Getenv("APP_VERSION"),
            "environment": os.Getenv("ENVIRONMENT"),
        },
        ProfileTypes: []pyroscope.ProfileType{
            pyroscope.ProfileCPU,
            pyroscope.ProfileInuseObjects,
            pyroscope.ProfileAllocObjects,
            pyroscope.ProfileBlock,
            pyroscope.ProfileMutex,
        },
    })
}
```

---

## Ad-Hoc Profiling

### Node.js (clinic.js)
```bash
# Install
npm install -g clinic

# CPU Profile
clinic doctor -- node app.js
# Generates: clinic-<pid>.clinic-doctor.html

# Flame Graph
clinic flame -- node app.js
# Generates: flamegraph-<pid>.html

# Memory
clinic heapprofiler -- node app.js

# Event Loop Delay
clinic bubbleprof -- node app.js
```

### Python (py-spy)
```bash
# Install
pip install py-spy

# Record (no code changes needed)
py-spy record -o profile.svg --pid <PID>
py-spy record -o profile.svg -- python app.py

# Top (live)
py-spy top --pid <PID>

# Flame graph
py-spy flame -o flame.svg --pid <PID>
```

### Go (pprof)
```bash
# Add to code
import _ "net/http/pprof"

# Or runtime/pprof for custom
import (
    "runtime/pprof"
    "os"
)

func main() {
    f, _ := os.Create("cpu.prof")
    pprof.StartCPUProfile(f)
    defer pprof.StopCPUProfile()
    
    // ... app runs ...
}

# Analyze
go tool pprof cpu.prof
go tool pprof -http=:8080 cpu.prof  # Web UI

# Memory
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/heap
```

### Java (JFR - Java Flight Recorder)
```bash
# Start recording
jcmd <PID> JFR.start name=profile settings=profile duration=60s filename=profile.jfr

# Analyze
jfr print profile.jfr
jfr summary profile.jfr

# Or use JDK Mission Control (JMC) GUI
```

---

## Flame Graph Analysis

### Reading Flame Graphs
```
- X-axis: Population (not time) - wider = more samples
- Y-axis: Stack depth - top = running, bottom = callers
- Colors: Usually random (hash of function name)
- Plateau at top = hot function (where time is spent)
- Search for: "GC", "serialize", "parse", "encrypt", "query"
```

### Common Patterns to Investigate

```markdown
## Flame Graph Anti-Patterns

| Pattern | Indicates | Investigation |
|---------|-----------|---------------|
| **Wide flat top** | Single function dominates | Optimize that function |
| **Deep narrow towers** | Long call chains | Reduce abstraction layers |
| **GC spikes** | Memory pressure | Reduce allocations, tune GC |
| **Lock contention** | Blocked threads | Reduce critical sections |
| **Regex/parse at top** | Expensive parsing | Cache compiled regex, lazy parse |
| **Serialization at top** | JSON/msgpack overhead | Use binary protocol, streaming |
| **DB query in loop** | N+1 problem | Batch queries, use DataLoader |
```

---

## Database Profiling (PostgreSQL)

```sql
-- Enable pg_stat_statements (in postgresql.conf)
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

-- Top queries by total time
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 20;

-- Missing indexes (sequential scans on large tables)
SELECT 
  schemaname, 
  tablename, 
  seq_scan, 
  seq_tup_read, 
  idx_scan,
  n_tup_ins + n_tup_upd + n_tup_del as writes
FROM pg_stat_user_tables 
WHERE seq_scan > 100 
  AND seq_tup_read > 100000 
ORDER BY seq_tup_read DESC;

-- Lock contention
SELECT 
  pid, 
  usename, 
  application_name, 
  state, 
  query_start, 
  now() - query_start as duration, 
  query
FROM pg_stat_activity 
WHERE state = 'active' 
  AND now() - query_start > interval '5 seconds'
  AND query NOT LIKE '%pg_stat_activity%';

-- Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;  -- Unused indexes first
```

### EXPLAIN ANALYZE
```sql
-- Always use ANALYZE for real execution stats
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM orders 
WHERE user_id = 'usr_123' 
AND created_at > '2024-01-01'
ORDER BY created_at DESC 
LIMIT 20;

-- Look for:
-- - Seq Scan (should be Index Scan)
-- - High actual rows vs estimated (stats outdated)
-- - High buffer reads (disk I/O)
-- - Sort method: external merge (spilling to disk)
```

---

## Memory Leak Detection

### Node.js (heap snapshots)
```bash
# Take snapshots
node --inspect app.js
# In Chrome DevTools: Memory tab -> Take heap snapshot
# Take 3: baseline, after load, after idle
# Compare: snapshot 3 vs snapshot 1 -> "Objects allocated between snapshots 1 and 3"
```

```typescript
// Programmatic leak detection
import { writeHeapSnapshot } from 'v8';

setInterval(() => {
  const filename = `heap-${Date.now()}.heapsnapshot`;
  writeHeapSnapshot(filename);
  console.log(`Heap snapshot: ${filename}`);
}, 5 * 60 * 1000); // Every 5 minutes

// Analyze with: node --heapsnapshot-near-heap-limit=100
```

### memlab (Automated)
```bash
npx memlab run --scenario ./scenario.js
# Scenario defines: login -> perform action -> logout -> heap snapshot
# Detects: detached DOM nodes, closure leaks, cache leaks
```

---

## Regression Detection

### CI Integration

```yaml
# .github/workflows/performance-profile.yml
name: Performance Profiling
on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 3 * * *'  # Nightly

jobs:
  profile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Start App
        run: |
          docker compose up -d
          sleep 30
      
      - name: Run Load Test with Profiling
        run: |
          # Start Pyroscope profiling
          curl -X POST http://localhost:4040/api/control/start \
            -H "Content-Type: application/json" \
            -d '{"name": "orders-service", "tags": {"run": "ci-'${GITHUB_SHA}'"}}'
          
          # Run k6 load test
          k6 run load-test/smoke.js
          
          # Stop profiling
          curl -X POST http://localhost:4040/api/control/stop \
            -H "Content-Type: application/json" \
            -d '{"name": "orders-service"}'
      
      - name: Compare with Baseline
        run: |
          # Download profiles
          curl "http://localhost:4040/api/profile?name=orders-service&from=now-1h&until=now" \
            -o current-profile.pb.gz
          
          # Compare with baseline (stored in artifacts)
          python scripts/compare-profiles.py baseline.pb.gz current-profile.pb.gz
      
      - name: Upload Profiles
        uses: actions/upload-artifact@v4
        with:
          name: pyroscope-profiles
          path: *.pb.gz
```

### Profile Comparison Script

```python
# scripts/compare-profiles.py
import pyroscope
import sys

def compare_profiles(baseline_path: str, current_path: str, threshold: float = 0.15):
    """Compare two profiles, alert if regression > threshold"""
    
    baseline = pyroscope.load(baseline_path)
    current = pyroscope.load(current_path)
    
    # Compare top functions
    baseline_top = baseline.top_functions(20)
    current_top = current.top_functions(20)
    
    regressions = []
    
    for func in current_top:
        baseline_func = baseline_top.get(func.name)
        if baseline_func:
            change = (func.cpu_percent - baseline_func.cpu_percent) / baseline_func.cpu_percent
            if change > threshold:
                regressions.append({
                    'function': func.name,
                    'baseline_cpu%': baseline_func.cpu_percent,
                    'current_cpu%': func.cpu_percent,
                    'change%': change * 100,
                })
    
    if regressions:
        print("⚠️ PERFORMANCE REGRESSIONS DETECTED:")
        for r in regressions:
            print(f"  {r['function']}: {r['baseline_cpu%']:.2f}% -> {r['current_cpu%']:.2f}% ({r['change%']:.1f}% increase)")
        sys.exit(1)
    
    print("✅ No significant regressions")
    sys.exit(0)

if __name__ == "__main__":
    compare_profiles(sys.argv[1], sys.argv[2])
```

---

## Frontend Profiling

### Lighthouse CI
```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm run build
      - name: Start Preview Server
        run: npm run preview -- --port 3000 &
      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/dashboard
            http://localhost:3000/checkout
          configPath: ./lighthouserc.json
          uploadArtifacts: true
```

```json
// lighthouserc.json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "settings": {
        "headless": true,
        "preset": "desktop"
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 1.0 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### Chrome DevTools Protocol (Programmatic)
```typescript
// frontend-profiling.ts
import { puppeteer } from 'puppeteer';

async function profilePage(url: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Enable profiling
  await page.tracing.start({ path: 'trace.json', categories: ['devtools.timeline'] });
  
  await page.goto(url, { waitUntil: 'networkidle0' });
  
  // Interact
  await page.click('[data-testid="add-to-cart"]');
  await page.waitForSelector('[data-testid="cart-count"]');
  
  await page.tracing.stop();
  await browser.close();
  
  // Analyze trace
  return analyzeTrace('trace.json');
}
```

---

## Profiling in Production (Safe)

```typescript
// production-profiler.ts
class ProductionProfiler {
  private samplingRate = 0.01; // 1% of requests
  private maxDuration = 30000; // 30 seconds max
  
  async profileRequest(req: Request, handler: () => Promise<Response>): Promise<Response> {
    // Only profile small percentage
    if (Math.random() > this.samplingRate) {
      return handler();
    }
    
    const profileId = `prod-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Start profiling
    Pyroscope.tagWrapper({ profileId, route: req.url, userId: req.user?.id });
    
    const start = Date.now();
    try {
      return await handler();
    } finally {
      const duration = Date.now() - start;
      if (duration > 1000) { // Only save slow request profiles
        await this.saveProfile(profileId, duration);
      }
    }
  }
  
  private async saveProfile(id: string, duration: number) {
    // Upload to Pyroscope with metadata
    await fetch(`${PYROSCOPE_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: Pyroscope.getProfile(id),
    });
  }
}
```

---

## Output Format (for agent using this skill)
```
## Profiling Results
- Type: [CPU / Memory / Block / Mutex / Database / Frontend]
- Tool: [Pyroscope / clinic.js / py-spy / pprof / Lighthouse]
- Duration: [X seconds/minutes]
- Top Findings: [Function: %CPU, allocation rate, lock wait]
- Flame Graph: [URL/path]
- Regressions: [count] - [details]
- Recommendations: [top 3 optimizations]
- Evidence: [profile file, trace, screenshot]
```