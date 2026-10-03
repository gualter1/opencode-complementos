---
description: Migration Patterns - Database migration, API versioning, feature flags, blue/green, canary, rollback. Safe deployment and migration patterns.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Migration Patterns - Safe Deployment & Migration Skill

## Purpose
Defines patterns for safe migrations: database migrations, API versioning, feature flags, blue/green deployments, canary releases, and rollback strategies.

## When to Invoke
- Database schema changes (used by `trevor`, `towards`, `archaeologist`)
- API breaking changes
- Service migrations
- Infrastructure migrations
- Rollback planning

---

## Database Migration Patterns

### 1. Expand/Contract (Backward Compatible)

```sql
-- Phase 1: EXPAND - Add new column (nullable, no default)
ALTER TABLE orders ADD COLUMN shipping_address_id UUID;

-- Phase 2: BACKFILL - Populate new column (background job)
UPDATE orders SET shipping_address_id = (
  SELECT id FROM addresses WHERE user_id = orders.user_id AND is_default = true
) WHERE shipping_address_id IS NULL;

-- Phase 3: CONTRACT - Add NOT NULL constraint (after backfill verified)
ALTER TABLE orders ALTER COLUMN shipping_address_id SET NOT NULL;

-- Phase 4: CLEANUP - Drop old column (after all code migrated)
ALTER TABLE orders DROP COLUMN old_shipping_address;
```

### 2. Migration Script Template

```sql
-- migrations/20240115_add_shipping_address_to_orders.sql
-- Description: Add shipping address reference to orders
-- Author: Towards
-- Ticket: ORD-1234
-- Rollback: Provided below

-- UP MIGRATION
BEGIN;

-- Add column as nullable (no lock on large tables)
ALTER TABLE orders ADD COLUMN shipping_address_id UUID;

-- Create index concurrently (PostgreSQL)
CREATE INDEX CONCURRENTLY idx_orders_shipping_address 
ON orders(shipping_address_id);

-- Add foreign key (VALIDATE after backfill)
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_shipping_address 
FOREIGN KEY (shipping_address_id) REFERENCES addresses(id) NOT VALID;

COMMIT;

-- BACKFILL (run separately, not in transaction)
-- UPDATE orders SET shipping_address_id = ... WHERE shipping_address_id IS NULL;

-- VALIDATE FK (after backfill)
-- ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_shipping_address;

-- DOWNGRADE (ROLLBACK)
-- BEGIN;
-- ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_shipping_address;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_orders_shipping_address;
-- ALTER TABLE orders DROP COLUMN IF EXISTS shipping_address_id;
-- COMMIT;
```

### 3. Dialect-Aware Migrations (PostgreSQL/MySQL)

```typescript
// migrations/runner.ts
class MigrationRunner {
  async run(migrations: Migration[]): Promise<void> {
    const dialect = this.getDialect(); // 'postgresql' | 'mysql'
    
    for (const migration of migrations) {
      const sql = dialect === 'postgresql' 
        ? migration.postgresql 
        : migration.mysql;
      
      if (!sql) {
        throw new Error(`Migration ${migration.id} missing ${dialect} SQL`);
      }
      
      await this.executeInTransaction(sql);
      await this.recordMigration(migration.id);
    }
  }
}

// Migration with dialect-specific SQL
const migration = {
  id: '20240115_add_json_column',
  postgresql: `
    ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
    CREATE INDEX idx_users_preferences ON users USING GIN (preferences);
  `,
  mysql: `
    ALTER TABLE users ADD COLUMN preferences JSON DEFAULT ('{}');
    -- MySQL JSON indexes are virtual, created differently
  `,
};
```

### 4. Zero-Downtime Migration Checklist

