---
description: Context Budget - Audit token usage per agent/skill/file before adding new agents or skills. Identifies bloat, recommends optimization.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Context Budget - Context Window Audit Skill

## Purpose
Audits token usage across agents, skills, and files before adding new components. Identifies context bloat, recommends optimization strategies, and enforces budget discipline.

## When to Invoke
- Before adding new agents/skills (used by `severino`, `context-guardian`)
- Periodic context health checks
- When context window > 70%
- Session handoff preparation

---

## Audit Process

### Phase 1: Measure Current Usage

```typescript
interface ContextAudit {
  timestamp: Date;
  windowSize: number;           // Total context window (e.g., 200k)
  totalUsed: number;            // Current tokens used
  utilization: number;          // Percentage
  breakdown: {
    systemPrompts: AgentPromptUsage[];
    skills: SkillUsage[];
    sessionHistory: HistoryUsage;
    codeReferences: CodeRefUsage;
    currentTask: TaskUsage;
  };
  recommendations: Recommendation[];
}

interface AgentPromptUsage {
  agent: string;
  tokens: number;
  percentage: number;
  skillsLoaded: string[];
}

interface SkillUsage {
  skill: string;
  tokens: number;
  percentage: number;
  referencesLoaded: number;
  lastUsed: Date;
}

interface HistoryUsage {
  totalTurns: number;
  summarizedTurns: number;
  rawTurns: number;
  tokens: number;
  oldestTurn: Date;
}

interface CodeRefUsage {
  file: string;
  tokens: number;
  lines: number;
  lastAccessed: Date;
  accessCount: number;
}

interface TaskUsage {
  description: string;
  tokens: number;
  subagentContexts: SubagentContext[];
}

interface SubagentContext {
  agent: string;
  tokensSent: number;
  tokensReceived: number;
  turns: number;
}
```

### Phase 2: Analysis Rules

