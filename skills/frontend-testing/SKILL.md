---
description: Frontend Testing - Vitest + React Testing Library, component testing, accessibility testing, visual regression, Storybook integration. Policy per package owner.
mode: subagent
model: 9router/Turing
skills:
  - context-mode
---

{reasoning effort: high}

# Frontend Testing - Vitest + RTL + Visual Regression Skill

## Purpose
Defines frontend testing standards: unit/component testing with Vitest + React Testing Library, accessibility testing, visual regression with Storybook/Playwright, and package-specific policies.

## When to Invoke
- Writing frontend tests (used by `turing`, `towards`, `qualy`)
- Reviewing frontend test code (used by `tranquilao`)
- Setting up test infrastructure for web/packages
- Debugging flaky frontend tests

---

## Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Unit/Component** | Vitest + React Testing Library | Behavior-driven component tests |
| **Accessibility** | jest-axe / @testing-library/user-event | a11y unit tests |
| **Visual Regression** | Storybook + Playwright + Percy/Chromatic | Component & page visual diffs |
| **E2E** | Playwright (see e2e-cucumber-playwright skill) | Critical user journeys |

---

## Component Testing (Vitest + RTL)

```typescript
// web/features/auth/components/LoginForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';
import { AuthProvider, useAuth } from '@/features/auth/context';

// Mock dependencies at module level
vi.mock('@/features/auth/api', () => ({
  login: vi.fn(),
}));

import { login } from '@/features/auth/api';

describe('LoginForm', () => {
  const defaultProps = {
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password fields with labels', () => {
    render(<LoginForm {...defaultProps} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  it('shows validation errors for empty submit', async () => {
    render(<LoginForm {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email is required');
    expect(await screen.findByRole('alert')).toHaveTextContent('Password is required');
  });

  it('calls login API on valid submit', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test' };
    vi.mocked(login).mockResolvedValue({ ok: true, value: mockUser });

    render(<LoginForm {...defaultProps} />);
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    }));
    expect(defaultProps.onSuccess).toHaveBeenCalledWith(mockUser);
  });

  it('handles API error gracefully', async () => {
    vi.mocked(login).mockResolvedValue({ 
      ok: false, 
      error: new Error('Invalid credentials') 
    });

    render(<LoginForm {...defaultProps} />);
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(defaultProps.onError).toHaveBeenCalled());
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
  });

  it('disables button during loading', async () => {
    let resolveLogin: (value: any) => void;
    vi.mocked(login).mockImplementation(() => new Promise(r => resolveLogin = r));

    render(<LoginForm {...defaultProps} />);
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Login' })).toHaveTextContent('Loading...');

    resolveLogin!({ ok: true, value: { id: '1', email: 'test@example.com', name: 'Test' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Login' })).not.toBeDisabled());
  });
});
```

### Component Test Rules
- **Test behavior, not implementation**: Use `screen.getByRole`, `getByLabelText`, `getByText`
- **User interactions via `@testing-library/user-event`** (not `fireEvent`)
- **Mock at module boundary** (API, context, hooks) - not internal functions
- **Test error states, loading states, empty states**
- **Accessibility assertions in EVERY test** (implicit via queries)

---

## Accessibility Testing (jest-axe)

```typescript
// web/features/auth/components/LoginForm.a11y.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LoginForm } from './LoginForm';

expect.extend(toHaveNoViolations);

describe('LoginForm accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<LoginForm onSuccess={vi.fn()} onError={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no violations with error state', async () => {
    const { container } = render(<LoginForm onSuccess={vi.fn()} onError={vi.fn()} />);
    // Trigger error
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

---

## Hook Testing

```typescript
// web/features/auth/hooks/useAuth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from './useAuth';
import { AuthProvider } from '../context';
import { login, logout, refreshToken } from '../api';

vi.mock('../api');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns unauthenticated state initially', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logs in user and updates state', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test' };
    vi.mocked(login).mockResolvedValue({ ok: true, value: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('handles token refresh automatically', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test' };
    vi.mocked(refreshToken).mockResolvedValue({ ok: true, value: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    // Simulate token expiry
    act(() => {
      result.current.user = mockUser;
      result.current.isAuthenticated = true;
    });

    // Trigger refresh (implementation detail)
    await act(async () => {
      await result.current.refresh();
    });

    expect(refreshToken).toHaveBeenCalled();
  });
});
```

---

## Visual Regression (Storybook + Playwright)

```typescript
// packages/dify-ui/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  parameters: {
    chromatic: { viewports: [320, 768, 1280] },
    // or Percy: percy: { widths: [320, 768, 1280] }
  },
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] },
    size: { control: 'select', options: ['default', 'sm', 'lg', 'icon'] },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = { args: { children: 'Button', variant: 'default', size: 'default' } };
export const Destructive: Story = { args: { children: 'Delete', variant: 'destructive' } };
export const Loading: Story = { args: { children: 'Loading...', disabled: true } };
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'].map(v => (
        <Button key={v} variant={v}>Button</Button>
      ))}
    </div>
  ),
};
```

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression
on: [pull_request]
jobs:
  visual:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build:storybook
      - uses: chromaui/action@v1
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          buildScriptName: build:storybook
          exitOnceUploaded: true
          autoAcceptChanges: main
      # OR Percy
      # - run: npx percy storybook:start --build-dir storybook-static
```

---

## Package Owner Policies (Dify Example)

### `web/` (Next.js App)
- **Unit**: Vitest + RTL for feature components
- **Hooks**: `@testing-library/react` renderHook
- **Utils**: Pure function tests
- **No Storybook** (app-level)

### `packages/dify-ui/` (Design System)
- **Component**: Storybook stories (required for every component)
- **Visual**: Chromatic/Percy on every PR
- **Unit**: Vitest + RTL for complex logic (not for pure presentational)
- **Accessibility**: jest-axe in story decorators
- **Props validation**: TypeScript strict + Zod schemas for complex props

### `e2e/` (Cucumber + Playwright)
- See `e2e-cucumber-playwright` skill
- Only critical journeys
- Tagged: `@smoke`, `@regression`, `@mobile`

---

## CI Pipeline (Frontend Tests)

```yaml
# .github/workflows/frontend-test.yml
name: Frontend Tests
on: [pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v4
  
  visual:
    needs: unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build:storybook
      - uses: chromaui/action@v1
        with: { projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }} }

  e2e:
    needs: unit
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e:smoke
```

---

## Coverage Thresholds (Enforced in CI)

```json
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
        // Per-file overrides for critical paths
        '100': ['features/auth/**', 'features/payment/**', 'features/security/**'],
      },
      exclude: ['**/*.d.ts', '**/*.test.ts', '**/*.stories.tsx', '**/test/**'],
    },
  },
});
```

---

## Output Format (for agent using this skill)
```
## Frontend Test Implementation
- Component: [name]
- Package: [web | dify-ui | other]
- Unit tests: [count, key scenarios]
- A11y tests: [included: yes/no]
- Visual stories: [created/updated]
- Hook tests: [if applicable]
- Coverage: [line/branch/function %]
- CI: [jobs affected]
```