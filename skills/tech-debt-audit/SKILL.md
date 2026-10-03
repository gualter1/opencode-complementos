---
description: Tech Debt Audit - 9-dimension audit via AST-grep/LSP/grep. Produces TECH_DEBT_AUDIT.md with findings, severity, effort estimates, prioritization.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Tech Debt Audit - 9-Dimension Codebase Health Skill

## Purpose
Executes comprehensive technical debt audit across 9 dimensions using AST-grep (tree-sitter), LSP, grep, and native tools. Produces `TECH_DEBT_AUDIT.md` with evidence-backed findings (file:line:col), severity, effort estimates, and impact/effort prioritization.

## When to Invoke
- Periodic codebase health checks (used by `auditor`, `severino`, `niamaia`)
- Pre-refactoring assessment
- Technical due diligence
- New repository onboarding
- Sprint planning for debt paydown

---

## 9 Dimensions of Audit

### 1. Architectural Decay
```bash
# Tools: AST-grep, dependency-cruiser, madge, wc

# Files > 500 LOC
find . -name "*.ts" -o -name "*.py" -o -name "*.go" | xargs wc -l | awk '$1 > 500'

# Functions > 80 LOC or > 4 nesting
sg -p 'function $NAME($$$) { $$$ }' --json | jq '.matches[] | select(.lines > 80 or .nesting > 4)'

# Classes > 15 methods or > 400 LOC
sg -p 'class $NAME { $$$ }' --json | jq '.matches[] | select(.methods > 15 or .lines > 400)'

# Import cycles
madge --circular --extensions ts,js src/
dependency-cruiser src/ --output-type dot | dot -Tpng > deps.png

# Dead exports (LSP)
# In IDE: find references on exports, filter zero refs

# Commented code blocks > 3 lines
grep -rn "^\s*//.*" --include="*.ts" | awk 'length($0) > 100'
```

### 2. Consistency Rot
```bash
# Multiple ways to do same thing
# HTTP clients
sg -p 'fetch($$$)' --json | jq '.matches | length'
sg -p 'axios.$$$($$$)' --json | jq '.matches | length'
sg -p 'ky.$$$($$$)' --json | jq '.matches | length'

# Loggers
sg -p 'console.log($$$)' --json | jq '.matches | length'
sg -p 'logger.$$$($$$)' --json | jq '.matches | length'
sg -p 'pino.$$$($$$)' --json | jq '.matches | length'

# Error patterns
sg -p 'throw new Error($$$)' --json
sg -p 'throw $ERR' --json
sg -p 'return Result.err($$$)' --json

# Date libraries
grep -r "moment\|dayjs\|date-fns\|luxon" --include="package.json"
```

### 3. Type & Contract Debt
```bash
# any usage
sg -p '$X as any' --json
sg -p '<any>' --json
sg -p ': any' --json

# @ts-ignore / @ts-expect-error
grep -rn "@ts-ignore\|@ts-expect-error" --include="*.ts"

# Missing types in public APIs
sg -p 'export function $NAME($$$) { $$$ }' --json | jq '.matches[] | select(.params[] | has("type") | not)'

# Missing schema validation at boundaries
# Check API routes, message handlers, DB repositories

# LSP errors grouped
# Run: tsc --noEmit / pyright / go vet
# Group by error code, file
```

### 4. Test Debt
```bash
# Critical path without tests
# Cross-ref: high-churn files (git log) vs test coverage

# Skipped tests
bun test | grep -E "(skip|todo)" -i

# Test implementation details vs behavior
# Look for: testing private methods, mocking internals, snapshot overuse

# Slow tests > 1s
bun test --reporter=verbose | awk '$3 > 1000'
```

### 5. Dependency & Config Debt
```bash
# Outdated deps
npm outdated --json | jq '.[] | select(.current != .latest)'

# Major version gaps
npm outdated --json | jq '.[] | select(.current | split(".")[0] != .latest | split(".")[0])'

# Duplicate libraries
# lodash vs lodash-es vs underscore
# moment vs dayjs vs date-fns
# axios vs ky vs fetch

# Undocumented env vars
grep -r "process.env\|\.env" --include="*.ts" | grep -v test | sort -u

# Hardcoded config
grep -r "localhost\|127.0.0.1\|3000\|5432" --include="*.ts" | grep -v test
```

