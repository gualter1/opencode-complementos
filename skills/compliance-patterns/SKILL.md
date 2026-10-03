---
description: Compliance Patterns - LGPD, SOC2, ISO27001, evidence collection, audit trails, DPIA. Compliance as code with OPA policies.
mode: subagent
model: 9router/Turing
skills:
  - context-mode
---

{reasoning effort: high}

# Compliance Patterns - LGPD, SOC2, ISO27001 Skill

## Purpose
Defines compliance patterns for LGPD (Brazil), SOC2 Type II, ISO27001. Implements compliance as code with OPA policies, evidence collection, audit trails, and DPIA workflows.

## When to Invoke
- Implementing compliance features (used by `kaspersky`, `security-lead`, `trevor`, `niamaia`, `tranquilao`)
- Audit preparation
- Data protection impact assessments
- Policy-as-code enforcement
- Incident response compliance

---

## LGPD (Lei Geral de Proteção de Dados - Brazil)

### Data Mapping (Required Artifact)

```yaml
# compliance/data-mapping.yaml
version: "1.0"
data_assets:
  - name: "users"
    domain: "identity"
    owner: "platform-team"
    pii_level: "HIGH"
    fields:
      - name: "email"
        pii: true
        purpose: "authentication, communication"
        legal_basis: "contract"
        retention: "7 years after account closure"
        sharing: ["email-provider", "analytics"]
        encryption: "at-rest: AES-256, in-transit: TLS 1.3"
      - name: "full_name"
        pii: true
        purpose: "personalization"
        legal_basis: "contract"
        retention: "7 years after account closure"
      - name: "cpf"
        pii: true
        level: "CRITICAL"
        purpose: "billing, compliance"
        legal_basis: "legal_obligation"
        retention: "10 years (tax law)"
        encryption: "field-level encryption"
    dpia_required: true
    dpia_ref: "DPIA-2024-001"
    
  - name: "orders"
    domain: "ecommerce"
    owner: "commerce-team"
    pii_level: "MEDIUM"
    fields:
      - name: "user_id"
        pii: true
        hashed_in_analytics: true
      - name: "shipping_address"
        pii: true
        purpose: "fulfillment"
        legal_basis: "contract"
        retention: "5 years"
```

### Consent Management

```typescript
// compliance/consent/consent-manager.ts
import { Result, ok, err } from '@/shared/result';

interface ConsentRecord {
  userId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  version: string; // Consent form version
  ipAddress: string;
  userAgent: string;
}

type ConsentPurpose = 
  | 'marketing_email'
  | 'analytics_tracking' 
  | 'personalization'
  | 'third_party_sharing'
  | 'profiling';

class ConsentManager {
  constructor(
    private db: Database,
    private auditLog: AuditLogger
  ) {}

  async grantConsent(
    userId: string,
    purpose: ConsentPurpose,
    version: string,
    context: { ip: string; userAgent: string }
  ): Promise<Result<ConsentRecord, ConsentError>> {
    const existing = await this.db.consents.find({ userId, purpose });
    
    if (existing && existing.granted && !existing.revokedAt) {
      return err(new ConsentAlreadyGrantedError(purpose));
    }

    const record: ConsentRecord = {
      userId,
      purpose,
      granted: true,
      grantedAt: new Date(),
      revokedAt: null,
      version,
      ipAddress: context.ip,
      userAgent: context.userAgent,
    };

    await this.db.consents.upsert(record);
    await this.auditLog.log({
      event: 'consent_granted',
      userId,
      purpose,
      version,
      timestamp: new Date(),
    });

    return ok(record);
  }

  async revokeConsent(userId: string, purpose: ConsentPurpose): Promise<Result<void, ConsentError>> {
    const record = await this.db.consents.find({ userId, purpose });
    if (!record || !record.granted) {
      return err(new ConsentNotGrantedError(purpose));
    }

    record.granted = false;
    record.revokedAt = new Date();
    await this.db.consents.update(record);

    await this.auditLog.log({
      event: 'consent_revoked',
      userId,
      purpose,
      timestamp: new Date(),
    });

    // Trigger downstream: stop processing for this purpose
    await this.enforceConsentRevocation(userId, purpose);

    return ok(undefined);
  }

  async getConsentStatus(userId: string): Promise<Record<ConsentPurpose, boolean>> {
    const records = await this.db.consents.findByUser(userId);
    return Object.fromEntries(
      ['marketing_email', 'analytics_tracking', 'personalization', 'third_party_sharing', 'profiling']
        .map(p => [p, records.find(r => r.purpose === p)?.granted ?? false])
    ) as Record<ConsentPurpose, boolean>;
  }
}
```

### Data Subject Rights API

