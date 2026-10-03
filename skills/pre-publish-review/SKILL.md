---
description: Pre-Publish Review - 12-agent nuclear-grade release gate. Per-change deep dive (10 ultrabrain), holistic review (review-work), release synthesis (oracle). Version bump, breaking changes audit.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Pre-Publish Review - 12-Agent Nuclear-Grade Release Gate Skill

## Purpose
Defines the pre-publish review process: a 12-agent nuclear-grade gate that runs BEFORE any publish when explicitly requested. Three-layer architecture ensures only release-ready code reaches production.

## When to Invoke
- User explicitly asks: "pre-publish review", "review before publish", "release review", "can I publish?" (used by `release-manager`, `severino`)
- Major version releases
- Security-sensitive releases
- Compliance-required releases

---

## Two Modes (Critical Distinction)

| Mode | Trigger | Purpose |
|------|---------|---------|
| **Pre-Publish Review** | Explicit user request | 12-agent gate, deep analysis, CAN block |
| **Publish Workflow** | "publish patch/minor/major" | Ship-only, straight to workflow, NO re-review |

**NEVER** run pre-publish-review as part of publish request. They are mutually exclusive.

---

## Architecture: Three Layers

| Layer | Agents | Type | What They Check |
|-------|--------|------|-----------------|
| **Per-Change Deep Dive** | up to 10 | `ultrabrain` | Each logical change group individually — correctness, edge cases, pattern adherence |
| **Holistic Review** | 1 (+ orchestrator QA) | `review-work` | Manual QA by orchestrator, then gate reviewer covering goal compliance, code quality, security, missed context |
| **Release Synthesis** | 1 | `oracle` | Overall release readiness, version bump, breaking changes, deployment risk |

---

## Release Layer Taxonomy

| Release Layer | Scope | Version Decision |
|---------------|-------|------------------|
| `omo pure components` | Core packages, MCP packages, shared skills, reusable scripts, platform binary inputs | Patch/minor/major for shared logic consumed by adapters |
| `omo opencode` | Root oh-my-opencode/oh-my-openagent, src/, OpenCode plugin hooks/tools/CLI/config/docs, .opencode/, .agents/ | Semver bump for OpenCode/OpenAgent npm release |
| `omo codex` | packages/omo-codex, lazycodex-ai, Codex plugin metadata/hooks, bundled MCP runtimes, code-yeongyu/lazycodex marketplace | Codex adapter bump, LazyCodex npm publish risk, marketplace/GitHub release need |

---

## Phase 0: Detect Unpublished Changes

```bash
# Run FIRST. Single source of truth.
/get-unpublished-changes
# Output: grouped by feat/fix/refactor/docs with scope, commits, files, diff
```

---

## Phase 1: Parse Changes into Groups

```markdown
## Change Grouping Rules

1. Start from `/get-unpublished-changes` output (already grouped by feat/fix/refactor/docs with scope)
2. Further split by module/area — changes touching same module belong together
3. Target up to 10 groups
4. If < 10 commits, each commit = own group
5. If > 10 areas, merge smallest
6. For each group: name, release layer(s), commits, files, diff, file contents
```

---

## Phase 2: Spawn All Agents (PARALLEL, background=true)

### Layer 1: Ultrabrain Per-Change (up to 10)

Each gets ONLY its diff portion.

