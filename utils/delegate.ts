/**
 * Delegation Helpers for Severino Orchestrator
 * 
 * Provides standardized context gathering, spec creation, and subagent orchestration.
 * All subagent calls should use these helpers to ensure consistent context passing.
 */

import type { Tool } from "opencode";

// ============================================================================
// Types
// ============================================================================

export interface ContextBundle {
  files: FileContext[];
  specs: SpecContext[];
  decisions: DecisionContext[];
  existingCode: CodeContext[];
  projectMeta: ProjectMeta;
}

export interface FileContext {
  path: string;
  content: string;
  relevance: "critical" | "reference" | "contextual";
  reason: string;
}

export interface SpecContext {
  id: string;
  title: string;
  content: string;
  source: "user" | "adr" | "rfc" | "prd" | "conversation";
}

export interface DecisionContext {
  id: string;
  title: string;
  decision: string;
  rationale: string;
  adrLink?: string;
  status: "accepted" | "proposed" | "superseded";
}

export interface CodeContext {
  path: string;
  symbol?: string; // function/class name if specific
  snippet: string;
  relevance: "pattern" | "integration" | "reference";
}

export interface ProjectMeta {
  stack: string[];
  conventions: string[];
  testCommands: string[];
  buildCommands: string[];
  lintCommands: string[];
  repoRoot: string;
}

export interface DelegationSpec {
  agent: string;
  description: string;
  prompt: string;
  background?: boolean;
  timeoutMs?: number;
}

export interface StandardFlowSpec {
  name: string;
  steps: DelegationSpec[];
}

// ============================================================================
// Context Gathering
// ============================================================================

/**
 * Gather comprehensive context for a delegation.
 * Reads files, specs, decisions, and existing code relevant to the task.
 */
export async function gatherContext(
  tools: Tool,
  params: {
    files?: string[];           // File paths to include
    specs?: string[];           // Spec IDs or paths
    decisions?: string[];       // Decision IDs or ADR paths
    codeSymbols?: string[];     // Specific symbols to find
    taskDescription: string;    // Used for semantic search
    maxFiles?: number;
  }
): Promise<ContextBundle> {
  const {
    files = [],
    specs = [],
    decisions = [],
    codeSymbols = [],
    taskDescription,
    maxFiles = 20,
  } = params;

  // Read explicit files
  const fileContexts: FileContext[] = [];
  for (const filePath of files.slice(0, maxFiles)) {
    try {
      const content = await tools.read({ path: filePath });
      fileContexts.push({
        path: filePath,
        content: content.text || "",
        relevance: "critical",
        reason: "Explicitly requested",
      });
    } catch {
      // File may not exist, skip
    }
  }

  // Semantic search for relevant files (placeholder - would use graphify/LSP in real impl)
  // For now, we'll rely on explicit file list

  // Read specs
  const specContexts: SpecContext[] = [];
  for (const specPath of specs) {
    try {
      const content = await tools.read({ path: specPath });
      specContexts.push({
        id: specPath,
        title: specPath.split("/").pop() || specPath,
        content: content.text || "",
        source: "user",
      });
    } catch {
      // Skip missing specs
    }
  }

  // Read decisions/ADRs
  const decisionContexts: DecisionContext[] = [];
  for (const decisionPath of decisions) {
    try {
      const content = await tools.read({ path: decisionPath });
      // Parse ADR frontmatter or extract decision
      decisionContexts.push({
        id: decisionPath,
        title: decisionPath.split("/").pop() || decisionPath,
        decision: extractDecision(content.text || ""),
        rationale: extractRationale(content.text || ""),
        adrLink: decisionPath,
        status: extractStatus(content.text || ""),
      });
    } catch {
      // Skip missing decisions
    }
  }

  // Get existing code patterns (placeholder)
  const codeContexts: CodeContext[] = [];

  // Project metadata (would be cached in real impl)
  const projectMeta: ProjectMeta = {
    stack: ["TypeScript", "Node.js", "React", "PostgreSQL"],
    conventions: ["kebab-case files", "conventional commits", "TypeScript strict"],
    testCommands: ["pnpm test", "pnpm test:e2e"],
    buildCommands: ["pnpm build"],
    lintCommands: ["pnpm lint", "pnpm typecheck"],
    repoRoot: process.cwd(),
  };

  return {
    files: fileContexts,
    specs: specContexts,
    decisions: decisionContexts,
    existingCode: codeContexts,
    projectMeta,
  };
}

