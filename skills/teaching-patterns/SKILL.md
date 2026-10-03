---
description: Teaching Patterns - Feynman technique, scaffolding, cognitive load, spaced repetition. Technical teaching and knowledge transfer patterns.
mode: subagent
model: 9router/Turing
skills:
  - context-mode
---

{reasoning effort: high}

# Teaching Patterns - Technical Knowledge Transfer Skill

## Purpose
Defines patterns for effective technical teaching: Feynman technique, scaffolding, cognitive load management, spaced repetition, and analogies. Used for onboarding, documentation, and knowledge sharing.

## When to Invoke
- Onboarding new team members (used by `guanabara`, `devrel-engineer`, `niamaia`)
- Creating technical documentation
- Explaining complex concepts
- Knowledge sharing sessions
- Writing tutorials and guides

---

## Core Teaching Principles

### 1. Feynman Technique (Explain Simply)
```
"If you can't explain it simply, you don't understand it well enough."

Process:
1. Choose a concept
2. Explain it to a 12-year-old (or rubber duck)
3. Identify gaps in your explanation
4. Return to source material to fill gaps
5. Simplify further with analogies
6. Test by teaching someone else
```

### 2. Scaffolding (Progressive Complexity)
```markdown
## Scaffolding Levels

### Level 1: Mental Model (Conceptual)
- What problem does this solve?
- High-level analogy
- Key components and relationships
- No code, no jargon

### Level 2: Guided Exploration (Structural)
- Architecture diagram
- Data flow
- Key interfaces/contracts
- Pseudo-code or simplified examples
- "Why" behind decisions

### Level 3: Hands-On (Implementation)
- Minimal working example
- Step-by-step with explanations
- Common pitfalls highlighted
- Exercises with solutions

### Level 4: Production Reality (Operational)
- Real codebase patterns
- Error handling, monitoring
- Performance considerations
- Deployment, rollback
- Debugging techniques

### Level 5: Mastery (Extension)
- Edge cases
- Customization/extension points
- Contributing back
- Teaching others
```

### 3. Cognitive Load Management
```markdown
## Cognitive Load Types

| Type | Description | Management Strategy |
|------|-------------|---------------------|
| **Intrinsic** | Inherent complexity of topic | Break into smaller chunks, prerequisite check |
| **Extraneous** | Poor presentation, noise | Clear structure, remove distractions, consistent notation |
| **Germane** | Schema construction | Worked examples, practice, reflection |

## Techniques
- **Chunking**: Group related concepts (max 4-7 items per chunk)
- **Signaling**: Highlight key terms, use visual hierarchy
- **Segmenting**: Break long content into digestible sections
- **Pre-training**: Cover prerequisites before main topic
- **Modality**: Use text + diagrams, not text alone
```

### 4. Spaced Repetition (Retention)
```markdown
## Review Schedule (Ebbinghaus Forgetting Curve)

| Review | Timing | Format |
|--------|--------|--------|
| 1st | Immediately after learning | Active recall (write summary) |
| 2nd | 10 minutes | Explain to peer |
| 3rd | 1 hour | Quick quiz |
| 4th | 1 day | Apply to problem |
| 5th | 1 week | Teach someone |
| 6th | 1 month | Refactor/extend |
| 7th | 3 months | Architecture review |

## Implementation
- Anki/flashcards for key concepts
- Weekly "learning retro" sessions
- Pair programming rotations
- Documentation as living reference
```

---

## Analogy Patterns (Mapping Abstract → Concrete)

