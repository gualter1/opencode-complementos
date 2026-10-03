---
description: Token Budget Advisor - Control response depth (25%/50%/75%/100%) based on task complexity. Prevents context overflow, optimizes token usage.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Token Budget Advisor - Response Depth Control Skill

## Purpose
Controls response depth and token usage based on task complexity. Implements 4 levels (25%/50%/75%/100%) to prevent context overflow while maintaining quality.

## When to Invoke
- Before complex delegations (used by `severino`, `context-guardian`)
- When context window > 70%
- Long-running sessions
- Multi-agent orchestration

---

## Budget Levels

| Level | Token % | Use Case | Output Style |
|-------|---------|----------|--------------|
| **25% (Summary)** | ~50k tokens | Quick status, simple decisions, high-level overview | Bullet points, key decisions only, no code |
| **50% (Standard)** | ~100k tokens | Normal feature work, code review, debugging | Code snippets, decisions, rationale, next steps |
| **75% (Detailed)** | ~150k tokens | Complex architecture, security audit, migration planning | Full code, detailed analysis, trade-offs, diagrams |
| **100% (Exhaustive)** | ~200k tokens | Critical incidents, deep debugging, comprehensive docs | Everything: code, logs, traces, full reasoning |

---

## Budget Allocation Formula

```typescript
interface TokenBudget {
  totalWindow: number;        // e.g., 200,000
  systemPrompts: number;      // 15% = 30k (agents + skills)
  currentTask: number;        // Variable based on level
  sessionHistory: number;     // 20% = 40k (summarized)
  codeReferences: number;     // 20% = 40k (indexed)
  buffer: number;             // 20% = 40k (growth)
}

function calculateBudget(level: 25 | 50 | 75 | 100, totalWindow = 200_000): TokenBudget {
  const systemPrompts = Math.floor(totalWindow * 0.15);
  const sessionHistory = Math.floor(totalWindow * 0.20);
  const codeReferences = Math.floor(totalWindow * 0.20);
  const buffer = Math.floor(totalWindow * 0.20);
  const availableForTask = totalWindow - systemPrompts - sessionHistory - codeReferences - buffer;
  
  const currentTask = Math.floor(availableForTask * (level / 100));
  
  return {
    totalWindow,
    systemPrompts,
    currentTask,
    sessionHistory,
    codeReferences,
    buffer,
  };
}
```

---

## Level Selection Heuristics

```typescript
function selectBudgetLevel(task: Task): 25 | 50 | 75 | 100 {
  // Complexity factors
  const factors = {
    filesModified: task.files?.length || 0,
    linesChanged: task.linesChanged || 0,
    agentsInvolved: task.subagents?.length || 1,
    hasSecurity: task.tags?.includes('security') || false,
    hasArchitecture: task.tags?.includes('architecture') || false,
    isIncident: task.priority === 'critical',
    isDebugging: task.type === 'debug',
    contextWindowUsed: task.contextUsage || 0,
  };
  
  // Score complexity (0-100)
  let score = 0;
  score += Math.min(factors.filesModified * 2, 20);
  score += Math.min(factors.linesChanged / 50, 20);
  score += factors.agentsInvolved * 10;
  score += factors.hasSecurity ? 15 : 0;
  score += factors.hasArchitecture ? 15 : 0;
  score += factors.isIncident ? 25 : 0;
  score += factors.isDebugging ? 10 : 0;
  score += factors.contextWindowUsed > 70 ? 15 : 0;
  
  if (score >= 70) return 100;
  if (score >= 50) return 75;
  if (score >= 30) return 50;
  return 25;
}
```

---

## Output Templates by Level

### 25% - Summary
```markdown
## Summary (25% Budget)
**Decision**: [One sentence]
**Key Points**: 
- [Point 1]
- [Point 2]
**Next**: [Single action]
**Risk**: [Top risk if any]
```

### 50% - Standard
```markdown
## Analysis (50% Budget)
### Decision
[2-3 sentences with rationale]

### Key Findings
- [Finding 1 with evidence]
- [Finding 2 with evidence]

### Code Changes
```typescript
// Key snippet only
function keyChange() { /* ... */ }
```

### Next Steps
1. [Action 1] - [Owner]
2. [Action 2] - [Owner]

### Risks
- [Risk 1] - [Mitigation]
```

