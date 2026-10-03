---
description: SAST/DAST Patterns - Static Application Security Testing (Semgrep, CodeQL), Dynamic Application Security Testing (OWASP ZAP, Nuclei), secrets scanning, CI integration. Security automation.
mode: subagent
model: 9router/Turing
skills:
  - context-mode
---

{reasoning effort: high}

# SAST/DAST Patterns - Security Testing Automation Skill

## Purpose
Defines patterns for Static Application Security Testing (SAST), Dynamic Application Security Testing (DAST), secrets scanning, and CI/CD integration. Used by `kaspersky`, `security-lead`, `tranquilao`, `trevor`.

## When to Invoke
- Setting up security scanning in new projects
- Configuring SAST/DAST rules and custom rules
- CI/CD pipeline security gates
- Security audit preparation
- Incident response (vulnerability scanning)

---

## SAST Tools & Configuration

### Semgrep (Primary - Fast, Customizable)

```yaml
# .semgrep.yml
rules:
  # OWASP Top 10 built-in
  - id: owasp-top-10
    config: p/owasp-top-ten
    
  # Language-specific security
  - id: typescript-security
    config: p/typescript
  - id: python-security  
    config: p/python
  - id: go-security
    config: p/go
    
  # Secrets detection
  - id: secrets
    config: p/secrets
    
  # Custom rules (project-specific)
  - id: no-sql-concat
    pattern-either:
      - pattern: $X.query($SQL + $Y)
      - pattern: $X.execute($SQL + $Y)
    message: "SQL concatenation detected - use parameterized queries"
    languages: [typescript, javascript, python]
    severity: ERROR
    
  - id: no-dangerous-html
    pattern-either:
      - pattern: dangerouslySetInnerHTML={{ __html: $X }}
      - pattern: innerHTML = $X
    message: "Direct HTML injection - use sanitization"
    languages: [typescript, javascript, tsx, jsx]
    severity: ERROR
    
  - id: no-eval
    pattern-either:
      - pattern: eval($X)
      - pattern: new Function($X)
      - pattern: setTimeout($X, ...) 
      - pattern: setInterval($X, ...)
    message: "Code injection via eval/Function/setTimeout - avoid dynamic code execution"
    languages: [typescript, javascript]
    severity: ERROR

  - id: tenant-scoping-required
    pattern: |
      SELECT ... FROM $TABLE WHERE ...
    pattern-not: |
      SELECT ... FROM $TABLE WHERE ... tenant_id = ...
    message: "Query on shared table missing tenant_id filter - multi-tenant violation"
    languages: [sql]
    severity: ERROR
```

```bash
# CI Integration
semgrep scan --config=.semgrep.yml --json=semgrep-results.json --fail=on-error
```

### CodeQL (Deep Analysis)

```yaml
# codeql-config.yml
name: "CodeQL Analysis"
queries:
  - uses: security-extended
  - uses: security-and-quality
paths-ignore:
  - node_modules
  - dist
  - build
  - '**/*.test.ts'
  - '**/*.spec.ts'
```

```yaml
# .github/workflows/codeql.yml
name: CodeQL
on: [push, pull_request, schedule: cron='0 0 * * 0']
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions: { security-events: write, actions: read, contents: read }
    strategy:
      matrix:
        language: [typescript, python, go]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          config-file: ./.github/codeql-config.yml
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
        with:
          category: /language:${{ matrix.language }}
```

---

## DAST Tools & Configuration

### OWASP ZAP (Baseline + Custom Rules)

```yaml
# zap-baseline.yaml
rules:
  # Enable all baseline rules
  - id: 10000 # SQL Injection
  - id: 10001 # XSS Reflected
  - id: 10002 # XSS Stored
  - id: 10003 # Path Traversal
  - id: 10004 # Command Injection
  - id: 10005 # LDAP Injection
  - id: 10006 # XPath Injection
  - id: 10007 # SSRF
  - id: 10008 # XXE
  - id: 10009 # Deserialization
  - id: 10010 # Auth Bypass
  - id: 10011 # AuthZ Bypass
  - id: 10012 # CSRF
  - id: 10013 # Clickjacking
  - id: 10014 # Info Disclosure
  - id: 10015 # Security Headers
  
# Custom rules for app-specific logic
custom_rules:
  - name: "Tenant Isolation Check"
    regex: "tenant_id.*=.*[^0-9a-f-]"
    message: "Potential tenant isolation bypass"
  - name: "Admin Endpoint Exposure"
    regex: "/admin/.*"
    message: "Admin endpoint accessible - verify authZ"
```

