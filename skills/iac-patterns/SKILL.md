---
description: IaC Patterns - Terraform, Terragrunt, modules, state, policy (OPA), drift detection. Infrastructure as Code best practices.
mode: subagent
model: 9router/Towards
skills:
  - context-mode
---

{reasoning effort: high}

# IaC Patterns - Infrastructure as Code Skill

## Purpose
Defines Infrastructure as Code patterns using Terraform/Terragrunt, module design, state management, policy-as-code with OPA, and drift detection. Used by `trevor`, `niamaia`, `performance-engineer`, `security-lead`.

## When to Invoke
- Setting up new infrastructure
- Creating reusable modules
- Implementing policy-as-code
- Drift detection and remediation
- Infrastructure code review

---

## Toolchain

| Tool | Purpose | Version Strategy |
|------|---------|------------------|
| **Terraform** | Cloud resource provisioning | Pin provider versions, upgrade quarterly |
| **Terragrunt** | DRY wrapper, remote state, dependencies | Pin to Terraform version |
| **OpenTofu** | Terraform fork (if needed) | Track Terraform compatibility |
| **Helm/Kustomize** | Kubernetes manifests | Helm for apps, Kustomize for overlays |
| **Crossplane** | Managed control planes | For cloud-native resources |
| **OPA/Gatekeeper** | Policy as code | Rego policies in git |
| **Checkov/Terraform Validator** | Static analysis | CI gate |
| **Terratest** | Integration testing | Go tests in CI |
| **Infracost** | Cost estimation | PR comment |

---

## Repository Structure

```
infra/
├── environments/
│   ├── dev/
│   │   ├── terragrunt.hcl
│   │   ├── vpc/terragrunt.hcl
│   │   ├── eks/terragrunt.hcl
│   │   ├── rds/terragrunt.hcl
│   │   └── monitoring/terragrunt.hcl
│   ├── staging/
│   └── prod/
├── modules/
│   ├── terraform/
│   │   ├── vpc/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   ├── versions.tf
│   │   │   ├── README.md
│   │   │   └── test/ (terratest)
│   │   ├── eks/
│   │   ├── rds/
│   │   ├── s3/
│   │   ├── iam/
│   │   ├── monitoring/
│   │   └── security/
│   └── helm/
│       ├── app-chart/
│       └── monitoring-stack/
├── policies/
│   ├── opa/
│   │   ├── required_tags.rego
│   │   ├── no_public_s3.rego
│   │   ├── encrypt_ebs.rego
│   │   └── egress_rules.rego
│   └── checkov/
│       └── custom_policies.yaml
├── live/ (deprecated - use environments/)
└── scripts/
    ├── deploy.sh
    ├── drift-detect.sh
    └── cost-estimate.sh
```

---

## Root Terragrunt Configuration

```hcl
# infra/terragrunt.hcl (root)
locals {
  account_id     = "123456789012"
  region         = "us-east-1"
  environment    = get_env("TF_ENV", "dev")
  terraform_version = "1.9.0"
}

remote_state {
  backend = "s3"
  config = {
    bucket         = "company-terraform-state-${local.account_id}"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.region
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = ">= ${local.terraform_version}"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region  = "${local.region}"
  default_tags {
    tags = {
      Environment = "${local.environment}"
      ManagedBy   = "terragrunt"
      Repository  = "github.com/company/infra"
    }
  }
}
EOF
}

# Feature flags for optional modules
feature "monitoring" {
  enabled = local.environment != "dev"  # Skip in dev to save costs
}

feature "drift_detection" {
  enabled = true
}
```

---

## Environment Configuration

```hcl
# infra/environments/prod/terragrunt.hcl
include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

inputs = {
  environment = "prod"
  
  vpc = {
    cidr_block = "10.0.0.0/16"
    enable_dns_hostnames = true
    enable_dns_support = true
    nat_gateway_strategy = "single"  # Cost optimization
  }
  
  eks = {
    version = "1.29"
    instance_types = ["m6i.xlarge", "m6i.2xlarge"]
    min_size = 3
    max_size = 50
    desired_size = 10
    spot_percentage = 70
  }
  
  rds = {
    instance_class = "db.r6g.xlarge"
    allocated_storage = 500
    max_allocated_storage = 2000
    backup_retention = 30
    deletion_protection = true
    performance_insights = true
  }
  
  monitoring = {
    retention_days = 90
    alert_email = "oncall@company.com"
  }
}
```

---

## Module Standards

### Module Structure (Every Module)

