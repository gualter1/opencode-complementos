# Component Architecture Rules (Vertical Modules)

## Vertical Module Organization

### Organize by Feature/Workflow Owner
Coloque **tudo que pertence a uma feature** junto:
```
src/features/checkout/
├── components/          # UI components
│   ├── CheckoutForm.tsx
│   ├── PaymentMethodSelector.tsx
│   └── OrderSummary.tsx
├── hooks/               # Feature-specific hooks
│   ├── useCheckout.ts
│   └── usePayment.ts
├── api.ts               # API calls (generated client usage)
├── types.ts             # Feature types (may re-export generated)
├── queries.ts           # TanStack Query hooks
├── mutations.ts         # TanStack Query mutations
├── store.ts             # Feature-scoped state (Jotai/Zustand)
├── constants.ts         # Feature constants
├── utils.ts             # Feature utilities
└── __tests__/           # Co-located tests
    ├── CheckoutForm.test.tsx
    └── useCheckout.test.ts
```

### Public Entrypoints Only
```tsx
// src/features/checkout/index.ts — ONLY public API
export { CheckoutForm } from './components/CheckoutForm';
export { useCheckout } from './hooks/useCheckout';
export type { CheckoutData } from './types';

// ❌ BAD - Barrel exporting internal details
export { CheckoutForm } from './components/CheckoutForm';
export { PaymentMethodSelector } from './components/PaymentMethodSelector'; // Internal!
export { usePayment } from './hooks/usePayment'; // Internal!
export { checkoutStore } from './store'; // Internal!
```

### Cross-Feature Imports
```tsx
// ✅ GOOD - Import via public entrypoint
import { useCheckout } from '@/features/checkout';

// ❌ BAD - Deep import (breaks encapsulation)
import { checkoutStore } from '@/features/checkout/store';
import { usePayment } from '@/features/checkout/hooks/usePayment';
```

## Ownership Rules

### Lowest Owner Principle
State, data access, loading, empty, error, handlers vivem no **lowest owner** cujo mounted lifetime matches persistence.

```tsx
// ✅ GOOD - Form draft state lives in form component (unmounts = discarded)
function CheckoutForm() {
  const [draft, setDraft] = useState<CheckoutDraft>(initialDraft);
  // ...
}

// ✅ GOOD - Shared workflow state lives in parent (survives step changes)
function CheckoutWizard() {
  const [workflowState, setWorkflowState] = useAtom(checkoutWorkflowAtom);
  return <Steps>{/* steps read/write workflowState */}</Steps>;
}

// ❌ BAD - Draft state lifted too high (survives unmount, stale data)
function CheckoutWizard() {
  const [draft, setDraft] = useState(initialDraft); // Wrong owner!
  return <CheckoutForm draft={draft} setDraft={setDraft} />;
}
```

### Parent Coordination Only When Necessary
Coordenação no parent **APENAS** para:
- Consistent snapshot (multiple children need same data at same time)
- Survive unmount (data persists across step navigation)
- Submission (single submit handler for multi-step)
- Shared selection (multiple components reflect same selection)
- Batch behavior (multiple components trigger same action)
- Navigation (parent controls routing)
- Cross-section loading/errors (unified loading/error state)

## Wrapper Components (Avoid)

### Anti-Pattern: Empty Wrapper
```tsx
// ❌ BAD - Just renames props, passes children
function CardWrapper({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return <Card className={className}><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>;
}

// ✅ GOOD - Use primitive directly with composition
<Card className="custom-class">
  <CardHeader><CardTitle>My Title</CardTitle></CardHeader>
  <CardContent>{children}</CardContent>
</Card>
```

### When Wrapper IS Justified
- Adds **behavior** (not just styling/renaming)
- Enforces **invariants** (required props, default composition)
- Provides **type-safe variants** (discriminated union props)

```tsx
// ✅ GOOD - Adds behavior + invariants
function DataTable<T>({ 
  data, 
  columns, 
  onRowClick, 
  selection, 
  onSelectionChange 
}: DataTableProps<T>) {
  // Handles sorting, pagination, selection, virtualization
  // Enforces: columns required, keyAccessor required
  // Returns: sorted, paginated, selected data
}
```

## Props Design

### Discriminated Unions for Variants
```tsx
// ✅ GOOD - Type-safe variants
type ButtonProps = 
  | { variant: 'primary'; onClick: () => void; children: React.ReactNode }
  | { variant: 'secondary'; onClick: () => void; children: React.ReactNode }
  | { variant: 'destructive'; onClick: () => void; confirmText: string; children: React.ReactNode };

// Usage - TypeScript narrows based on variant
<Button variant="destructive" confirmText="Delete permanently?" onClick={onDelete}>Delete</Button>
```

### No Optional Boolean Props (Use Variants)
```tsx
// ❌ BAD - Boolean explosion
interface ButtonProps {
  primary?: boolean;
  secondary?: boolean;
  destructive?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

// ✅ GOOD - Single variant prop
type ButtonProps = { variant: 'primary' | 'secondary' | 'destructive' | 'outline' } & 
  ({ loading?: true } | { loading?: false; onClick: () => void }) &
  { disabled?: boolean; children: React.ReactNode };
```

## Module Boundaries Enforcement

### ESLint Rule (Recommended)
```json
// .eslintrc.json
{
  "rules": {
    "import/no-restricted-paths": [
      "error",
      {
        "zones": [
          {
            "target": "./src/features/*/store.ts",
            "from": "./src/features/*/components",
            "message": "Components cannot import feature store directly. Use hooks."
          },
          {
            "target": "./src/features/*/hooks/*",
            "from": "./src/features/*/components",
            "message": "Components should use public entrypoint hooks."
          }
        ]
      }
    ]
  }
}
```

### Public API Checklist
- [ ] `index.ts` exports only what consumers need
- [ ] No internal types leaked (use `type` imports for internals)
- [ ] No internal hooks/components exported
- [ ] No store/atoms exported directly
- [ ] Generated contracts re-exported, not duplicated