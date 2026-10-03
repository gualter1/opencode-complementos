---
description: E2E Cucumber Playwright - Critical user journey testing with Cucumber BDD + Playwright. Tags, fixtures, cleanup, parallel execution, trace viewer.
mode: subagent
model: 9router/Turing
skills:
  - context-mode
---

{reasoning effort: high}

# E2E Cucumber Playwright - Critical Journey Testing Skill

## Purpose
Defines standards for End-to-End testing using Cucumber (Gherkin) + Playwright. Only for **critical user journeys** (10-20 max). Not for CRUD trivialities.

## When to Invoke
- Writing new E2E tests for critical flows (login, checkout, onboarding, core workflow)
- Reviewing E2E test architecture (used by `tranquilao`, `qualy`, `turing`)
- Setting up E2E infrastructure in new projects
- Debugging flaky E2E tests

---

## Architecture

### Project Structure (Dify-style)
```
e2e/
├── AGENTS.md              # Suite ownership, tags, fixtures, cleanup rules
├── cucumber.json          # Cucumber config
├── features/
│   ├── auth/
│   │   ├── login.feature
│   │   └── login.steps.ts
│   ├── checkout/
│   │   ├── purchase.feature
│   │   └── purchase.steps.ts
│   └── onboarding/
│       ├── first-visit.feature
│       └── first-visit.steps.ts
├── fixtures/
│   ├── test-data.ts       # Test data builders
│   ├── auth.ts            # Auth helpers (login, register, tokens)
│   └── cleanup.ts         # Database/API cleanup between scenarios
├── support/
│   ├── world.ts           # Custom World (Playwright page, context, helpers)
│   ├── hooks.ts           # Before/After hooks
│   └── selective-tagging.ts # Tag-based execution logic
├── playwright.config.ts   # Playwright config
└── package.json
```

### AGENTS.md (Ownership Contract)
```markdown
# E2E Suite Ownership

## Tags
- @smoke: Critical path, runs on every PR (~2 min)
- @regression: Full suite, runs on merge/main (~10 min)
- @mobile: Mobile viewport tests
- @api: API-only tests (no browser)
- @skip-ci: Manual only (exploratory, flaky investigation)

## Fixtures
- Each feature owns its test data builders
- Cleanup: `afterEach` hook calls `cleanupTestData()`
- Isolation: Unique test user per scenario (UUID suffix)

## Parallel Execution
- Playwright workers: 4 (CI), 8 (local)
- Scenario-level parallelism via Cucumber `--parallel`
- Sharding: `--shard=1/3` for CI scale
```

---

## Gherkin Best Practices

### Feature File Structure
```gherkin
# features/auth/login.feature
@smoke @auth
Feature: User Login
  As a registered user
  I want to log in with my credentials
  So that I can access my dashboard

  Background:
    Given a registered user exists with email "user@example.com" and password "securePass123"
    And I am on the login page

  @smoke @happy-path
  Scenario: Successful login with valid credentials
    When I enter email "user@example.com"
    And I enter password "securePass123"
    And I click the login button
    Then I should be redirected to the dashboard
    And I should see my user name in the header

  @smoke @error-handling
  Scenario: Failed login with invalid password
    When I enter email "user@example.com"
    And I enter password "wrongPassword"
    And I click the login button
    Then I should see an error message "Invalid credentials"
    And I should remain on the login page

  @regression @security
  Scenario: Account lockout after 5 failed attempts
    Given the login attempt limit is 5
    When I attempt login with wrong password 5 times
    Then my account should be locked
    And I should see "Account temporarily locked" message
```

### Step Definition Patterns
```typescript
// features/auth/login.steps.ts
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

Given('a registered user exists with email {string} and password {string}', async function(this: CustomWorld, email: string, password: string) {
  await this.testData.createUser({ email, password });
  this.testUser = { email, password };
});

Given('I am on the login page', async function(this: CustomWorld) {
  this.loginPage = new LoginPage(this.page);
  await this.loginPage.goto();
});

When('I enter email {string}', async function(this: CustomWorld, email: string) {
  await this.loginPage.fillEmail(email);
});

When('I enter password {string}', async function(this: CustomWorld, password: string) {
  await this.loginPage.fillPassword(password);
});

When('I click the login button', async function(this: CustomWorld) {
  await this.loginPage.submit();
});

Then('I should be redirected to the dashboard', async function(this: CustomWorld) {
  this.dashboardPage = new DashboardPage(this.page);
  await expect(this.page).toHaveURL(/\/dashboard/);
  await this.dashboardPage.waitForLoad();
});

Then('I should see my user name in the header', async function(this: CustomWorld) {
  await expect(this.dashboardPage.userMenu).toContainText(this.testUser.email.split('@')[0]);
});

Then('I should see an error message {string}', async function(this: CustomWorld, message: string) {
  await expect(this.loginPage.errorMessage).toHaveText(message);
});
```

---

## Page Object Model (Required)

