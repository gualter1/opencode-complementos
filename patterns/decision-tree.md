# Decision Tree: Agent Orchestration Flow

> **Visual guide for Severino** — how demands route through the agent team
> **Legend:** 🟦 Decision Point | 🟩 Action/Delegate | 🟨 Skill Gate | 🟥 Blocker/Escalation

---

```mermaid
flowchart TD
    %% ============ ENTRY POINT ============
    START([👤 User Demand]) --> RECEIVE[🟦 Severino: Receive & Analyze]
    
    RECEIVE --> AMBIGUOUS{Ambiguous?}
    AMBIGUOUS -->|Yes| CLARIFY[Ask clarifying questions]
    CLARIFY --> RECEIVE
    AMBIGUOUS -->|No| CLASSIFY[🟨 orch-pipeline: Classify size]
    
    CLASSIFY --> SIZE{Size?}
    SIZE -->|Trivial <30min| DIRECT[🟩 Severino codes directly]
    SIZE -->|Small 2-4h| SIMPLE[🟩 Single agent]
    SIZE -->|Standard 1-3 days| STANDARD[🟦 Standard Flow]
    SIZE -->|Large >3 days| LARGE[🟦 Decompose → Multiple PRs]
    
    %% ============ TRIVIAL ============
    DIRECT --> VERIFY_TRIVIAL[🟨 verification-loop]
    VERIFY_TRIVIAL --> DONE_TRIVIAL([✅ Done])
    
    %% ============ SIMPLE ============
    SIMPLE --> DOMAIN{Domain?}
    DOMAIN -->|Backend/API/DB| TOWARDS[🟩 towards]
    DOMAIN -->|Frontend/UI| TURING[🟩 turing]
    DOMAIN -->|Infra/CI/CD| TREVOR[🟩 trevor]
    DOMAIN -->|Tests| QUALY[🟩 qualy]
    DOMAIN -->|Security audit| KASPERSKY[🟩 kaspersky]
    DOMAIN -->|Architecture| NIAMAIA[🟩 niamaia]
    DOMAIN -->|Legacy understanding| ARCHAEOLOGIST[🟩 archaeologist]
    DOMAIN -->|Performance| PERF[🟩 performance-engineer]
    DOMAIN -->|Data pipelines| DATA[🟩 data-engineer]
    DOMAIN -->|Mobile| MOBILE[🟩 mobile-engineer]
    DOMAIN -->|DX/Docs/SDK| DEVREL[🟩 devrel-engineer]
    DOMAIN -->|Teaching/Onboarding| GUANABARA[🟩 guanabara]
    
    TOWARDS --> REVIEW_SIMPLE[🟩 tranquilao review]
    TURING --> REVIEW_SIMPLE
    TREVOR --> REVIEW_SIMPLE
    QUALY --> REVIEW_SIMPLE
    KASPERSKY --> REVIEW_SIMPLE
    NIAMAIA --> REVIEW_SIMPLE
    ARCHAEOLOGIST --> REVIEW_SIMPLE
    PERF --> REVIEW_SIMPLE
    DATA --> REVIEW_SIMPLE
    MOBILE --> REVIEW_SIMPLE
    DEVREL --> REVIEW_SIMPLE
    GUANABARA --> REVIEW_SIMPLE
    
    REVIEW_SIMPLE --> VERIFY_SIMPLE[🟨 verification-loop]
    VERIFY_SIMPLE --> DONE_SIMPLE([✅ Done])
    
    %% ============ STANDARD FLOW ============
    STANDARD --> CONTEXT_CHECK[🟨 context-budget: Check context]
    CONTEXT_CHECK --> OVER_BUDGET{Over budget?}
    OVER_BUDGET -->|Yes| GUARDIAN[🟩 context-guardian: Compact]
    GUARDIAN --> CONTEXT_CHECK
    OVER_BUDGET -->|No| ARCH_DECISION{Arch decision needed?}
    
    ARCH_DECISION -->|Yes| NIAMAIA_ADR[🟩 niamaia: ADR]
    NIAMAIA_ADR --> ADR_DONE{ADR Accepted?}
    ADR_DONE -->|No| REVISE_ADR[Revise ADR]
    REVISE_ADR --> NIAMAIA_ADR
    ADR_DONE -->|Yes| SEC_CHECK
    ARCH_DECISION -->|No| SEC_CHECK
    
    SEC_CHECK --> SECURITY_SENSITIVE{Auth/Payments/PII/External?}
    SECURITY_SENSITIVE -->|Yes| THREAT_MODEL[🟩 kaspersky: Threat Model]
    THREAT_MODEL --> TM_DONE{Threats mitigated?}
    TM_DONE -->|No| FIX_THREATS[Fix threats]
    FIX_THREATS --> THREAT_MODEL
    TM_DONE -->|Yes| PLAN
    SECURITY_SENSITIVE -->|No| PLAN
    
    PLAN --> IMPL_PLAN[🟩 towards/turing: Implementation Plan]
    IMPL_PLAN --> TEST_DESIGN[🟩 qualy: Test Design]
    
    TEST_DESIGN --> PARALLEL{Can parallelize?}
    PARALLEL -->|Yes: FE + BE| PARALLEL_IMPL[🟩 towards + turing parallel]
    PARALLEL -->|No| SEQUENTIAL_IMPL[🟩 towards OR turing]
    
    PARALLEL_IMPL --> REVIEW_FULL[🟩 tranquilao: Full Review]
    SEQUENTIAL_IMPL --> REVIEW_FULL
    
    REVIEW_FULL --> REVIEW_RESULT{Review Status?}
    REVIEW_RESULT -->|BLOCKER| FIX_BLOCKER[Fix blockers]
    FIX_BLOCKER --> REVIEW_FULL
    REVIEW_RESULT -->|MAJOR| FIX_MAJOR[Fix major issues]
    FIX_MAJOR --> REVIEW_FULL
    REVIEW_RESULT -->|MINOR/NIT| OPTIONAL_FIX[Optional fixes]
    OPTIONAL_FIX --> VERIFY_FULL
    REVIEW_RESULT -->|APPROVED| VERIFY_FULL
    
    VERIFY_FULL --> VERIFY_LOOP[🟨 verification-loop]
    VERIFY_LOOP --> VERIFY_PASS{All gates pass?}
    VERIFY_PASS -->|No| FIX_VERIFY[Fix failures]
    FIX_VERIFY --> VERIFY_LOOP
    VERIFY_PASS -->|Yes| LEARN[🟨 continuous-learning-v2]
    LEARN --> DONE_STANDARD([✅ Ready for PR])
    
    %% ============ LARGE ============
    LARGE --> DECOMPOSE[🟩 pr-engineer: Decompose to atomic PRs]
    DECOMPOSE --> PR_PLAN{PR Plan}
    PR_PLAN -->|Independent| PARALLEL_PRS[Multiple PRs in parallel]
    PR_PLAN -->|Dependent| SEQUENTIAL_PRS[Sequential PR chain]
    
    PARALLEL_PRS --> STANDARD
    SEQUENTIAL_PRS --> STANDARD
    
    %% ============ SPECIAL TRIGGERS ============
    %% Release
    RELEASE_TRIGGER[👤 User: "publish" / "release"] --> RELEASE_MGR[🟩 release-manager]
    RELEASE_MGR --> PRE_PUBLISH[🟨 pre-publish-review: 12-agent gate]
    PRE_PUBLISH --> GATE_PASS{All 12 pass?}
    GATE_PASS -->|No| FIX_RELEASE[Fix issues]
    FIX_RELEASE --> PRE_PUBLISH
    GATE_PASS -->|Yes| PUBLISH[🟨 publish workflow]
    PUBLISH --> DONE_RELEASE([📦 Published])
    
    %% Security Deep Dive
    SEC_DEEP[👤 User: "security audit" / "pen test prep"] --> SEC_LEAD[🟩 security-lead]
    SEC_LEAD --> TEAM_MODE[Team Mode: 5 agents]
    TEAM_MODE --> SEC_REPORT([📋 Security Report])
    
    %% Tech Debt
    DEBT_TRIGGER[👤 User: "tech debt audit" / "refactor"] --> AUDITOR[🟩 auditor]
    AUDITOR --> AUDIT_REPORT[📋 TECH_DEBT_AUDIT.md]
    AUDIT_REPORT --> PRIORITIZE[🟦 Severino: Prioritize]
    PRIORITIZE --> STANDARD
    
    %% Triage
    TRIAGE_TRIGGER[👤 User: "triage backlog" / "release prep"] --> TRIAGE[🟩 triage-lead]
    TRIAGE --> TRIAGE_REPORT[📋 Triage Report]
    
    %% Legacy/Migration
    LEGACY_TRIGGER[👤 User: "understand legacy" / "migrate"] --> ARCHAEO[🟩 archaeologist]
    ARCHAEO --> MIGRATION_PLAN[📋 Migration Plan]
    MIGRATION_PLAN --> STANDARD
    
    %% ============ CONSULTATION FLOW ============
    CONSULT[Subagent needs clarification] --> CONSULT_TYPE{Type?}
    CONSULT_TYPE -->|Spec clarification| PEER_CONSULT[🟩 Peer agent: Read-only consult]
    CONSULT_TYPE -->|Decision needed| SEVERINO_DECIDE[🟦 Severino decides]
    PEER_CONSULT --> CONSULT_ANSWER{Answer generates decision?}
    CONSULT_ANSWER -->|Yes| SEVERINO_DECIDE
    CONSULT_ANSWER -->|No| CONTINUE[Continue implementation]
    SEVERINO_DECIDE --> CONTINUE
    
    %% ============ ERROR HANDLING ============
    AGENT_STUCK[Subagent stuck >3 iterations] --> INTERVENE[🟦 Severino intervenes]
    INTERVENE --> REASSIGN[Re-delegate OR code directly]
    REASSIGN --> STANDARD
    
    CONFLICT[Agents disagree] --> SEVERINO_RESOLVE[🟦 Severino resolves]
    SEVERINO_RESOLVE --> CONTINUE
    
    %% ============ STYLING ============
    classDef decision fill:#1e3a5f,stroke:#3b82f6,stroke-width:2px,color:#fff
    classDef action fill:#14532d,stroke:#22c55e,stroke-width:2px,color:#fff
    classDef skill fill:#854d0e,stroke:#f59e0b,stroke-width:2px,color:#fff
    classDef blocker fill:#7f1d1d,stroke:#ef4444,stroke-width:2px,color:#fff
    classDef done fill:#36260e,stroke:#fbbf24,stroke-width:2px,color:#fff
    classDef user fill:#4c1d95,stroke:#a855f7,stroke-width:2px,color:#fff
    
    class AMBIGUOUS,SIZE,DOMAIN,OVER_BUDGET,ARCH_DECISION,ADR_DONE,SECURITY_SENSITIVE,TM_DONE,PARALLEL,REVIEW_RESULT,VERIFY_PASS,GATE_PASS,CONSULT_TYPE,CONSULT_ANSWER decision
    class CLARIFY,DIRECT,TOWARDS,TURING,TREVOR,QUALY,KASPERSKY,NIAMAIA,ARCHAEOLOGIST,PERF,DATA,MOBILE,DEVREL,GUANABARA,NIAMAIA_ADR,THREAT_MODEL,IMPL_PLAN,TEST_DESIGN,PARALLEL_IMPL,SEQUENTIAL_IMPL,REVIEW_FULL,FIX_BLOCKER,FIX_MAJOR,OPTIONAL_FIX,LEARN,DECOMPOSE,PARALLEL_PRS,SEQUENTIAL_PRS,RELEASE_MGR,PUBLISH,SEC_LEAD,TEAM_MODE,AUDITOR,PRIORITIZE,TRIAGE,ARCHAEO,CONSULT,PEER_CONSULT,SEVERINO_DECIDE,INTERVENE,REASSIGN,SEVERINO_RESOLVE action
    class CLASSIFY,CONTEXT_CHECK,VERIFY_TRIVIAL,VERIFY_SIMPLE,VERIFY_FULL,VERIFY_LOOP,PRE_PUBLISH skill
    class FIX_THREATS,FIX_VERIFY,FIX_RELEASE blocker
    class DONE_TRIVIAL,DONE_SIMPLE,DONE_STANDARD,DONE_RELEASE,SEC_REPORT,AUDIT_REPORT,TRIAGE_REPORT,MIGRATION_PLAN done
    class START,RELEASE_TRIGGER,SEC_DEEP,DEBT_TRIGGER,TRIAGE_TRIGGER,LEGACY_TRIGGER user
```

