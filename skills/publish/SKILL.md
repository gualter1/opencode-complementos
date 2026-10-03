---
description: Publish Workflow - Ship-only release workflow. Version bump, changelog, GitHub release, Discord announcement, npm verification. NO pre-publish review, NO code fixes.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# Publish Workflow - Ship-Only Release Automation Skill

## Purpose
Executes the complete publish workflow: version bump → changelog → GitHub release → Discord announcement → npm verification. **Ship-only** — no pre-publish review, no code fixes, no re-audit loops.

## When to Invoke
- User says: "publish patch", "release minor", "deploy major v2.0.0", "ship v1.5.0" (used by `release-manager`, `severino`)
- **NEVER** for "can I publish?" or "pre-publish review" — different skill

---

## Critical Rules (NON-NEGOTIABLE)

1. **NEVER** run pre-publish-review, review-work, or code re-review
2. **NEVER** "fix" code, open PRs, or enter fix-and-re-audit loops
3. If workflow fails or something looks broken → **report and STOP**
4. Publish request goes from Step 0 to Step 3 (trigger) in minutes
5. **NO EARLY TURN-END** — must drive to terminal conclusion

---

## Three Release Surfaces (ALL Must Verify)

| Release Layer | Surface | Required Proof |
|---------------|---------|----------------|
| `omo pure components` | Core/MCP/shared-skill changes in published package payload | Release notes call out layer-specific version impact |
| `omo opencode` | oh-my-opencode, oh-my-openagent npm packages + platform packages | npm versions and GitHub release exist for selected bump |
| `omo codex` | lazycodex-ai, Codex plugin metadata, code-yeongyu/lazycodex marketplace | Plugin metadata stamped, lazycodex-ai publishes, LazyCodex repo release created |

---

## Discord Announcement (MANDATORY)

- DO NOT stop after GitHub release
- DO NOT stop after drafting/applying release notes
- After release notes finalized → **immediately post to Discord**
- If Discord fails after auth/retry → report failure clearly, continue remaining steps

---

## Completion Contract (NO EARLY TURN-END)

After triggering workflow, you MUST drive to terminal conclusion:
1. Run conclusion = success (poll every 30s)
2. Release exists (`gh release view`)
3. Enhanced summary applied (mandatory for ALL release types)
4. Discord announced (message ID recorded OR clear failure reported)
5. npm verified (oh-my-opencode, oh-my-openagent, lazycodex-ai show new version)

---

## Steps 0-12 (Complete Workflow)

### Step 0: Register Todo List
```markdown
## Publish Todo: [version] [type: patch/minor/major]

- [ ] Step 1: Confirm Release Selector
- [ ] Step 2: Check Uncommitted Changes
- [ ] Step 3: Sync with Remote
- [ ] Step 4: Trigger GitHub Actions Workflow
- [ ] Step 5: Wait for Workflow Completion
- [ ] Step 6: Verify Release & Preview Auto-Generated Content
- [ ] Step 7: Draft Enhanced Release Summary
- [ ] Step 8: Apply Enhanced Summary to Release
- [ ] Step 9: Post to Discord
- [ ] Step 10: Verify npm Publication
- [ ] Step 11: Spot-Check Platform Binaries
- [ ] Step 12: Final Confirmation
```

### Step 1: Confirm Release Selector
```bash
# User must provide: patch | minor | major | explicit semver (e.g., v2.0.0)
# STOP if not provided
echo "Release type: $RELEASE_TYPE"
# Validate: patch|minor|major|v*
```

### Step 2: Check Uncommitted Changes
```bash
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠️  WARNING: Uncommitted changes detected"
  git status --short
  # Warn but continue (user responsibility)
fi
```

### Step 3: Sync with Remote
```bash
git pull --rebase origin dev
# Push if local commits not on remote
git push origin dev
```

