---
description: Legacy Patterns - Strangler Fig, characterization tests, seams, CDK, anti-corruption layer. Safe legacy migration patterns.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Legacy Patterns - Safe Migration & Understanding Skill

## Purpose
Defines patterns for understanding and migrating legacy systems: Strangler Fig, characterization tests, seam identification, anti-corruption layers, and CDK (Consumer-Driven Contracts).

## When to Invoke
- Legacy system analysis (used by `archaeologist`, `towards`, `niamaia`)
- Migration planning
- Characterization test creation
- Risk assessment for legacy changes

---

## Strangler Fig Pattern (Default Migration Strategy)

### Core Principle
```
┌─────────────────────────────────────────────────────────────┐
│                    STRANGLER FIG                             │
├─────────────────────────────────────────────────────────────┤
│  Legacy System                    New System                │
│  ┌─────────────┐                 ┌─────────────┐            │
│  │  Module A   │ ◄─── Seam ───►  │  Module A'  │            │
│  │  Module B   │                 │  Module B'  │            │
│  │  Module C   │                 │             │            │
│  └─────────────┘                 └─────────────┘            │
│        ▲                              ▲                      │
│        │         Router / Facade       │                      │
│        └──────────────┬────────────────┘                      │
│                       ▼                                       │
│              ┌─────────────────┐                              │
│              │   Traffic       │                              │
│              │   Splitter      │                              │
│              │   (Feature      │                              │
│              │    Flags)       │                              │
│              └─────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// strangler-router.ts
interface Route {
  path: string;
  legacy: ServiceClient;
  modern: ServiceClient;
  percentage: number;  // 0-100% to modern
  canary?: boolean;
}

class StranglerRouter {
  private routes: Route[] = [];
  private metrics: MetricsCollector;
  
  addRoute(route: Route) {
    this.routes.push(route);
  }
  
  async route(request: Request): Promise<Response> {
    const route = this.matchRoute(request);
    if (!route) return this.legacy.handle(request);
    
    // Determine target
    const useModern = route.canary 
      ? this.isInCanary(request) 
      : Math.random() * 100 < route.percentage;
    
    const client = useModern ? route.modern : route.legacy;
    const startTime = Date.now();
    
    try {
      const response = await client.handle(request);
      this.metrics.record({ route: route.path, target: useModern ? 'modern' : 'legacy', latency: Date.now() - startTime, success: true });
      return response;
    } catch (error) {
      this.metrics.record({ route: route.path, target: useModern ? 'modern' : 'legacy', latency: Date.now() - startTime, success: false });
      
      // Fallback to legacy on modern failure
      if (useModern && route.percentage < 100) {
        return route.legacy.handle(request);
      }
      throw error;
    }
  }
}
```

### Migration Phases

```markdown
# Migration Plan: Legacy Monolith → Microservices

## Phase 0: Preparation (Week 1-2)
- [ ] Identify all seams (API endpoints, DB tables, message queues, file formats)
- [ ] Set up characterization test infrastructure
- [ ] Deploy Strangler Router (proxy) in front of legacy
- [ ] Implement feature flag system
- [ ] Establish monitoring/alerting for both systems

## Phase 1: Extract & Wrap (Week 3-6)
| Seam | Legacy Component | Extraction Approach | Anti-Corruption Layer | Feature Flag |
|------|------------------|---------------------|----------------------|--------------|
| /api/users | UserModule | New Users Service + DB sync | UserMapper (legacy ↔ new model) | users-service-v2 |
| /api/orders | OrderModule | New Orders Service + CDC | OrderTransformer | orders-service-v2 |
| /api/catalog | CatalogModule | Read-only replica → New service | CatalogAdapter | catalog-service-v2 |

## Phase 2: Incremental Replacement (Week 7-16)
| Slice | Legacy | New | Validation | Rollback |
|-------|--------|-----|------------|----------|
| User Read | UserModule.get() | UsersService.get() | Characterization tests + shadow traffic | Feature flag OFF |
| User Write | UserModule.save() | UsersService.save() | Dual-write + reconciliation | Feature flag OFF |
| Order Read | OrderModule.get() | OrdersService.get() | Characterization tests | Feature flag OFF |
| Order Write | OrderModule.create() | OrdersService.create() | Saga + compensation | Feature flag OFF |

## Phase 3: Cutover (Week 17-20)
- Canary: 10% → 50% → 100%
- Monitoring: Error rate, latency, data consistency
- Rollback trigger: Error rate > 1%, latency > 2x baseline, data mismatch
- Legacy decommission: After 30 days stable at 100%

## Timeline
| Week | Milestone | Owner | Risk |
|------|-----------|-------|------|
| 1-2 | Router deployed, flags ready | Platform | Low |
| 3-6 | 3 seams extracted | Teams | Medium (data sync) |
| 7-16 | Incremental replacement | Teams | High (dual-write bugs) |
| 17-20 | Full cutover | Platform | Medium (rollback) |
```

---

## Characterization Tests (Capture Current Behavior)

### Purpose
Tests that document what the legacy code **actually does** (not what it should do). Created BEFORE any changes.

### Generation Process