---

## Text-Based Decision Tree (for quick reference)

```
USER DEMAND
    │
    ▼
┌─────────────────────────────────────┐
│ SEVERINO: Receive & Analyze         │
│ • Scope, complexity, risks, deps    │
│ • Ambiguous? → Ask questions        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 🟨 orch-pipeline: Classify Size     │
└─────────────────────────────────────┘
    │
    ├──────────────────┬──────────────────┬──────────────────┐
    ▼                  ▼                  ▼                  ▼
 TRIVIAL            SMALL              STANDARD           LARGE
 (<30min)           (2-4h)             (1-3 days)         (>3 days)
    │                  │                  │                  │
    ▼                  ▼                  ▼                  ▼
Severino codes   Single agent      Full orchestration   pr-engineer:
directly         (see routing)      flow below          decompose →
    │                  │                  │              atomic PRs
    ▼                  ▼                  ▼                  │
verification-loop  tranquilao +       ┌──────────────────┐  │
    │            verification-loop    │ STANDARD FLOW    │  │
    ▼                  ▼              └──────────────────┘  │
  DONE               DONE                 │                  │
                                        ▼                  ▼
                                   context-budget        (routes to
                                        │             STANDARD FLOW)
                                        ▼
                              ┌─────────────────────┐
                              │ Architecture        │
                              │ decision needed?    │
                              └─────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
                      YES                      NO
                        │                       │
                        ▼                       ▼
                  ┌───────────┐          ┌─────────────┐
                  │ niamaia:  │          │ Security    │
                  │ ADR       │          │ sensitive?  │
                  └───────────┘          └─────────────┘
                        │                       │
                ┌───────┴───────┐      ┌────────┴────────┐
                ▼               ▼      ▼                 ▼
           ADR Accepted?    No     YES                 NO
                │                        │                 │
         ┌──────┴──────┐         ┌──────┴──────┐          │
         ▼             ▼         ▼             ▼          ▼
       YES            NO      Threat         Mitigated?   Implementation
         │             │      Model           │            Plan
         ▼             ▼         │      ┌──────┴──────┐     │
      Continue      Revise   Mitigated?   YES          NO  ▼
         │             │         │            │           Fix
         ▼             ▼         ▼            ▼           threats
      Continue    Continue    Continue    Continue      ▼
         │             │         │            │      Threat
         ▼             ▼         ▼            ▼      Model
      Implementation Plan ← Test Design ← Parallel? ← Implementation
         │                                  │
    ┌────┴────┐                         ┌────┴────┐
    ▼         ▼                         ▼         ▼
   FE + BE   Sequential            towards    turing
  parallel  (one agent)              OR        OR
    │         │                       other     other
    └────┬────┘                         └────┬────┘
         ▼                                    ▼
    ┌─────────────────────────────────────────────┐
    │ tranquilao: Code Review (MANDATORY)         │
    │ BLOCKER → fix → re-review                   │
    │ MAJOR → fix → re-review                     │
    │ MINOR/NIT → optional                        │
    │ APPROVED → continue                         │
    └─────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────┐
    │ 🟨 verification-loop (MANDATORY)    │
    │ 1. Build passes                     │
    │ 2. Typecheck zero errors            │
    │ 3. Lint zero warnings               │
    │ 4. Tests pass + coverage thresholds │
    │ 5. Security scan clean              │
    │ 6. Architecture check               │
    │ 7. Diff review intentional only     │
    └─────────────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
  PASS      FAIL
    │         │
    ▼         ▼
continuous-  Fix failures
learning-v2   ▼
    │      verification-loop
    ▼
   DONE ✅
```