```typescript
// compliance/rights/data-subject-rights.ts
interface DataSubjectRequest {
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'objection' | 'restriction';
  userId: string;
  requestId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  completedAt?: Date;
  legalBasis?: string; // For rejection
}

class DataSubjectRightsService {
  async handleRequest(request: DataSubjectRequest): Promise<Result<void, RightsError>> {
    switch (request.type) {
      case 'access':
        return this.handleAccessRequest(request);
      case 'rectification':
        return this.handleRectificationRequest(request);
      case 'erasure':
        return this.handleErasureRequest(request);
      case 'portability':
        return this.handlePortabilityRequest(request);
      case 'objection':
        return this.handleObjectionRequest(request);
      case 'restriction':
        return this.handleRestrictionRequest(request);
    }
  }

  private async handleAccessRequest(request: DataSubjectRequest): Promise<Result<void, RightsError>> {
    // Collect ALL data for user across ALL systems
    const userData = await this.collectAllUserData(request.userId);
    
    // Generate structured export (JSON + human-readable)
    const exportPackage = await this.generateDataExport(userData);
    
    // Secure delivery (encrypted download link, expires in 7 days)
    await this.deliverExport(request.userId, exportPackage);
    
    await this.auditLog.log({
      event: 'data_access_completed',
      userId: request.userId,
      requestId: request.requestId,
      dataCategories: Object.keys(userData),
    });
    
    return ok(undefined);
  }

  private async handleErasureRequest(request: DataSubjectRequest): Promise<Result<void, RightsError>> {
    // Check legal basis for retention (tax, legal hold, fraud prevention)
    const retentionConflicts = await this.checkRetentionObligations(request.userId);
    
    if (retentionConflicts.length > 0) {
      // Partial erasure: delete what we can, anonymize what we must keep
      await this.partialErasure(request.userId, retentionConflicts);
      
      await this.auditLog.log({
        event: 'data_erasure_partial',
        userId: request.userId,
        requestId: request.requestId,
        retainedFields: retentionConflicts.map(c => c.field),
        legalBases: retentionConflicts.map(c => c.legalBasis),
      });
      
      return ok(undefined); // Not an error - legal obligation
    }

    // Full erasure
    await this.fullErasure(request.userId);
    
    await this.auditLog.log({
      event: 'data_erasure_complete',
      userId: request.userId,
      requestId: request.requestId,
    });
    
    return ok(undefined);
  }
}
```

### DPIA (Data Protection Impact Assessment)

```markdown
# DPIA-2024-001: User Profiling for Personalized Recommendations

## Screening Questions
- Systematic monitoring? YES (behavioral tracking)
- Large scale? YES (> 100k users)
- Sensitive data? NO (behavioral only, no special category)
- Automated decision making? YES (recommendation algorithm)
**→ DPIA REQUIRED**

## Description
Real-time user behavior tracking (clicks, views, dwell time) fed into ML recommendation engine. 
Profiles updated every 30 min. Used for homepage personalization, email recommendations.

## Data Flow
User Event → Kafka → Stream Processor → Feature Store → ML Model → Recommendation API → Frontend

## Necessity & Proportionality
- Purpose: Increase engagement, conversion
- Alternative: Rule-based recommendations (lower performance)
- Data minimization: Only behavioral events, no PII in features
- Retention: Raw events 30 days, features 90 days, profiles 1 year

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Re-identification from behavioral profile | Medium | High | K-anonymity (k=50), differential privacy (ε=0.5) |
| Function creep (profiling used for other purposes) | Low | High | Purpose binding in code, audit trail |
| Algorithmic bias/discrimination | Medium | Medium | Fairness testing, disparate impact analysis quarterly |
| Data breach exposing behavioral profiles | Low | High | Encryption at rest/in transit, access controls, monitoring |

## Safeguards
- [ ] Pseudonymization: user_id → hash in analytics pipeline
- [ ] Access control: Only ML team accesses feature store
- [ ] Audit logging: All profile reads/writes logged
- [ ] User control: Opt-out via consent manager (profiling consent)
- [ ] Retention enforcement: Automated TTL on all stores
- [ ] Security: Pen test annually, SAST/DAST on pipeline

## Sign-off
- DPO: _______________ Date: _______
- CISO: _______________ Date: _______
- Engineering Lead: _______________ Date: _______
- Review Date: 2025-06-01
```

---

## SOC2 Type II Readiness

### Control Mapping (CC1-CC9)