```typescript
const AUDIT_RULES = {
  // Agent prompt bloat
  agentPromptThreshold: 0.20,      // > 20% of window = investigate
  skillThreshold: 0.10,            // > 10% per skill = investigate
  historyThreshold: 0.25,          // > 25% = needs summarization
  codeRefThreshold: 0.20,          // > 20% = prune unused
  singleFileThreshold: 0.05,       // > 5% for one file = investigate
  
  // Staleness
  unusedSkillDays: 7,              // Skills not used in 7 days
  unusedFileDays: 3,               // Files not accessed in 3 days
  oldHistoryTurns: 20,             // Turns older than 20 = summarize
  
  // Redundancy
  duplicateContentThreshold: 0.8,  // 80% similarity = dedupe
};

function analyzeAudit(audit: ContextAudit): Recommendation[] {
  const recs: Recommendation[] = [];
  
  // System prompts
  for (const agent of audit.breakdown.systemPrompts) {
    if (agent.percentage > AUDIT_RULES.agentPromptThreshold) {
      recs.push({
        type: 'AGENT_PROMPT_BLOAT',
        severity: 'HIGH',
        message: `Agent ${agent.agent} uses ${agent.percentage}% of window`,
        action: 'Review agent prompt length, consider splitting or lazy-loading skills',
        estimatedSavings: Math.floor(agent.tokens * 0.3),
      });
    }
    
    // Unused skills in agent
    for (const skill of agent.skillsLoaded) {
      const skillUsage = audit.breakdown.skills.find(s => s.skill === skill);
      if (skillUsage && daysSince(skillUsage.lastUsed) > AUDIT_RULES.unusedSkillDays) {
        recs.push({
          type: 'UNUSED_SKILL',
          severity: 'MEDIUM',
          message: `Skill ${skill} loaded by ${agent.agent} but unused for ${daysSince(skillUsage.lastUsed)} days`,
          action: 'Remove skill from agent frontmatter or lazy-load',
          estimatedSavings: skillUsage.tokens,
        });
      }
    }
  }
  
  // Skills
  for (const skill of audit.breakdown.skills) {
    if (skill.percentage > AUDIT_RULES.skillThreshold) {
      recs.push({
        type: 'SKILL_BLOAT',
        severity: 'MEDIUM',
        message: `Skill ${skill.skill} uses ${skill.percentage}% of window`,
        action: 'Split skill, remove unused references, or lazy-load',
        estimatedSavings: Math.floor(skill.tokens * 0.25),
      });
    }
  }
  
  // Session history
  if (audit.breakdown.sessionHistory.percentage > AUDIT_RULES.historyThreshold) {
    recs.push({
      type: 'HISTORY_BLOAT',
      severity: 'HIGH',
      message: `Session history uses ${audit.breakdown.sessionHistory.percentage}% of window`,
      action: 'Run context-guardian compaction (summarize old turns, drop raw outputs)',
      estimatedSavings: Math.floor(audit.breakdown.sessionHistory.tokens * 0.6),
    });
  }
  
  // Code references
  for (const ref of audit.breakdown.codeReferences) {
    if (ref.percentage > AUDIT_RULES.singleFileThreshold) {
      recs.push({
        type: 'LARGE_FILE_REFERENCE',
        severity: 'MEDIUM',
        message: `File ${ref.file} uses ${ref.percentage}% of window`,
        action: 'Reference only relevant sections, use ctx_search instead of full file',
        estimatedSavings: Math.floor(ref.tokens * 0.5),
      });
    }
    
    if (daysSince(ref.lastAccessed) > AUDIT_RULES.unusedFileDays) {
      recs.push({
        type: 'STALE_FILE_REFERENCE',
        severity: 'LOW',
        message: `File ${ref.file} not accessed for ${daysSince(ref.lastAccessed)} days`,
        action: 'Remove from context, re-index if needed',
        estimatedSavings: ref.tokens,
      });
    }
  }
  
  // Deduplication
  const duplicates = findDuplicateContent(audit.breakdown);
  for (const dup of duplicates) {
    recs.push({
      type: 'DUPLICATE_CONTENT',
      severity: 'MEDIUM',
      message: `Duplicate content detected: ${dup.files.join(', ')} (${(dup.similarity * 100).toFixed(0)}% similar)`,
      action: 'Keep single canonical reference',
      estimatedSavings: dup.estimatedSavings,
    });
  }
  
  return recs.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
}
```

---

## Optimization Actions

### 1. Agent Prompt Optimization
```typescript
function optimizeAgentPrompt(agent: string): OptimizationResult {
  const prompt = loadAgentPrompt(agent);
  const originalTokens = countTokens(prompt);
  
  // Remove redundant sections
  let optimized = prompt
    .replace(/## (Skills|When to Invoke|Output Format).*?(?=## |\n$)/gs, '') // Move to skill
    .replace(/### Examples?\n.*?(?=### |\n$)/gs, '') // Move examples to references
    .replace(/\n{3,}/g, '\n\n'); // Normalize whitespace
  
  // Extract to skill references
  const extractedSkills = extractSkillReferences(prompt);
  
  return {
    originalTokens,
    optimizedTokens: countTokens(optimized),
    savings: originalTokens - countTokens(optimized),
    extractedSkills,
    optimizedPrompt: optimized,
  };
}
```

### 2. Skill Lazy Loading
```typescript
// Instead of loading all skills at agent start
// Frontmatter declares available skills
// Agent loads skill ONLY when needed

// Agent frontmatter (metadata only)
skills:
  - backend-code-review      # Available
  - testing-strategies       # Available
  - how-to-write-component   # Available

// At runtime (when agent invokes skill)
async function invokeSkill(skillName: string) {
  const skillContent = await readSkillFile(skillName);
  const references = await readSkillReferences(skillName);
  return { skillContent, references };
}
```

