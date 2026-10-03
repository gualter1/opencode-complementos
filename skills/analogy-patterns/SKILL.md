---
description: Analogy Patterns - Curated technical analogies mapped to real-world concepts. Event loop=restaurant, cache=pantry, database index=library catalog, etc.
mode: subagent
model: 9router/Turing
skills:
  - context-mode
---

{reasoning effort: high}

# Analogy Patterns - Technical Concepts Mapped to Real World

## Purpose
Provides a curated library of technical analogies for teaching, documentation, and communication. Each analogy includes mapping table, boundaries, and predictive power.

## When to Invoke
- Explaining concepts to non-technical stakeholders (used by `guanabara`, `devrel-engineer`, `niamaia`)
- Writing documentation and tutorials
- Onboarding new team members
- Architecture presentations
- Incident communication

---

## Core Analogies Library

### 1. Concurrency & Async

#### Event Loop ≈ Restaurant Kitchen
| Technical | Restaurant | Insight |
|-----------|------------|---------|
| Main Thread | Head Chef (one person) | Single-threaded execution |
| Event Queue | Order tickets on rail | FIFO processing |
| Async I/O | Cooking appliances (oven, fryer) | Non-blocking operations |
| Callbacks/Promises | "Ding!" timers on appliances | Completion notifications |
| Blocking I/O | Chef waiting at oven | Wasted capacity, line backs up |
| Microtasks | Chef wiping counter between orders | Higher priority, same tick |
| Macrotasks | Next customer order | Next event loop iteration |

**Boundary**: Real kitchens have multiple chefs (worker threads). Node.js has one main thread + libuv thread pool.

**Predictive Power**: Explains why CPU-intensive tasks block the event loop, why `setTimeout(0)` doesn't run immediately, why `Promise.resolve().then()` runs before next I/O.

---

#### Thread Pool ≈ Kitchen Prep Stations
| Technical | Kitchen | Insight |
|-----------|---------|---------|
| Worker Threads | Prep stations (chopping, sauces) | Parallelizable work |
| Main Thread | Line cook (plating) | Coordination, final assembly |
| Task Queue | Order tickets | Work distribution |
| Thread Pool Size | Number of prep stations | Fixed capacity (4 default in Node) |
| Blocking Task | Long chopping job | Occupies station, blocks others |

**Predictive Power**: Explains why heavy crypto/file operations should use worker threads, why `UV_THREADPOOL_SIZE` matters.

---

#### Async/Await ≈ Recipe Steps
```markdown
## Synchronous (Blocking)
Step 1: Boil water (wait 10 min)
Step 2: Cook pasta (wait 12 min) 
Step 3: Make sauce (wait 15 min)
Total: 37 minutes, chef idle 37 min

## Asynchronous (Non-blocking)
Step 1: Start boiling water (set timer)
Step 2: Start making sauce (while water heats)
Step 3: When water boils → cook pasta
Step 4: When sauce ready → combine
Total: ~22 minutes, chef working throughout

## Async/Await Syntax
async function cookMeal() {
  const water = boilWater();        // Returns promise (timer set)
  const sauce = makeSauce();        // Start immediately
  await water;                      // Wait ONLY when needed
  const pasta = cookPasta(water);   // Depends on water
  await sauce;                      // Wait for sauce
  return combine(pasta, sauce);
}
```

---

### 2. Data & Storage

#### Cache ≈ Pantry
| Technical | Pantry | Insight |
|-----------|--------|---------|
| Cache Hit | Ingredient in pantry | Fast access (ms) |
| Cache Miss | Ingredient not in pantry | Must go to store (DB) |
| TTL | Expiration date | Auto-eviction |
| LRU Eviction | Throw out oldest unused | Make space for fresh |
| Write-Through | Restock pantry immediately | Consistency, slower writes |
| Write-Back | Note to restock later | Fast writes, risk of loss |
| Cache Invalidation | Recipe change → clear pantry | Hard problem (naming, TTL) |
| Distributed Cache | Multiple pantries | Consistency complexity |