```markdown
## Zero-Downtime Migration Checklist

### Pre-Migration
- [ ] Migration is backward compatible (expand phase only)
- [ ] No `DROP COLUMN`, `RENAME COLUMN`, `ALTER TYPE` in expand phase
- [ ] Indexes created `CONCURRENTLY` (PostgreSQL) / `ONLINE` (MySQL)
- [ ] Foreign keys added `NOT VALID` then `VALIDATE` after backfill
- [ ] Backfill script tested on staging copy
- [ ] Rollback script tested and verified
- [ ] Migration estimated duration < maintenance window
- [ ] Feature flag guards new column usage

### During Migration
- [ ] Run expand migration
- [ ] Verify schema change
- [ ] Deploy code that writes to BOTH old and new columns
- [ ] Run backfill (batch, throttled, resumable)
- [ ] Verify backfill completeness
- [ ] Validate constraints
- [ ] Deploy code that reads from NEW column
- [ ] Run contract migration (drop old, add NOT NULL)

### Post-Migration
- [ ] Monitor error rates, latency
- [ ] Verify data integrity (reconciliation)
- [ ] Remove feature flag
- [ ] Update documentation
```

---

## API Versioning Patterns

### 1. URL Versioning (Recommended for Breaking Changes)
```
GET  /api/v1/users/{id}        # Legacy
GET  /api/v2/users/{id}        # New (different response shape)
GET  /api/v3/users/{id}        # Latest
```

### 2. Header Versioning (For Minor Additions)
```
GET /api/users/{id}
Accept-Version: v2
```

### 3. Version Negotiation Middleware

```typescript
// middleware/api-versioning.ts
const SUPPORTED_VERSIONS = ['v1', 'v2', 'v3'];
const DEFAULT_VERSION = 'v3';
const DEPRECATED_VERSIONS = ['v1']; // Sunset date tracked separately

function versionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Priority: URL > Header > Default
  let version = req.params.version || req.headers['accept-version'] || DEFAULT_VERSION;
  
  version = version.replace(/^v/, ''); // Normalize
  
  if (!SUPPORTED_VERSIONS.includes(`v${version}`)) {
    return res.status(400).json({
      error: 'UNSUPPORTED_VERSION',
      message: `Version ${version} not supported. Supported: ${SUPPORTED_VERSIONS.join(', ')}`,
      deprecated: DEPRECATED_VERSIONS,
    });
  }
  
  req.apiVersion = `v${version}`;
  
  // Add deprecation headers
  if (DEPRECATED_VERSIONS.includes(`v${version}`)) {
    res.set('Deprecation', 'true');
    res.set('Sunset', 'Sat, 01 Jan 2025 00:00:00 GMT');
    res.set('Link', '<https://docs.example.com/migration/v2>; rel="successor-version"');
  }
  
  next();
}
```

### 4. Response Transformation per Version

```typescript
// transformers/user-response.ts
interface UserV1 { id: string; email: string; name: string; }
interface UserV2 { id: string; email: string; name: string; profile: { avatar?: string; bio?: string }; }
interface UserV3 { id: string; email: string; name: string; profile: Profile; preferences: Preferences; }

class UserResponseTransformer {
  transform(user: InternalUser, version: string): UserV1 | UserV2 | UserV3 {
    const base = { id: user.id, email: user.email, name: user.name };
    
    switch (version) {
      case 'v1':
        return base;
      case 'v2':
        return { ...base, profile: { avatar: user.avatar, bio: user.bio } };
      case 'v3':
        return { ...base, profile: user.profile, preferences: user.preferences };
      default:
        throw new Error(`Unknown version: ${version}`);
    }
  }
}
```

---

## Feature Flags (LaunchDarkly / Unleash / OpenFeature)