---

## Agent Routing Table (SMALL tasks)

| Demand Keywords | Primary Agent | Reviewer | Skills Invoked |
|-----------------|---------------|----------|----------------|
| API, backend, database, refactor, debug | **towards** | tranquilao | backend-code-review, clean-code-patterns, testing-strategies |
| UI, frontend, React, accessibility, design system | **turing** | tranquilao | frontend-code-review, frontend-testing, how-to-write-component |
| Deploy, CI/CD, K8s, cloud, infra, observability | **trevor** | tranquilao | iac-patterns, cicd-patterns, observability-patterns |
| Test strategy, flakiness, E2E, contract testing | **qualy** | tranquilao | testing-strategies, e2e-cucumber-playwright |
| Auth, payments, PII, crypto, compliance | **kaspersky** | tranquilao | threat-modeling, sast-dast-patterns, compliance-patterns |
| New stack, ADR, scaling, integration, patterns | **niamaia** | tranquilao | architecture-patterns, adr-template, threat-modeling |
| Legacy code, migration, characterization tests | **archaeologist** | tranquilao | legacy-patterns, migration-patterns |
| Performance regression, profiling, capacity | **performance-engineer** | tranquilao | profiling-patterns, load-testing, capacity-planning |
| Data pipelines, ETL, warehouse, ML ops | **data-engineer** | tranquilao | architecture-patterns, clean-code-patterns, testing-strategies |
| React Native, Expo, iOS/Android, offline-first | **mobile-engineer** | tranquilao | clean-code-patterns, testing-strategies |
| Public API, SDK, docs, developer onboarding | **devrel-engineer** | tranquilao | teaching-patterns, analogy-patterns |
| Explain concept, onboard, document | **guanabara** | (N/A) | teaching-patterns, analogy-patterns |
| Context overflow, long sessions | **context-guardian** | (N/A) | context-budget, token-budget-advisor |