```yaml
# compliance/soc2/controls.yaml
controls:
  CC1_Control_Environment:
    - code_review_mandatory: 
        evidence: "tranquilao gate on all PRs"
        frequency: "continuous"
    - hiring_background_checks: 
        evidence: "HR records"
        frequency: "per hire"
    - org_structure_documented:
        evidence: "org-chart.md, team-charters"
        frequency: "quarterly review"

  CC6_Logical_Access:
    - least_privilege:
        evidence: "IAM policies, RBAC matrix"
        frequency: "quarterly access review"
    - mfa_enforced:
        evidence: "IdP config, AWS/GCP/Org MFA reports"
        frequency: "continuous"
    - periodic_access_review:
        evidence: "access-review-YYYY-QX.md"
        frequency: "quarterly"
    - offboarding_automation:
        evidence: "HRIS → IdP → IAM deprovisioning workflow"
        frequency: "per termination"

  CC7_System_Operations:
    - incident_response:
        evidence: "incident-runbooks, postmortems"
        frequency: "per incident + quarterly drill"
    - change_management:
        evidence: "PR required for all changes, ADR for architecture"
        frequency: "continuous"
    - monitoring_alerting:
        evidence: "Grafana dashboards, Alertmanager rules, runbook_url on every alert"
        frequency: "continuous"

  CC8_Change_Management:
    - sdlc_security_gates:
        evidence: "SAST, SCA, DAST, secret scan, container scan in CI"
        frequency: "per PR"
    - rollback_capability:
        evidence: "Blue/green, canary, feature flags, <5min rollback"
        frequency: "tested monthly"
    - testing:
        evidence: "Unit/Integration/Contract/E2E in CI, mutation testing"
        frequency: "per PR"

  CC9_Risk_Mitigation:
    - vendor_risk_management:
        evidence: "Vendor assessments, DPAs, SOC2 reports collected"
        frequency: "annual + on change"
    - business_continuity:
        evidence: "DR plan, RTO/RPO documented, tested quarterly"
        frequency: "quarterly test"
    - disaster_recovery:
        evidence: "Cross-region backup, restore tested"
        frequency: "quarterly test"
```

### Evidence Collection (Automated)

```typescript
// compliance/evidence/collector.ts
class EvidenceCollector {
  async collectSOC2Evidence(period: { from: Date; to: Date }): Promise<SOC2EvidencePackage> {
    return {
      period,
      generatedAt: new Date(),
      controls: {
        CC1: await this.collectCC1Evidence(period),
        CC6: await this.collectCC6Evidence(period),
        CC7: await this.collectCC7Evidence(period),
        CC8: await this.collectCC8Evidence(period),
        CC9: await this.collectCC9Evidence(period),
      },
      attestations: await this.collectAttestations(period),
    };
  }

  private async collectCC8Evidence(period: Period): Promise<CC8Evidence> {
    const prs = await this.github.getMergedPRs(period);
    return {
      securityGates: {
        sast: await this.getSASTResults(prs),
        sca: await this.getSCAResults(prs),
        dast: await this.getDASTResults(prs),
        secretScan: await this.getSecretScanResults(prs),
        containerScan: await this.getContainerScanResults(prs),
      },
      rollbackTests: await this.getRollbackTestResults(period),
      testResults: await this.getTestResults(prs),
      deploymentRecords: await this.getDeploymentRecords(period),
    };
  }
}
```

---

## ISO27001 Annex A Controls (Key Ones)

```yaml
# compliance/iso27001/controls.yaml
key_controls:
  A5_Information_Security_Policies:
    - policy_management: "Policies in git, reviewed annually, approved by CISO"
  
  A6_Organization:
    - roles_responsibilities: "RACI matrix for security roles"
    - segregation_of_duties: "Dev ≠ Prod access, Code ≠ Deploy"
  
  A8_Asset_Management:
    - asset_inventory: "CMDB with all assets, owner, classification"
    - media_handling: "Encryption, secure disposal, tracking"
  
  A9_Access_Control:
    - access_policy: "Least privilege, need-to-know, regular review"
    - user_registration: "Identity verification, approval workflow"
    - privileged_access: "JIT access, session recording, break-glass"
    - secret_management: "Vault, rotation, no secrets in code"
  
  A12_Operations_Security:
    - malware_protection: "Endpoint protection, container scanning"
    - backup: "Automated, encrypted, tested restore, offsite"
    - logging_monitoring: "Centralized, tamper-proof, alerting"
    - vulnerability_management: "SAST/SCA/DAST, patch SLAs"
  
  A13_Communications_Security:
    - network_controls: "Segmentation, mTLS, WAF, DDoS protection"
    - info_transfer: "Encryption in transit, API security"
  
  A14_Acquisition_Development:
    - secure_development: "SDLC with security gates, threat modeling"
    - security_testing: "SAST, DAST, SCA, pen test"
    - outsourced_development: "Security requirements in contracts"
  
  A15_Supplier_Relationships:
    - supplier_security: "Assessment, contract clauses, monitoring"
  
  A16_Incident_Management:
    - incident_process: "Detection, response, recovery, lessons learned"
    - evidence_collection: "Forensic readiness, chain of custody"
  
  A17_Continuity:
    - bcp: "Business continuity plan, tested annually"
    - redundancy: "Multi-AZ, multi-region for critical systems"
  
  A18_Compliance:
    - legal_regulatory: "LGPD, SOC2, tax, labor law tracking"
    - independent_review: "Internal audit, external audit"
```