```typescript
// characterization/generator.ts
class CharacterizationTestGenerator {
  async generateForModule(modulePath: string): Promise<TestSuite> {
    // 1. Discover public API
    const exports = this.discoverExports(modulePath);
    
    // 2. Generate inputs (fuzzing + real data samples)
    const inputs = await this.generateInputs(exports);
    
    // 3. Capture outputs by running legacy code
    const results = await this.captureBehavior(exports, inputs);
    
    // 4. Generate test file
    return this.renderTests(modulePath, results);
  }
  
  private async captureBehavior(exports: Export[], inputs: Input[]): Promise<Behavior[]> {
    const behaviors: Behavior[] = [];
    
    for (const exp of exports) {
      for (const input of inputs[exp.name]) {
        try {
          const output = await this.executeLegacy(exp, input);
          behaviors.push({
            function: exp.name,
            input,
            output,
            timestamp: new Date(),
            // Include side effects: DB changes, events, external calls
            sideEffects: await this.captureSideEffects(exp, input),
          });
        } catch (error) {
          behaviors.push({
            function: exp.name,
            input,
            error: error.message,
            timestamp: new Date(),
          });
        }
      }
    }
    
    return behaviors;
  }
}
```

### Test Output Format

```typescript
// tests/characterization/user-module.test.ts
// AUTO-GENERATED - DO NOT EDIT MANUALLY
// Captures current behavior as of 2024-01-15
// Source: src/legacy/user-module.ts

describe('Characterization: UserModule', () => {
  const legacy = require('../../src/legacy/user-module');
  
  describe('getUserById', () => {
    it('returns user for valid ID', () => {
      // Observed behavior: returns user object with id, email, name, createdAt
      const result = legacy.getUserById('usr_abc123');
      expect(result).toEqual({
        id: 'usr_abc123',
        email: 'user@example.com',
        name: 'John Doe',
        createdAt: '2023-06-15T10:30:00.000Z',
      });
    });
    
    it('returns null for non-existent ID', () => {
      // Observed behavior: returns null (not throw)
      const result = legacy.getUserById('usr_nonexistent');
      expect(result).toBeNull();
    });
    
    it('throws for malformed ID', () => {
      // Observed behavior: throws ValidationError
      expect(() => legacy.getUserById('invalid-id')).toThrow('ValidationError');
    });
  });
  
  describe('createUser', () => {
    it('creates user and emits UserCreated event', async () => {
      const input = { email: 'new@test.com', name: 'New User' };
      const result = await legacy.createUser(input);
      
      // Observed: returns user with generated ID, emits event
      expect(result).toMatchObject({
        id: expect.stringMatching(/^usr_[a-z0-9]{16}$/),
        email: 'new@test.com',
        name: 'New User',
      });
      
      // Side effect: event emitted
      expect(eventBus.published).toContainEqual(
        expect.objectContaining({
          type: 'UserCreated',
          payload: expect.objectContaining({ email: 'new@test.com' }),
        })
      );
    });
  });
});
```

### Running Characterization Tests

```yaml
# .github/workflows/characterization.yml
name: Characterization Tests
on: [push, pull_request]
jobs:
  characterization:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Run Characterization Tests
        run: npm run test:characterization
      - name: Compare with Baseline
        run: |
          # Fail if behavior changed unexpectedly
          npx jest --testPathPattern=characterization --json > results.json
          node scripts/compare-baseline.js results.json
```

---

## Seam Identification

### Types of Seams

| Seam Type | Identification | Extraction Difficulty |
|-----------|----------------|----------------------|
| **API Endpoint** | Route definitions, controllers | Low (natural boundary) |
| **Database Table** | Schema, foreign keys, access patterns | Medium (data sync needed) |
| **Message Queue** | Topics, event types, consumers | Low (async, natural) |
| **File Format** | Import/export, config files | Low (serialization boundary) |
| **Shared Library** | Import statements, function calls | High (compile-time coupling) |
| **Global State** | Singletons, static variables, env vars | High (implicit coupling) |

### Seam Analysis Tool

```bash
# Find API seams
grep -r "app\.(get|post|put|delete|patch)" src/ --include="*.ts" | head -50

# Find DB seams
grep -r "repository\|findBy\|save\|delete" src/ --include="*.ts" | \
  grep -v test | sort | uniq -c | sort -rn

# Find message seams
grep -r "kafka\|rabbitmq\|publish\|subscribe\|emit" src/ --include="*.ts" | head -30

# Find shared library coupling
madge --circular src/
dependency-cruiser src/ --output-type dot | dot -Tpng > deps.png
```

---

## Anti-Corruption Layer (ACL)