### Analogy Template
```markdown
## Analogy: [Technical Concept] ≈ [Real World Concept]

### Mapping Table
| Technical | Real World | Why It Works |
|-----------|------------|--------------|
| Event Loop | Restaurant kitchen | Single chef (thread) handles multiple orders (tasks) efficiently |
| Cache | Pantry | Frequently used ingredients (data) kept close for fast access |
| Database Index | Library catalog | Find books (rows) without scanning every shelf |
| Load Balancer | Restaurant host | Distributes diners (requests) across tables (servers) |
| Circuit Breaker | Electrical breaker | Prevents cascade failure when downstream is overwhelmed |
| Message Queue | Postal service | Async delivery, retries, ordering, persistence |
| Authentication | ID card + PIN | Proves identity (who) + proves possession (what) |
| Authorization | Hotel key card | Grants access to specific rooms (resources) based on role |
| Rate Limiting | Bouncer at club | Controls entry rate, rejects when at capacity |
| Feature Flag | Light switch | Turn features on/off without rewiring (deploying) |
| Blue/Green Deploy | Theater rehearsal | Practice on stage B while audience watches stage A |
| Canary Release | Canary in coal mine | Small group tests safety before full rollout |
| Database Migration | Changing tires on moving car | Must maintain forward motion (availability) while swapping |
| Technical Debt | Credit card debt | Fast now, expensive later with compound interest |
| Refactoring | Kitchen reorganization | Same menu (behavior), better layout (maintainability) |
```

### Creating Effective Analogies
```markdown
## Analogy Quality Checklist

- [ ] **Familiar**: Target audience knows the real-world concept
- [ ] **Structural similarity**: Relationships map 1:1 (not just surface)
- [ ] **Predictive**: Can use analogy to reason about edge cases
- [ ] **Boundaries clear**: Know where analogy breaks down
- [ ] **No false confidence**: Doesn't oversimplify critical nuances
- [ ] **Cultural sensitivity**: Works across team backgrounds

## Example: Explaining Event Loop

### ❌ Bad Analogy
"Event loop is like a loop." (Tautology, no insight)

### ✅ Good Analogy
"Event loop is like a **single-barista coffee shop**:
- **Barista** = Main thread (one person)
- **Customers** = Events (I/O completion, timers, clicks)
- **Orders** = Callbacks/promises
- **Waiting area** = Event queue
- **Coffee machine** = Async operations (DB, network, disk)

**Flow**: Barista takes order → starts machine → serves next customer while machine brews → when ding! → delivers coffee → next order.

**Key insight**: Barista never waits for machine. If barista waited, line would back up. That's why blocking I/O kills Node.js performance."

---

## Teaching Formats

### 1. Interactive Workshop (90 min)
```markdown
## Workshop: [Topic]

### Pre-reqs (sent 1 week before)
- [ ] Read: [Link to primer]
- [ ] Setup: [Environment setup]
- [ ] Quiz: [5-question prerequisite check]

### Agenda
| Time | Activity | Format |
|------|----------|--------|
| 0:00 | Hook & Motivation | Story + Live Demo (5 min) |
| 0:05 | Mental Model | Diagram + Analogy (10 min) |
| 0:15 | Guided Exploration | Live Coding + Q&A (25 min) |
| 0:40 | Break | - (5 min) |
| 0:45 | Hands-On Exercise | Pair Programming (30 min) |
| 1:15 | Solutions & Patterns | Group Discussion (10 min) |
| 1:25 | Common Pitfalls | Anti-patterns + Fixes (5 min) |
| 1:30 | Wrap-up & Next Steps | Resources + Homework (5 min) |

### Post-Workshop
- [ ] Recording uploaded
- [ ] Solution repo shared
- [ ] Feedback form (3 questions)
- [ ] Follow-up exercise (due 1 week)
```

### 2. Async Learning Module
```markdown
## Module: [Topic]

### Structure
1. **Concept Video** (5-10 min) - Mental model + analogy
2. **Interactive Notebook** - Runnable code with comments
3. **Checkpoint Quiz** - 3-5 questions, immediate feedback
4. **Practice Exercise** - Scaffolded: guided → independent
5. **Reference Card** - One-page cheat sheet
6. **Discussion Prompt** - Async forum question

### Completion Criteria
- [ ] Quiz ≥ 80%
- [ ] Exercise submitted
- [ ] Peer review of exercise
- [ ] Self-reflection (3 sentences)
```

### 3. Documentation as Teaching
```markdown
## Documentation Teaching Patterns