### Step 4: Trigger GitHub Actions Workflow
```bash
# Determine workflow file and bump parameter
WORKFLOW_FILE="publish.yml"
BUMP_PARAM="$RELEASE_TYPE"  # patch, minor, major, or explicit version

gh workflow run "$WORKFLOW_FILE" --ref dev -f bump="$BUMP_PARAM"

# Get run ID for polling
RUN_ID=$(gh run list --workflow="$WORKFLOW_FILE" --limit=1 --json databaseId -q '.[0].databaseId')
echo "Triggered workflow run: $RUN_ID"
```

### Step 5: Wait for Workflow Completion
```bash
# Poll every 30 seconds
while true; do
  STATUS=$(gh run view "$RUN_ID" --json conclusion -q '.conclusion')
  if [ "$STATUS" = "success" ]; then
    echo "✅ Workflow completed successfully"
    break
  elif [ "$STATUS" = "failure" ] || [ "$STATUS" = "cancelled" ]; then
    echo "❌ Workflow failed: $STATUS"
    gh run view "$RUN_ID" --log-failed
    exit 1
  fi
  echo "⏳ Workflow in progress... (status: $STATUS)"
  sleep 30
done
```

### Step 6: Verify Release & Preview Auto-Generated Content
```bash
# Get the new release tag
NEW_TAG=$(gh release list --limit=1 --json tagName -q '.[0].tagName')
echo "New release: $NEW_TAG"

# View release details
gh release view "$NEW_TAG" --json name,body,isDraft,isPrerelease

# Preview auto-generated changelog
# Check for: conventional commits, contributors, breaking changes
```

### Step 7: Draft Enhanced Release Summary (MANDATORY for ALL)

```markdown
# Enhanced Summary Rules

## NEVER
- Duplicate commit messages
- Generic filler ("various bug fixes", "improvements", "refactors")
- Include internal adapter changes (senpi, omo-senpi, senpi-task, pi-goal, pi-webfetch)

## ALWAYS
- Focus on USER IMPACT
- Group by THEME/CAPABILITY
- Concrete language: "You can now do X"
- Concrete language: "Fixed issue where Y happened"

## Template
### 🎉 What's New in [version]

#### ✨ New Capabilities
- **You can now [do X]** — [brief context, link to docs]
- **You can now [do Y]** — [brief context]

#### 🐛 Fixed Issues
- **Fixed [specific problem]** — [user impact, not commit hash]
- **Fixed [specific problem]** — [user impact]

#### ⚡ Performance
- **[Operation] is now [X]% faster** — [context]
- **Reduced [metric] from [A] to [B]**

#### 🔧 Developer Experience
- **[Tool/Command] now supports [feature]**
- **Improved [error message/logging] for [scenario]**

#### 📦 Dependencies
- **Updated [dep] to [version]** — [reason if notable]

#### ⚠️ Breaking Changes (if major)
- **[What changed]** — [migration guide link]

#### 🙏 Contributors
- @user1, @user2, @user3 (auto-generated + manual additions)
```

### Step 8: Apply Enhanced Summary to Release
```bash
# Prepend enhanced summary to existing release notes (ZERO content loss)
CURRENT_BODY=$(gh release view "$NEW_TAG" --json body -q '.body')
ENHANCED_BODY="$ENHANCED_SUMMARY\n\n---\n\n### Auto-Generated\n$CURRENT_BODY"

gh release edit "$NEW_TAG" --notes "$ENHANCED_BODY"
echo "✅ Enhanced summary applied"
```

### Step 9: Post to Discord
```bash
# Jobdori bot, channel 1454708427392680067
# Match previous style
DISCORD_PAYLOAD=$(cat <<'EOF'
{
  "content": "**🚀 New Release: `$NEW_TAG`**\n\n$ENHANCED_SUMMARY\n\n📦 **npm**: https://www.npmjs.com/package/oh-my-opencode/v/$NEW_TAG\n📋 **GitHub**: https://github.com/owner/repo/releases/tag/$NEW_TAG\n\n@here"
}
EOF
)

curl -X POST "$DISCORD_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d "$DISCORD_PAYLOAD"

# Record message ID
DISCORD_MSG_ID=$(echo $RESPONSE | jq -r '.id')
echo "Discord message ID: $DISCORD_MSG_ID"
```