/**
 * Extract decision from ADR content
 */
function extractDecision(content: string): string {
  const match = content.match(/## Decision\s*\n([\s\S]*?)(?:\n##|$)/i);
  return match ? match[1].trim() : "See ADR for details";
}

function extractRationale(content: string): string {
  const match = content.match(/## (?:Consequences|Rationale)\s*\n([\s\S]*?)(?:\n##|$)/i);
  return match ? match[1].trim() : "See ADR for details";
}

function extractStatus(content: string): "accepted" | "proposed" | "superseded" {
  const match = content.match(/Status:\s*(Proposed|Accepted|Superseded|Deprecated)/i);
  if (!match) return "proposed";
  const status = match[1].toLowerCase();
  return status === "accepted" ? "accepted" : status === "superseded" ? "superseded" : "proposed";
}

// ============================================================================
// Spec Creation
// ============================================================================

/**
 * Create a standard feature flow: Research → Plan → TDD → Implement → Review → Commit
 * Returns ordered delegation specs for the full feature lifecycle.
 */
export function createStandardFeatureFlow(
  featureName: string,
  taskDescription: string,
  context: ContextBundle,
  options: {
    includeResearch?: boolean;
    includeSecurityReview?: boolean;
    includePerformanceReview?: boolean;
    parallelizable?: string[]; // agent names that can run in parallel
  } = {}
): StandardFlowSpec {
  const {
    includeResearch = true,
    includeSecurityReview = true,
    includePerformanceReview = false,
    parallelizable = [],
  } = options;

  const contextBlock = formatContextForPrompt(context);
  const steps: DelegationSpec[] = [];

  // Step 1: Research (optional, for complex/unknown domains)
  if (includeResearch) {
    steps.push(createDelegationSpec({
      agent: "towards",
      description: `Research: ${featureName}`,
      task: `Research and analyze the problem space for "${featureName}". 
      
Task: ${taskDescription}

${contextBlock}

Deliverable: Research summary with:
- Problem decomposition
- Existing patterns in codebase
- Technical risks and unknowns
- Recommended approach with alternatives
- Effort estimate (S/M/L/XL)`,
    }));
  }

  // Step 2: Architecture Decision (if needed)
  steps.push(createDelegationSpec({
    agent: "niamaia",
    description: `Architecture Decision: ${featureName}`,
    task: `Make architectural decisions for "${featureName}".

Task: ${taskDescription}

${contextBlock}

Deliverable: ADR with:
- Context and problem statement
- Decision with concrete action
- Trade-offs (positive/negative/risks)
- Alternatives considered
- Implementation guidance
- Migration path if applicable

Only create ADR if decision is irreversible (stack, DB, auth, cache, message broker, API versioning).`,
  }));

  // Step 3: Threat Modeling (if security-sensitive)
  if (includeSecurityReview) {
    steps.push(createDelegationSpec({
      agent: "kaspersky",
      description: `Threat Model: ${featureName}`,
      task: `Perform threat modeling for "${featureName}".

Task: ${taskDescription}

${contextBlock}

Deliverable: Threat model with:
- STRIDE analysis for new trust boundaries
- Data flow diagram
- Risk scoring (Critical/High/Medium/Low)
- Mitigations for each threat
- Security requirements for implementation

Focus on: auth, payments, PII, file upload, crypto, external integrations.`,
    }));
  }

  // Step 4: Implementation Plan
  steps.push(createDelegationSpec({
    agent: "towards",
    description: `Implementation Plan: ${featureName}`,
    task: `Create detailed implementation plan for "${featureName}".

Task: ${taskDescription}

${contextBlock}

Deliverable: Implementation plan with:
- Atomic tasks (max 2-3h each)
- File changes per task
- Test scenarios per task
- Dependencies between tasks
- Parallelizable groups
- Rollback plan
- ADR references`,
  }));

  // Step 5: TDD - Test First (qualy designs, towards/turing implement)
  steps.push(createDelegationSpec({
    agent: "qualy",
    description: `Test Design: ${featureName}`,
    task: `Design test strategy and write test specs for "${featureName}".

Task: ${taskDescription}

${contextBlock}

Deliverable: Test plan with:
- Unit test cases (happy path, edge cases, error handling)
- Integration test cases (API contracts, DB interactions)
- E2E test cases (critical user journeys)
- Contract test cases (if API changes)
- Performance benchmarks (if applicable)
- Test data requirements
- Flakiness prevention strategies`,
  }));

  // Step 6: Implementation (parallelizable: towards + turing)
  if (parallelizable.includes("towards") && parallelizable.includes("turing")) {
    steps.push(createDelegationSpec({
      agent: "towards",
      description: `Backend Implementation: ${featureName}`,
      task: `Implement backend for "${featureName}".

Task: ${taskDescription}

${contextBlock}

Follow test specs from qualy. Implement:
- Domain models and business logic
- Repository layer
- Service layer
- API endpoints
- Database migrations
- Unit tests

Output: Complete implementation files + test evidence.`,
    }));

    steps.push(createDelegationSpec({
      agent: "turing",
      description: `Frontend Implementation: ${featureName}`,
      task: `Implement frontend for "${featureName}".

Task: ${taskDescription}

${contextBlock}

Follow test specs from qualy. Implement:
- Components (Server Components by default)
- Hooks and state management
- API integration (generated types)
- Accessibility (WCAG 2.1 AA)
- Performance (Core Web Vitals)
- Unit + E2E tests

Output: Complete implementation files + test evidence.`,
    }));
  } else {
    steps.push(createDelegationSpec({
      agent: "towards",
      description: `Full Implementation: ${featureName}`,
      task: `Implement "${featureName}" (full-stack).

Task: ${taskDescription}

${contextBlock}

Follow test specs from qualy. Implement backend + frontend as needed.

Output: Complete implementation files + test evidence.`,
    }));
  }

  // Step 7: Code Review (mandatory)
  steps.push(createDelegationSpec({
    agent: "tranquilao",
    description: `Code Review: ${featureName}`,
    task: `Perform comprehensive code review for "${featureName}".

Review all changes against checklist:
- TypeScript strict, lint clean
- Tests pass, coverage maintained
- Security (injection, XSS, authz, secrets)
- Performance (N+1, bundle, re-renders)
- Breaking changes (API, DB, config)
- Architecture compliance
- Accessibility (if frontend)
- Documentation

Output: Review with BLOCKER/MAJOR/MINOR/NIT classification.`,
  }));

  // Step 8: Performance Review (optional)
  if (includePerformanceReview) {
    steps.push(createDelegationSpec({
      agent: "performance-engineer",
      description: `Performance Review: ${featureName}`,
      task: `Review performance implications for "${featureName}".

Check:
- Query performance (EXPLAIN plans)
- Bundle size impact
- Core Web Vitals (if frontend)
- Memory/CPU profiling
- Capacity planning

Output: Performance report with baselines and recommendations.`,
    }));
  }

  // Step 9: Verification Loop (mandatory before PR)
  steps.push(createDelegationSpec({
    agent: "towards",
    description: `Verification Loop: ${featureName}`,
    task: `Run verification loop for "${featureName}".

Execute:
1. Build passes
2. Type check passes (zero errors)
3. Lint clean (zero warnings)
4. Tests pass with coverage ≥ 80% line / 70% branch
5. Security scan clean
6. Architecture check (circular deps, boundaries)
7. Diff review - intentional changes only

Fix any failures before considering complete.`,
  }));

  return { name: featureName, steps };
}

/**
 * Create a single delegation spec with full context injection.
 */
export function createDelegationSpec(params: {
  agent: string;
  description: string;
  task: string;
  background?: boolean;
  timeoutMs?: number;
  context?: ContextBundle;
}): DelegationSpec {
  const { agent, description, task, background = false, timeoutMs = 300000, context } = params;
  
  const contextBlock = context ? formatContextForPrompt(context) : "";
  
  const agentPrompts: Record<string, string> = {
    towards: await import("../agents/towards.md").then(m => m.default || ""),
    turing: await import("../agents/turing.md").then(m => m.default || ""),
    niamaia: await import("../agents/niamaia.md").then(m => m.default || ""),
    trevor: await import("../agents/trevor.md").then(m => m.default || ""),
    qualy: await import("../agents/qualy.md").then(m => m.default || ""),
    tranquilao: await import("../agents/tranquilao.md").then(m => m.default || ""),
    kaspersky: await import("../agents/kaspersky.md").then(m => m.default || ""),
    guanabara: await import("../agents/guanabara.md").then(m => m.default || ""),
    "context-guardian": await import("../agents/context-guardian.md").then(m => m.default || ""),
    archaeologist: await import("../agents/archaeologist.md").then(m => m.default || ""),
    "performance-engineer": await import("../agents/performance-engineer.md").then(m => m.default || ""),
    "data-engineer": await import("../agents/data-engineer.md").then(m => m.default || ""),
    "mobile-engineer": await import("../agents/mobile-engineer.md").then(m => m.default || ""),
    "devrel-engineer": await import("../agents/devrel-engineer.md").then(m => m.default || ""),
    auditor: await import("../agents/auditor.md").then(m => m.default || ""),
    "security-lead": await import("../agents/security-lead.md").then(m => m.default || ""),
    "release-manager": await import("../agents/release-manager.md").then(m => m.default || ""),
    "pr-engineer": await import("../agents/pr-engineer.md").then(m => m.default || ""),
    "triage-lead": await import("../agents/triage-lead.md").then(m => m.default || ""),
  };

  const systemPrompt = agentPrompts[agent] || "";
  
  const fullPrompt = `${systemPrompt}

## Delegated Task
${description}

## Task Details
${task}

${contextBlock ? `## Full Context\n${contextBlock}` : ""}

## Instructions
- Read the full system prompt above (your role definition)
- Use your assigned skills (listed in your agent frontmatter)
- Follow the output format specified in your role
- Return complete, PR-ready code (not snippets)
- Include technical decisions, test suggestions, and next steps`;

  return {
    agent: "general", // OpenCode subagent type
    description,
    prompt: fullPrompt,
    background,
    timeoutMs,
  };
}

/**
 * Format context bundle for prompt injection
 */
function formatContextForPrompt(context: ContextBundle): string {
  const parts: string[] = [];

  if (context.files.length > 0) {
    parts.push("### Relevant Files");
    for (const f of context.files) {
      parts.push(`\`${f.path}\` (${f.relevance}): ${f.reason}`);
      parts.push("```");
      parts.push(f.content.slice(0, 3000)); // Truncate large files
      parts.push("```");
    }
  }

  if (context.specs.length > 0) {
    parts.push("### Specifications");
    for (const s of context.specs) {
      parts.push(`**${s.title}** (${s.source}):`);
      parts.push(s.content.slice(0, 2000));
    }
  }

  if (context.decisions.length > 0) {
    parts.push("### Previous Decisions (ADRs)");
    for (const d of context.decisions) {
      parts.push(`**${d.title}** [${d.status}]: ${d.decision}`);
      parts.push(`Rationale: ${d.rationale}`);
      if (d.adrLink) parts.push(`Link: ${d.adrLink}`);
    }
  }

  if (context.existingCode.length > 0) {
    parts.push("### Existing Code Patterns");
    for (const c of context.existingCode) {
      parts.push(`\`${c.path}\`${c.symbol ? `::${c.symbol}` : ""} (${c.relevance}):`);
      parts.push("```");
      parts.push(c.snippet.slice(0, 1000));
      parts.push("```");
    }
  }

  parts.push("### Project Meta");
  parts.push(`Stack: ${context.projectMeta.stack.join(", ")}`);
  parts.push(`Conventions: ${context.projectMeta.conventions.join(", ")}`);
  parts.push(`Test: ${context.projectMeta.testCommands.join(" | ")}`);
  parts.push(`Build: ${context.projectMeta.buildCommands.join(" | ")}`);
  parts.push(`Lint: ${context.projectMeta.lintCommands.join(" | ")}`);

  return parts.join("\n\n");
}

