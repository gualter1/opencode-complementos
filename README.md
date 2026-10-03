# Unified OpenCode Agent Team

> **A curated, rewritten, and merged collection of 20 specialized AI agents + 51 skills for OpenCode, synthesized from 4 analyzed repositories.**

---

## 🎯 Purpose

This repository provides a **complete, production-ready agent ecosystem** for OpenCode that you can drop into any project and start using immediately. It solves the problem of fragmented, overlapping, and inconsistent agent definitions by:

1. **Merging 4 source repositories** — keeping the best version of each agent/skill
2. **Rewriting everything from scratch** — no copied files (malware-safe), modern patterns
3. **Adding 11 new specialized agents** — beyond the original 9 core agents
4. **Creating 51 skills** — reusable workflows, patterns, and review guidelines
5. **Providing orchestration infrastructure** — delegation helpers, decision trees, project memory templates

---

## 📦 What's Inside

```
ResultadoFinal/
├── agents/              # 20 specialized agent definitions
├── skills/              # 51 reusable skills (workflows, patterns, reviews)
├── patterns/            # Project templates (CLAUDE.md, ADR, decision tree)
├── utils/               # Delegation helpers (delegate.ts)
└── README.md            # This file
```

### 🤖 Agents (20)

| Category | Agents | Description |
|----------|--------|-------------|
| **Core Team** | `severino`, `towards`, `turing`, `niamaia`, `trevor`, `qualy`, `tranquilao`, `kaspersky`, `guanabara` | Original 9: orchestrator, backend, frontend, architect, platform, QA, reviewer, security, teacher |
| **Extended Team** | `context-guardian`, `archaeologist`, `performance-engineer`, `data-engineer`, `mobile-engineer`, `devrel-engineer` | Context optimization, legacy, performance, data, mobile, DX |
| **Quality/Process** | `auditor`, `security-lead`, `release-manager`, `pr-engineer`, `triage-lead` | Tech debt audit, security orchestration, releases, PR lifecycle, GitHub triage |

**Each agent includes:** role definition, thinking style, stack, rules, output format, delegation triggers, skill references, and verification loop integration.

### 🛠️ Skills (51)

Organized by domain:

| Domain | Skills |
|--------|--------|
| **Code Review** | `backend-code-review` (4 refs), `frontend-code-review` (5 refs), `sast-dast-patterns`, `compliance-patterns` |
| **Architecture** | `architecture-patterns`, `adr-template`, `threat-modeling`, `iac-patterns`, `cicd-patterns`, `observability-patterns` |
| **Testing** | `testing-strategies`, `e2e-cucumber-playwright`, `frontend-testing`, `verification-loop` |
| **Frontend** | `how-to-write-component`, `clean-code-patterns`, `accessibility-ui`, `performance` |
| **Security** | `threat-modeling`, `sast-dast-patterns`, `compliance-patterns`, `security-research` |
| **Process** | `orch-pipeline`, `continuous-learning-v2`, `tech-debt-audit`, `pre-publish-review`, `publish`, `work-with-pr`, `github-triage` |
| **Context** | `context-mode`, `context-budget`, `token-budget-advisor` |
| **Legacy** | `legacy-patterns`, `migration-patterns`, `archaeologist` |
| **Performance** | `profiling-patterns`, `load-testing`, `capacity-planning` |
| **Teaching** | `teaching-patterns`, `analogy-patterns` |
| **Team/Decision** | `dev-team`, `team-builder`, `skill-stocktake`, `recursive-decision-ledger` |

**Each skill has:** `SKILL.md` with when/how to use, workflow patterns, best practices, and troubleshooting.

### 📋 Patterns (3 Templates)

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Living project memory — tech stack, conventions, security baseline, observability, ADR index |
| `ADR-template.md` | Nygard-format Architecture Decision Records with checklist, index, and filled example |
| `decision-tree.md` | Visual + text decision tree for routing demands through 20 agents (Mermaid + routing table) |

### ⚙️ Utils

| File | Purpose |
|------|---------|
| `delegate.ts` | TypeScript helpers: `gatherContext()`, `createStandardFeatureFlow()`, `createDelegationSpec()`, `invokeSkill()`, `executeFlow()` — used by Severino for consistent delegation |

---

## 🚀 Quick Start

### 1. Copy to Your Project

```bash
# Copy the entire folder to your project root
cp -r /path/to/ResultadoFinal /your-project/.opencode/agents/ResultadoFinal
```

Or clone directly into your OpenCode agents directory:

```bash
cd ~/.config/opencode/agent/
git clone https://github.com/gualter1/opencode-complementos.git ResultadoFinal
```

### 2. Configure Severino as Primary Agent

In your `opencode.json` or via CLI:

```json
{
  "agent": "severino",
  "model": "9router/Tech"
}
```

### 3. Start Working

```
> @severino "Create a JWT auth system with refresh tokens"
```

Severino will:
1. Classify the work via `orch-pipeline`
2. Check `context-budget`
3. Request ADR from `niamaia` (irreversible decision)
4. Request threat model from `kaspersky` (auth = security-sensitive)
4. Create implementation plan via `towards`
5. Design tests via `qualy`
6. Implement backend (`towards`) + frontend (`turing`) in parallel
7. Review via `tranquilao` (mandatory gate)
8. Run `verification-loop` (mandatory before PR)
9. Capture learnings via `continuous-learning-v2`