### 6. Performance & Resource Hygiene
```bash
# Async in loop (sequential)
sg -p 'for ($$$ of $$$) { $$$ await $$$ }' --json
grep -rn "await.*map\|await.*forEach" --include="*.ts"

# N+1 queries
# Look for: loop with DB call inside

# Missing cleanup
sg -p 'addEventListener($$$)' --json
sg -p 'setInterval($$$)' --json
sg -p 'setTimeout($$$)' --json
# Check for corresponding removeEventListener/clearInterval

# Unnecessary serialization
sg -p 'JSON.stringify($$$)' --json
sg -p 'JSON.parse($$$)' --json
```

### 7. Error Handling & Observability
```bash
# Empty catch blocks
sg -p 'catch ($$$) { $$$ }' --json | jq '.matches[] | select(.body == "")'

# Generic catch without recovery
sg -p 'catch ($$$) { console.error($$$) }' --json

# Inconsistent error shapes
# Check: ErrorResponse vs ApiError vs CustomError

# Missing structured logging
grep -rn "console.log\|console.error" --include="*.ts" | grep -v "logger"

# Swallowed promises
sg -p 'promise.then($$$)' --json | jq '.matches[] | select(.catch == null)'
```

### 8. Security Hygiene
```bash
# Hardcoded secrets
grep -rn "password\|secret\|key\|token" --include="*.ts" | grep -v test | grep -v ".env"

# SQL construction
sg -p 'query($SQL + $X)' --json
sg -p 'execute($SQL + $X)' --json

# XSS vectors
sg -p 'innerHTML = $X' --json
sg -p 'dangerouslySetInnerHTML={{ __html: $X }}' --json

# Code injection
sg -p 'eval($X)' --json
sg -p 'new Function($X)' --json
sg -p 'setTimeout($X, $$$)' --json

# Permissive CORS
grep -rn "cors.*origin.*\*" --include="*.ts"
```

### 9. Documentation Drift
```bash
# README claims vs reality
# Compare: README features vs actual routes/exports

# Public functions without docs
sg -p 'export function $NAME($$$) { $$$ }' --json | jq '.matches[] | select(.jsdoc == null)'

# Comments contradicting code
# Look for: "TODO: remove" on active code, "// temporary" on old code

# ADRs stale
# Check: ADR date > 6 months, no review
find docs/adr -name "*.md" -mtime +180
```

---

## Audit Execution

### Phase 0: Orient (Always Run)
```bash
# 1. Map language stack
find . -name "*.ts" -o -name "*.py" -o -name "*.go" -o -name "*.js" | head -20

# 2. Dependencies & build tooling
cat package.json | jq '.dependencies, .devDependencies'
cat pyproject.toml 2>/dev/null || cat requirements.txt 2>/dev/null

# 3. Git churn
git log --oneline -200 --format="%h %an %s" > git-churn.txt

# 4. Largest files
find . -name "*.ts" -exec wc -l {} + | sort -rn | head -30

# 5. Cross-ref: high-churn + large = debt hot zones
# 6. Write mental model
```

### Phase 1: Audit 9 Dimensions (Parallel Tool Calls)
```typescript
// Run all standard checks per dimension
// Every finding MUST cite file:line:col
interface Finding {
  id: string;
  category: string;
  file: string;
  line: number;
  col: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  effortHours: number;
  description: string;
  recommendation: string;
  evidence: string;  // The actual code snippet
}
```

### Phase 2: Deeper Dives (Parallel Sub-agents for Large Codebases)
```typescript
// Spawn sub-agents for heaviest dimensions
const heavyDimensions = [
  'Architecture+Consistency',
  'Types+Errors', 
  'Security+Performance'
];

for (const dim of heavyDimensions) {
  await tools.subagent({
    agent: 'general',
    description: `auditor: deep-dive ${dim}`,
    prompt: DEEP_DIVE_PROMPT,
    background: true,
  });
}
```

### Phase 3: Synthesize & Deliver
```typescript
// 1. Collect all findings
// 2. Deduplicate
// 3. Classify severity (Critical/High/Medium/Low)
// 4. Estimate effort (conservative hours)
// 5. Write TECH_DEBT_AUDIT.md
// 6. Report summary
```

---

## Output: TECH_DEBT_AUDIT.md