```typescript
// flags/feature-flags.ts
interface FeatureFlags {
  'new-checkout-flow': boolean;
  'payments-v2': boolean;
  'recommendations-ml': boolean;
  'dark-mode': boolean;
}

class FeatureFlagClient {
  private client: OpenFeatureClient;
  
  async isEnabled(flag: keyof FeatureFlags, context: EvaluationContext): Promise<boolean> {
    return this.client.getBooleanValue(flag, false, context);
  }
  
  async getVariant(flag: keyof FeatureFlags, context: EvaluationContext): Promise<string> {
    return this.client.getStringValue(flag, 'control', context);
  }
}

// Usage in code
async function checkout(user: User, cart: Cart): Promise<Order> {
  const useNewFlow = await flags.isEnabled('new-checkout-flow', { 
    targetingKey: user.id,
    attributes: { tier: user.tier, region: user.region }
  });
  
  if (useNewFlow) {
    return newCheckoutFlow(user, cart);
  }
  return legacyCheckoutFlow(user, cart);
}
```

### Flag Lifecycle

```markdown
## Feature Flag Lifecycle

| Stage | Name Pattern | Duration | Cleanup |
|-------|--------------|----------|---------|
| **Development** | `dev-*` | Until merged | Auto-remove on merge |
| **Testing** | `test-*` | Sprint | Remove after release |
| **Canary** | `canary-*` | 1-2 weeks | Remove after full rollout |
| **Rollout** | `rollout-*` | 2-4 weeks | Remove after 100% |
| **Permanent** | `perm-*` | Indefinite | Regular review |
| **Kill Switch** | `kill-*` | Emergency | Remove after incident |

## Flag Removal Checklist
- [ ] 100% rollout for 2+ weeks
- [ ] No errors in new path
- [ ] Metrics stable
- [ ] Code cleanup: remove flag checks, old paths
- [ ] Delete flag from provider
- [ ] Update documentation
```

---

## Blue/Green Deployment

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
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        preStop:
          exec:
            command: ["/bin/sh", "-c", "sleep 10"]  # Connection draining
```

### Blue/Green Process

```bash
#!/bin/bash
# deploy-blue-green.sh

VERSION=$1
ENVIRONMENT=$2

# 1. Determine inactive color
ACTIVE=$(kubectl get svc orders-service-$ENVIRONMENT -o jsonpath='{.spec.selector.version}')
INACTIVE=$([ "$ACTIVE" = "blue" ] && echo "green" || echo "blue")

echo "Active: $ACTIVE, Deploying to: $INACTIVE"

# 2. Deploy to inactive
kubectl set image deployment/orders-service-$INACTIVE \
  orders-service=orders-service:$VERSION \
  -n $ENVIRONMENT

# 3. Wait for rollout
kubectl rollout status deployment/orders-service-$INACTIVE -n $ENVIRONMENT --timeout=5m

# 4. Smoke tests on preview
PREVIEW_URL="https://$INACTIVE.$ENVIRONMENT.example.com"
curl -f "$PREVIEW_URL/health" || { echo "Health check failed"; exit 1; }
npm run test:smoke -- --baseUrl=$PREVIEW_URL

# 5. Switch traffic (manual approval in prod)
if [ "$ENVIRONMENT" = "prod" ]; then
  read -p "Smoke tests passed. Switch traffic? (y/N) " -n 1 -r
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    exit 1
  fi
fi

kubectl patch svc orders-service-$ENVIRONMENT \
  -p "{\"spec\":{\"selector\":{\"version\":\"$INACTIVE\"}}}" \
  -n $ENVIRONMENT

# 6. Verify
sleep 30
curl -f "https://$ENVIRONMENT.example.com/health" || { 
  echo "Post-switch health check failed, rolling back..."
  kubectl patch svc orders-service-$ENVIRONMENT \
    -p "{\"spec\":{\"selector\":{\"version\":\"$ACTIVE\"}}}" \
    -n $ENVIRONMENT
  exit 1
}

echo "Deployment successful!"
```

---

## Canary Deployment (Progressive Delivery)

```yaml
# Flagger Canary
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
    - name: request-duration-p99
      thresholdRange:
        max: 500
      interval: 30s
    - name: error-budget-burn-rate
      thresholdRange:
        max: 2
      interval: 1m
    webhooks:
    - name: load-test
      url: http://flagger-loadtester/
      timeout: 5s
      metadata:
        cmd: "hey -z 30s -q 10 -c 2 http://api.example.com/orders"