---

## Mandatory Gates (Cannot Skip)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEVERINO GATES                               │
├──────────────────┬──────────────────────────────────────────────┤
| Gate             | When                                         |
├──────────────────┼──────────────────────────────────────────────┤
| orch-pipeline    | EVERY new demand (classify size)             |
| context-budget   | Before adding agents/skills                  |
| niamaia (ADR)    | Irreversible decisions (stack, DB, auth...)  |
| kaspersky        | Auth/Payments/PII/External integrations      |
| tranquilao       | BEFORE any merge (code review)               |
| verification-loop| BEFORE PR (build, types, lint, tests, sec...)|
| continuous-lrn   | After feature complete                       |
| pre-publish-review| User asks "can I publish?"                 |
| publish          | User says "publish patch/minor/major"        |
| tech-debt-audit  | Periodic / pre-major-refactor                |
| security-research| Team Mode security audit for critical features|
└──────────────────┴──────────────────────────────────────────────┘
```

---

## Parallelization Rules

| Scenario | Agents | Coordination |
|----------|--------|--------------|
| **New feature** | towards (BE) + turing (FE) | Severino shares context, merges at review |
| **Refactor + Tests** | towards + qualy | qualy designs tests first, towards implements |
| **Infra + App** | trevor + towards | trevor provisions, towards adapts |
| **Security + Perf** | kaspersky + perf-engineer | kaspersky models threats, perf validates impact |
| **Multiple independent PRs** | pr-engineer spawns | Each PR runs full standard flow |

---

## Escalation Paths

```
Subagent Stuck (>3 iterations)
         │
         ▼
    Severino intervenes
         │
         ├─→ Re-delegate to different agent
         ├─→ Code directly (if trivial)
         └─→ Call niamaia (if architectural)