```markdown
# Tech Debt Audit Report

## Executive Summary
[3-5 sentences: overall health, worst dimension, quick wins count]

## Mental Model
[1 paragraph: what the repo does, stack, module boundaries]

## Findings Table
| ID | Category | File:Line:Col | Severity | Effort (h) | Description | Recommendation |
|----|----------|---------------|----------|------------|-------------|----------------|
| TD-001 | Arch Decay | src/api/users/controller.ts:45:12 | High | 8 | God class: UserController 18 methods, 520 LOC | Extract service layer, use command handlers |
| TD-002 | Consistency | src/utils/date.ts:12:1 | Medium | 2 | Three date libraries: moment, dayjs, date-fns | Standardize on date-fns, remove others |
| TD-003 | Types | src/api/orders/service.ts:78:5 | High | 4 | Public API returns `any` | Define proper return type, add validation |
| TD-004 | Test Debt | src/features/payment/ | Critical | 16 | Payment module 0% coverage | Add unit + integration tests |

## Top 5 Priorities (Impact/Effort Ratio)
1. **TD-004** - Payment tests - Critical path, 16h, prevents revenue loss
2. **TD-001** - UserController god class - Blocks changes, 8h, enables future work
3. **TD-003** - Type safety in orders - High risk, 4h, quick win
4. **TD-002** - Date library consolidation - 2h, removes 3 deps
5. **TD-005** - Security: SQL concat in reports - High risk, 6h

## Quick Wins Checklist (< 30 min each)
- [ ] TD-002: Remove moment from package.json, replace 3 imports
- [ ] TD-007: Add @ts-expect-error comment with reason (src/legacy/foo.ts:12)
- [ ] TD-011: Delete commented code block (src/utils/bar.ts:45-67)
- [ ] TD-015: Fix typo in error message (src/api/baz.ts:89)

## "Looks Bad But Is Fine"
- **Pattern**: `setTimeout(fn, 0)` in src/events/emitter.ts:23
- **Why**: Intentional macrotask scheduling for batch processing, documented in ADR-012
- **Pattern**: `any` in src/adapters/external-api.ts:15
- **Why**: External API has no types, validated at boundary via Zod schema

## Open Questions
- Should we migrate from Jest to Vitest? (Current: 40% Jest, 60% Vitest)
- Is the custom Result type worth keeping vs neverthrow?
- Database migration strategy for multi-tenant: per-tenant vs shared?
```

---

## Severity Rubric

```markdown
Critical = actively causing bugs or security holes
High     = will cause problems under normal operation; blocks changes
Medium   = reduces maintainability; inconsistent; violates conventions
Low      = cosmetic; would be nice to fix when nearby
```

### Effort Estimation (Conservative)
| Effort | Criteria |
|--------|----------|
| 0.5h | Single file, localized fix, test exists |
| 1-2h | Few files, straightforward refactor |
| 4-8h | Multiple files, requires design, tests need update |
| 16-40h | Cross-module, architectural, migration needed |
| 40h+ | Major refactor, new abstraction, team effort |

---

## Quality Gates

- [ ] Every finding has file:line:col citation
- [ ] No generic claims without evidence
- [ ] "Looks Bad But Is Fine" explains 2-3 patterns
- [ ] Top 5 ranked by impact/effort
- [ ] Quick wins are < 30 min each

---

## Automation (CI Integration)

```yaml
# .github/workflows/tech-debt-audit.yml
name: Tech Debt Audit
on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly Sunday
  workflow_dispatch:
    inputs:
      depth:
        type: choice
        options: [quick, standard, deep]
        default: standard

jobs:
  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      
      - name: Run Audit
        run: |
          python scripts/tech_debt_audit.py \
            --depth ${{ github.event.inputs.depth }} \
            --output TECH_DEBT_AUDIT.md
      
      - name: Check for Critical/High
        run: |
          CRITICAL=$(grep -c "Critical" TECH_DEBT_AUDIT.md || true)
          HIGH=$(grep -c "High" TECH_DEBT_AUDIT.md || true)
          if [ $CRITICAL -gt 0 ] || [ $HIGH -gt 10 ]; then
            echo "::warning::Critical/High debt detected: $CRITICAL critical, $HIGH high"
          fi
      
      - name: Upload Report
        uses: actions/upload-artifact@v4
        with:
          name: tech-debt-audit
          path: TECH_DEBT_AUDIT.md
      
      - name: Create Issue if Significant
        run: |
          if [ $CRITICAL -gt 0 ] || [ $HIGH -gt 5 ]; then
            gh issue create \
              --title "Tech Debt Audit: $CRITICAL Critical, $HIGH High findings" \
              --body-file TECH_DEBT_AUDIT.md \
              --label "tech-debt,audit,automated"
          fi
```

---

## Output Format (for agent using this skill)
```
## Tech Debt Audit Complete
- Repository: [name]
- Dimensions Audited: 9/9
- Total Findings: [X] (Critical: Y, High: Z, Medium: A, Low: B)
- Top Priority: [ID] - [Description] - [Effort] - [Impact]
- Quick Wins: [Count] - [List]
- "Looks Bad But Is Fine": [Count] - [Patterns]
- Report: TECH_DEBT_AUDIT.md
- Recommendations: [Top 3 debt paydown items]
```