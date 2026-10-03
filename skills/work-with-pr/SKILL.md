---
description: Work with PR - Full PR lifecycle with evidence-bound manual QA. Worktree → ulw-loop → atomic commits → PR → verification loop (CI + Cubic) → merge → cleanup.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Work with PR - Full PR Lifecycle Skill

## Purpose
Defines the complete Pull Request lifecycle: isolated worktree → implementation via ulw-loop (evidence-bound manual QA) → atomic commits → reviewer-readable PR → unbounded verification loop (CI + Cubic) → merge → worktree cleanup.

## When to Invoke
- Any implementation that needs to become a PR (used by `pr-engineer`, `towards`, `turing`, `qualy`)
- Large tasks requiring decomposition into atomic PRs
- Features requiring manual QA evidence
- Work touching OpenCode/Codex/Senpi (mandatory QA)

---

## Core Principles

### Unit of Delivery = Smallest Atomic PR
- **NOT** "one task, one PR"
- **IS** "smallest PR that compiles, passes, and stands alone"
- 200-line PR gets real review; 2000-line PR gets rubber stamp
- Independent slices → parallel worktrees → concurrent PRs

### Manual QA is the Gate (Not Tests)
> Repo rule: Change reaching OpenCode/Codex not done until you drive real harness (tmux/HTTP/browser/GUI) AND write evidence to disk.
> No evidence file = QA did not happen = may NOT commit or push.
> "It typechecks" and "bun test green" are NOT QA.

---

## Phase 0: Setup & Decomposition

### 1. Decide PR Split
```bash
# Before creating anything, decompose task into atomic PRs
# Each PR: compiles, passes, delivers one reviewable slice
# Sequence by dependency: independent → parallel, dependent → stacked
```

**Building multiple independent PRs concurrently = recommended default:**
- **Subagents**: Dispatch one background subagent per PR, each owning its worktree, branch, full Phase 0→4 lifecycle
- **Team**: For larger fan-outs, form a team (`team_mode`) and assign one member per PR

### 2. Repository Context
```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
REPO_NAME=$(basename "$PWD")
BASE_BRANCH="dev"  # CI blocks PRs to master
```

### 3. Create Branch
```bash
# Auto-generate: feature/short-description or fix/short-description
BRANCH_NAME="feature/$(echo "$TASK_SUMMARY" | tr '[:upper:] ' '[:lower:]-' | head -c 50)"
git fetch origin "$BASE_BRANCH"
git branch "$BRANCH_NAME" "origin/$BASE_BRANCH"
```

### 4. Create Worktree
```bash
# Place worktrees as siblings to repo — not inside it. Avoids git nested repo issues.
WORKTREE_PATH="../${REPO_NAME}-wt/${BRANCH_NAME}"
mkdir -p "$(dirname "$WORKTREE_PATH")"
git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
```

### 5. Set Working Context
```bash
# All subsequent work happens inside worktree
cd "$WORKTREE_PATH"
[ -f "bun.lock" ] && bun install
```

---

## Phase 1: Implement via ulw-loop

### ulw-loop: Evidence-Bound Manual QA
Drive ALL implementation through ulw-loop skill from inside worktree. Do not free-hand.

```markdown
## ulw-loop Cycle

### 1. Plan (ulw-plan)
- Break into success criteria (testable, observable)
- Each criterion = one atomic commit
- Define manual QA steps for each

### 2. Implement
- Write code for ONE criterion
- Run local validation (typecheck, test, build)

### 3. Manual QA (MANDATORY)
- Drive real harness (tmux, curl, browser, CLI)
- Observe expected behavior
- Write evidence to disk: `.omo/evidence/YYYYMMDD-slug/qa-evidence.json`

### 4. Commit (git-master)
- Pair implementation with its tests
- Commit message: conventional + references criterion
- Commit ONLY after QA evidence on disk

### 5. Repeat until all criteria done
```

### Scope Discipline
Within each PR, stay minimal: deliver its one slice, add test, prove it, stop.
No refactoring surrounding code, no config options, no "improvements" — that work belongs in its own PR.

### Commit Strategy (via git-master)
```
3+ files changed  → 2+ commits minimum
5+ files changed  → 3+ commits minimum
10+ files changed → 5+ commits minimum
```

### Pre-Push Local Validation (Cheap Pre-filter, NOT Substitute for Manual QA)
```bash
bun run typecheck
bun test
bun run build
```

---

## Phase 2: PR Creation

### Push & Create PR
```bash
git push -u origin "$BRANCH_NAME"
PR_URL=$(gh pr create --base "$BASE_BRANCH" --head "$BRANCH_NAME" --title "$PR_TITLE" --body "$PR_BODY" --repo "$REPO")
PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
```

### PR Body Template (Reviewer-Readable English)
```markdown
## What Changed
[2-3 sentences: user-impact focused, not commit log]

## Why
[Problem solved, context, links to issues/ADRs]

## How It Was Tested
[Manual QA evidence: commands run, surfaces driven, observed behavior, evidence file paths]
- QA Evidence: `.omo/evidence/YYYYMMDD-slug/qa-evidence.json`
- Test Coverage: [unit/integration/E2E added]

## Residual Risk
[Known limitations, follow-ups needed, tech debt introduced]

## Checklist
- [ ] Typecheck passes
- [ ] Tests pass (including new ones)
- [ ] Manual QA evidence written to disk
- [ ] No secrets/PII in code
- [ ] CHANGELOG updated if user-facing
- [ ] Breaking changes documented
```