────────────────────────────────────────

Agents Disagree (e.g. towards vs turing on API contract)
         │
         ▼
    Severino decides
         │
         ├─→ Creates ADR if irreversible
         ├─→ Documents decision in CLAUDE.md
         └─→ Both agents follow decision

────────────────────────────────────────

Verification Loop Fails
         │
         ▼
    Fix failures → re-run verification-loop
         │
         ├─→ Build/Type/Lint → towards/turing fixes
         ├─→ Tests → qualy + author fix
         ├─→ Security → kaspersky + author fix
         ├─→ Architecture → niamaia + author fix
         └─→ Diff review → author clarifies/fixes
```

---

## Quick Decision Card (Severino Pocket Reference)

```
┌─────────────────────────────────────────────────────────────┐
│  DEMAND RECEIVED → WHAT DO I DO?                            │
├─────────────────────────────────────────────────────────────┤
│  "Fix typo / config / small bug"        → Severino codes    │
│  "Add endpoint / refactor service"      → towards           │
│  "Build UI / fix accessibility"         → turing            │
│  "Setup CI / deploy / scale"            → trevor            │
│  "Design tests / fix flakiness"         → qualy             │
│  "Security review / threat model"       → kaspersky         │
│  "New database / message queue / stack" → niamaia           │
│  "Understand legacy / plan migration"   → archaeologist     │
│  "It's slow / capacity planning"        → performance-eng   │
│  "Data pipeline / warehouse / ML"       → data-engineer     │
│  "Mobile app / React Native"            → mobile-engineer   │
│  "Public API docs / SDK / examples"     → devrel-engineer   │
│  "Teach me / explain / onboard"         → guanabara         │
│  "Context full / session long"          → context-guardian  │
│  "Publish / release"                    → release-manager   │
│  "Deep security audit"                  → security-lead     │
│  "Tech debt audit"                      → auditor           │
│  "Triage backlog / issues / PRs"        → triage-lead       │
│  "Decompose to atomic PRs"              → pr-engineer       │
└─────────────────────────────────────────────────────────────┘

REMEMBER:
✓ Always gatherContext() before delegating
✓ Always tranquilao before merge
✓ Always verification-loop before PR
✓ Always ADR for irreversible decisions
✓ Always threat model for auth/payments/PII
✓ Subagents don't decide — they inform, you decide
```

---

*Generated for ResultadoFinal agent team. Keep updated as agents/skills evolve.*