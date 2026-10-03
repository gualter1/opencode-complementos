---
description: How to Write Component - Component architecture decisions: ownership, state, interactions, runtime, data. Vertical modules, no wrapper components, design system compliance.
mode: subagent
model: 9router/Turing
skills:
  - context-mode
---

{reasoning effort: high}

# How to Write Component - Component Architecture Skill

## Purpose
Guides component architecture decisions for frontend codebases. Enforces vertical module ownership, eliminates wrapper components, ensures design system compliance, and defines clear patterns for state, interactions, runtime, and data.

## When to Invoke
- Creating new components or refactoring existing ones
- Code review of frontend changes (used by `tranquilao`, `turing`, `towards`)
- Design system governance
- Onboarding new frontend developers

---

## Core Principles

### 1. Vertical Module Ownership
```
src/
├── features/
│   ├── auth/
│   │   ├── components/     # Owned by auth feature
│   │   ├── hooks/          # Owned by auth feature
│   │   ├── api.ts          # Owned by auth feature
│   │   └── types.ts        # Owned by auth feature
│   ├── dashboard/
│   └── settings/
├── shared/
│   ├── ui/                 # Design system primitives (Button, Input, Card)
│   ├── hooks/              # Truly shared hooks (useColorScheme, useMediaQuery)
│   └── utils/              # Truly shared utilities
```

**Rule**: A component belongs to ONE feature. If used by multiple features, promote to `shared/ui/` with design system review.

### 2. No Wrapper Components
```tsx
// ❌ BAD - Wrapper that adds no value
export function CardWrapper({ children, ...props }) {
  return <Card {...props}>{children}</Card>;
}

// ✅ GOOD - Compose directly
<Card className="custom-styles">Content</Card>

// ✅ GOOD - Wrapper WITH behavior (context, logic, a11y)
export function FormField({ label, error, children }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {React.cloneElement(children, { id, 'aria-describedby': error ? `${id}-error` : undefined })}
      {error && <p id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}
```

### 3. Props Drilling > Shared State (Default)
```tsx
// ✅ DEFAULT: Pass props explicitly (traceable, testable)
function Parent() {
  return <ChildA user={user} onUpdate={setUser} />;
}

// ⚠️ ONLY for truly cross-cutting concerns: theme, auth, feature flags
// Use Jotai/Recoil atoms scoped to feature, NOT global
const userAtom = atom<User | null>(null); // Feature-scoped, not global
```

### 4. State Classification
| State Type | Where | Tool |
|------------|-------|------|
| **Local sync** | Component | `useState`, `useReducer` |
| **Feature shared** | Feature scope | Jotai atom (feature folder) |
| **Server state** | Global cache | TanStack Query (React Query) |
| **URL/shareable** | Router | `searchParams`, `useRouter` |
| **Global app** | Rare, documented | Jotai/Context with owner |

---

## Component Decision Checklist

Before creating ANY component, answer:

1. **Ownership**: Which feature owns this? (If unclear → `shared/ui/` with ADR)
2. **Composition**: Can this be built by composing `shared/ui` primitives? (If yes → don't create new primitive)
3. **State**: What state does it need? Classify per table above.
4. **Variants**: Does it need variants? Use `cva` (class-variance-authority) + TypeScript discriminated unions.
5. **Accessibility**: Semantic HTML first. ARIA only when HTML insufficient.
6. **Performance**: `React.memo`? `useMemo`? `useCallback`? Virtualization for lists?
7. **Testing**: Unit testable? Storybook story? Visual regression?

---

## Variant Pattern (cva + TypeScript)

```tsx
// shared/ui/button/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
```

---

## Data Fetching Pattern

```tsx
// features/dashboard/components/MetricsCard.tsx
import { useQuery, skipToken } from '@tanstack/react-query';
import { Card } from '@/shared/ui/card';

interface MetricsCardProps {
  tenantId: string;
  dateRange?: DateRange; // Optional - if missing, show skeleton
}

export function MetricsCard({ tenantId, dateRange }: MetricsCardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['metrics', tenantId, dateRange],
    queryFn: dateRange ? () => fetchMetrics(tenantId, dateRange) : skipToken,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Card><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></Card>;
  if (error) return <Card className="border-destructive"><Alert>Failed to load metrics</Alert></Card>;
  if (!data) return <Card><p className="text-muted-foreground">Select a date range</p></Card>;

  return <Card>...</Card>;
}
```

---

## Accessibility Checklist (Every Component)
- [ ] Semantic HTML (`<button>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`)
- [ ] Focus visible: `focus-visible:ring-2 focus-visible:ring-ring`
- [ ] Accessible names: `<label htmlFor>`, `aria-label`, `aria-labelledby`
- [ ] Form associations: `htmlFor`/`id`, `aria-describedby` for errors
- [ ] Keyboard navigation: Tab order, Enter/Space activation, Escape to close
- [ ] Screen reader: `role`, `aria-*` only when HTML insufficient
- [ ] Color contrast: 4.5:1 normal, 3:1 large text (Tailwind `text-muted-foreground` passes)
- [ ] Reduced motion: `@media (prefers-reduced-motion: reduce)`

---

## Overlay Contracts (Tooltip vs Popover vs Dialog)

| Pattern | Use Case | Focus | Dismiss | Example |
|---------|----------|-------|---------|---------|
| **Tooltip** | Label/icon hint | Stays on trigger | Hover/focus out | Icon help text |
| **Popover** | Interactive content | Moves to content | Click outside/Escape | User menu, date picker |
| **Dialog** | Task requiring focus | Traps in dialog | Escape + explicit action | Confirm delete, form modal |

```tsx
// ✅ Correct: Tooltip for non-interactive hint
<Tooltip><TooltipTrigger><InfoIcon /></TooltipTrigger><TooltipContent>Help text</TooltipContent></Tooltip>

// ✅ Correct: Popover for interactive menu
<Popover><PopoverTrigger><UserButton /></PopoverTrigger><PopoverContent><UserMenu /></PopoverContent></Popover>

// ✅ Correct: Dialog for focused task
<Dialog><DialogTrigger><Button>Delete</Button></DialogTrigger><DialogContent><ConfirmDeleteForm /></DialogContent></Dialog>
```

---

## Dify UI Specific Rules (if applicable)
- Subpath imports only: `import { Button } from '@/packages/dify-ui/button'`
- Semantic tokens only: `bg-primary`, `text-muted-foreground` (NO arbitrary values)
- `cn()` utility for class merging
- Overlay contracts enforced (Tooltip/Popover/Dialog distinction)

---

## Output Format (for agent using this skill)
```
## Component Decision
- Component: [name]
- Owner: [feature/shared]
- State strategy: [local/feature/server/url]
- Variants: [cva config or N/A]
- Accessibility: [semantic HTML used, ARIA if any]
- Testing: [Storybook story path, unit test path]
- Performance: [memo/virtualization decisions]
```