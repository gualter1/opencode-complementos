# CLAUDE.md - Project Memory (Living Document)

> **Maintained by:** Severino (Tech Lead Orchestrator)  
> **Updated:** Every architectural decision, new convention, or pattern change  
> **Location:** Repository root (committed to git)

---

## Project Overview

| Field | Value |
|-------|-------|
| **Name** | [Project Name] |
| **Description** | [One-liner: what does this project do?] |
| **Type** | [Web App / API / Library / CLI / Mobile / Data Pipeline / etc.] |
| **Primary Language** | [TypeScript / Python / Go / Rust / etc.] |
| **Framework** | [Next.js / FastAPI / React Native / etc.] |
| **Deployment** | [Vercel / AWS / K8s / Docker Compose / etc.] |

---

## Tech Stack (Decision Log)

| Layer | Technology | Version | ADR | Status |
|-------|------------|---------|-----|--------|
| **Runtime** | Node.js | 20.x | ADR-001 | Active |
| **Language** | TypeScript | 5.x | ADR-001 | Active |
| **Frontend** | React / Next.js | 14.x | ADR-002 | Active |
| **Backend** | Fastify / tRPC | Latest | ADR-003 | Active |
| **Database** | PostgreSQL | 16 | ADR-004 | Active |
| **ORM** | Prisma / Drizzle / SQLAlchemy | Latest | ADR-005 | Active |
| **Cache** | Redis | 7.x | ADR-006 | Active |
| **Message Queue** | [RabbitMQ / Kafka / NATS] | Latest | ADR-007 | Active |
| **Auth** | [NextAuth / Clerk / Custom JWT] | Latest | ADR-008 | Active |
| **Testing** | Vitest / Playwright / MSW | Latest | ADR-009 | Active |
| **Linting** | Biome / ESLint / Oxlint | Latest | ADR-010 | Active |
| **CI/CD** | GitHub Actions / GitLab CI | Latest | ADR-011 | Active |
| **Observability** | OpenTelemetry / Grafana / Datadog | Latest | ADR-012 | Active |

> **Rule:** Every entry here must have a corresponding ADR in `docs/adr/`. If no ADR exists, create one.

---

## Architecture Patterns (Enforced by Tranquilão)

### Dependency Direction
- **Controllers/Transport** → can depend on Services + Domain Contracts
- **Domain** → MUST NOT import controllers, request context, or framework code
- **Services** → depend on Repository Abstractions (Protocols/Interfaces), not implementations
- **Infrastructure** → implements Repository Abstractions

### Module Organization
```
src/
├── features/           # Vertical slices (bounded contexts)
│   ├── [feature-name]/
│   │   ├── components/     # UI components (frontend)
│   │   ├── hooks/          # Feature-scoped hooks
│   │   ├── types/          # Feature types + generated contracts
│   │   ├── queries/        # TanStack Query / API calls
│   │   ├── services/       # Business logic (backend)
│   │   ├── repositories/   # Data access abstractions
│   │   ├── models/         # Domain models
│   │   └── tests/          # Co-located tests
├── shared/             # Truly shared code (used by 3+ features)
│   ├── ui/               # Design system primitives
│   ├── lib/              # Utilities, helpers
│   ├── config/           # App config (env, feature flags)
│   └── types/            # Shared domain types
├── core/               # Migration-only (legacy)
└── app/                # Next.js App Router / Entry points
```

### Multi-Tenancy
- **All shared tables** MUST include `tenant_id` column
- **All queries** on shared tables MUST filter by `tenant_id`
- **Tenant context** propagated explicitly through service/repository contracts
- **Row-level security** (RLS) enabled in PostgreSQL as defense-in-depth

---

## Coding Conventions (Enforced by Linter + Tranquilão)

