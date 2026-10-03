---
description: Architecture Patterns - C4 modeling, communication patterns, data patterns, deployment patterns, tech radar. System design patterns and decision-making frameworks.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Architecture Patterns - System Design Patterns Skill

## Purpose
Defines architectural patterns for system design: C4 modeling, communication patterns (sync/async), data patterns, deployment patterns, and technology radar for decision-making.

## When to Invoke
- Designing new systems (used by `niamaia`, `trevor`, `towards`, `turing`, `data-engineer`)
- Architecture reviews
- Technology evaluation
- Creating ADRs
- Migration planning (used by `archaeologist`)

---

## C4 Modeling (Structurizr DSL)

### Level 1: Context Diagram
```dsl
// docs/architecture/context.dsl
workspace "E-Commerce Platform" "Context diagram" {
  model {
    customer = person "Customer" "Browses products, places orders, manages account"
    admin = person "Admin" "Manages catalog, orders, users"
    
    ecommerce = softwareSystem "E-Commerce Platform" "Core platform handling catalog, orders, payments, users" {
      web = container "Web App" "React/Next.js" "Customer-facing storefront"
      api = container "API Gateway" "Kong" "Routes requests, auth, rate limiting"
      catalog = container "Catalog Service" "Go" "Product catalog, search, categories"
      orders = container "Orders Service" "Python/FastAPI" "Order lifecycle, payments"
      users = container "Users Service" "TypeScript/Node" "Authentication, profiles, tenant"
      payments = container "Payments Service" "Java/Spring" "Payment processing, refunds"
      notifications = container "Notifications Service" "Go" "Email, push, SMS, webhooks"
    }
    
    postgres = containerDb "PostgreSQL" "Primary database" "Users, orders, catalog"
    redis = containerDb "Redis" "Cache, sessions, queues" "Ephemeral data"
    kafka = container "Kafka" "Event streaming" "Inter-service communication"
    
    stripe = softwareSystem "Stripe" "Payment processing" "External"
    sendgrid = softwareSystem "SendGrid" "Email delivery" "External"
    firebase = softwareSystem "Firebase" "Push notifications" "External"
  }
  
  views {
    systemContext "Context" "System context diagram" {
      include *
      autoLayout
    }
  }
}
```

### Level 2: Container Diagram
```dsl
// docs/architecture/containers.dsl
views {
  container "Containers" "Container diagram" {
    include ecommerce, postgres, redis, kafka, stripe, sendgrid, firebase
    autoLayout
  }
}
```

### Level 3: Component Diagram (per service)
```dsl
// docs/architecture/orders-components.dsl
model {
  orders = container "Orders Service" {
    controller = component "OrdersController" "FastAPI" "HTTP endpoints"
    service = component "OrderService" "Python" "Business logic"
    repo = component "OrderRepository" "SQLAlchemy" "Data access"
    publisher = component "EventPublisher" "Kafka" "Event emission"
    client = component "PaymentClient" "HTTP" "Calls Payments Service"
    client2 = component "InventoryClient" "HTTP" "Calls Inventory Service"
  }
}

views {
  component "OrdersComponents" "Orders Service components" {
    include orders.*
    autoLayout
  }
}
```

### Level 4: Code Diagram (auto-generated)
```bash
# Generate from code
structurizr export -workspace docs/architecture/workspace.dsl -format plantuml
```

---

## Communication Patterns

### Synchronous (Request-Response)
```typescript
// Use for: Queries, commands requiring immediate consistency, user-facing operations
// Protocol: REST (OpenAPI), gRPC, tRPC, oRPC

// tRPC Example (Type-safe end-to-end)
export const appRouter = createTRPCRouter({
  orders: createTRPCRouter({
    create: protectedProcedure
      .input(createOrderSchema)
      .mutation(async ({ ctx, input }) => {
        return await ctx.orderService.createOrder(ctx.user.id, input);
      }),
    getById: protectedProcedure
      .input(z.string().uuid())
      .query(async ({ ctx, input }) => {
        return await ctx.orderService.getOrder(ctx.user.id, input);
      }),
  }),
});

// Client usage (fully typed)
const order = await trpc.orders.create.mutate({ items: [...], shippingAddress: ... });
```

