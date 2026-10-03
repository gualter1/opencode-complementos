---
description: CI/CD Patterns - GitHub Actions/GitLab CI, pipelines, gates, rollback, supply chain security. Pipeline as code with reusable workflows.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# CI/CD Patterns - Pipeline Automation Skill

## Purpose
Defines CI/CD patterns for GitHub Actions/GitLab CI: pipeline architecture, reusable workflows, quality gates, rollback strategies, and supply chain security (SLSA, signing, SBOM).

## When to Invoke
- Setting up CI/CD for new projects (used by `trevor`, `qualy`, `performance-engineer`, `release-manager`)
- Optimizing pipeline performance
- Adding security gates
- Implementing deployment strategies
- Supply chain hardening

---

## Pipeline Architecture Principles

### 1. Pipeline as Code
```yaml
# All pipelines in .github/workflows/ (or .gitlab-ci.yml)
# Version controlled, peer reviewed, tested
```

### 2. Reusable Workflows (GitHub Actions)
```yaml
# .github/workflows/reusable-ci.yml
name: Reusable CI
on:
  workflow_call:
    inputs:
      node-version:
        required: true
        type: string
      cache-key:
        required: false
        type: string
        default: "node-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}"
    outputs:
      test-results:
        description: "Test results summary"
        value: ${{ jobs.test.outputs.results }}
    secrets:
      NPM_TOKEN:
        required: true

jobs:
  test:
    runs-on: ubuntu-latest
    outputs:
      results: ${{ steps.summary.outputs.results }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: 'npm'
          cache-dependency-path: ${{ inputs.cache-key }}
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - id: test
        run: npm test -- --reporter=json --outputFile=test-results.json
      - id: summary
        run: |
          PASS=$(jq '.testResults[].assertionResults | map(select(.status=="passed")) | length' test-results.json)
          FAIL=$(jq '.testResults[].assertionResults | map(select(.status=="failed")) | length' test-results.json)
          echo "results=Pass: $PASS, Fail: $FAIL" >> $GITHUB_OUTPUT
      - uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results.json
```

### 3. Matrix Strategies for Parallelization
```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request, push]

jobs:
  test:
    uses: ./.github/workflows/reusable-ci.yml
    strategy:
      matrix:
        include:
          - node-version: "20"
            name: "Node 20"
          - node-version: "22"
            name: "Node 22"
    secrets: inherit

  security:
    uses: ./.github/workflows/reusable-security.yml
    secrets: inherit

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
```

---

## Quality Gates (Required for All Pipelines)

```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates
on: [pull_request]

jobs:
  gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Gate 1: Type Check
      - name: Type Check
        run: npm run typecheck
      
      # Gate 2: Lint
      - name: Lint
        run: npm run lint -- --max-warnings=0
      
      # Gate 3: Unit Tests + Coverage
      - name: Unit Tests
        run: npm run test:unit -- --coverage
      - name: Check Coverage
        run: |
          COV=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COV < 80" | bc -l) )); then
            echo "Line coverage $COV% below 80%"
            exit 1
          fi
      
      # Gate 4: Integration Tests (Testcontainers)
      - name: Integration Tests
        run: npm run test:integration
      
      # Gate 5: Contract Tests
      - name: Contract Tests
        run: npm run test:contract
      
      # Gate 6: Build
      - name: Build
        run: npm run build
      
      # Gate 7: Security Scan
      - name: SAST (Semgrep)
        uses: returntocorp/semgrep-action@v1
      - name: Secrets Scan
        uses: trufflesecurity/trufflehog-action@v1
      - name: Dependency Scan
        run: npm audit --audit-level=high
      
      # Gate 8: Container Scan (if Docker)
      - name: Container Scan
        if: hashFiles('Dockerfile') != ''
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ github.repository }}:${{ github.sha }}
          severity: HIGH,CRITICAL
      
      # Gate 9: SBOM Generation
      - name: Generate SBOM
        run: syft . -o spdx-json=sbom.spdx.json
      - uses: actions/upload-artifact@v4
        with: { name: sbom, path: sbom.spdx.json }
```

---

## Deployment Strategies