```bash
# CI: Baseline scan (fast, no spider)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://staging.example.com \
  -r zap-report.html \
  -c zap-baseline.yaml \
  -J zap-report.json

# Full scan (slow, with spider) - nightly only
docker run -t owasp/zap2docker-stable zap-full-scan.py \
  -t https://staging.example.com \
  -r zap-full-report.html
```

### Nuclei (Template-Based, Fast)

```yaml
# nuclei-templates/custom/
# custom-tenant-bypass.yaml
id: custom-tenant-bypass
info:
  name: Tenant Isolation Bypass
  author: security-team
  severity: high
  tags: [tenant, isolation, multi-tenant]
requests:
  - method: GET
    path:
      - "{{BaseURL}}/api/users?tenant_id=other-tenant"
    headers:
      Authorization: "Bearer {{token}}"
    matchers:
      - type: status
        status: [200]
      - type: word
        words: ["other-tenant-data"]
```

```bash
# CI: Run nuclei against staging
nuclei -u https://staging.example.com -t nuclei-templates/ -severity critical,high,medium -json -o nuclei-results.json
```

---

## Secrets Scanning

### TruffleHog (Git History + PR)

```yaml
# .trufflehog.yaml
exclude_paths:
  - "*.md"
  - "*.txt"
  - "test/**"
  - "tests/**"
  - "**/*.test.ts"
  - "**/*.spec.ts"
  
detector_options:
  # Custom detectors for internal secrets
  custom:
    - name: "internal-api-key"
      regex: "sk_internal_[a-zA-Z0-9]{32}"
    - name: "database-url"
      regex: "postgres://[^:]+:[^@]+@[^/]+/"
```

```bash
# Pre-commit hook (via Husky)
trufflehog git file://. --since-commit HEAD~1 --fail

# CI: Scan PR changes
trufflehog github --repo=org/repo --pr=$PR_NUMBER --fail
```

### GitLeaks (Alternative)

```toml
# .gitleaks.toml
[allowlist]
description = "Test files"
paths = ["**/*_test.go", "**/*.test.ts", "**/*.spec.ts"]

[[rules]]
description = "Generic API Key"
regex = '''(?i)(api[_-]?key|apikey)['"\s]*[:=]['"\s]*[a-zA-Z0-9_-]{20,}'''
tags = ["key", "api"]
```

---

## Container Security

### Trivy (FS + Image + Config)

```bash
# Filesystem scan (CI)
trivy fs --severity HIGH,CRITICAL --format json --output trivy-fs.json .

# Image scan (pre-deploy)
trivy image --severity HIGH,CRITICAL --format json --output trivy-image.json myapp:latest

# Config scan (IaC)
trivy config --severity HIGH,CRITICAL --format json --output trivy-iac.json ./terraform/
```

### Cosign (Signing & Verification)

```bash
# Keyless signing (OIDC)
cosign sign --yes myapp:latest

# Verification in deploy pipeline
cosign verify --certificate-identity-regexp ".*" --certificate-oidc-issuer-regexp ".*" myapp:latest
```

### Syft + Grype (SBOM + Vuln Scan)

```bash
# Generate SBOM
syft myapp:latest -o spdx-json=sbom.spdx.json

# Scan SBOM for vulnerabilities
grype sbom:sbom.spdx.json -o json > grype-results.json
```

---

## CI/CD Integration (Complete Pipeline)

