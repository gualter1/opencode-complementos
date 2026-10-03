# Best Practices for the Super Development Team

This document consolidates the best practices extracted from all analyzed repositories, adapted for our super team.

---

## 1. Code Quality Standards

### TypeScript
- **Strict mode always**: `strict: true` in tsconfig. No `any` without justification comment.
- **No suppressed errors**: Zero `@ts-ignore`, `@ts-expect-error` unless absolutely necessary with explanation.
- **Type-safe boundaries**: Zod/Valibot schemas at all API/IO boundaries. No implicit `any`.
- **Factory pattern**: `createXXX()` for all tools, hooks, agents, services. No classes with public constructors.

### Code Organization
- **Kebab-case files**: All files and directories use kebab-case.
- **Barrel exports**: `index.ts` barrel exports only. No catch-all files (`utils.ts`, `helpers.ts`, `service.ts` banned).
- **200 LOC soft limit**: Files over 200 lines should be split.
- **Relative imports within module**, barrel imports across modules. No path aliases inside package `src/`.

### Error Handling
- **Result types**: Use `Result<T, E>` for operations that can fail. No throwing for expected errors.
- **Empty catch blocks forbidden**: Every catch must handle or re-throw with context.
- **Structured logging**: JSON logs with correlation IDs. No `console.log` in production.
- **Error shapes consistent**: Same error response format across all modules.

---

## 2. Testing Strategy

### Test Pyramid (Inverted for CI)
| Layer | Coverage | Speed | Tool | When |
|-------|----------|-------|------|------|
| Unit | 80%+ (business logic) | <1s | Vitest | Every push |
| Integration | Contracts, DB, external APIs | 10-30s | Vitest + Testcontainers | Every push |
| Contract | Consumer-provider | 5-10s | Pact | PR + scheduled |
| E2E | 10-20 critical journeys | 1-3min | Playwright | Merge + scheduled |
| Performance | Baselines per PR | 2-5min | k6 | Merge + nightly |
| Chaos | Monthly / pre-release | 10-30min | Litmus/Chaos Mesh | Scheduled |

### Rules
- **Zero flaky tests in main**: Quarantine → fix in 48h or delete.
- **E2E only for critical user journeys**: Login, checkout, onboarding, payment.
- **Mock external, not internal**: Testcontainers > mocks for DB/Redis/Kafka.
- **Test data isolated per run**: Namespace, schema, prefix, or transaction rollback.
- **Mutation testing**: Stryker on critical logic > 60% score.
- **Tests as documentation**: Descriptive names, BDD-style, living documentation.

---

## 3. Git & PR Workflow

### Branch Strategy
- **Trunk-based with short-lived branches**: Branch off `dev`, merge back via PR.
- **Atomic PRs**: Smallest PR that compiles, passes, stands alone. 200 lines ideal, 400 max.
- **Parallel PRs**: Independent slices run concurrently via worktrees.