```hcl
# modules/terraform/vpc/main.tf
terraform {
  required_version = ">= 1.9.0"
}

variable "cidr_block" {
  description = "CIDR block for VPC"
  type        = string
  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "Must be a valid CIDR block."
  }
}

variable "environment" {
  description = "Environment name for tagging"
  type        = string
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

# Resources
resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge({
    Name        = "${var.environment}-vpc"
    Environment = var.environment
  }, var.tags)
}

# Subnets, NAT, IGW, Route Tables...
resource "aws_subnet" "private" {
  for_each = var.private_subnet_cidrs
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value
  availability_zone = each.key
  
  tags = merge({
    Name        = "${var.environment}-private-${each.key}"
    Type        = "private"
    Environment = var.environment
  }, var.tags)
}

# Outputs (EXPLICIT - no implicit outputs)
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = { for k, v in aws_subnet.private : k => v.id }
}
```

### Module Documentation (README.md - Auto-generated)

```bash
# Generate with terraform-docs
terraform-docs markdown table --output-file README.md ./modules/terraform/vpc
```

---

## Policy as Code (OPA/Rego)

```rego
# policies/opa/required_tags.rego
package terraform.tags

deny[msg] {
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_instance"
  not resource.values.tags.Environment
  msg := sprintf("Resource %s missing required tag: Environment", [resource.address])
}

deny[msg] {
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_db_instance"
  not resource.values.tags.Owner
  msg := sprintf("RDS instance %s missing required tag: Owner", [resource.address])
}

deny[msg] {
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_s3_bucket"
  not resource.values.tags.DataClassification
  msg := sprintf("S3 bucket %s missing required tag: DataClassification", [resource.address])
}

# All resources must have these tags
required_tags := {"Environment", "Owner", "CostCenter", "DataClassification"}

deny[msg] {
  resource := input.planned_values.root_module.resources[_]
  tag := required_tags[_]
  not resource.values.tags[tag]
  msg := sprintf("Resource %s missing required tag: %s", [resource.address, tag])
}
```

```rego
# policies/opa/no_public_s3.rego
package terraform.s3

deny[msg] {
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_s3_bucket"
  resource.values.acl == "public-read"
  msg := sprintf("S3 bucket %s has public-read ACL", [resource.address])
}

deny[msg] {
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_s3_bucket_public_access_block"
  resource.values.block_public_acls == false
  msg := sprintf("S3 bucket %s allows public ACLs", [resource.address])
}

deny[msg] {
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_s3_bucket_policy"
  policy := json.unmarshal(resource.values.policy)
  statement := policy.Statement[_]
  statement.Effect == "Allow"
  statement.Principal == "*"
  msg := sprintf("S3 bucket policy %s allows public access", [resource.address])
}
```

```rego
# policies/opa/encrypt_ebs.rego
package terraform.encryption

deny[msg] {
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_ebs_volume"
  not resource.values.encrypted
  msg := sprintf("EBS volume %s is not encrypted", [resource.address])
}

deny[msg] {
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_db_instance"
  not resource.values.storage_encrypted
  msg := sprintf("RDS instance %s is not encrypted", [resource.address])
}

deny[msg] {
  resource := input.planned_values.root_module.resources[_]
  resource.type == "aws_redshift_cluster"
  not resource.values.encrypted
  msg := sprintf("Redshift cluster %s is not encrypted", [resource.address])
}
```

---

## CI/CD Pipeline for IaC

```yaml
# .github/workflows/iac.yml
name: Infrastructure CI
on: [pull_request, push]

jobs:
  validate:
    name: Validate & Plan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with: { terraform_version: "1.9.0" }
      - uses: actions/setup-go@v5
        with: { go-version: "1.22" }
      
      - name: Terraform fmt
        run: terragrunt run-all fmt --check
      
      - name: Terraform validate
        run: terragrunt run-all validate
      
      - name: Checkov scan
        uses: bridgecrewio/checkov-action@v12
        with:
          directory: .
          framework: terraform
          skip_download: true
      
      - name: OPA Policy Check
        run: |
          # Generate plan JSON for each environment
          for env in dev staging prod; do
            cd environments/$env
            terragrunt run-all plan -out=tfplan.binary
            terragrunt show -json tfplan.binary > tfplan.json
            # Run OPA
            opa eval --data ../../policies/opa --input tfplan.json "data.terraform" --format json > opa-results-$env.json
            # Check for denials
            if jq -e '.result[0].expressions[0].value | length > 0' opa-results-$env.json; then
              echo "OPA policy violations in $env:"
              jq '.result[0].expressions[0].value[]' opa-results-$env.json
              exit 1
            fi
            cd ../..
          done
      
      - name: Infracost Estimate
        uses: infracost/actions/setup@v3
        with:
          api-key: ${{ secrets.INFRACOST_API_KEY }}
      - name: Infracost Breakdown
        run: |
          infracost breakdown --path=environments/prod --format=json --out-file=infracost.json
      - name: Infracost Comment PR
        uses: infracost/comment-on-pr@v3
        with:
          path: infracost.json
          repo-token: ${{ secrets.GITHUB_TOKEN }}

  test:
    name: Terratest Integration
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: "1.22" }
      - name: Run Terratest
        run: |
          cd modules/terraform/vpc/test
          go test -v -timeout 30m ./...
      - name: Run Terratest (EKS)
        run: |
          cd modules/terraform/eks/test
          go test -v -timeout 60m ./...

  drift:
    name: Drift Detection
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - name: Detect Drift
        run: |
          for env in dev staging prod; do
            cd environments/$env
            terragrunt run-all plan -detailed-exitcode || true
            # Exit code 2 = drift detected
            if [ $? -eq 2 ]; then
              echo "::warning::Drift detected in $env"
              # Create issue or alert
            fi
            cd ../..
          done
```