### Blue/Green (Zero Downtime)
```yaml
# .github/workflows/deploy-blue-green.yml
name: Deploy Blue/Green
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, prod]
        required: true
      version:
        type: string
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - name: Deploy to inactive slot
        run: |
          # Deploy to blue if green active, vice versa
          ACTIVE=$(kubectl get svc app-${{ github.event.inputs.environment }} -o jsonpath='{.spec.selector.version}')
          INACTIVE=$([ "$ACTIVE" = "blue" ] && echo "green" || echo "blue")
          
          kubectl set image deployment/app-${INACTIVE} \
            app=${{ env.REGISTRY }}/${{ github.repository }}:${{ github.event.inputs.version }} \
            -n ${{ github.event.inputs.environment }}
          
          kubectl rollout status deployment/app-${INACTIVE} -n ${{ github.event.inputs.environment }} --timeout=5m
      
      - name: Smoke Tests
        run: |
          PREVIEW_URL="https://${INACTIVE}.${{ github.event.inputs.environment }}.example.com"
          curl -f "$PREVIEW_URL/health" || exit 1
          npm run test:smoke -- --baseUrl=$PREVIEW_URL
      
      - name: Switch Traffic
        run: |
          kubectl patch svc app-${{ github.event.inputs.environment }} \
            -p '{"spec":{"selector":{"version":"'${INACTIVE}'"}}}' \
            -n ${{ github.event.inputs.environment }}
      
      - name: Verify Post-Switch
        run: |
          sleep 30
          curl -f "https://${{ github.event.inputs.environment }}.example.com/health" || exit 1
      
      - name: Rollback on Failure
        if: failure()
        run: |
          kubectl patch svc app-${{ github.event.inputs.environment }} \
            -p '{"spec":{"selector":{"version":"'${ACTIVE}'"}}}' \
            -n ${{ github.event.inputs.environment }}
```

### Canary (Progressive Delivery)
```yaml
# .github/workflows/deploy-canary.yml
name: Deploy Canary
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, prod]
      version:
        type: string

jobs:
  canary:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - name: Deploy Canary (10%)
        run: |
          kubectl set image deployment/app app=${{ env.REGISTRY }}/${{ github.repository }}:${{ github.event.inputs.version }} -n ${{ github.event.inputs.environment }}
          # Flagger/Argo Rollouts handles progressive rollout
          kubectl argo rollouts set image rollout/app app=${{ env.REGISTRY }}/${{ github.repository }}:${{ github.event.inputs.version }} -n ${{ github.event.inputs.environment }}
      
      - name: Monitor Metrics
        run: |
          # Wait for analysis (Flagger checks success rate, latency, etc.)
          kubectl argo rollouts get rollout app -n ${{ github.event.inputs.environment }} --watch
      
      - name: Promote or Rollback
        run: |
          STATUS=$(kubectl argo rollouts get rollout app -n ${{ github.event.inputs.environment }} -o jsonpath='{.status.phase}')
          if [ "$STATUS" = "Healthy" ]; then
            kubectl argo rollouts promote rollout app -n ${{ github.event.inputs.environment }}
          else
            kubectl argo rollouts abort rollout app -n ${{ github.event.inputs.environment }}
            exit 1
          fi
```

### Feature Flags (LaunchDarkly/Unleash/OpenFeature)
```typescript
// Feature flag integration in deployment
const flags = await launchdarklyClient.variation('new-checkout-flow', userContext, false);

if (flags) {
  // New code path
  return newCheckoutFlow();
}
// Old code path (safe fallback)
return legacyCheckoutFlow();
```

---

## Rollback Strategies

```yaml
# Automated rollback on metric anomaly
- name: Monitor Post-Deploy
  run: |
    for i in {1..10}; do
      ERROR_RATE=$(curl -s "https://prometheus.example.com/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])" | jq '.data.result[0].value[1]')
      if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
        echo "Error rate ${ERROR_RATE}% exceeds 5% threshold - ROLLING BACK"
        gh workflow run rollback.yml -f environment=${{ github.event.inputs.environment }}
        exit 1
      fi
      sleep 30
    done
```

```yaml
# .github/workflows/rollback.yml
name: Rollback
on: workflow_dispatch
jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Rollback Deployment
        run: |
          kubectl rollout undo deployment/app -n ${{ github.event.inputs.environment }}
          kubectl rollout status deployment/app -n ${{ github.event.inputs.environment }} --timeout=5m
      - name: Verify Rollback
        run: |
          curl -f "https://${{ github.event.inputs.environment }}.example.com/health"
      - name: Notify
        run: |
          curl -X POST $SLACK_WEBHOOK -d "{\"text\":\"🔄 Rolled back ${{ github.event.inputs.environment }} to previous version\"}"
```

---

## Supply Chain Security (SLSA Level 3+)

