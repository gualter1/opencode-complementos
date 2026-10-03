---
description: Testing Strategies - Test pyramid, unit/integration/E2E, contract testing, property-based testing, test data builders, mutation testing. Quality engineering approach.
mode: subagent
model: 9router/Turing
skills:
  - context-mode
---

{reasoning effort: high}

# Testing Strategies - Quality Engineering Skill

## Purpose
Defines comprehensive testing strategy: pyramid, contract testing, property-based testing, test data management, mutation testing. Used by `qualy` (primary), `towards`, `turing`, `tranquilao`, `data-engineer`, `mobile-engineer`.

## When to Invoke
- Designing test plan for new feature
- Setting up test infrastructure
- Fixing flaky tests
- Improving coverage quality (not just quantity)
- Code review of test code

---

## Test Pyramid (Inverted for CI)

```
                    ████████████████  E2E (10-20 critical journeys)
                  ████████████████████  Contract (consumer-driven)
                ████████████████████████  Integration (Testcontainers)
              ████████████████████████████  Unit (80%+ business logic)
```

### Layer Targets

| Layer | Coverage | Speed | Tool | Runs On |
|-------|----------|-------|------|---------|
| **Unit** | 80%+ line, 70%+ branch | <1s/test | Vitest/Jest | Every PR |
| **Integration** | Contracts, DB, external APIs | 10-30s | Vitest + Testcontainers | Every PR |
| **Contract** | Consumer-provider boundaries | 5-10s | Pact / Schemathesis | PR + nightly |
| **E2E** | 10-20 critical journeys | 1-3 min | Playwright | Merge/main + nightly |
| **Performance** | Baselines per PR | 2-5 min | k6 | PR (smoke) + nightly (full) |
| **Chaos** | Monthly / pre-release | 10-30 min | LitmusChaos | Scheduled |
| **Visual** | Component stories + critical pages | 30-60s | Playwright + Percy | PR (changed) |
| **Mutation** | > 60% core domain | 5-10 min | Stryker | CI (core) |

---

## Unit Testing (Vitest)

```typescript
// tests/unit/pricing/calculate-discount.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDiscount } from '@/features/pricing/discount';
import { faker } from '@faker-js/faker';

describe('calculateDiscount', () => {
  it('applies percentage discount correctly', () => {
    const price = faker.number.int({ min: 100, max: 10000 });
    const discount = faker.number.int({ min: 1, max: 50 });
    const result = calculateDiscount(price, { type: 'percentage', value: discount });
    expect(result).toBe(price * (1 - discount / 100));
  });

  it('applies fixed amount discount correctly', () => {
    const price = faker.number.int({ min: 1000, max: 10000 });
    const discount = faker.number.int({ min: 50, max: 500 });
    const result = calculateDiscount(price, { type: 'fixed', value: discount });
    expect(result).toBe(price - discount);
  });

  it('caps discount at price (never negative)', () => {
    const price = 100;
    const result = calculateDiscount(price, { type: 'fixed', value: 200 });
    expect(result).toBe(0);
  });

  it('throws on invalid discount type', () => {
    expect(() => calculateDiscount(100, { type: 'invalid' as any, value: 10 }))
      .toThrow('Unknown discount type');
  });
});
```

### Unit Test Rules
- **Pure functions only** (no DB, network, filesystem)
- **Fast**: < 1ms per test typical
- **Deterministic**: Same input → same output
- **Test behavior, not implementation**
- **Faker for test data** (not hardcoded values)

---

## Integration Testing (Testcontainers - Real Dependencies)