---

## Drift Detection & Remediation

```bash
#!/bin/bash
# scripts/drift-detect.sh

set -euo pipefail

ENVIRONMENTS=("dev" "staging" "prod")
ALERT_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

for env in "${ENVIRONMENTS[@]}"; do
  echo "Checking drift in $env..."
  cd "environments/$env"
  
  # Run plan and capture exit code
  terragrunt run-all plan -detailed-exitcode -out=drift.tfplan 2>&1 | tee plan-output.txt
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 2 ]; then
    echo "DRIFT DETECTED in $env"
    
    # Generate human-readable diff
    terragrunt show drift.tfplan > drift-summary.txt
    
    # Send alert
    if [ -n "$ALERT_WEBHOOK" ]; then
      curl -X POST "$ALERT_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"🚨 *Terraform Drift Detected*\nEnvironment: $env\n\`\`\`$(head -100 drift-summary.txt)\`\`\`\"}"
    fi
    
    # Create GitHub issue
    gh issue create \
      --title "[Drift] $env - $(date +%Y-%m-%d)" \
      --body "$(cat drift-summary.txt)" \
      --label "drift,infrastructure,$env" \
      --repo "company/infra"
  elif [ $EXIT_CODE -eq 0 ]; then
    echo "No drift in $env"
  else
    echo "Error running plan in $env (exit code: $EXIT_CODE)"
  fi
  
  cd ../..
done
```

---

## State Management

```hcl
# State backend configuration (in root terragrunt.hcl)
remote_state {
  backend = "s3"
  config = {
    bucket         = "company-terraform-state-${local.account_id}"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.region
    encrypt        = true
    dynamodb_table = "terraform-locks"
    
    # Server-side encryption with KMS
    kms_key_id = "arn:aws:kms:us-east-1:123456789012:key/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}

# State locking via DynamoDB (automatic with above config)
# Table: terraform-locks with primary key LockID (string)
```

### State Operations (Runbooks)

```markdown
## State Recovery Runbook

### Scenario: State file corrupted
1. `aws s3 cp s3://bucket/path/terraform.tfstate ./backup.tfstate`
2. `terraform init -migrate-state` (if backend changed)
3. `terraform state list` to verify
4. `terraform plan` to confirm

### Scenario: Lock stuck (DynamoDB)
1. `aws dynamodb delete-item --table-name terraform-locks --key '{"LockID": {"S": "path/to/state"}}'`
2. Verify no running Terraform processes
3. Re-run plan

### Scenario: Need to move resource between modules
1. `terraform state mv module.old.resource module.new.resource`
2. Update both modules
3. `terraform plan` to verify
```

---

## Cost Estimation (Infracost)

```yaml
# .infracost.yml
version: 0.1
projects:
  - path: environments/prod
    name: Production
  - path: environments/staging
    name: Staging
```

```bash
# PR Comment Example
# Infracost estimate for Production
# Monthly cost: $2,847.32 (+$156.78 / +5.8%)
# 
# Top changes:
#   aws_rds_cluster.prod  db.r6g.xlarge → db.r6g.2xlarge  +$142.00/mo
#   aws_eks_node_group.prod  desired: 10 → 15  +$89.00/mo
#   aws_ebs_volume.prod  500GB → 1000GB  +$50.00/mo
```

---

## Security Hardening (Kyverno for K8s)

```yaml
# policies/kyverno/require-limits.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-resource-limits
spec:
  validationFailureAction: Enforce
  background: true
  rules:
  - name: require-limits
    match:
      any:
      - resources:
          kinds: ["Pod"]
    validate:
      message: "CPU and memory limits and requests are required"
      pattern:
        spec:
          containers:
          - resources:
              limits:
                cpu: "?*"
                memory: "?*"
              requests:
                cpu: "?*"
                memory: "?*"
```

---

## Output Format (for agent using this skill)
```
## IaC Changes
- Module: [name]
- Environment: [dev/staging/prod]
- Resources: [created/updated/destroyed]
- Plan Output: [summary]
- Policy Check: [PASS/FAIL - details]
- Cost Impact: [monthly $ change]
- Drift Detected: [yes/no]
- Testing: [terratest results]
```