### Commit Standards
- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`
- **Atomic commits**: One logical change per commit. Implementation + tests together.
- **Minimum commits by file count**:
  - 3+ files → 2+ commits
  - 5+ files → 3+ commits
  - 10+ files → 5+ commits

### PR Requirements
- **Reviewer-readable English**: What changed, why, how tested, residual risk.
- **Manual QA evidence mandatory**: Evidence files in `.omo/evidence/YYYYMMDD-slug/`. No evidence = no merge.
- **Verification loop**: CI (typecheck, test, build) + Cubic review. Failing gate → back to worktree.
- **Merge commits only**: Never squash or rebase merge. `gh pr merge --merge --delete-branch`.

---

## 4. Security Practices

### Shift-Left Security
- **SAST in IDE**: Semgrep/CodeQL in editor.
- **SCA in CI**: Dependabot/Renovate + OWASP Dependency Check + Syft/Grype (SBOM).
- **Secrets scan**: TruffleHog/GitLeaks in pre-commit + CI.
- **DAST in staging**: OWASP ZAP/Nuclei against staging environment.

### Code-Level
- **Zero hardcoded secrets**: Env vars only, rotation automated.
- **Parameterized queries**: Never string-concatenate SQL.
- **Input validation at boundaries**: Zod schemas on all API inputs.
- **AuthZ resource-level**: Not just role-based. Check ownership/permissions per resource.
- **Crypto**: TLS 1.2+, approved algorithms, proper key management (KMS/HSM).

### Compliance
- **LGPD by design**: Data mapping, DPIA, consent management, retention policies.
- **SOC2 ready**: Audit logs, access control, encryption at rest/in transit.
- **Supply chain**: Pinned deps, provenance (SLSA), signed artifacts (Cosign).

---

## 5. Architecture Principles

### Decision Making (ADR Required)
- **Every irreversible decision** → ADR (Architecture Decision Record)
- **ADR Format**: Context, Decision, Consequences (Pos/Neg/Risks), Alternatives, References
- **Review ADRs every 6 months** or when context changes significantly

### Design Principles
- **Simplicity first**: Simplest architecture that handles actual requirements.
- **Observability native**: Logs, metrics (RED/USE), traces, actionable alerts from day one.
- **Evolvibility**: API versioning, feature flags, backward compatibility, strangler fig.
- **Cost awareness**: Buy vs build, managed services vs self-hosted, vendor lock-in analysis.
- **Security by design**: Zero trust, defense in depth, threat modeling (STRIDE) for new features.

### Patterns to Prefer
- **Event-driven over sync** for cross-service communication
- **Saga/Outbox** for distributed transactions
- **CQRS** when read/write patterns diverge significantly
- **Feature flags** for gradual rollouts and quick rollbacks

---

## 6. DevOps & Platform

### Infrastructure
- **GitOps**: Desired state in git, automated reconciliation (ArgoCD/Flux).
- **Immutable infrastructure**: Never SSH to prod. Rebuild, don't patch.
- **Policy as Code**: OPA/Gatekeeper, Kyverno, Checkov in pipeline.
- **Secrets**: Vault, Sealed Secrets, External Secrets Operator — zero secrets in git.

### CI/CD
- **Reusable workflows**: Shared CI templates across repos.
- **Pipeline as code**: All CI/CD in version control.
- **Fast feedback**: Typecheck + unit tests < 2 min. Full suite < 10 min.
- **Rollback < 5 min**: Blue/green, canary, feature flags.
- **Disaster recovery tested quarterly**: RTO/RPO documented.

### Observability
- **OpenTelemetry native**: Auto-instrumentation + custom spans.
- **SLO-based alerting**: Burn rate alerts, not threshold alerts.
- **Runbooks for every alert**: Link in alert, actionable steps.
- **Cost monitoring**: Budgets, alerts, right-sizing automation.

---

## 7. Release Management

### Versioning
- **SemVer strict**: PATCH (bugs), MINOR (features), MAJOR (breaking).
- **Layer-specific bumps**: Core components, OpenCode adapter, Codex adapter may differ.
- **Changelog from commits**: Conventional commits → auto-generated + human-enhanced summary.

### Pre-Publish Gate (12-Agent)
1. **Per-change analysis** (up to 10 ultrabrain agents): Correctness, breaking changes, patterns.
2. **Holistic review** (review-work): Manual QA + gate reviewer (goal compliance, quality, security).
3. **Release synthesis** (oracle): Version bump, breaking changes audit, deployment risk.

### Publish Workflow
- **Ship-only**: No code review during publish. Straight to workflow.
- **Three surfaces**: Core components, OpenCode packages, Codex packages — all must verify.
- **Discord announcement mandatory**: Jobdori bot, matching previous style.
- **Completion contract**: Run success + release exists + enhanced summary + Discord + npm verified.

---

## 8. Team Collaboration

### Communication
- **Severino is the only user interface**: All subagents communicate through Severino.
- **Subagents don't talk directly**: Exception = read-only consultations (max 3 lines, closed questions).
- **Consultation → Decision escalation**: If consultation generates decision, stop and call Severino.

### Delegation Rules
- **Complete context always**: Files, specs, decisions, related code.
- **One task per subagent call**: No bundling unrelated tasks.
- **Timeout**: 2-3 iterations max, then Severino takes over or re-delegates.
- **Code review mandatory**: `tranquilao` reviews ALL new code before user sees it.

### When Severino Codes (Not Delegates)
- 1-2 line bugs (typos, off-by-one, missing imports)
- Config adjustments (tsconfig, eslint, docker-compose, .env)
- Simple utility scripts
- Trivial CI fixes
- Quick prototypes to validate before delegating

---

## 9. QA & Evidence

### Evidence Standards
- **Evidence file = QA happened**: No file in `.omo/evidence/` = QA didn't happen = no commit/push.
- **Evidence stays local**: `.omo/evidence/` is gitignored. PR body carries summary + decisive excerpts.
- **Four required sections in evidence**:
  1. What was tested (command, surface, behavior)
  2. What was observed (before/after, isolation proof, artifact path)
  3. Why it's enough (coverage of intended behavior, residual risk)
  4. What was omitted (redacted secrets, summarized logs)

### Isolation Requirements
- **OpenCode QA**: Isolated XDG sandbox (`XDG_DATA_HOME`, etc). Prove via session count before/after.
- **Codex QA**: Isolated `CODEX_HOME` + local mock model. Prove via `~/.codex/config.toml` shasum unchanged.
- **Senpi QA**: Isolated `SENPI_CODING_AGENT_DIR`. Drivers ignore caller-provided dir. Report isolation fields.

---

## 10. Anti-Patterns (Blocking)

| Category | Violation |
|----------|-----------|
| **TypeScript** | `as any`, `@ts-ignore`, `@ts-expect-error` without justification |
| **Testing** | Deleting failing tests to make build green. Skipping tests for behavior changes. |
| **Git** | Working in main worktree. Pushing directly to dev/master. Committing without QA evidence. |
| **CI/CD** | Skipping CI gate. Skipping Cubic because it found issues (only quota exhaustion = skip). |
| **Security** | Hardcoded secrets. String-concatenated SQL. `eval()` or string `setTimeout`. |
| **Architecture** | Making decisions without ADR. Creating catch-all files. Empty catch blocks. |
| **Release** | Publishing without waiting for all agents. Not including diff in agent prompts. |
| **Team** | Subagents making decisions directly. Soft-pedaling adversarial prompts. |

---

## 11. Tooling Standards

### Required Tools
- **Runtime**: Bun 1.4.0 (pinned in CI and devcontainer)
- **TypeScript**: `tsgo --noEmit` (not `tsc`)
- **Lint/Format**: Biome/Oxlint + Prettier
- **Package Manager**: Bun only (no npm/yarn/pnpm)
- **Test**: Bun test (`bun:test`), co-located `*.test.ts`
- **Structural Search**: AST-grep (`sg`) for code patterns

### CI Configuration
- **Fast path**: `script/ci-fast-path.mjs` classifies changes; only runtime-touching changes get full OS matrix.
- **Platform-sensitive**: Windows runs on `windows-latest` (not cross-compiled).
- **Quarantine**: Serial quarantine runs first, then parallelizes remainder.
- **Required checks**: All must pass. No `--admin`, no weakened tests, no retry masking.

---

## 12. Documentation

### Standards
- **README matches reality**: Claims verified against actual features.
- **Public APIs documented**: JSDoc with `@param`, `@returns`, `@throws`.
- **Architecture decisions**: ADRs for irreversible choices, C4 diagrams for systems.
- **Runbooks**: For every alert, every common incident, every operational task.
- **No AI filler**: No "simply", "obviously", "clearly", "moreover", "furthermore" in generated content.

### Prose Testing Forbidden
- Never assert authored agent prompt, SKILL.md, AGENTS.md, or markdown wording.
- Test only: machine-consumed fields, tool names, byte equality, observable runtime behavior.
- Pure prose verified by review and QA-by-read, not automated tests.

---

*This document is a living artifact. Update it when patterns evolve, tools change, or lessons are learned.*