---

## Policy as Code (OPA)

```rego
# policies/lgdpr/consent.rego
package lgpd.consent

default allow = false

allow {
  input.action == "process_personal_data"
  consent := data.consents[input.user_id][input.purpose]
  consent.granted == true
  consent.revoked_at == null
  consent.version == data.current_consent_versions[input.purpose]
}

allow {
  input.action == "process_personal_data"
  input.legal_basis == "legal_obligation"
  input.purpose in data.legal_obligation_purposes
}

deny[msg] {
  input.action == "process_personal_data"
  not allow
  msg := sprintf("No valid consent or legal basis for %s on user %s", [input.purpose, input.user_id])
}

# policies/soc2/access.rego
package soc2.access

default allow = false

allow {
  input.action == "access_production"
  input.user.mfa_verified == true
  input.user.role in ["engineer", "sre", "manager"]
  input.request.justification != ""
  time.now_ns() < input.request.expires_at
}

deny[msg] {
  input.action == "access_production"
  input.user.mfa_verified == false
  msg := "MFA required for production access"
}

deny[msg] {
  input.action == "access_production"
  input.user.role == "intern"
  msg := "Interns cannot access production directly"
}
```

---

## Audit Trail (Immutable)

```typescript
// compliance/audit/audit-logger.ts
interface AuditEvent {
  id: string; // ULID
  timestamp: Date;
  actor: { type: 'user' | 'system' | 'service'; id: string; ip?: string };
  action: string;
  resource: { type: string; id: string; tenantId?: string };
  outcome: 'success' | 'failure' | 'partial';
  metadata: Record<string, any>;
  // Tamper-evident
  hash: string; // SHA256 of previous event + this event
  previousHash: string;
}

class AuditLogger {
  private appendOnlyStore: AppendOnlyStore; // CloudWatch, Loki, or immutable DB
  
  async log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'hash' | 'previousHash'>): Promise<void> {
    const previous = await this.appendOnlyStore.getLastEvent();
    const eventWithHash = {
      ...event,
      id: ulid(),
      timestamp: new Date(),
      previousHash: previous?.hash ?? 'genesis',
    };
    eventWithHash.hash = this.computeHash(eventWithHash);
    
    await this.appendOnlyStore.append(eventWithHash);
    
    // Also stream to SIEM
    await this.siem.forward(eventWithHash);
  }

  async verifyIntegrity(from?: Date, to?: Date): Promise<VerificationResult> {
    const events = await this.appendOnlyStore.query({ from, to });
    let previousHash = 'genesis';
    
    for (const event of events) {
      if (event.previousHash !== previousHash) {
        return { valid: false, brokenAt: event.id, expected: previousHash, actual: event.previousHash };
      }
      const computedHash = this.computeHash(event);
      if (computedHash !== event.hash) {
        return { valid: false, brokenAt: event.id, reason: 'hash_mismatch' };
      }
      previousHash = event.hash;
    }
    
    return { valid: true, eventsVerified: events.length };
  }
}
```

---

## Breach Notification (LGPD 72h)

```typescript
// compliance/breach/notification.ts
class BreachNotificationService {
  async handleBreach(incident: SecurityIncident): Promise<void> {
    // 1. Assess severity (within 24h)
    const assessment = await this.assessBreachSeverity(incident);
    
    if (assessment.requiresANPDNotification) {
      // 2. Notify ANPD within 72h of awareness
      await this.notifyANPD({
        nature: assessment.nature,
        affectedDataSubjects: assessment.affectedCount,
        likelyConsequences: assessment.consequences,
        measuresTaken: assessment.mitigations,
        dpoContact: this.dpoContact,
      });
    }
    
    if (assessment.requiresDataSubjectNotification) {
      // 3. Notify affected data subjects without undue delay
      await this.notifyDataSubjects(incident, assessment);
    }
    
    // 4. Document everything
    await this.auditLog.log({
      event: 'breach_notification_sent',
      incidentId: incident.id,
      anpdNotified: assessment.requiresANPDNotification,
      subjectsNotified: assessment.requiresDataSubjectNotification,
      timestamp: new Date(),
    });
  }
}
```

---

## Output Format (for agent using this skill)
```
## Compliance Implementation
- Regulation: [LGPD/SOC2/ISO27001]
- Controls implemented: [list with evidence references]
- Policies as code: [OPA policies created/updated]
- Data mapping: [updated assets]
- DPIA: [reference if applicable]
- Consent/Rights: [API endpoints, status]
- Audit trail: [integrity verified: yes/no]
- Evidence package: [path/location]
- Gaps: [remaining compliance gaps]
```