// ============================================================================
// Execution Helpers
// ============================================================================

/**
 * Execute a standard flow sequentially, updating context between steps.
 */
export async function executeFlow(
  tools: Tool,
  flow: StandardFlowSpec,
  initialContext: ContextBundle,
  onStepComplete?: (step: DelegationSpec, result: any, context: ContextBundle) => ContextBundle
): Promise<{ results: any[]; finalContext: ContextBundle }> {
  let context = initialContext;
  const results: any[] = [];

  for (const step of flow.steps) {
    const result = await tools.subagent({
      agent: step.agent,
      description: step.description,
      prompt: step.prompt,
      background: step.background,
    });

    results.push({ step: step.description, result });

    // Update context with result
    if (onStepComplete) {
      context = onStepComplete(step, result, context);
    } else {
      context = updateContextWithResult(context, step, result);
    }
  }

  return { results, finalContext: context };
}

/**
 * Update context bundle with subagent result
 */
function updateContextWithResult(
  context: ContextBundle,
  step: DelegationSpec,
  result: any
): ContextBundle {
  // Extract files, decisions, code from result
  // This is a simplified version - real impl would parse structured output
  return context;
}

/**
 * Create a consultation spec for inter-subagent read-only queries.
 * Used when subagent A needs clarification from subagent B without decision-making.
 */