```typescript
// pages/login.page.ts
export class LoginPage {
  readonly page: Page;
  readonly emailInput = this.page.getByLabel('Email');
  readonly passwordInput = this.page.getByLabel('Password');
  readonly submitButton = this.page.getByRole('button', { name: 'Login' });
  readonly errorMessage = this.page.getByRole('alert');

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}
```

---

## Custom World & Hooks

```typescript
// support/world.ts
import { Page, BrowserContext, chromium } from '@playwright/test';
import { ITestCaseHookParameter } from '@cucumber/cucumber';
import { TestDataBuilder } from '../fixtures/test-data';
import { CleanupManager } from '../fixtures/cleanup';

export class CustomWorld {
  page!: Page;
  context!: BrowserContext;
  testData!: TestDataBuilder;
  cleanup!: CleanupManager;
  loginPage!: LoginPage;
  dashboardPage!: DashboardPage;
  testUser!: { email: string; password: string };
  
  // Attachments for reports
  attach(data: string | Buffer, mediaType: string): void { /* ... */ }
}

export async function createWorld(): Promise<CustomWorld> {
  const context = await chromium.launchPersistentContext('', { headless: true });
  const page = await context.newPage();
  const world = new CustomWorld();
  world.page = page;
  world.context = context;
  world.testData = new TestDataBuilder(page);
  world.cleanup = new CleanupManager(page);
  return world;
}
```

```typescript
// support/hooks.ts
import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { CustomWorld } from './world';

let browserContext: BrowserContext;

BeforeAll(async () => {
  // Global setup: start test database, seed reference data
});

Before(async function(this: CustomWorld) {
  this.page = await createWorld();
  this.testData = new TestDataBuilder(this.page);
  this.cleanup = new CleanupManager(this.page);
});

After(async function(this: CustomWorld, { result }: ITestCaseHookParameter) {
  // Evidence on failure
  if (result?.status === 'FAILED') {
    const screenshot = await this.page.screenshot({ fullPage: true });
    this.attach(screenshot, 'image/png');
    
    const trace = await this.context.tracing.stopChunk();
    this.attach(trace, 'application/zip');
  }
  
  // Cleanup test data
  await this.cleanup.cleanupTestData(this.testUser?.email);
  await this.context.close();
});

AfterAll(async () => {
  // Global teardown
});
```

---

## Test Data Builders (No Hardcoded Fixtures)

```typescript
// fixtures/test-data.ts
export class TestDataBuilder {
  constructor(private page: Page) {}

  async createUser(overrides: Partial<User> = {}): Promise<User> {
    const user = {
      email: `test-${crypto.randomUUID()}@example.com`,
      password: 'TestPass123!',
      name: 'Test User',
      ...overrides,
    };
    
    // API call to create user (bypasses UI for speed)
    const response = await this.page.request.post('/api/test/users', { data: user });
    expect(response.ok()).toBeTruthy();
    
    return response.json();
  }

  async createOrder(userId: string, overrides: Partial<Order> = {}): Promise<Order> {
    const order = {
      userId,
      items: [{ productId: 'prod-1', quantity: 1, price: 1000 }],
      total: 1000,
      ...overrides,
    };
    const response = await this.page.request.post('/api/test/orders', { data: order });
    return response.json();
  }
}
```

---

## CI Configuration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [pull_request, push]
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      matrix:
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run E2E (sharded)
        run: |
          npx cucumber-js --parallel 4 --shard ${{ matrix.shard }}/3 \
            --tags "@smoke and not @skip-ci" \
            --format @cucumber/pretty-formatter \
            --format json:reports/cucumber-${{ matrix.shard }}.json \
            --format html:reports/cucumber-${{ matrix.shard }}.html
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-report-${{ matrix.shard }}
          path: reports/
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-traces-${{ matrix.shard }}
          path: test-results/
```

---

## Flakiness Protocol (Zero Tolerance)

1. **Auto-quarantine**: `@flaky` tag added after 2 failures in 10 runs
2. **Root cause in 48h**: `qualy` investigates, fixes or deletes
3. **Flaky tests DON'T block merge** but MUST have issue tracking
4. **Delete if unfixed in 2 weeks**: "Test that can't be trusted is worse than no test"

---

## Running Locally

```bash
# All smoke tests
npm run e2e:smoke

# Specific feature
npm run e2e -- --tags "@auth"

# Debug mode (headed, slowmo)
npm run e2e:debug -- --tags "@auth and @happy-path"

# With trace viewer
npm run e2e:trace -- --tags "@checkout"
npx playwright show-trace test-results/trace.zip
```

---

## Output Format (for agent using this skill)
```
## E2E Test Implementation
- Feature: [name]
- Scenarios: [count] (@smoke: X, @regression: Y)
- Tags: [list]
- Page Objects: [created/updated]
- Test Data: [builders used]
- CI: [sharding config, parallel workers]
- Evidence: [trace/screenshot paths on failure]
```