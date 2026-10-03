---
description: Clean Code Patterns - SOLID, DRY/KISS/YAGNI, naming, functions, error handling, dependency injection, TypeScript strict. Universal code quality standards.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Clean Code Patterns - Universal Code Quality Skill

## Purpose
Enforces universal clean code standards across all languages (TypeScript, Python, Go). Used by ALL engineers for writing, reviewing, and refactoring code.

## When to Invoke
- Writing new code (all agents)
- Code review (used by `tranquilao`, `towards`, `turing`, `qualy`)
- Refactoring legacy code (used by `archaeologist`, `towards`)
- Onboarding (used by `guanabara`)

---

## SOLID Principles (Enforced)

### S - Single Responsibility
```typescript
// ❌ BAD: UserService handles auth, profile, notifications, billing
class UserService {
  async login() {}
  async updateProfile() {}
  async sendNotification() {}
  async chargeCreditCard() {}
}

// ✅ GOOD: Each class has ONE reason to change
class AuthService { async login() {} }
class ProfileService { async updateProfile() {} }
class NotificationService { async send() {} }
class BillingService { async charge() {} }
```

### O - Open/Closed
```typescript
// ❌ BAD: Modify existing code for new payment methods
function processPayment(type: string, amount: number) {
  if (type === 'card') { /* card logic */ }
  else if (type === 'pix') { /* pix logic */ }
  // Adding crypto requires modifying this function
}

// ✅ GOOD: Extend via abstraction
interface PaymentProcessor { process(amount: number): Promise<Result>; }
class CardProcessor implements PaymentProcessor { /* ... */ }
class PixProcessor implements PaymentProcessor { /* ... */ }
// New CryptoProcessor added WITHOUT touching existing code
```

### L - Liskov Substitution
```typescript
// ❌ BAD: Subtype breaks contract
class Bird { fly() {} }
class Penguin extends Bird { fly() { throw new Error("Can't fly") } }

// ✅ GOOD: Behavioral subtyping
interface Flyable { fly(): void }
class Eagle implements Flyable { fly() {} }
class Penguin { swim() {} } // No Flyable - correct!
```

### I - Interface Segregation
```typescript
// ❌ BAD: Fat interface forces unused methods
interface UserRepository {
  findById(id: string): User;
  findByEmail(email: string): User;
  save(user: User): void;
  delete(id: string): void;
  sendWelcomeEmail(user: User): void; // Not all implementers need this
  generateReport(): Report;           // Not all implementers need this
}

// ✅ GOOD: Small, focused interfaces
interface UserReader { findById(id: string): User; findByEmail(email: string): User; }
interface UserWriter { save(user: User): void; delete(id: string): void; }
interface UserNotifier { sendWelcomeEmail(user: User): void; }
interface UserReporter { generateReport(): Report; }
```

### D - Dependency Inversion
```typescript
// ❌ BAD: High-level depends on low-level concrete
class OrderService {
  private db = new PostgreSQLDatabase(); // Concrete dependency
  async createOrder() { this.db.save(...) }
}

// ✅ GOOD: Both depend on abstraction
interface Database { save(entity: any): Promise<void>; }
class OrderService {
  constructor(private db: Database) {} // Injected abstraction
  async createOrder() { await this.db.save(...) }
}
// PostgreSQLDatabase implements Database - provided at composition root
```

---

## DRY / KISS / YAGNI

### DRY (Don't Repeat Yourself) - With Nuance
```typescript
// ❌ WRONG: Premature abstraction (different reasons to change)
function formatUserName(user: User) { return `${user.first} ${user.last}`; }
function formatCompanyName(company: Company) { return `${company.name} Inc.`; }
// These LOOK similar but change for DIFFERENT reasons

// ✅ GOOD: Abstract when SAME reason to change
function formatCurrency(amount: number, currency: Currency) { /* ... */ } // Single source of truth
```

### KISS (Keep It Simple, Stupid)
```typescript
// ❌ OVER-ENGINEERED
class ConfigManager {
  private configs = new Map<string, ConfigSchema>();
  register(schema: ConfigSchema) { /* validation, transformation, caching */ }
  get<T>(key: string): T { /* complex lookup with fallbacks */ }
}

// ✅ SIMPLE
const config = {
  dbUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL!,
  jwtSecret: process.env.JWT_SECRET!,
} as const;
```

### YAGNI (You Aren't Gonna Need It)
```typescript
// ❌ BAD: Building for hypothetical future
class UserRepository {
  async findById(id: string) {}
  async findByEmail(email: string) {}
  async findByPhone(phone: string) {}  // Not needed yet
  async findBySocialSecurity(ssn: string) {} // Not needed yet
  async findByPreferences(prefs: Preferences) {} // Not needed yet
}

// ✅ GOOD: Only what's needed NOW
class UserRepository {
  async findById(id: string) {}
  async findByEmail(email: string) {}
  // Add findByPhone when feature requires it
}
```

---

## Naming Conventions (Universal)