### 3. Context Compaction (Context Guardian)
```typescript
async function compactContext(audit: ContextAudit): Promise<CompactionResult> {
  let saved = 0;
  const actions: string[] = [];
  
  // 1. Summarize old history turns
  const history = loadSessionHistory();
  const toSummarize = history.turns.filter(t => 
    t.turnNumber < history.currentTurn - 20 && !t.isSummarized
  );
  
  for (const turn of toSummarize) {
    const summary = await summarizeTurn(turn);
    saved += turn.tokens - summary.tokens;
    turn.summary = summary;
    turn.isSummarized = true;
    actions.push(`Summarized turn ${turn.turnNumber}: ${turn.tokens} -> ${summary.tokens} tokens`);
  }
  
  // 2. Drop raw tool outputs (keep summaries)
  for (const turn of history.turns) {
    if (turn.toolOutputs && !turn.outputsDropped) {
      const outputTokens = turn.toolOutputs.reduce((a, o) => a + o.tokens, 0);
      if (outputTokens > 1000) {
        turn.toolOutputs = turn.toolOutputs.map(o => ({
          ...o,
          content: o.content.length > 500 ? '[DROPPED - ' + o.summary + ']' : o.content,
          tokens: Math.min(o.tokens, 200),
        }));
        saved += outputTokens - turn.toolOutputs.reduce((a, o) => a + o.tokens, 0);
        actions.push(`Compressed tool outputs in turn ${turn.turnNumber}`);
      }
    }
  }
  
  // 3. Prune stale code references
  const codeRefs = loadCodeReferences();
  const stale = codeRefs.filter(r => daysSince(r.lastAccessed) > 3);
  for (const ref of stale) {
    saved += ref.tokens;
    removeCodeReference(ref.file);
    actions.push(`Removed stale reference: ${ref.file} (${ref.tokens} tokens)`);
  }
  
  // 4. Re-index for semantic search
  await reindexCodebase();
  actions.push('Re-indexed codebase for semantic search');
  
  return { saved, actions, newUtilization: (audit.totalUsed - saved) / audit.windowSize };
}
```

---

## Pre-Addition Checklist

Before adding new agent/skill:

```markdown
## Context Budget Pre-Addition Checklist

### Current State
- [ ] Window utilization < 70%
- [ ] Headroom > 30% (60k tokens for 200k window)
- [ ] No single agent > 20%
- [ ] No single skill > 10%
- [ ] History < 25%
- [ ] Code refs < 20%

### New Component Analysis
- [ ] Estimated prompt tokens: ______
- [ ] Estimated skill tokens: ______
- [ ] Estimated references: ______
- [ ] Total estimated addition: ______ tokens (____%)
- [ ] Post-addition utilization: ______%

### Decision
- [ ] **APPROVE**: Post-addition < 70%, headroom maintained
- [ ] **CONDITIONAL**: Requires compaction first (run context-guardian)
- [ ] **REJECT**: Would exceed 80% or eliminate headroom

### Mitigation (if conditional/reject)
- [ ] Compact history
- [ ] Lazy-load skills
- [ ] Remove stale references
- [ ] Split agent/skill
- [ ] Use context-mode for large outputs
```

---

## Automated Audit (CI/CD)

```yaml
# .github/workflows/context-audit.yml
name: Context Budget Audit
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Context Audit
        run: |
          # This would run in the actual opencode session
          # For CI, we simulate with token estimates
          node scripts/context-audit.js --ci
      - name: Check Budget
        run: |
          UTILIZATION=$(cat audit-result.json | jq '.utilization')
          if (( $(echo "$UTILIZATION > 0.75" | bc -l) )); then
            echo "::warning::Context utilization at ${UTILIZATION}%"
            # Create issue
            gh issue create \
              --title "Context Budget Warning: ${UTILIZATION}% utilization" \
              --body "$(cat audit-result.json | jq -r '.recommendations[] | "- \(.type): \(.message) (save ~\(.estimatedSavings) tokens)"')" \
              --label "context-budget,automated"
```

---

## Output Format (for agent using this skill)
```
## Context Budget Audit
- Window: [X tokens total, Y% used, Z% headroom]
- Top Consumers: [Agent/Skill/File: tokens, %]
- Recommendations: [count] - [top 3 with estimated savings]
- Pre-Addition Check: [PASS/CONDITIONAL/REJECT] for [new component]
- Action Required: [Compact / Lazy-load / Prune / Re-index]
```