### TypeScript
- `strict: true` — **no exceptions**
- `any` forbidden — use `unknown` + type guards, or add `// @ts-expect-error` with justification comment
- **No enums** — use `const` objects + `as const` or union types
- **Interfaces over types** for object shapes (extends, declaration merging)
- **Type imports**: `import type { Foo } from 'bar'`

### Naming
| Construct | Convention | Example |
|-----------|------------|---------|
| Files/Directories | kebab-case | `user-profile.tsx`, `api-client.ts` |
| Components | PascalCase | `UserProfile.tsx` |
| Functions/Variables | camelCase | `getUserById`, `userName` |
| Types/Interfaces | PascalCase | `User`, `UserRepository` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Private fields | `#field` (native) | `#cache` |

### Functions
- **Single responsibility** — max 50 lines, cyclomatic complexity < 10
- **Explicit returns** — no implicit returns for non-trivial functions
- **Error handling** — `Result<T, E>` for expected failures, throw only for bugs
- **Dependency injection** — pass dependencies as parameters, not global imports

### React / Frontend
- **Server Components by default** — `'use client'` only when interactivity needed
- **Semantic HTML** — `<button>`, `<nav>`, `<main>`, `<dialog>`, `<form>`, `<fieldset>`
- **Focus visible** on ALL interactive elements
- **Accessible names** — icon-only buttons need `aria-label`
- **Forms** — labels clickable, `name` stable, `autoComplete` correct, errors via `aria-describedby`
- **Dify UI** — subpath imports only (`@langgenius/dify-ui/button`), semantic tokens, `cn()` utility

### Backend / Database
- **Parameterized queries only** — ORM safe methods, zero string concatenation
- **Tenant scoping** — mandatory on all shared table queries
- **Concurrency** — optimistic lock (version) for low contention, Redis lock for cross-worker, `SELECT FOR UPDATE` for high contention
- **Migrations** — dialect-aware (PostgreSQL/MySQL branches), use `models.types` wrappers
- **Repository pattern** — use existing abstractions; create new only when justified

---

## Testing Strategy (Enforced by Qualy + Verification Loop)

### Pyramid
```
         E2E (Playwright)          ← 10%  | Critical user journeys only
        ┌─────────────┐
       Integration          ← 30%  | API contracts, DB, external services
      ┌─────────────────┐
     Unit (Vitest)       ← 60%  | Pure logic, domain, utilities
    ┌─────────────────────┐
```

### Thresholds (CI Gate)
- **Line coverage**: ≥ 80%
- **Branch coverage**: ≥ 70%
- **Mutation coverage** (core): ≥ 60%
- **Zero flaky tests** in main branch

### Patterns
- **Contract testing** — generated types are authoritative; test against schemas
- **Property-based testing** — for complex algorithms, serialization, validation
- **Test data** — factories/fixtures, no hardcoded IDs, deterministic
- **MSW** — for API mocking in unit/integration tests

---

## Git & Commit Conventions

### Branching
- `main` — production-ready, protected
- `dev` — integration branch (optional)
- `feat/*` — features
- `fix/*` — bug fixes
- `refactor/*` — refactoring
- `chore/*` — maintenance
- `docs/*` — documentation

### Commits (Conventional Commits)
```
<type>(<scope>): <subject>

<body>

<footer>
```

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change without behavior change |
| `perf` | Performance improvement |
| `test` | Test changes |
| `docs` | Documentation |
| `chore` | Build, deps, tooling |
| `ci` | CI/CD changes |
| `security` | Security fix |

### PR Requirements
- **Atomic** — one logical change per PR
- **Size** — < 400 lines preferred, > 600 requires split
- **Checks** — all CI gates pass (build, typecheck, lint, tests, security, arch)
- **Review** — Tranquilão approval required
- **Evidence** — QA evidence in `.omo/evidence/`

---

## Security Baseline (Enforced by Kaspersky + Tranquilão)