| Type | Convention | Example |
|------|------------|---------|
| **Variables/Functions** | camelCase | `getUserById`, `maxRetryCount` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT` |
| **Types/Interfaces** | PascalCase | `User`, `PaymentRequest`, `Result` |
| **Classes** | PascalCase | `UserService`, `PaymentProcessor` |
| **Enums** | PascalCase (singular) | `OrderStatus`, `PaymentMethod` |
| **Enum values** | UPPER_SNAKE_CASE | `PENDING`, `COMPLETED`, `FAILED` |
| **Files** | kebab-case | `user-service.ts`, `payment-processor.ts` |
| **Test files** | `*.test.ts` / `*.spec.ts` | `user-service.test.ts` |

### Naming Rules
- **Verbs for functions**: `get`, `fetch`, `calculate`, `validate`, `transform`, `create`, `update`, `delete`
- **Nouns for types**: `User`, `Payment`, `Order`, `Result`
- **Booleans**: `is`, `has`, `can`, `should`, `will` prefix (`isActive`, `hasPermission`, `canEdit`)
- **Avoid**: `data`, `info`, `obj`, `item`, `entity`, `manager`, `handler`, `util`, `helper` (meaningless)

---

## Function Design

### Small, Focused, Pure When Possible
```typescript
// ❌ BAD: 50 lines, multiple responsibilities
async function processOrder(orderId: string) {
  const order = await db.orders.find(orderId);
  const user = await db.users.find(order.userId);
  const payment = await paymentGateway.charge(user.cardToken, order.total);
  await db.orders.update(orderId, { status: 'paid', paymentId: payment.id });
  await emailService.sendReceipt(user.email, order);
  await inventoryService.reserve(order.items);
  await analytics.track('order_completed', { orderId, userId: user.id });
}

// ✅ GOOD: Composed from small functions
async function processOrder(orderId: string): Promise<Result<Order, OrderError>> {
  const order = await getOrderOrFail(orderId);
  const user = await getUserOrFail(order.userId);
  const payment = await chargePayment(user, order.total);
  await recordPayment(orderId, payment.id);
  await sendReceipt(user.email, order);
  await reserveInventory(order.items);
  await trackOrderCompletion(orderId, user.id);
  return ok(order);
}
```

### Parameters
- **Max 3 parameters** (use object/options pattern beyond that)
- **No boolean flags** (split into two functions)
- **No output parameters** (return values)

```typescript
// ❌ BAD
function createUser(name: string, email: string, isAdmin: boolean, sendWelcome: boolean) {}

// ✅ GOOD
interface CreateUserInput { name: string; email: string; role: 'user' | 'admin'; }
function createUser(input: CreateUserInput): Promise<User> {}
function createUserAndWelcome(input: CreateUserInput): Promise<User> {}
```

---

## Error Handling: Result Types (No Throwing for Expected Errors)

```typescript
// Shared result type (use everywhere)
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// Helper
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Usage
async function findUserById(id: string): Promise<Result<User, UserNotFoundError>> {
  const user = await db.users.find(id);
  if (!user) return err(new UserNotFoundError(id));
  return ok(user);
}

// Caller handles explicitly
const result = await findUserById('123');
if (!result.ok) {
  if (result.error instanceof UserNotFoundError) { /* handle */ }
  return;
}
const user = result.value; // TypeScript knows user exists
```

### When to Throw (Exceptional Only)
- Programming bugs (null dereference, index out of bounds)
- Infrastructure failures (DB connection lost, network partition)
- Panic/unrecoverable states

### Never
- Validation failures (return Result)
- Business rule violations (return Result)
- Not found (return Result)
- Expected API errors (return Result)

---

## TypeScript Strict Mode (Non-Negotiable)

```json
// tsconfig.json - Required settings
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### `any` Ban (Only with Justification Comment)
```typescript
// ❌ FORBIDDEN
const data: any = JSON.parse(response);

// ✅ ALLOWED with justification
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyData: any = JSON.parse(response); // TODO: Replace with schema validation (ADR-042)
const typedData = LegacySchema.parse(legacyData);
```

---

## Dependency Injection Pattern (Factory Functions)

```typescript
// ❌ NO public constructors for services
class UserService {
  constructor(private db: Database, private email: EmailService) {}
}

// ✅ Factory pattern
interface UserServiceDeps {
  db: Database;
  email: EmailService;
  config: Config;
}

function createUserService(deps: UserServiceDeps) {
  return {
    async findById(id: string) { /* ... */ },
    async create(input: CreateUserInput) { /* ... */ },
    async update(id: string, input: UpdateUserInput) { /* ... */ },
  };
}

type UserService = ReturnType<typeof createUserService>;

// Composition root (main.ts / app.ts)
const userService = createUserService({
  db: createDatabase(config.dbUrl),
  email: createEmailService(config.email),
  config,
});
```

---

## Code Review Checklist (Clean Code Lens)

| Category | Checks |
|----------|--------|
| **SOLID** | Single responsibility? Open for extension? Liskov respected? Interfaces segregated? Dependencies inverted? |
| **Naming** | Verbs for functions? Nouns for types? Boolean prefixes? No meaningless names? |
| **Functions** | < 20 lines? < 3 params? No boolean flags? Pure when possible? |
| **Errors** | Result types for expected errors? No throwing for validation? Exhaustive handling? |
| **TypeScript** | Zero `any` without comment? Strict mode passes? No `@ts-ignore`? |
| **DI** | Factory functions? No public constructors? Abstractions injected? |
| **DRY/KISS/YAGNI** | No premature abstraction? Simple over clever? No speculative code? |

---

## Output Format (for agent using this skill)
```
## Clean Code Review
- Files reviewed: [list]
- SOLID violations: [count] - [details]
- Naming issues: [count] - [details]
- Function design: [issues]
- Error handling: [Result usage, throwing patterns]
- TypeScript: [any usage, strict violations]
- DI pattern: [factory usage, constructor violations]
- Recommendations: [top 3 priority fixes]
```