```

### Canary Metrics (Prometheus)

```promql
# Success rate
sum(rate(http_requests_total{job="orders-service",version="canary",status!~"5.."}[1m]))
/
sum(rate(http_requests_total{job="orders-service",version="canary"}[1m]))

# Latency p99
histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{job="orders-service",version="canary"}[1m])))

# Error budget burn rate (SLO: 99.9% over 30d)
(1 - (sum(rate(http_requests_total{job="orders-service",version="canary",status!~"5.."}[1h])) / sum(rate(http_requests_total{job="orders-service",version="canary"}[1h]))))
/
(1 - 0.999)  # Normalize to burn rate
```

---

## Rollback Strategies

### 1. Instant Rollback (Blue/Green)
```bash
# Traffic switch back - seconds
kubectl patch svc orders-service-prod \
  -p '{"spec":{"selector":{"version":"blue"}}}' \
  -n prod
```

### 2. Kubernetes Rollout Undo
```bash
# Previous ReplicaSet - ~30 seconds
kubectl rollout undo deployment/orders-service -n prod
kubectl rollout status deployment/orders-service -n prod --timeout=5m
```

### 3. Database Rollback (If Schema Changed)
```sql
-- Only if NO data loss possible (expand phase only)
-- If contract phase ran, requires Point-in-Time Recovery (PITR)

-- Check if safe to rollback
SELECT COUNT(*) FROM orders WHERE shipping_address_id IS NOT NULL;
-- If > 0, data was written to new column - CANNOT simple rollback
-- Need PITR or manual data migration

-- If safe (no data in new column):
BEGIN;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_shipping_address;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_shipping_address;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_address_id;
COMMIT;
```

### 4. Feature Flag Rollback (Instant)
```typescript
// Kill switch - instant
await flags.set('new-checkout-flow', false, { reason: 'Emergency rollback - high error rate' });
```

---

## Migration Runbook Template

```markdown
# Migration Runbook: [Migration Name]

## Overview
- **What**: [Description]
- **Why**: [Business/Technical reason]
- **Risk Level**: [LOW/MEDIUM/HIGH/CRITICAL]
- **Estimated Duration**: [Time]
- **Downtime Expected**: [None / X minutes]

## Pre-Requisites
- [ ] Approval from [Team Lead / Architect]
- [ ] Staging validation complete
- [ ] Rollback tested
- [ ] On-call notified
- [ ] Communication sent to stakeholders

## Steps

### Phase 1: Preparation (T-30min)
1. [Step] - [Command] - [Expected] - [Rollback if fails]
2. ...

### Phase 2: Execution (T-0)
1. [Step] - [Command] - [Expected] - [Rollback if fails]
2. ...

### Phase 3: Validation (T+15min)
1. [Health check] - [Command] - [Expected]
2. [Smoke tests] - [Command] - [Expected]
3. [Metrics check] - [Dashboard] - [Thresholds]

## Rollback Triggers
| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | > 1% | Immediate rollback |
| Latency p99 | > 2x baseline | Rollback |
| Data inconsistency | Any | Rollback + PITR |

## Rollback Procedure
1. [Command] - [Expected time]
2. [Verification] - [Command]
3. [Notification] - [Slack/Email]

## Post-Migration
- [ ] Monitor for 2 hours
- [ ] Update runbook with actuals
- [ ] Retire old resources (after 30 days)
- [ ] Post-mortem if issues
```

---

## Output Format (for agent using this skill)
```
## Migration Plan
- Type: [Database / API / Service / Infrastructure]
- Strategy: [Expand/Contract / Blue-Green / Canary / Feature Flag]
- Steps: [count] - [phases]
- Rollback: [Instant / Minutes / PITR] - [Tested: Yes/No]
- Feature Flags: [list]
- Validation: [Health checks, smoke tests, metrics]
- Risk Level: [LOW/MEDIUM/HIGH/CRITICAL]
- Estimated Duration: [Time]
```