### Mandatory
- **Secrets scanning** — TruffleHog/GitLeaks in CI
- **Dependency audit** — `npm audit` / `pnpm audit` / `pip-audit` in CI
- **Input validation** — Zod/Valibot at ALL boundaries (API, forms, messages)
- **AuthZ** — resource-level (ownership/tenant), not just role-based
- **Logging** — structured JSON, NO PII/secrets/stack traces
- **Errors** — generic messages to clients, detailed only in server logs
- **Crypto** — use platform libs (Web Crypto, Node crypto), no custom implementations

### Threat Modeling (Required For)
- Authentication / Authorization changes
- Payment processing
- PII handling (GDPR/LGPD)
- File upload / processing
- External integrations (webhooks, OAuth, APIs)
- Cryptographic operations

---

## Observability Standards

### Logging
- **Format**: JSON with `timestamp`, `level`, `traceId`, `spanId`, `service`, `message`
- **Levels**: `debug`, `info`, `warn`, `error`, `fatal`
- **Correlation**: `traceId` propagated through all services (OpenTelemetry)
- **No PII** in logs — use hashed identifiers

### Metrics (RED Method)
- **Rate** — requests per second
- **Errors** — error rate (5xx, 4xx by type)
- **Duration** — latency percentiles (p50, p95, p99)

### Tracing
- **OpenTelemetry** — auto-instrumentation + manual spans for business logic
- **Sampling** — tail-based for errors, head-based for throughput

### Alerting
- **Actionable only** — every alert has a runbook
- **No paging for warnings** — warnings go to Slack/email
- **SLO-based** — alert on error budget burn rate

---

## CI/CD Pipeline (Enforced by Trevor)

### Stages
```
┌─────────┐   ┌──────────┐   ┌────────┐   ┌──────────┐   ┌─────────┐   ┌───────┐
│  Lint   │ → │ Typecheck │ → │ Build  │ → │  Unit    │ → │ Integr. │ → │ E2E   │
└─────────┘   └──────────┘   └────────┘   └──────────┘   └─────────┘   └───────┘
                                                                              ↓
┌─────────┐   ┌──────────┐   ┌────────┐   ┌──────────┐   ┌─────────┐   ┌───────┐
│ Security│ ← │  Arch    │ ← │  Diff  │ ← │ Coverage │ ← │Mutation │ ← │Deploy │
│  Scan   │   │  Check   │   │ Review │   │  Check   │   │ Testing │   │ Staging│
└─────────┘   └──────────┘   └────────┘   └──────────┘   └─────────┘   └───────┘
```

### Gates (All Must Pass)
1. **Build** — compiles without errors
2. **Typecheck** — `tsc --noEmit` zero errors
3. **Lint** — zero warnings (Biome/ESLint/Oxlint)
4. **Unit Tests** — pass + coverage thresholds
5. **Integration Tests** — pass
6. **E2E Tests** — critical paths pass
7. **Security Scan** — SAST (Semgrep/CodeQL), secrets, dependencies
6. **Architecture Check** — no circular deps, boundary violations, dead code
7. **Diff Review** — intentional changes only (Tranquilão)

### Deployment
- **Staging** — auto-deploy on `dev` branch merge
- **Production** — manual approval + Release Manager workflow
- **Rollback** — one-click, < 5 min
- **Canary** — for high-risk changes (10% → 50% → 100%)

---

## Feature Flags

### Naming
- `feature.<domain>.<name>` — e.g., `feature.billing.new-checkout`
- `experiment.<name>` — A/B tests
- `kill-switch.<name>` — emergency disable

### Lifecycle
1. **Create** — ADR + flag definition in config
2. **Rollout** — gradual (internal → beta → 10% → 50% → 100%)
3. **Cleanup** — remove flag + dead code within 2 sprints of 100% rollout
4. **Audit** — quarterly flag cleanup

---

## Documentation Standards

### Required
- **README.md** — project overview, quick start, architecture summary
- **ADRs** — `docs/adr/ADR-XXX-title.md` (Nygard format)
- **API Docs** — generated from contracts (OpenAPI/orpc/tRPC)
- **Runbooks** — `docs/runbooks/` for each alert
- **Onboarding** — `docs/onboarding/` for new team members