export function createConsultationSpec(params: {
  fromAgent: string;
  toAgent: string;
  question: string;
  context: ContextBundle;
}): DelegationSpec {
  const { fromAgent, toAgent, question, context } = params;
  const contextBlock = formatContextForPrompt(context);

  return createDelegationSpec({
    agent: toAgent,
    description: `Consultation: ${question.slice(0, 50)}`,
    task: `CONSULTATION REQUEST from ${fromAgent}

Question: ${question}

This is a READ-ONLY consultation. Answer directly (max 3 lines).
If your answer requires a DECISION (trade-off, contract change, new pattern, tech choice),
respond EXACTLY: "REQUER DECISÃO DO SEVERINO: [option A vs option B summary]"

${contextBlock}`,
    timeoutMs: 60000,
  });
}

// ============================================================================
// Skill Invocation Helpers
// ============================================================================

export interface SkillInvocation {
  skill: string;
  params: Record<string, any>;
  reason: string;
}

/**
 * Standard skills that Severino must invoke at specific gates.
 */
export const REQUIRED_SKILLS: Record<string, SkillInvocation[]> = {
  "pre-implementation": [
    { skill: "orch-pipeline", params: { phase: "classify" }, reason: "Classify work size and required gates" },
    { skill: "context-budget", params: {}, reason: "Check context bloat before adding agents/skills" },
  ],
  "pre-pr": [
    { skill: "verification-loop", params: {}, reason: "Mandatory verification before PR" },
  ],
  "post-feature": [
    { skill: "continuous-learning-v2", params: {}, reason: "Capture instincts, evolve skills" },
  ],
  "security-sensitive": [
    { skill: "threat-modeling", params: {}, reason: "STRIDE threat model for auth/payments/PII" },
    { skill: "security-research", params: {}, reason: "Team Mode security audit" },
  ],
  "release": [
    { skill: "pre-publish-review", params: {}, reason: "12-agent gate before publish" },
    { skill: "publish", params: {}, reason: "Ship-only workflow" },
  ],
  "refactoring": [
    { skill: "tech-debt-audit", params: {}, reason: "Codebase health check" },
    { skill: "migration-patterns", params: {}, reason: "Migration strategy" },
  ],
  "legacy": [
    { skill: "legacy-patterns", params: {}, reason: "Understand legacy code" },
    { skill: "archaeologist", params: {}, reason: "Code archaeology" },
  ],
};