### Asynchronous (Event-Driven)
```typescript
// Use for: Notifications, audit logs, analytics, cross-service workflows, eventual consistency
// Protocol: Kafka, Redis Streams, NATS, CloudEvents

// Event Definition (CloudEvents spec)
interface OrderCreatedEvent {
  specversion: "1.0";
  id: string; // UUID
  source: "orders-service";
  type: "com.company.orders.created";
  time: string; // ISO8601
  datacontenttype: "application/json";
  data: {
    orderId: string;
    userId: string;
    tenantId: string;
    items: OrderItem[];
    total: number;
    currency: string;
  };
}

// Producer
class OrderService {
  async createOrder(input: CreateOrderInput): Promise<Order> {
    const order = await this.repo.save(order);
    
    // Emit event (outbox pattern for reliability)
    await this.outbox.save({
      eventType: 'OrderCreated',
      payload: orderToEvent(order),
      metadata: { tenantId: order.tenantId },
    });
    
    return order;
  }
}

// Consumer (idempotent)
class NotificationService {
  @KafkaListener('orders.created')
  async handleOrderCreated(event: OrderCreatedEvent) {
    const idempotencyKey = `order-created-${event.id}`;
    
    // Idempotency check
    if (await this.processedEvents.exists(idempotencyKey)) return;
    
    await this.sendOrderConfirmation(event.data.userId, event.data.orderId);
    await this.processedEvents.mark(idempotencyKey);
  }
}
```

### Saga Pattern (Distributed Transactions)
```typescript
// Orchestration-based saga for order placement
class PlaceOrderSaga {
  constructor(
    private orders: OrderService,
    private payments: PaymentClient,
    private inventory: InventoryClient,
    private notifications: NotificationClient,
    private outbox: Outbox,
  ) {}

  async execute(input: PlaceOrderInput): Promise<Result<Order, SagaError>> {
    const sagaId = ulid();
    const compensations: Compensation[] = [];

    try {
      // Step 1: Reserve inventory
      const reservation = await this.inventory.reserve(input.items);
      compensations.push(() => this.inventory.release(reservation.id));

      // Step 2: Process payment
      const payment = await this.payments.charge(input.paymentMethod, input.total);
      compensations.push(() => this.payments.refund(payment.id));

      // Step 3: Create order
      const order = await this.orders.create({
        ...input,
        paymentId: payment.id,
        reservationId: reservation.id,
      });

      // Step 4: Confirm inventory (convert reservation to allocation)
      await this.inventory.confirm(reservation.id);

      // Step 5: Emit events
      await this.outbox.saveAll([
        { eventType: 'OrderPlaced', payload: order },
        { eventType: 'PaymentCaptured', payload: payment },
      ]);

      return ok(order);
    } catch (error) {
      // Execute compensations in reverse order
      for (const compensate of compensations.reverse()) {
        try { await compensate(); } catch { /* log, alert, manual intervention */ }
      }
      return err(new SagaError(error.message, sagaId));
    }
  }
}
```

---

## Data Patterns

### Database per Service (Polyglot Persistence)
```yaml
# Each service owns its data
services:
  users:
    database: PostgreSQL
    schema: users_schema
    tables: [users, tenants, roles, sessions]
    access: ONLY users-service
  
  catalog:
    database: PostgreSQL + Elasticsearch
    schema: catalog_schema
    tables: [products, categories, attributes]
    search: Elasticsearch (synced via CDC)
    access: ONLY catalog-service
  
  orders:
    database: PostgreSQL
    schema: orders_schema
    tables: [orders, order_items, shipments, returns]
    access: ONLY orders-service
  
  payments:
    database: PostgreSQL (PCI DSS compliant)
    schema: payments_schema
    tables: [transactions, refunds, payment_methods, webhooks]
    access: ONLY payments-service
```