**Predictive Power**: Explains cache stampede (everyone runs to store), thundering herd, cold start latency.

---

#### Database Index ≈ Library Catalog
| Technical | Library | Insight |
|-----------|---------|---------|
| B-Tree Index | Card catalog (sorted by title) | Fast exact/range lookup |
| Hash Index | ISBN lookup (direct mapping) | Fast exact, no range |
| Composite Index | Catalog sorted by (author, title) | Leftmost prefix rule |
| Covering Index | Catalog with all book details | No shelf lookup needed |
| Index Write Cost | Updating catalog on new book | Slower inserts |
| Unused Index | Catalog nobody searches | Waste of space/maintenance |
| Fragmentation | Cards out of order | Rebuild needed (REINDEX) |

**Predictive Power**: Explains why `(a,b,c)` index covers `(a,b)` queries, why `LIKE '%term%'` can't use index, why indexes slow writes.

---

#### Database Transaction ≈ Bank Transfer
| Technical | Bank | Insight |
|-----------|------|---------|
| BEGIN | Start transfer form | Group operations |
| READ | Check balances | Consistent snapshot |
| WRITE | Debit/credit accounts | Pending changes |
| COMMIT | Submit form | Atomic, all-or-nothing |
| ROLLBACK | Void form | No changes applied |
| Isolation Levels | Concurrent transfers | Dirty read, phantom read |
| Deadlock | Circular wait | Timeout + retry |
| Savepoint | Checkpoint in long form | Partial rollback |

**Predictive Power**: Explains isolation anomalies, deadlock detection, why long transactions hurt concurrency.

---

### 3. Networking & Architecture

#### Load Balancer ≈ Restaurant Host
| Technical | Restaurant | Insight |
|-----------|------------|---------|
| Host | Host/hostess | Single entry point |
| Servers | Tables/sections | Backend capacity |
| Health Check | "Table ready?" | Remove unhealthy |
| Round Robin | Next available table | Simple distribution |
| Least Connections | Smallest party first | Balance load |
| IP Hash | Regular's favorite table | Session affinity |
| Circuit Breaker | "Kitchen closed" sign | Fail fast, prevent cascade |
| Rate Limiting | "Full, wait 20 min" | Protect capacity |

**Predictive Power**: Explains sticky sessions, health check intervals, circuit breaker states (closed/open/half-open).

---

#### API Gateway ≈ Hotel Concierge
| Technical | Hotel | Insight |
|-----------|-------|---------|
| Concierge | Single contact point | Unified interface |
| Authentication | Key card verification | Centralized auth |
| Rate Limiting | "3 towels per room" | Quota enforcement |
| Request Routing | "Spa is building B" | Path-based routing |
| Protocol Translation | "We speak your language" | gRPC ↔ REST, GraphQL |
| Response Caching | "Menu printed daily" | Reduce backend load |
| Observability | Guest log book | Logging, metrics, tracing |

---

#### Message Queue ≈ Postal Service
| Technical | Postal Service | Insight |
|-----------|----------------|---------|
| Producer | Sender | Fire-and-forget |
| Queue | Post office | Durable, ordered |
| Consumer | Recipient | Processes at own pace |
| Acknowledgment | Signature confirmation | At-least-once delivery |
| Dead Letter | Return to sender | Failed after retries |
| Priority Mail | Express shipping | Priority queues |
| Bulk Mail | Batch processing | High throughput |
| Tracking | Trace ID | Observability |

**Predictive Power**: Explains backpressure, consumer lag, exactly-once vs at-least-once, ordering guarantees.

---

#### Circuit Breaker ≈ Electrical Breaker
| Technical | Electrical | Insight |
|-----------|------------|---------|
| Closed (Normal) | Circuit closed | Requests flow |
| Open (Tripped) | Breaker tripped | Fail fast, no calls |
| Half-Open (Testing) | Reset attempt | Probe with few requests |
| Threshold | Amp rating | Configurable sensitivity |
| Timeout | Cool-down period | Auto-reset timer |
| Fallback | Backup generator | Graceful degradation |

---

### 4. Deployment & Operations