/**
 * Invoke a skill by name with parameters.
 * Skills are loaded from ResultadoFinal/skills/{skill}/SKILL.md
 */
export async function invokeSkill(
  tools: Tool,
  skillName: string,
  params: Record<string, any> = {}
): Promise<any> {
  // Read skill definition
  const skillPath = `./ResultadoFinal/skills/${skillName}/SKILL.md`;
  let skillContent = "";
  
  try {
    const result = await tools.read({ path: skillPath });
    skillContent = result.text || "";
  } catch {
    throw new Error(`Skill not found: ${skillName}`);
  }

  // Execute skill (this would invoke the skill's workflow)
  // For now, return the skill content for the agent to follow
  return {
    skill: skillName,
    content: skillContent,
    params,
    executed: true,
  };
}

// ============================================================================
// Utility: Load Agent Prompt
// ============================================================================

const agentPromptCache: Map<string, string> = new Map();

export async function loadAgentPrompt(
  tools: Tool,
  agentName: string
): Promise<string> {
  if (agentPromptCache.has(agentName)) {
    return agentPromptCache.get(agentName)!;
  }

  const path = `./ResultadoFinal/agents/${agentName}.md`;
  try {
    const result = await tools.read({ path });
    const content = result.text || "";
    agentPromptCache.set(agentName, content);
    return content;
  } catch {
    throw new Error(`Agent prompt not found: ${agentName}`);
  }
}

// ============================================================================
// Export all
// ============================================================================

export default {
  gatherContext,
  createStandardFeatureFlow,
  createDelegationSpec,
  createConsultationSpec,
  executeFlow,
  invokeSkill,
  loadAgentPrompt,
  REQUIRED_SKILLS,
  formatContextForPrompt,
  updateContextWithResult,
};