### Step 10: Verify npm Publication
```bash
# Poll npm registry
for pkg in "oh-my-opencode" "oh-my-openagent" "lazycodex-ai"; do
  echo "Verifying $pkg..."
  for i in {1..20}; do
    VERSION=$(npm view "$pkg" version --json 2>/dev/null || echo "null")
    if [ "$VERSION" = "\"$NEW_TAG\"" ] || [ "$VERSION" = "\"v$NEW_TAG\"" ]; then
      echo "✅ $pkg@$VERSION published"
      break
    fi
    sleep 15
  done
  if [ "$VERSION" != "\"$NEW_TAG\"" ]; then
    echo "❌ $pkg not published after 5 minutes"
    exit 1
  fi
done
```

### Step 11: Spot-Check Platform Binaries
```bash
# Verify platform binaries exist and are downloadable
for platform in "darwin-arm64" "linux-x64" "windows-x64"; do
  URL="https://github.com/owner/repo/releases/download/$NEW_TAG/oh-my-opencode-$platform.tar.gz"
  if curl -f -I "$URL" >/dev/null 2>&1; then
    echo "✅ $platform binary available"
  else
    echo "⚠️  $platform binary NOT found"
  fi
done
```

### Step 12: Final Confirmation
```markdown
## Release Complete: $NEW_TAG

### Version
- Tag: $NEW_TAG
- Type: [patch/minor/major]

### Verification
- ✅ GitHub Release: https://github.com/owner/repo/releases/tag/$NEW_TAG
- ✅ Enhanced Summary: Applied
- ✅ Discord: Posted (Message ID: $DISCORD_MSG_ID)
- ✅ npm: oh-my-opencode@$NEW_TAG, oh-my-openagent@$NEW_TAG, lazycodex-ai@$NEW_TAG
- ✅ Binaries: darwin-arm64, linux-x64, windows-x64

### Release Layers
| Layer | Version | Notes |
|-------|---------|-------|
| omo pure components | [version] | [changes] |
| omo opencode | [version] | [changes] |
| omo codex | [version] | [changes] |

### Next Steps
- Monitor error rates for 30 minutes
- Watch deployment metrics
- Update team on Discord
```

---

## Rollback Procedure (If Workflow Fails)

```bash
# If GitHub Actions workflow fails:
1. gh run view $RUN_ID --log-failed
2. Identify failure point
3. If transient (network, timeout): re-run workflow
4. If code issue: DO NOT FIX HERE → Report to Severino
5. If release already created but incomplete: gh release delete $NEW_TAG

# If npm publish fails but GitHub release exists:
1. DO NOT delete GitHub release (audit trail)
2. Report to Severino for manual npm publish
3. Discord: "⚠️ Release $NEW_TAG published to GitHub but npm pending"
```

---

## Anti-Patterns (BLOCKING)

| Violation | Why it fails |
|-----------|--------------|
| Running pre-publish-review during publish | Separate workflows; publish is ship-only |
| Fixing code during publish | Breaks audit trail; publish is ship-only |
| Stopping after GitHub release | Discord + npm verification mandatory |
| Stopping after drafting release notes | Must APPLY enhanced summary |
| Early turn-end before npm verified | Completion contract requires all 5 verifications |
| Skipping Discord on failure | Must report failure clearly, continue |
| Not spot-checking binaries | Platform users affected |

---

## Output Format (for agent using this skill)
```
## Publish Complete
- Version: [tag]
- Type: [patch/minor/major/explicit]
- Workflow Run: [ID] - [success/failed]
- GitHub Release: [URL]
- Enhanced Summary: [Applied - yes/no]
- Discord: [Posted - message ID / Failed - reason]
- npm: [oh-my-opencode@X, oh-my-openagent@X, lazycodex-ai@X]
- Binaries: [darwin-arm64, linux-x64, windows-x64 - all OK/partial]
- Total Time: [minutes]
- Issues: [Any failures reported]
```