```markdown
## Ultrabrain Deep Dive Prompt

You are reviewing a SINGLE logical change group for pre-publish review.

### Context
- Release Layer: [omo pure components | omo opencode | omo codex]
- Change Group: [name]
- Commits: [list]
- Files: [list]
- Diff: [full diff for this group ONLY]
- File Contents: [key files for context]

### Review Checklist (Each Criterion: PASS/FAIL/CONCERN)

#### Intent Clarity
- [ ] Commit messages explain WHAT and WHY
- [ ] Changes match stated intent
- [ ] No scope creep

#### Correctness (Test 3+ Scenarios)
- [ ] Happy path
- [ ] Error/edge cases
- [ ] Boundary conditions
- [ ] Concurrency/race conditions (if applicable)

#### Breaking Changes
- [ ] API contracts: additions only (no removals/changes)
- [ ] Database: backward compatible (additive migrations)
- [ ] Config: new optional only, no required changes
- [ ] Events: new fields only, no schema breaks

#### Pattern Adherence
- [ ] Follows codebase conventions (lint, types, naming)
- [ ] Uses established abstractions (repositories, services, hooks)
- [ ] No duplicate implementations

#### Edge Cases
- [ ] Null/undefined handling
- [ ] Empty collections
- [ ] Large inputs (pagination, streaming)
- [ ] Partial failures
- [ ] Timeouts/retries

#### Error Handling
- [ ] Result types for expected errors
- [ ] No silent failures
- [ ] Structured logging
- [ ] No sensitive data in errors/logs

#### Type Safety
- [ ] Zero `any` without justification
- [ ] Proper generics
- [ ] Exhaustive matching (discriminated unions)

#### Test Coverage
- [ ] Unit tests for logic
- [ ] Integration tests for contracts
- [ ] E2E for critical paths (if applicable)

#### Side Effects
- [ ] No unexpected mutations
- [ ] No global state changes
- [ ] No console.log/debugger

#### Release Risk
- **SAFE**: No concerns, follows patterns, tested
- **CAUTION**: Minor concerns, needs monitoring
- **RISKY**: Significant concerns, may block

### Output Format
```json
{
  "group": "group-name",
  "verdict": "SAFE|CAUTION|RISKY",
  "findings": [
    {"criterion": "Intent Clarity", "status": "PASS", "notes": ""},
    {"criterion": "Correctness", "status": "CONCERN", "notes": "Missing null check on line 45"},
    ...
  ],
  "blockers": ["Specific blocking issues"],
  "recommendations": ["Actionable suggestions"]
}
```
```

### Layer 2: Holistic Review via `/review-work`

Spawns manual QA on real surface, then gate reviewer.

```markdown
## Holistic Review Process

### Step 1: Manual QA (Orchestrator)
- Drive real harness (tmux, browser, API, CLI)
- Test cross-group interactions
- Verify user-facing flows end-to-end
- Check: "Does this actually solve the user problem?"

### Step 2: Gate Reviewer (review-work)
Reviews:
1. **Goal Compliance**: Does the change achieve stated objective?
2. **Code Quality**: Patterns, maintainability, technical debt
3. **Security**: AuthZ, injection, secrets, PII, supply chain
4. **Missed Context**: Dependencies, migrations, rollback, config
5. **QA Audit**: Evidence quality, test coverage, edge cases covered

### Gate Reviewer Verdict
- **PASS**: Ready for release synthesis
- **FAIL**: Blocking issues found → return to Phase 1
```

### Layer 3: Oracle Release Synthesis

Gets full picture: all commits, full diff stat, changed file list, key file contents.

```markdown
## Oracle Release Synthesis Prompt

You are the Release Oracle. Review the COMPLETE release picture.

### Inputs
- All commits: [list with messages]
- Full diff stat: [files changed, +lines/-lines]
- Changed file list: [all files]
- Key file contents: [critical files]
- Ultrabrain results: [all group verdicts]
- Holistic review: [verdict + findings]
- Current version: [x.y.z]

### Synthesis Checklist

#### Release Coherence
- [ ] Changes form coherent release theme
- [ ] No conflicting changes across groups
- [ ] Dependencies between groups resolved

#### Version Bump (Semver per Layer)
| Layer | Current | Bump | Reason |
|-------|---------|------|--------|
| omo pure components | | patch/minor/major | |
| omo opencode | | patch/minor/major | |
| omo codex | | patch/minor/major | |

#### Breaking Changes Audit
- [ ] API: Any removed/changed endpoints?
- [ ] DB: Any non-additive migrations?
- [ ] Config: Any required new vars?
- [ ] Events: Any schema changes?
- [ ] CLI: Any command changes?

#### Migration Requirements
- [ ] DB migrations: backward compatible?
- [ ] Data migrations: idempotent, tested?
- [ ] Config migrations: documented?
- [ ] Feature flags: rollout plan?

#### Dependency Changes
- [ ] New deps: justified, licensed, pinned?
- [ ] Updated deps: breaking changes reviewed?
- [ ] Removed deps: no orphaned code?

#### Changelog Draft
- [ ] User-facing changes captured
- [ ] Grouped by theme/capability
- [ ] Concrete language: "You can now..."

#### Deployment Risk
- [ ] Rollback tested?
- [ ] Canary/blue-green ready?
- [ ] Feature flags for risky changes?
- [ ] Monitoring/alerts updated?

#### Post-Publish Monitoring
- [ ] Key metrics to watch
- [ ] Alert thresholds
- [ ] Rollback triggers

### Output
```json
{
  "verdict": "SAFE|CAUTION|RISKY|BLOCK",
  "version_bumps": {
    "omo pure components": "patch",
    "omo opencode": "minor",
    "omo codex": "patch"
  },
  "breaking_changes": [],
  "changelog_draft": "markdown",
  "deployment_risk": "LOW|MEDIUM|HIGH",
  "monitoring_plan": "..."
}
```
```