### 75% - Detailed
```markdown
## Detailed Analysis (75% Budget)
### Context
[Background, constraints, requirements]

### Decision
[Full rationale with trade-offs]

### Alternatives Considered
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A | ... | ... | Rejected |
| B | ... | ... | **Selected** |

### Implementation
```typescript
// Complete implementation
```

### Testing Strategy
- Unit: [scenarios]
- Integration: [setup]
- E2E: [journeys]

### Rollback Plan
[Steps]

### Risks & Mitigations
[Table]
```

### 100% - Exhaustive
```markdown
# Exhaustive Analysis (100% Budget)
## Executive Summary
[Full context]

## Complete Reasoning
[Step-by-step with all evidence]

## Full Implementation
[All files, complete code]

## Complete Test Plan
[Every scenario]

## All Risks
[Comprehensive]

## Appendices
- Logs
- Traces
- Diagrams
- References
```

---

## Dynamic Adjustment

```typescript
class TokenBudgetManager {
  private currentLevel: 25 | 50 | 75 | 100 = 50;
  private usageHistory: number[] = [];
  
  adjustForContext(windowUsage: number): void {
    this.usageHistory.push(windowUsage);
    if (this.usageHistory.length > 10) this.usageHistory.shift();
    
    const avgUsage = this.usageHistory.reduce((a, b) => a + b, 0) / this.usageHistory.length;
    
    if (avgUsage > 85 && this.currentLevel > 25) {
      this.currentLevel = this.stepDown(this.currentLevel);
    } else if (avgUsage < 50 && this.currentLevel < 100) {
      this.currentLevel = this.stepUp(this.currentLevel);
    }
  }
  
  private stepDown(level: 25 | 50 | 75 | 100): 25 | 50 | 75 | 100 {
    const levels: (25 | 50 | 75 | 100)[] = [25, 50, 75, 100];
    const idx = levels.indexOf(level);
    return levels[Math.max(0, idx - 1)];
  }
  
  private stepUp(level: 25 | 50 | 75 | 100): 25 | 50 | 75 | 100 {
    const levels: (25 | 50 | 75 | 100)[] = [25, 50, 75, 100];
    const idx = levels.indexOf(level);
    return levels[Math.min(3, idx + 1)];
  }
  
  getOutputTemplate(): string {
    return OUTPUT_TEMPLATES[this.currentLevel];
  }
}
```

---

## Integration with Context-Mode

```bash
# Use context-mode for large outputs regardless of budget level
ctx_execute "long-running-command" --max-lines 100 --summarize
ctx_execute_file "script.sh" --tail 50
```

---

## Budget Enforcement in Delegation

```typescript
// In Severino's delegation logic
async function delegateWithBudget(task: Task, subagent: string) {
  const level = tokenBudgetAdvisor.selectBudgetLevel(task);
  const budget = tokenBudgetAdvisor.calculateBudget(level);
  
  const context = await gatherContext(task.files, task.specs, task.decisions);
  
  // Trim context to fit budget
  const trimmedContext = trimContextToBudget(context, budget.currentTask);
  
  const spec = createDelegationSpec(subagent, task.description, trimmedContext);
  spec.metadata = { budgetLevel: level, tokenBudget: budget.currentTask };
  
  return tools.subagent(spec);
}
```

---

## Monitoring & Metrics

```typescript
interface BudgetMetrics {
  level: 25 | 50 | 75 | 100;
  allocatedTokens: number;
  usedTokens: number;
  utilization: number;      // used / allocated
  windowUtilization: number; // used / totalWindow
  adjustments: number;      // level changes per session
  overflowEvents: number;   // times window > 90%
}

function recordBudgetMetrics(metrics: BudgetMetrics): void {
  // Send to observability
  metricsClient.gauge('token_budget.level', metrics.level);
  metricsClient.gauge('token_budget.utilization', metrics.utilization);
  metricsClient.gauge('token_budget.window_utilization', metrics.windowUtilization);
  metricsClient.increment('token_budget.adjustments', metrics.adjustments);
  metricsClient.increment('token_budget.overflow', metrics.overflowEvents);
}
```

---

## Output Format (for agent using this skill)
```
## Token Budget Advisory
- Recommended Level: [25%/50%/75%/100%]
- Allocated Tokens: [X / Y]
- Current Window Usage: [Z%]
- Reasoning: [Complexity factors]
- Template: [Summary/Standard/Detailed/Exhaustive]
- Warning: [if window > 80%]
```