### Diagrams
- **C4 Level 1-2** — system context, containers (PlantUML/Mermaid in ADRs)
- **Sequence** — for complex flows (auth, payments, async processing)
- **Data Flow** — for threat models

---

## ADR Index (docs/adr/)

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| ADR-001 | [Title] | Accepted | YYYY-MM-DD |
| ADR-002 | [Title] | Accepted | YYYY-MM-DD |
| ... | ... | ... | ... |

> **Template:** See `ResultadoFinal/patterns/ADR-template.md`

---

## Team Conventions

### Code Review
- **Tranquilão** = mandatory gatekeeper (no merge without approval)
- **Turnaround** — < 4h for PRs < 400 lines, < 24h for larger
- **Size limit** — PR > 600 lines → request split

### Communication
- **Async first** — GitHub issues/PRs/discussions over meetings
- **Decisions documented** — if not in ADR/PR/comment, it didn't happen
- **No private decisions** — all technical decisions in public channels

### Onboarding
- New devs → Guanabara for guided tour
- First PR — pair with Towards/Turing
- First feature — full orch-pipeline with Severino

---

## Known Tech Debt (Tracked)

| Item | Impact | Mitigation | Owner | Target Date |
|------|--------|------------|-------|-------------|
| [Description] | [High/Med/Low] | [Plan] | [Agent/Person] | [YYYY-MM-DD] |

> Updated by Auditor during tech-debt-audit skill runs

---

## Quick Reference: Agent Skills

| Agent | Primary Skills |
|-------|---------------|
| **Severino** | orch-pipeline, verification-loop, continuous-learning-v2, context-budget, token-budget-advisor |
| **Towards** | backend-code-review, clean-code-patterns, testing-strategies, e2e-cucumber-playwright |
| **Turing** | frontend-code-review, frontend-testing, how-to-write-component, e2e-cucumber-playwright |
| **Niamaia** | architecture-patterns, adr-template, threat-modeling |
| **Trevor** | iac-patterns, cicd-patterns, observability-patterns |
| **Qualy** | testing-strategies, e2e-cucumber-playwright, frontend-testing |
| **Tranquilão** | backend-code-review, frontend-code-review, sast-dast-patterns, compliance-patterns |
| **Kaspersky** | threat-modeling, sast-dast-patterns, security-research |
| **Guanabara** | teaching-patterns, analogy-patterns |
| **Context-Guardian** | context-budget, token-budget-advisor |
| **Archaeologist** | legacy-patterns, migration-patterns |
| **Performance-Engineer** | profiling-patterns, load-testing, capacity-planning |
| **Data-Engineer** | data-quality-patterns, pipeline-patterns |
| **Mobile-Engineer** | mobile-patterns, offline-first |
| **DevRel-Engineer** | api-docs-patterns, sdk-patterns |
| **Auditor** | tech-debt-audit, code-quality-patterns |
| **Security-Lead** | security-research, threat-modeling |
| **Release-Manager** | pre-publish-review, publish |
| **PR-Engineer** | work-with-pr, ulw-loop |
| **Triage-Lead** | github-triage |

---

## Emergency Contacts

| Role | Agent | Escalation |
|------|-------|------------|
| **Security Incident** | Kaspersky → Security-Lead | Page: [contact] |
| **Production Outage** | Trevor → Severino | Page: [contact] |
| **Data Breach** | Kaspersky → Legal | Page: [contact] |
| **Performance Crisis** | Performance-Engineer → Trevor | Page: [contact] |

---

## Last Updated

- **Date:** [YYYY-MM-DD]
- **By:** Severino
- **Reason:** [Initial creation / Major decision / Periodic review]

---

*This document is the single source of truth for project conventions. If something here conflicts with code, **code wins but document must be updated**.*