```typescript
// tests/integration/user-repository.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { createDatabase, runMigrations } from '@/infrastructure/database';
import { createUserRepository } from '@/features/user/repository';
import { User } from '@/features/user/types';

describe('UserRepository (integration)', () => {
  let container: PostgreSqlContainer;
  let db: Database;
  let repo: UserRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = createDatabase(container.getConnectionUri());
    await runMigrations(db);
    repo = createUserRepository(db);
  });

  afterAll(async () => {
    await container.stop();
  });

  it('saves and finds user by email', async () => {
    const user: User = { id: '1', email: 'test@example.com', name: 'Test User' };
    await repo.save(user);
    const found = await repo.findByEmail('test@example.com');
    expect(found).toEqual(user);
  });

  it('enforces unique email constraint', async () => {
    const user: User = { id: '1', email: 'unique@test.com', name: 'User 1' };
    await repo.save(user);
    await expect(repo.save({ id: '2', email: 'unique@test.com', name: 'User 2' }))
      .rejects.toThrow('unique constraint');
  });
});
```

### Integration Test Rules
- **Testcontainers for ALL external deps**: PostgreSQL, Redis, Kafka, LocalStack, MinIO
- **NO mocks for infrastructure** (DB, cache, message queue)
- **Mock ONLY third-party APIs without test environment** (Stripe, SendGrid, external SaaS)
- **Real schemas, real constraints, real indexes**
- **Parallel-safe**: Unique test data per test (UUID, random suffix)

---

## Contract Testing (Pact - Consumer Driven)

```typescript
// tests/contract/user-api.consumer.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { UserApiClient } from '@/features/user/api-client';

const { like, eachLike, term } = MatchersV3;

describe('User API Consumer Contract', () => {
  const provider = new PactV3({
    consumer: 'web-frontend',
    provider: 'user-service',
    dir: './pacts',
  });

  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());

  it('returns user by ID', async () => {
    await provider.addInteraction({
      state: 'user with ID 123 exists',
      uponReceiving: 'a request for user 123',
      withRequest: {
        method: 'GET',
        path: '/api/users/123',
        headers: { 'Accept': 'application/json' },
      },
      willRespondWith: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: like({
          id: '123',
          email: like('user@example.com'),
          name: like('John Doe'),
          createdAt: term({ matcher: 'iso8601', generate: '2024-01-15T10:30:00Z' }),
        }),
      },
    });

    const client = new UserApiClient(provider.mockServer.url);
    const user = await client.getUser('123');
    expect(user.id).toBe('123');
    expect(user.email).toContain('@');
  });
});
```

```typescript
// tests/contract/user-api.provider.test.ts (Provider verification)
import { describe, it } from 'vitest';
import { Verifier } from '@pact-foundation/pact';
import { createApp } from '@/app';
import { createTestDatabase } from '@/test/db';

describe('User API Provider Contract Verification', () => {
  it('verifies all consumer contracts', async () => {
    const app = createApp({ db: createTestDatabase() });
    const server = app.listen(0);
    const port = server.address().port;

    const verifier = new Verifier({
      providerBaseUrl: `http://localhost:${port}`,
      pactBrokerUrl: process.env.PACT_BROKER_URL,
      providerVersion: process.env.GIT_SHA,
      publishVerificationResult: true,
    });

    await verifier.verifyProvider();
    server.close();
  });
});
```

### Contract Testing Rules
- **MANDATORY for service-to-service communication**
- **Consumer writes contract, provider verifies**
- **Pact Broker for versioning and can-i-deploy**
- **Bi-directional: Schemathesis for OpenAPI fuzzing**

---

## Property-Based Testing (fast-check)

```typescript
// tests/property/pricing/calculate-total.property.test.ts
import { describe, it } from 'vitest';
import { fc, testProperty } from '@fast-check/vitest';
import { calculateOrderTotal } from '@/features/pricing/total';