#### Blue/Green Deploy ≈ Theater Rehearsal
| Technical | Theater | Insight |
|-----------|---------|---------|
| Blue (Current) | Main stage (audience) | Live production |
| Green (New) | Rehearsal stage | Staging/preview |
| Switch | Curtain swap | Atomic cutover |
| Rollback | Curtain back | Instant revert |
| Smoke Test | Dress rehearsal | Validate before switch |
| Cost | Two stages | Double infrastructure |

---

#### Canary Release ≈ Canary in Coal Mine
| Technical | Mine | Insight |
|-----------|------|---------|
| Canary (Small %) | Canary bird | Early warning |
| Metrics | Bird's behavior | Error rate, latency |
| Full Rollout | Miners enter | All clear |
| Rollback | Evacuate | Instant revert |
| Automation | Gas detector | Automated decision |

---

#### Feature Flag ≈ Light Switch
| Technical | Light Switch | Insight |
|-----------|--------------|---------|
| Flag ON | Light on | Feature active |
| Flag OFF | Light off | Feature hidden |
| Dimmer | Percentage rollout | Gradual enable |
| Remote Control | Central panel | Dynamic change |
| Wiring | Code paths | No deploy needed |
| Burnout | Switch fails | Cleanup needed |

---

#### Database Migration ≈ Changing Tires on Moving Car
| Technical | Car | Insight |
|-----------|-----|---------|
| Expand (Add column) | Add spare tire rack | Safe, backward compatible |
| Backfill | Fill spare tire | Background, no downtime |
| Contract (Drop column) | Remove old rack | Only after new verified |
| Rollback | Put old tire back | Must be instant |
| Zero-downtime | Car never stops | Business continuity |

---

### 5. Security

#### Authentication ≈ ID Card + PIN
| Technical | Physical | Insight |
|-----------|----------|---------|
| Username | Name on ID | Identifier |
| Password | PIN | Secret knowledge |
| MFA | ID + PIN + Fingerprint | Multiple factors |
| Session | Badge validity | Time-limited access |
| Token | Electronic badge | Stateless, portable |
| Refresh Token | Badge renewal | Long-lived, rotatable |
| OAuth | Visitor pass | Delegated access |

---

#### Authorization ≈ Hotel Key Card
| Technical | Hotel | Insight |
|-----------|-------|---------|
| Role | Guest/Staff/Manager | Coarse access |
| Permission | Room access | Fine-grained |
| Policy | Master key rules | Centralized logic |
| ABAC | Context-aware (time, location) | Dynamic decisions |
| Audit Log | Key card logs | Compliance |

---

#### Rate Limiting ≈ Nightclub Bouncer
| Technical | Club | Insight |
|-----------|------|---------|
| Limit | Capacity | Max concurrent |
| Window | Counting period | Reset interval |
| Burst | VIP entry | Allow spikes |
| Queue | Waiting line | Fairness |
| Reject | "Come back later" | 429 Too Many Requests |
| Tiered | VIP vs General | Different limits |

---

### 6. Observability

#### Structured Logging ≈ Shipping Manifest
| Technical | Shipping | Insight |
|-----------|----------|---------|
| JSON Format | Standardized manifest | Machine parseable |
| Correlation ID | Tracking number | End-to-end trace |
| Timestamp | Scan events | Ordering |
| Level | Priority (fragile/urgent) | Filtering |
| Context | Package details | Debugging |

---

#### Distributed Tracing ≕ Package Tracking
| Technical | Package Tracking | Insight |
|-----------|------------------|---------|
| Trace ID | Tracking number | Unique journey |
| Span | Scan event (pickup, sort, deliver) | Operation |
| Parent Span | Previous scan | Causality |
| Baggage | Customs form | Cross-cutting context |
| Sampling | Scan 1 in 100 | Cost control |

---

#### Metrics (RED) ≕ Car Dashboard
| Technical | Car Dashboard | Insight |
|-----------|---------------|---------|
| Rate (RPM) | Speedometer | Throughput |
| Errors (Check Engine) | Warning lights | Health |
| Duration (Trip Time) | Odometer/Timer | Latency |
| USE (Fuel/Temp) | Gauges | Resource saturation |