### Provenance Generation
```yaml
# .github/workflows/provenance.yml
name: Generate Provenance
on: [push, workflow_dispatch]
jobs:
  build:
    uses: ./.github/workflows/reusable-build.yml
    secrets: inherit
  
  provenance:
    needs: build
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v1.9.0
    with:
      base64-subjects: "${{ needs.build.outputs.artifacts-base64 }}"
    secrets:
      attestation-key: ${{ secrets.ATTESTATION_KEY }}
```

### Artifact Signing (Cosign Keyless)
```yaml
# .github/workflows/sign.yml
name: Sign Artifacts
on: [push]
jobs:
  sign:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # For OIDC
      contents: read
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: npm run build
      - name: Sign with Cosign (Keyless)
        uses: sigstore/cosign-installer@v3
      - run: |
          cosign sign-blob --yes \
            --blob dist/app.tar.gz \
            --output-signature dist/app.tar.gz.sig \
            --output-certificate dist/app.tar.gz.crt
      - name: Upload Signed Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: signed-artifacts
          path: dist/*.{tar.gz,sig,crt}
```

### Dependency Pinning & Verification
```json
// package.json - Exact versions + integrity
{
  "dependencies": {
    "express": "4.19.2",
    "typescript": "5.4.5"
  },
  "overrides": {
    "minimatch": "9.0.4"  // Force patch for CVE
  }
}

// npm audit + audit-ci
// .github/workflows/deps.yml
- name: Audit Dependencies
  run: |
    npm audit --audit-level=high --json > audit.json
    npx audit-ci --config audit-ci.json
```

```json
// audit-ci.json
{
  "moderate": false,
  "high": true,
  "critical": true,
  "allowlist": [
    "CVE-2024-1234: Accepted risk - mitigated by WAF rule X"
  ]
}
```

---

## Pipeline Templates by Project Type

### Monorepo (Nx/Turborepo)
```yaml
# .github/workflows/monorepo-ci.yml
name: Monorepo CI
on: [pull_request, push]
jobs:
  affected:
    runs-on: ubuntu-latest
    outputs:
      projects: ${{ steps.affected.outputs.projects }}
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: nrwl/nx-set-shas@v4
      - id: affected
        run: |
          PROJECTS=$(npx nx show projects --affected --type=app,lib --plain)
          echo "projects=$PROJECTS" >> $GITHUB_OUTPUT
  
  test:
    needs: affected
    if: needs.affected.outputs.projects != ''
    runs-on: ubuntu-latest
    strategy:
      matrix:
        project: ${{ fromJson(needs.affected.outputs.projects) }}
    steps:
      - uses: actions/checkout@v4
      - run: npx nx test ${{ matrix.project }} --parallel=4
```

### Mobile (React Native/Expo)
```yaml
# .github/workflows/mobile-ci.yml
name: Mobile CI
on: [pull_request, push]
jobs:
  ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
      - run: npm ci
      - run: npx expo install --fix
      - run: npx expo run:ios --configuration Release --device "iPhone 15" --no-bundler
      - run: npx detox test -c ios.release
  
  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: 'temurin', java-version: '17' }
      - uses: expo/expo-github-action@v8
      - run: npm ci
      - run: npx expo run:android --variant release --device "pixel_7"
      - run: npx detox test -c android.release
```

---

## Metrics & Observability

```yaml
# Pipeline metrics collection
- name: Collect Pipeline Metrics
  run: |
    DURATION=$(( $(date +%s) - ${{ github.event.workflow_run.run_started_at }} ))
    curl -X POST "https://metrics.example.com/api/v1/pipeline" \
      -H "Content-Type: application/json" \
      -d "{
        \"pipeline\": \"${{ github.workflow }}\",
        \"repo\": \"${{ github.repository }}\",
        \"branch\": \"${{ github.ref_name }}\",
        \"status\": \"${{ job.status }}\",
        \"duration_seconds\": $DURATION,
        \"trigger\": \"${{ github.event_name }}\"
      }"
```

---

## Output Format (for agent using this skill)
```
## CI/CD Pipeline Changes
- Workflow: [name]
- Type: [CI / CD / Security / Release]
- Jobs: [count] - [parallel/sequential]
- Gates: [list of quality gates]
- Deployment Strategy: [blue-green / canary / rolling / feature-flag]
- Rollback: [automated/manual - time target]
- Supply Chain: [SLSA level, signing, SBOM]
- Metrics: [duration, success rate, MTTR]
```