---

## 🧠 How It Works

### The Orchestration Model

```
┌─────────────────────────────────────────────────────────────┐
│                      SEVERINO (Orchestrator)                │
│  • Only interface with user                                 │
│  • Decides architecture, stack, patterns                    │
│  • Delegates to subagents via subagent tool                 │
│  • Resolves conflicts, approves/rejects deliveries          │
│  • Maintains CLAUDE.md (living project memory)              │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   TOWARDS     │     │   TURING      │     │   NIAMAIA     │
│ Backend/API   │     │ Frontend/UX   │     │ Architecture  │
│ Database      │     │ Design System │     │ ADRs/Tradeoffs│
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    ┌───────────────────┐
                    │   TRANQUILÃO      │
                    │ Code Review Gate  │
                    │ (MANDATORY)       │
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ VERIFICATION LOOP │
                    │ (MANDATORY)       │
                    └───────────────────┘
```

### Mandatory Gates (Cannot Skip)

| Gate | Skill | When |
|------|-------|------|
| **Size Classification** | `orch-pipeline` | Every new demand |
| **Context Budget** | `context-budget` | Before adding agents/skills |
| **Architecture Decision** | `adr-template` + `niamaia` | Irreversible decisions |
| **Threat Modeling** | `threat-modeling` + `kaspersky` | Auth/Payments/PII |
| **Code Review** | `tranquilao` | **Before any merge** |
| **Verification Loop** | `verification-loop` | **Before PR** |
| **Continuous Learning** | `continuous-learning-v2` | After feature complete |
| **Release Gate** | `pre-publish-review` (12 agents) | Before publish |

---

## 📚 Source Repositories (Merged & Rewritten)

This repository synthesizes the best from:

| Source | Contribution |
|--------|--------------|
| **Resultado1** | Core 9 agents (Severino, Towards, Turing, Niamaia, Trevor, Qualy, Tranquilão, Kaspersky, Guanabara) |
| **Resultado2** | Extended agents (Context-Guardian, Archaeologist, Performance-Engineer, Data-Engineer, Mobile-Engineer, DevRel-Engineer) |
| **Resultado3** | Quality/Process agents (Auditor, Security-Lead, Release-Manager, PR-Engineer, Triage-Lead) |
| **Resultado4** | Additional skills and patterns |
| **opencode-agents** | Reference patterns from [gualter1/opencode-complementos](https://github.com/gualter1/opencode-complementos.git) |

> **Important:** All files were **rewritten from scratch** — no direct copying. This eliminates malware risk and ensures modern, consistent patterns.

---

## 🔗 Related Repository

**Reference/Upstream:** https://github.com/gualter1/opencode-complementos.git

This repository (`ResultadoFinal`) is a **curated, enhanced, and restructured derivative** of the patterns and agents found in `opencode-complementos`. It adds:

- ✅ 11 new specialized agents
- ✅ Unified skill system (51 skills vs scattered patterns)
- ✅ Delegation infrastructure (`delegate.ts`)
- ✅ Project templates (`CLAUDE.md`, `ADR-template.md`)
- ✅ Visual decision tree for orchestration
- ✅ Mandatory gate enforcement
- ✅ Consistent formatting and cross-references

---

## 📖 Usage Examples

### Feature Development
```
> @severino "Build a real-time notifications system with WebSocket"
```
→ Routes through full standard flow with parallel BE/FE implementation

### Security-Sensitive Work
```
> @severino "Implement payment processing with Stripe"
```
→ Triggers mandatory `kaspersky` threat model + `niamaia` ADR before implementation

### Legacy Migration
```
> @severino "Understand the legacy billing module and plan migration"
```
→ Spawns `archaeologist` for code archaeology → `niamaia` for migration ADR → phased implementation

### Performance Issue
```
> @severino "API /users is slow at 10k req/s"
```
→ Spawns `performance-engineer` for profiling → `towards` for fixes → `tranquilao` review → `verification-loop`

### Release
```
> @severino "Publish v2.3.0"
```
→ Invokes `release-manager` → 12-agent `pre-publish-review` gate → `publish` workflow

---

## 🛡️ Safety & Quality

- **No copied code** — everything rewritten
- **Explicit permissions** — each agent declares allowed tools
- **Mandatory reviews** — `tranquilao` gate on all code
- **Verification loops** — automated quality gates
- **ADR enforcement** — irreversible decisions documented
- **Threat modeling** — security by design for sensitive features
- **Context management** — prevents overflow in long sessions

---

## 🤝 Contributing

This is a curated collection. To propose changes:

1. Open an issue describing the improvement
2. Reference which agent/skill/pattern is affected
3. Explain the rationale (trade-offs, alternatives considered)
4. If accepted, changes will be rewritten to match project standards

---

## 📄 License

MIT — Use freely in your projects.

---

## 🙏 Credits

- **Original patterns:** [gualter1/opencode-complementos](https://github.com/gualter1/opencode-complementos.git)
- **Architecture inspiration:** Dify, Anthropic, Google Engineering Practices
- **Agent design:** OpenCode community patterns

---

**Ready to use.** Drop into any project and start orchestrating.