describe('calculateOrderTotal properties', () => {
  testProperty('total is sum of item totals', fc.array(fc.record({
    price: fc.nat({ max: 10000 }),
    quantity: fc.nat({ max: 100 }),
  }), { minLength: 1, maxLength: 50 }), (items) => {
    const total = calculateOrderTotal(items);
    const expected = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    expect(total).toBe(expected);
  });

  testProperty('empty order returns zero', fc.constant([]), (items) => {
    expect(calculateOrderTotal(items)).toBe(0);
  });

  testProperty('discount never exceeds subtotal', 
    fc.record({
      items: fc.array(fc.record({ price: fc.nat(10000), quantity: fc.nat(10) }), { minLength: 1 }),
      discount: fc.nat(100000),
    }),
    ({ items, discount }) => {
      const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const total = calculateOrderTotal(items, { type: 'fixed', value: discount });
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(subtotal);
    }
  );
});
```

---

## Test Data Builders (Factory Pattern)

```typescript
// test/factories/user.factory.ts
import { faker } from '@faker-js/faker';
import { User, UserRole } from '@/features/user/types';

export class UserBuilder {
  private data: User = {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: 'user' as UserRole,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  withId(id: string) { this.data.id = id; return this; }
  withEmail(email: string) { this.data.email = email; return this; }
  withName(name: string) { this.data.name = name; return this; }
  withRole(role: UserRole) { this.data.role = role; return this; }
  withCreatedAt(date: Date) { this.data.createdAt = date; return this; }
  
  build(): User { return { ...this.data }; }
  buildPartial(): Partial<User> { return { ...this.data }; }

  static admin(): UserBuilder {
    return new UserBuilder().withRole('admin');
  }
  
  static premium(): UserBuilder {
    return new UserBuilder().withRole('premium');
  }
}

// Usage
const adminUser = UserBuilder.admin().withEmail('admin@test.com').build();
const randomUser = new UserBuilder().build();
```

---

## Mutation Testing (Stryker)

```json
// stryker.conf.json
{
  "$schema": "https://stryker-mutator.io/schema/stryker-schema.json",
  "mutator": "typescript",
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "thresholds": { "high": 80, "low": 60, "break": 60 },
  "mutations": {
    "excludedMutations": ["StringLiteral", "Regex"]
  },
  "reporters": ["html", "clear-text", "progress"],
  "tsconfigFile": "tsconfig.json"
}
```

```bash
# Run mutation testing
npx stryker run
# Target: > 60% mutation score on core domain logic
```

---

## Flakiness Protocol

```typescript
// vitest.config.ts - Flakiness detection
export default defineConfig({
  test: {
    retry: 2,                    // Retry failed tests 2x
    poolOptions: { threads: { singleThread: false } },
    // Custom reporter to track flakiness
    reporters: ['default', ['vitest-flakiness-reporter', { threshold: 0.05 }]],
  },
});
```

**Zero Tolerance Policy:**
1. Auto-quarantine after 2 failures in 10 runs (`@flaky` tag)
2. Root cause analysis in 48h by `qualy`
3. Fix or DELETE in 2 weeks
4. Flaky tests NEVER block merge (but tracked in dashboard)

---

## Dify-Specific Patterns

```typescript
// Backend: api/ uses SQLAlchemy + Testcontainers PostgreSQL
// uv run --project api pytest

// Frontend: web/ uses Vitest + React Testing Library
// packages/dify-ui/ uses Storybook + Vitest

// E2E: e2e/ uses Cucumber + Playwright
// e2e/AGENTS.md owns suite architecture, tags, fixtures, cleanup

// Generated contracts: oRPC/OpenAPI → Schemathesis fuzzing, Pact consumer-driven

// Multi-tenant: test data isolation via tenant_id scoping at ALL levels
```

---

## Output Format (for agent using this skill)
```
## Test Strategy - [Feature]
- Unit: [what, coverage target, key scenarios]
- Integration: [what, Testcontainers setup, DB/contracts]
- Contract: [consumer/provider, Pact file location]
- E2E: [critical journey, Playwright spec, tags]
- Performance: [k6 script, baseline metrics]
- Chaos: [scenario, hypothesis]
- Mutation: [target score, core files]
- CI Pipeline: [jobs, parallelization, thresholds]
- Risks/Gaps: [what's not covered and why]
```