```typescript
// acl/user-mapper.ts
// Translates between legacy and new domain models

interface LegacyUser {
  user_id: string;
  email_address: string;
  full_name: string;
  created_dt: string;
  status_cd: 'A' | 'I' | 'S';
  legacy_metadata: string; // JSON blob
}

interface NewUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  status: 'active' | 'inactive' | 'suspended';
  metadata: Record<string, any>;
}

class UserAntiCorruptionLayer {
  toNew(legacy: LegacyUser): NewUser {
    return {
      id: legacy.user_id,
      email: legacy.email_address.toLowerCase(),
      name: legacy.full_name.trim(),
      createdAt: new Date(legacy.created_dt),
      status: this.mapStatus(legacy.status_cd),
      metadata: this.parseMetadata(legacy.legacy_metadata),
    };
  }
  
  toLegacy(newUser: NewUser): LegacyUser {
    return {
      user_id: newUser.id,
      email_address: newUser.email,
      full_name: newUser.name,
      created_dt: newUser.createdAt.toISOString(),
      status_cd: this.mapStatusReverse(newUser.status),
      legacy_metadata: JSON.stringify(newUser.metadata),
    };
  }
  
  private mapStatus(cd: string): NewUser['status'] {
    switch (cd) {
      case 'A': return 'active';
      case 'I': return 'inactive';
      case 'S': return 'suspended';
      default: return 'inactive';
    }
  }
  
  private mapStatusReverse(status: NewUser['status']): LegacyUser['status_cd'] {
    switch (status) {
      case 'active': return 'A';
      case 'inactive': return 'I';
      case 'suspended': return 'S';
    }
  }
  
  private parseMetadata(blob: string): Record<string, any> {
    try { return JSON.parse(blob); } catch { return {}; }
  }
}
```

### ACL Usage in Strangler Router

```typescript
// strangler-router.ts (with ACL)
async function route(request: Request): Promise<Response> {
  const route = this.matchRoute(request);
  const useModern = this.shouldUseModern(route, request);
  
  if (useModern) {
    try {
      // Transform request to new model
      const newRequest = this.acl.transformRequest(route.path, request);
      const newResponse = await route.modern.handle(newRequest);
      // Transform response back to legacy format
      return this.acl.transformResponse(route.path, newResponse);
    } catch (error) {
      // Fallback with legacy format request
      return route.legacy.handle(request);
    }
  }
  
  return route.legacy.handle(request);
}
```

---

## Data Synchronization Strategies

### 1. Dual Write (Write to Both)
```typescript
async function saveUser(user: NewUser): Promise<void> {
  await Promise.all([
    newDb.users.save(user),
    legacyDb.users.save(acl.toLegacy(user)), // Best effort
  ]);
}
```

### 2. Change Data Capture (CDC) - Recommended
```yaml
# Debezium connector for PostgreSQL
{
  "name": "legacy-users-cdc",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "legacy-db",
    "database.port": "5432",
    "database.user": "cdc_user",
    "database.password": "${SECRET}",
    "database.dbname": "legacy",
    "table.include.list": "public.users",
    "publication.name": "legacy_cdc",
    "slot.name": "legacy_users_slot",
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.drop.tombstones": "false"
  }
}
```

### 3. Batch Reconciliation (Nightly)
```typescript
// reconciliation/jobs/user-reconcile.ts
async function reconcileUsers(): Promise<ReconciliationReport> {
  const legacyUsers = await legacyDb.users.findAll();
  const newUsers = await newDb.users.findAll();
  
  const mismatches: Mismatch[] = [];
  
  for (const legacy of legacyUsers) {
    const newUser = newUsers.find(u => u.id === legacy.user_id);
    if (!newUser) {
      mismatches.push({ type: 'MISSING_IN_NEW', legacy, new: null });
    } else if (!acl.equals(legacy, newUser)) {
      mismatches.push({ type: 'DATA_MISMATCH', legacy, new: newUser });
    }
  }
  
  // Auto-fix: create missing, update mismatched (with audit)
  for (const mismatch of mismatches) {
    if (mismatch.type === 'MISSING_IN_NEW') {
      await newDb.users.save(acl.toNew(mismatch.legacy));
    } else {
      await newDb.users.save(acl.toNew(mismatch.legacy)); // Legacy wins for now
    }
  }
  
  return { totalLegacy: legacyUsers.length, totalNew: newUsers.length, mismatches: mismatches.length };
}
```

---

## Risk Assessment Matrix

| Risk | Likelihood | Impact | Detection | Mitigation |
|------|------------|--------|-----------|------------|
| Data loss during migration | Medium | Critical | Reconciliation job alerts | CDC + dual-write + nightly reconcile |
| Behavioral drift | High | High | Characterization test failures | Run characterization tests on every deploy |
| Performance regression | Medium | High | Load test + profiling | Shadow traffic + canary metrics |
| Dual-write inconsistency | High | Critical | Data diff reports | Idempotent writes + reconciliation |
| Feature flag leak | Low | High | Flag audit | Centralized flag management + audit log |
| Rollback data corruption | Low | Critical | Pre-rollback snapshot | Point-in-time recovery tested |

---

## Output Format (for agent using this skill)
```
## Legacy Analysis / Migration Plan
- System: [name]
- Seams Identified: [count] - [list with types]
- Characterization Tests: [generated: X, passing: Y]
- Migration Strategy: [Strangler Fig / Big Bang / Hybrid]
- Phases: [count] - [timeline]
- ACLs Needed: [count] - [domains]
- Data Sync: [CDC / Dual-write / Batch]
- Key Risks: [top 3 with mitigations]
- Rollback Plan: [documented and tested]
```