---

## Phase 3: Verification Loop (Unbounded)

### Gate A: CI
```bash
gh pr checks "$PR_NUMBER" --repo "$REPO" --watch
# Wait for: bun test, typecheck, build, codex-compatibility, senpi-compatibility
```

### Gate B: Cubic
- Wait for `cubic-dev-ai[bot]` review
- **"No issues found"** = PASS
- **Issues found** = fix in worktree, re-push, re-QA
- **Quota exhausted** = SKIPPED (not failed) — only valid skip reason

### Loop Logic
```bash
while true; do
  wait for both gates
  if CI FAIL or Cubic ISSUES:
    cd worktree
    fix code
    re-run manual QA (write NEW evidence)
    commit + push
    continue loop
  if both PASS:
    break
done
```

**Critical**: Fix ONLY what the failing gate caught. No scope creep. If fixing Cubic issue breaks CI, loop continues.

---

## Phase 4: Merge & Cleanup

### Merge (Merge Commit ONLY)
```bash
gh pr merge "$PR_NUMBER" --merge --delete-branch --repo "$REPO"
# Wait for actual merge
gh pr view "$PR_NUMBER" --repo "$REPO" --json mergedAt --jq '.mergedAt'
```

### Worktree Cleanup
```bash
cd "$ORIGINAL_PWD"
git worktree remove "$WORKTREE_PATH" --force
git worktree prune
```

### Report Completion
```markdown
## PR Complete
- PR: #{$PR_NUMBER} — {$PR_TITLE}
- Branch: {$BRANCH_NAME} → {$BASE_BRANCH}
- Iterations: {$N} verification loops
- Gates: CI pass | Cubic {pass | SKIPPED (quota exhausted)}
- Merged: yes
- Worktree: cleaned up
```

---

## Parallel PR Execution (Multiple Independent PRs)

```bash
# For independent slices, spawn background subagents
for slice in "${SLICES[@]}"; do
  tools.subagent({
    agent: "general",
    description: "pr-engineer: $slice",
    prompt: PR_ENGINEER_PROMPT_WITH_SLICE_CONTEXT,
    background: true,
  })
done

# Monitor all, report as each completes
```

---

## Stacked PRs (Dependent Slices)

```bash
# PR 1: Base infrastructure
# PR 2: Feature A (depends on PR 1)
# PR 3: Feature B (depends on PR 2)

# Create stacked branches
git checkout -b feature/base origin/dev
# ... work ...
git push -u origin feature/base
gh pr create --base dev --head feature/base

git checkout -b feature/a feature/base
# ... work ...
git push -u origin feature/a
gh pr create --base feature/base --head feature/a

git checkout -b feature/b feature/a
# ... work ...
git push -u origin feature/b
gh pr create --base feature/a --head feature/b

# Merge order: base → a → b (or use gh pr merge --merge with base updates)
```

---

## Failure Recovery

### Unrecoverable Error
```markdown
Do NOT delete worktree. Report what happened, worktree path for user to inspect/resume.
```

### Merge Conflicts
```bash
cd "$WORKTREE_PATH"
git fetch origin "$BASE_BRANCH"
git rebase "origin/$BASE_BRANCH"
# Resolve conflicts, continue loop
```

---

## Anti-Patterns (BLOCKING)

| Violation | Why it fails |
|-----------|--------------|
| Working in main worktree | Pollutes user's working directory, may destroy uncommitted work |
| Committing/pushing without manual-QA evidence | "Tests pass" never proves feature works; repo forbids it |
| Pushing directly to dev/master | Bypasses review entirely |
| Skipping CI gate after code changes | Cubic may pass on stale code |
| Skipping Cubic because it found issues | Only exhausted quota justifies skip; real issues must be fixed |
| Fixing unrelated code during verification | Scope creep causes new failures |
| Deleting worktree on failure | User loses ability to inspect/resume |
| Bundling independent slices into one big PR | Atomic review dies — regressions hide, one bad slice blocks all |

---

## QA Evidence Format

```json
// .omo/evidence/20240115-new-checkout-flow/qa-evidence.json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "pr": "feature/new-checkout-flow",
  "criteria": [
    {
      "id": "crit-1",
      "description": "User can complete checkout with saved payment method",
      "steps": [
        "Login as testuser@example.com",
        "Add product to cart",
        "Go to checkout",
        "Select saved Visa ending in 4242",
        "Click Place Order"
      ],
      "observed": "Order created successfully, order confirmation email sent, redirected to /orders/ord_abc123",
      "evidence": {
        "screenshots": ["step1-login.png", "step2-cart.png", "step3-checkout.png", "step4-confirmation.png"],
        "network_logs": "network.har",
        "console_logs": "console.log"
      },
      "passed": true
    }
  ],
  "test_coverage": {
    "unit": "features/checkout/__tests__/checkout.test.ts",
    "integration": "tests/integration/checkout.test.ts",
    "e2e": "e2e/features/checkout/purchase.feature"
  }
}
```

---

## Output Format (for agent using this skill)
```
## PR Lifecycle Complete
- PR: #[number] — [title]
- Branch: [branch] → [base]
- Worktree: [path] (cleaned up)
- Iterations: [N] verification loops
- Gates: CI [pass/fail] | Cubic [pass/skipped/failed]
- QA Evidence: [path to evidence file]
- Commits: [count] - [atomic, conventional]
- Merged: [yes/no]
- Residual Risk: [summary]
```