```yaml
# .github/workflows/security.yml
name: Security Scanning
on: [pull_request, push, schedule: cron='0 2 * * *']
jobs:
  sast:
    name: SAST (Semgrep + CodeQL)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: .semgrep.yml
          failOnError: true
      - name: CodeQL
        uses: github/codeql-action/analyze@v3
        with:
          languages: typescript,python,go
  
  secrets:
    name: Secrets Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: TruffleHog
        uses: trufflesecurity/trufflehog-action@v1
        with:
          fail: true
  
  container:
    name: Container Security
    runs-on: ubuntu-latest
    needs: [sast, secrets]
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t myapp:${{ github.sha }} .
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          severity: HIGH,CRITICAL
          exit-code: 1
      - name: Generate SBOM
        run: syft myapp:${{ github.sha }} -o spdx-json=sbom.spdx.json
      - name: Upload SBOM
        uses: actions/upload-artifact@v4
        with: { name: sbom, path: sbom.spdx.json }
  
  dast:
    name: DAST (OWASP ZAP Baseline)
    runs-on: ubuntu-latest
    needs: container
    if: github.event_name == 'pull_request'  # Only PR for baseline
    steps:
      - name: Deploy to staging
        run: ./deploy-staging.sh ${{ github.sha }}
      - name: ZAP Baseline Scan
        run: |
          docker run -t owasp/zap2docker-stable zap-baseline.py \
            -t https://staging.example.com \
            -r zap-report.html -J zap-report.json \
            -c zap-baseline.yaml
      - name: Upload ZAP Report
        uses: actions/upload-artifact@v4
        with: { name: zap-report, path: zap-report.* }
  
  nuclei:
    name: Nuclei Scan
    runs-on: ubuntu-latest
    needs: container
    steps:
      - name: Run Nuclei
        run: |
          nuclei -u https://staging.example.com -t nuclei-templates/ \
            -severity critical,high,medium -json -o nuclei-results.json
      - name: Check Results
        run: |
          if [ -s nuclei-results.json ]; then
            echo "::error::Nuclei found vulnerabilities"
            cat nuclei-results.json
            exit 1
          fi
  
  gate:
    name: Security Gate
    runs-on: ubuntu-latest
    needs: [sast, secrets, container, dast, nuclei]
    if: always()
    steps:
      - name: Check all passed
        run: |
          if [[ "${{ needs.sast.result }}" != "success" ]] ||
             [[ "${{ needs.secrets.result }}" != "success" ]] ||
             [[ "${{ needs.container.result }}" != "success" ]] ||
             [[ "${{ needs.dast.result }}" != "success" ]] ||
             [[ "${{ needs.nuclei.result }}" != "success" ]]; then
            echo "Security gate FAILED"
            exit 1
          fi
          echo "Security gate PASSED"
```

---

## Custom Rule Development

### Semgrep Rule Template

```yaml
# rules/custom/no-hardcoded-jwt-secret.yaml
rules:
  - id: no-hardcoded-jwt-secret
    patterns:
      - pattern-either:
          - pattern: jwt.sign($PAYLOAD, $SECRET, ...)
          - pattern: jwt.verify($TOKEN, $SECRET, ...)
      - metavariable-regex:
          metavariable: $SECRET
          regex: ^["'][^"']{16,}["']$
    message: "Hardcoded JWT secret detected - use environment variable"
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      cwe: "CWE-798: Use of Hard-coded Credentials"
      owasp: "A07:2021 - Identification and Authentication Failures"
      references:
        - https://owasp.org/www-project-top-ten/2021/A07_2021-Identification_and_Authentication_Failures
```

### Testing Custom Rules

```bash
# Test rule against test cases
semgrep test --config=rules/custom/no-hardcoded-jwt-secret.yaml
```

---

## Metrics & Reporting

```typescript
// Security metrics dashboard data
interface SecurityMetrics {
  sast: {
    totalFindings: number;
    bySeverity: { critical: number; high: number; medium: number; low: number };
    byCategory: Record<string, number>;
    falsePositiveRate: number;
    timeToFix: { p50: number; p90: number }; // days
  };
  dast: {
    scansRun: number;
    findingsByType: Record<string, number>;
    coverage: number; // % of endpoints scanned
  };
  secrets: {
    leaksDetected: number;
    rotatedInTime: number;
    meanTimeToRotate: number; // hours
  };
  container: {
    criticalVulns: number;
    highVulns: number;
    baseImageAge: number; // days
    sbomGenerated: boolean;
  };
  compliance: {
    sastCoverage: number; // % of codebase scanned
    dastCoverage: number; // % of endpoints
    secretScanCoverage: number; // % of repos
  };
}
```

---

## Output Format (for agent using this skill)
```
## Security Scan Results
- SAST: [Semgrep findings by severity, CodeQL findings]
- Secrets: [leaks detected, rotated]
- Container: [Trivy results, SBOM generated]
- DAST: [ZAP baseline, Nuclei findings]
- Custom Rules: [triggered/not triggered]
- Gate Status: [PASS/FAIL]
- Remediation: [top 3 priority fixes with file:line]
```