---

## Phase 3: Collect Results

```typescript
// Poll background_output() per task
// Track completion
// Do NOT deliver final report until ALL complete
async function collectResults(taskIds: string[]): Promise<CollectedResults> {
  const results = [];
  for (const id of taskIds) {
    const output = await tools.background_output({ task_id: id });
    results.push(output);
  }
  return results;
}
```

---

## Phase 4: Final Verdict Logic

```typescript
function computeFinalVerdict(
  oracle: OracleResult,
  ultrabrains: UltrabrainResult[],
  holistic: HolisticResult
): 'BLOCK' | 'RISKY' | 'CAUTION' | 'SAFE' {
  
  // BLOCK conditions
  if (oracle.verdict === 'BLOCK') return 'BLOCK';
  if (ultrabrains.some(u => u.verdict === 'RISKY' && u.blockers.length > 0)) return 'BLOCK';
  if (holistic.verdict === 'FAIL') return 'BLOCK';
  
  // RISKY conditions
  if (oracle.verdict === 'RISKY') return 'RISKY';
  if (ultrabrains.filter(u => u.verdict === 'CAUTION' || u.verdict === 'RISKY').length >= 2) return 'RISKY';
  if (holistic.verdict === 'PASS' && holistic.findings.length > 3) return 'RISKY';
  
  // CAUTION conditions
  if (oracle.verdict === 'CAUTION') return 'CAUTION';
  if (ultrabrains.some(u => u.verdict === 'CAUTION')) return 'CAUTION';
  if (holistic.verdict === 'PASS' && holistic.findings.length > 0) return 'CAUTION';
  
  // SAFE
  return 'SAFE';
}
```

---

## Final Report Format

```markdown
# Pre-Publish Review Report

## Verdict: [SAFE | CAUTION | RISKY | BLOCK]

## Scope
- Target: [what's being released]
- Base Commit: [sha]
- Head Commit: [sha]
- Change Groups: [N]

## Layer Results

### Per-Change Deep Dive (Ultrabrain x N)
| Group | Verdict | Blockers | Concerns |
|-------|---------|----------|----------|

### Holistic Review
- Manual QA: [PASS/FAIL]
- Gate Review: [PASS/FAIL]
- Key Findings: [list]

### Release Synthesis (Oracle)
- Verdict: [SAFE/CAUTION/RISKY/BLOCK]
- Version Bumps: [per layer]
- Breaking Changes: [list]
- Changelog Draft: [markdown]
- Deployment Risk: [LOW/MEDIUM/HIGH]

## Final Verdict Logic
[Explanation of how verdict computed]

## Recommendations
1. [Action] - [Owner] - [Before/After publish]
2. ...

## Residual Risk
[What wasn't fully verified]
```

---

## Output Format (for agent using this skill)
```
## Pre-Publish Review Complete
- Verdict: [SAFE/CAUTION/RISKY/BLOCK]
- Change Groups: [N]
- Ultrabrain Reviews: [N completed]
- Holistic Review: [PASS/FAIL]
- Oracle Verdict: [SAFE/CAUTION/RISKY/BLOCK]
- Version Bumps: [per layer]
- Blocking Issues: [Count - details]
- Changelog Draft: [Ready/Needs work]
- Residual Risk: [Summary]
```