### Concept Doc (Mental Model)
- Problem statement
- Analogy
- Architecture diagram
- Key decisions (why)
- Glossary

### Tutorial (Guided)
- Prerequisites
- Step-by-step with explanations
- Expected output at each step
- Troubleshooting section
- "Why this way?" callouts

### How-To Guide (Task-Focused)
- Goal statement
- Minimal steps
- Copy-pasteable code
- Common variations

### Reference (Lookup)
- Complete API surface
- Type signatures
- Examples for each method
- Edge cases
```

---

## Onboarding Program (Example)

```markdown
# Technical Onboarding - 4 Week Program

## Week 1: Foundations
### Day 1-2: Environment & Culture
- [ ] Machine setup (scripts provided)
- [ ] Repository tour (architecture, conventions)
- [ ] Communication norms (Slack, PRs, meetings)
- [ ] Buddy assigned (peer mentor)

### Day 3-4: Codebase Walkthrough
- [ ] Architecture overview (C4 diagrams)
- [ ] Key services: auth, orders, payments
- [ ] Data models & multi-tenancy
- [ ] Deployment pipeline

### Day 5: First Contribution
- [ ] Good first issue (labeled `good-first-issue`)
- [ ] Pair with buddy
- [ ] PR opened, reviewed, merged

## Week 2: Deep Dives
### Day 1-2: Backend (Towards)
- [ ] API patterns, tRPC, SQLAlchemy
- [ ] Testing: unit, integration, contract
- [ ] Debugging production issues

### Day 3-4: Frontend (Turing)
- [ ] React patterns, TanStack Query
- [ ] Design system, accessibility
- [ ] E2E testing with Playwright

### Day 5: Infrastructure (Trevor)
- [ ] Kubernetes, Terraform, observability
- [ ] Incident response drill

## Week 3: Specialization
- [ ] Join feature team
- [ ] Own a small feature end-to-end
- [ ] Security review with Kaspersky
- [ ] Performance baseline with Perf Engineer

## Week 4: Independence
- [ ] Solo feature (2-3 days)
- [ ] Teach concept to new hire (Feynman)
- [ ] Retro: What was missing?
- [ ] Graduate! 🎓

## Ongoing
- Monthly: "Learn & Teach" sessions
- Quarterly: Tech radar review
- Annual: Conference/training budget
```

---

## Knowledge Transfer Artifacts

### 1. Decision Log (Why, Not What)
```markdown
# Decision: [Topic]

## Context
[Problem, constraints, requirements]

## Options Considered
| Option | Pros | Cons | Score |
|--------|------|------|-------|

## Decision
[Chosen option + rationale]

## Implications
- Team must: [Actions]
- Watch for: [Risks]
- Revisit when: [Trigger]

## Teaching Notes
- **Analogy**: [Best analogy for this decision]
- **Common confusion**: [What people get wrong]
- **Exercise**: [How to practice]
```

### 2. FAQ as Teaching Tool
```markdown
# FAQ: [Topic]

## Beginner Questions
**Q: Why do we use X instead of Y?**
A: [Analogy + technical reason + historical context]

**Q: What happens if X fails?**
A: [Failure mode + mitigation + runbook link]

## Intermediate Questions
**Q: How does X interact with Y?**
A: [Data flow diagram + sequence diagram]

**Q: When should I use pattern X?**
A: [Decision tree + examples + anti-patterns]

## Advanced Questions
**Q: How would you scale X to 10x?**
A: [Bottlenecks + strategies + trade-offs]

**Q: What's the migration path from X to Y?**
A: [Strangler Fig phases + timeline + rollback]
```

---

## Output Format (for agent using this skill)
```
## Teaching Artifact Created
- Format: [Workshop / Module / Doc / FAQ / Onboarding]
- Topic: [Name]
- Audience: [Junior / Mid / Senior / Mixed]
- Duration: [Time]
- Prerequisites: [List]
- Analogies Used: [List]
- Exercises: [Count]
- Assessment: [Quiz / Project / Teaching back]
- Materials: [Links to slides, repo, videos]
```