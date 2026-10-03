# Context Mode Skill

## Description
Provides context-mode execution capabilities for handling large outputs, logs, and command results without overflowing the context window. Uses `ctx_execute` and `ctx_execute_file` tools for offloading heavy operations.

## When to Use
- Running commands that may return > 20 lines (build output, test results, logs)
- Analyzing large files (logs, test output, API responses)
- Any operation where output size is unpredictable or potentially large
- Before adding many agents/skills to a session (check context budget)

## Core Tools

### `ctx_execute`
Execute a command with context-mode output handling.

```bash
# Returns: { output: string, truncated: boolean, lines: number, file?: string }
ctx_execute "command" [--timeout=120000] [--background]
```

**Parameters:**
- `command`: Shell command to execute
- `timeout`: Max milliseconds (default: 120000)
- `background`: Run in background, return immediately

### `ctx_execute_file`
Execute command and save full output to file, return summary.

```bash
# Returns: { summary: string, file: string, lines: number, truncated: boolean }
ctx_execute_file "command" [--timeout=120000] [--output-dir=/tmp/opencode]
```

**Parameters:**
- `command`: Shell command to execute
- `timeout`: Max milliseconds
- `output-dir`: Directory to save full output (default: /tmp/opencode)

### `ctx_index`
Index a directory for fast searching.

```bash
# Returns: { indexed: number, path: string }
ctx_index "/path/to/dir" [--pattern="**/*.ts"]
```

### `ctx_search`
Search indexed content.

```bash
# Returns: { results: Array<{file, line, match, context}> }
ctx_search "query" [--path="/indexed/path"] [--limit=50]
```

## Workflow Patterns

### Pattern 1: Large Command Output
```typescript
// Instead of: tools.shell({ command: "npm test" })
const result = await tools.ctx_execute_file("npm test");
// result.summary contains first/last N lines + stats
// result.file contains full output for reference
```

### Pattern 2: Log Analysis
```typescript
const result = await tools.ctx_execute_file("tail -n 1000 /var/log/app.log");
if (result.truncated) {
  // Use ctx_search on result.file for specific patterns
  const errors = await tools.ctx_search("ERROR", { path: result.file });
}
```

### Pattern 3: Build/Test Pipeline
```typescript
const build = await tools.ctx_execute_file("pnpm build");
if (build.truncated && build.summary.includes("error")) {
  const details = await tools.ctx_search("error TS", { path: build.file });
}
```

### Pattern 4: Proactive Context Management
```typescript
// Before spawning multiple agents
const budget = await tools.ctx_execute("wc -l $(find . -name '*.ts' -o -name '*.md')");
// If total lines > threshold, use context-budget skill to compact
```

## Integration with Subagents

### Automatic via Hooks
Subagents inherit context-mode automatically via PreToolUse hook:
- Any `shell` command > 20 lines → auto-converted to `ctx_execute_file`
- Any `read` > 500 lines → auto-truncated with file reference

### Manual Invocation
Agents should explicitly use context-mode when:
```typescript
// In agent code:
const result = await tools.ctx_execute_file("pnpm test:e2e --reporter=line");
// Process result.summary for immediate decisions
// Reference result.file for detailed analysis if needed
```

## Best Practices

1. **Default to ctx_execute_file** for any command that might produce > 50 lines
2. **Use ctx_search** on result files instead of re-running commands
3. **Clean up** temp files after session: `ctx_execute "rm -f /tmp/opencode/*.log"`
4. **Combine with context-budget** skill for session-level management
5. **Log file paths** in agent output for traceability

## Token Budget Guidelines

| Operation | Estimated Tokens | Use Context-Mode? |
|-----------|------------------|-------------------|
| `npm test` (passing) | ~500 | Yes |
| `npm test` (failing) | ~2000+ | Yes |
| `pnpm build` | ~1000-5000 | Yes |
| `tail -n 1000` | ~3000 | Yes |
| `grep -r` large codebase | ~1000-10000 | Yes |
| `cat package.json` | ~50 | No |
| `ls -la` | ~100 | No |

## Example Agent Integration

```markdown
## Context-Mode Usage (Mandatory)

### Before Running Commands
- Any test/build/lint command → `ctx_execute_file`
- Any log/search command → `ctx_execute_file`
- Any command with unknown output size → `ctx_execute_file`

### Processing Results
1. Read `result.summary` for immediate decision
2. If `result.truncated` and need details → `ctx_search` on `result.file`
3. Reference `result.file` in output for traceability

### Session Management
- Call `context-guardian` if session > 50k tokens
- Use `token-budget-advisor` to set response depth (25%/50%/75%/100%)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Output still truncated | Increase `--limit` in ctx_search, or read result.file directly |
| Command hangs | Add `--timeout=300000` (5 min) |
| File not found | Check `/tmp/opencode/` exists, use `--output-dir` |
| Permission denied | Ensure command doesn't need sudo; use docker if needed |

## Related Skills
- `context-budget` — Session-level context optimization
- `token-budget-advisor` — Response depth control
- `continuous-learning-v2` — Captures context-mode patterns

---

*This skill is automatically available to all subagents via PreToolUse hook.*