### Multi-Tenant Data Isolation
```sql
-- Row Level Security (RLS) - PostgreSQL
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Application sets tenant context per request
SET app.current_tenant_id = 'tenant-uuid-here';
```

### CQRS (Command Query Responsibility Segregation)
```typescript
// Write Model (Commands)
class OrderCommandHandler {
  async handle(command: PlaceOrderCommand): Promise<void> {
    const order = Order.create(command);
    await this.orderRepository.save(order);
    await this.eventBus.publish(new OrderPlacedEvent(order));
  }
}

// Read Model (Queries) - Optimized for reads
class OrderReadModel {
  @MaterializedView('order_summary')
  async getOrderSummary(userId: string): Promise<OrderSummary[]> {
    return this.readDb.query(`
      SELECT o.id, o.status, o.total, o.currency, o.created_at,
             COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [userId]);
  }
}

// Event handler updates read model
class OrderEventHandler {
  async handle(event: OrderPlacedEvent): Promise<void> {
    await this.readDb.execute(`
      INSERT INTO order_summary (id, user_id, status, total, currency, item_count, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [event.orderId, event.userId, 'placed', event.total, event.currency, event.items.length, event.timestamp]);
  }
}
```

### Event Sourcing
```typescript
// Aggregate stores state as event sequence
class OrderAggregate {
  private events: Event[] = [];
  private state: OrderState;

  static fromEvents(events: Event[]): OrderAggregate {
    const aggregate = new OrderAggregate();
    events.forEach(e => aggregate.apply(e));
    return aggregate;
  }

  placeOrder(input: PlaceOrderInput): void {
    if (this.state.status !== 'draft') throw new Error('Order already placed');
    this.emit(new OrderPlacedEvent({ ...input, orderId: ulid() }));
  }

  addItem(item: OrderItem): void {
    if (this.state.status !== 'draft') throw new Error('Cannot modify placed order');
    this.emit(new OrderItemAddedEvent({ orderId: this.state.id, item }));
  }

  private emit(event: Event): void {
    this.apply(event);
    this.events.push(event);
  }

  private apply(event: Event): void {
    switch (event.type) {
      case 'OrderPlaced':
        this.state = { ...event.data, status: 'placed', items: [] };
        break;
      case 'OrderItemAdded':
        this.state.items.push(event.data.item);
        break;
    }
  }

  getUncommittedEvents(): Event[] { return this.events; }
}
```

---

## Deployment Patterns

### Blue/Green Deployment
```yaml
# Kubernetes Blue/Green with Argo Rollouts
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: orders-service
spec:
  replicas: 10
  strategy:
    blueGreen:
      activeService: orders-service-blue
      previewService: orders-service-green
      autoPromotionEnabled: false
      previewMetadata:
        annotations:
          rollout.argoproj.io/canary: "true"
  selector:
    matchLabels:
      app: orders-service
  template:
    metadata:
      labels:
        app: orders-service
    spec:
      containers:
      - name: orders-service
        image: orders-service:v1.2.3
```

### Canary Deployment
```yaml
# Kubernetes Canary with Flagger
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: orders-service
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orders-service
  progressDeadlineSeconds: 600
  service:
    port: 80
    targetPort: 8080
    gateways:
    - public-gateway
    hosts:
    - api.example.com
  canaryAnalysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
    - name: request-success-rate
      thresholdRange:
        min: 99
      interval: 30s
    - name: request-duration
      thresholdRange:
        max: 500
      interval: 30s
    webhooks:
    - name: load-test
      url: http://flagger-loadtester.test/
      timeout: 5s
      metadata:
        type: cmd
        cmd: "hey -z 30s -q 10 -c 2 http://api.example.com/orders"
```

### Strangler Fig (Migration Pattern)
```typescript
// Gradual migration from monolith to services
class StranglerFigRouter {
  private routes: Route[] = [
    { path: '/api/users/**', target: 'users-service', percentage: 100 },
    { path: '/api/orders/**', target: 'orders-service', percentage: 50 }, // 50% to new
    { path: '/api/catalog/**', target: 'monolith', percentage: 100 }, // Not migrated yet
  ];

  async route(request: Request): Promise<Response> {
    const route = this.matchRoute(request.url);
    
    if (route.percentage < 100 && Math.random() * 100 > route.percentage) {
      return this.forwardToMonolith(request);
    }
    
    return this.forwardToService(route.target, request);
  }
}
```

---

## Technology Radar (Quarterly)

```markdown
# Tech Radar - 2025 Q1

## ADOPT (Proven, standard choice)
- **Language**: TypeScript, Python 3.12, Go 1.22
- **Runtime**: Node.js 20 LTS, Bun 1.1
- **Framework**: Next.js 14, FastAPI, Gin
- **Database**: PostgreSQL 16, Redis 7, SQLite (dev/test)
- **ORM**: SQLAlchemy 2.0, Drizzle, Prisma
- **API**: tRPC, oRPC, OpenAPI 3.1
- **Testing**: Vitest, Playwright, Testcontainers, Pact
- **CI/CD**: GitHub Actions, ArgoCD
- **Infrastructure**: Terraform, Helm, Kubernetes (EKS/GKE)
- **Observability**: OpenTelemetry, Prometheus, Grafana, Loki, Tempo, Pyroscope
- **Security**: Semgrep, CodeQL, Trivy, Cosign, Kyverno

## TRIAL (Evaluating for specific use cases)
- **Language**: Rust (for performance-critical services)
- **Database**: ClickHouse (analytics), RisingWave (streaming SQL)
- **Streaming**: Redpanda (Kafka-compatible, simpler)
- **API**: GraphQL (Federation) for complex queries
- **Frontend**: React Server Components, TanStack Start
- **Testing**: Maestro (mobile E2E), Playwright MCP
- **AI/ML**: Ollama (local LLMs), LangChain, LangGraph

## ASSESS (Researching, not yet committed)
- **Language**: Zig, Gleam
- **Database**: SurrealDB, DuckDB (embedded analytics)
- **Platform**: WasmEdge, Spin (WebAssembly)
- **Observability**: Grafana Beyla (eBPF auto-instrumentation)

## HOLD (Deprecating, avoid new adoption)
- **Language**: Python < 3.11, Node.js < 18
- **Framework**: Express (use Fastify), Flask (use FastAPI)
- **Database**: MongoDB (prefer PostgreSQL + JSONB)
- **Queue**: RabbitMQ (prefer Kafka/Redpanda)
- **CI/CD**: Jenkins, CircleCI
- **Monitoring**: Datadog (cost), New Relic (cost)
```

---

## Architecture Decision Checklist

Before any architectural decision:
- [ ] **C4 Diagram** created/updated
- [ ] **ADR** written (if irreversible)
- [ ] **Threat Model** (if new trust boundary)
- [ ] **Capacity Plan** (if scaling change)
- [ ] **Cost Analysis** (TCO 3 years)
- [ ] **Migration Path** (if replacing existing)
- [ ] **Rollback Plan** (if deployment change)
- [ ] **Observability** (metrics, logs, traces defined)
- [ ] **Security Review** (by `kaspersky` if auth/payments/PII)
- [ ] **Compliance Check** (by `trevor` if data handling)

---

## Output Format (for agent using this skill)
```
## Architecture Decision
- Pattern: [C4 level, communication, data, deployment]
- Diagram: [path to .dsl/.puml]
- ADR: [reference if created]
- Trade-offs: [key decisions with rationale]
- Migration: [path if applicable]
- Risks: [top 3 with mitigations]
- Tech Radar Impact: [adopt/trial/assess/hold changes]
```