---

### 7. Software Design

#### Technical Debt ≈ Credit Card Debt
| Technical | Credit Card | Insight |
|-----------|-------------|---------|
| Quick fix | Swipe card | Fast now |
| Interest | Maintenance burden | Compounds over time |
| Minimum payment | Band-aid fixes | Never pays principal |
| Maxed out | Unmaintainable | Can't add features |
| Bankruptcy | Rewrite | Catastrophic |
| Pay down | Refactoring | Deliberate investment |

---

#### Refactoring ≕ Kitchen Reorganization
| Technical | Kitchen | Insight |
|-----------|---------|---------|
| Same menu | Behavior preserved | Tests pass |
| Better layout | Cleaner code | Maintainable |
| Mise en place | Organized ingredients | DRY, clear naming |
| Workstation zones | Bounded contexts | Separation of concerns |
| Continuous | Daily habit | Not "refactoring sprint" |

---

#### Design Patterns ≕ Kitchen Tools
| Pattern | Tool | Purpose |
|---------|------|---------|
| Factory | Cookie cutter | Consistent object creation |
| Builder | Sandwich maker | Complex object step-by-step |
| Singleton | Head chef | Single instance |
| Strategy | Interchangeable blades | Algorithm variation |
| Observer | Order bell | Event notification |
| Adapter | Plug converter | Interface compatibility |
| Decorator | Garnish | Add behavior transparently |
| Facade | Menu | Simplified interface |

---

## Using Analogies Effectively

### In Documentation
```markdown
## Caching Strategy

> **Analogy**: Think of our cache like a **pantry** in a restaurant kitchen.
> 
> - **Cache hit** = Ingredient already in pantry (fast)
> - **Cache miss** = Run to walk-in fridge (slower)  
> - **TTL** = Expiration date on ingredients
> - **LRU eviction** = Toss oldest unused items when pantry full
> 
> **Why this matters**: Just as a chef organizes the pantry for the day's menu,
> we configure cache keys and TTLs based on access patterns.
```

### In Code Comments
```typescript
// Event Loop Analogy: This is the "chef" - single threaded.
// Never block here (no waiting for oven).
// Use async I/O (set timer, continue cooking other orders).
async function handleRequest(req: Request) {
  // Good: Non-blocking (chef starts oven, serves next customer)
  const user = await db.getUser(req.userId);
  
  // Bad: Blocking (chef stares at oven) - DON'T DO THIS
  // const user = db.getUserSync(req.userId);
  
  return user;
}
```

### In Incident Communication
```markdown
## Incident: High Latency

**What happened**: Our "restaurant kitchen" (API servers) got overwhelmed.
The "head chef" (event loop) was blocked by a synchronous "oven wait" 
(database query without proper indexing) on the "popular dish" (checkout endpoint).

**Impact**: Customers (requests) waited 30s+ instead of 200ms.

**Fix**: Added database index (organized the pantry) so the "chef" 
doesn't wait. Also moved heavy computation to "prep station" (worker thread).
```

---

## Anti-Analogies (What NOT to Use)

| Avoid | Why | Better |
|-------|-----|--------|
| "Database is like Excel" | Misses concurrency, transactions, indexes | Library catalog |
| "API is like a waiter" | Too passive, misses contracts/versioning | Hotel concierge |
| "Microservices are like functions" | Misses network, failure modes, deployment | Independent restaurants |
| "Kubernetes is like Docker Compose" | Misses scheduling, self-healing, scaling | Fleet manager |
| "GraphQL is like SQL for APIs" | Misses over-fetching, N+1, caching | Flexible menu (order exactly what you want) |

---

## Output Format (for agent using this skill)
```
## Analogy Provided
- Concept: [Technical concept]
- Analogy: [Real-world mapping]
- Mapping Table: [Key correspondences]
- Boundaries: [Where analogy breaks]
- Predictive Insights: [What it helps reason about]
- Use Case: [Documentation / Teaching / Incident / Presentation]
```