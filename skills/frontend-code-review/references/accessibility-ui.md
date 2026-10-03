# Accessibility UI Rules (WCAG 2.1 AA)

## Semantic HTML (P0 for Critical Workflow)

### Required Elements
| Purpose | Required Element | Anti-Pattern |
|---------|------------------|--------------|
| Interactive trigger | `<button>` | `<div onClick>`, `<span onClick>` |
| Navigation | `<nav>` + `<a href>` | `<div role="navigation">` |
| Main content | `<main>` | `<div id="main">` |
| Dialogs/modals | `<dialog>` | `<div role="dialog">` |
| Forms | `<form>` + `<label>` | `<div>` wrapping inputs |
| Grouped controls | `<fieldset>` + `<legend>` | `<div>` with text |

### Interactive Elements
```tsx
// ✅ GOOD - Native button with accessible name
<button aria-label="Close dialog" onClick={onClose}>
  <XIcon aria-hidden="true" />
</button>

// ✅ GOOD - Native link for navigation
<nav>
  <a href="/settings">Settings</a>
</nav>

// ❌ BAD - Div pretending to be button
<div onClick={onClick} className="button-lookalike">Click me</div>

// ❌ BAD - Icon-only button without label
<IconButton onClick={onClose}><XIcon /></IconButton>
```

## Focus Management (P0)

### Focus Visible Ring (Mandatory)
**TODO** elemento interativo **DEVE** ter focus visible:
```css
/* Global - never remove */
*:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* Component-specific override if needed */
.my-button:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
  border-radius: 4px;
}
```

### Focus Order
- Tab order follows visual layout (left-to-right, top-to-bottom)
- No focus traps except in modals/dialogs
- Skip links for main navigation: `<a href="#main" class="skip-link">Skip to main content</a>`

### Focus Restoration
Quando fechar dialog/popover/overlay → **restore focus** ao trigger element:
```tsx
const triggerRef = useRef<HTMLButtonElement>(null);

<Dialog 
  open={isOpen} 
  onClose={() => { setIsOpen(false); triggerRef.current?.focus(); }}
>
  <DialogTrigger ref={triggerRef}>Open</DialogTrigger>
</Dialog>
```

## Accessible Names (P0)

### Icon-Only Controls
**SEMPRE** forneça accessible name:
```tsx
// ✅ GOOD - aria-label
<button aria-label="Delete document" onClick={onDelete}>
  <TrashIcon aria-hidden="true" />
</button>

// ✅ GOOD - Dify UI IconButton (handles this)
<IconButton aria-label="Delete document" onClick={onDelete}>
  <TrashIcon />
</IconButton>

// ❌ BAD - No accessible name
<IconButton onClick={onDelete}><TrashIcon /></IconButton>
```

### Form Labels
```tsx
// ✅ GOOD - Explicit label association
<label htmlFor="email">Email</label>
<input id="email" type="email" autoComplete="email" />

// ✅ GOOD - Wrapped label
<label>
  Email
  <input type="email" autoComplete="email" />
</label>

// ❌ BAD - Placeholder as label
<input placeholder="Email" type="email" />
```

### Error Association
```tsx
// ✅ GOOD - aria-describedby links input to error
<div>
  <label htmlFor="email">Email</label>
  <input 
    id="email" 
    type="email" 
    aria-invalid={!!error}
    aria-describedby={error ? "email-error" : undefined}
  />
  {error && <p id="email-error" role="alert">{error}</p>}
</div>
```

## Overlays (Tooltip vs Popover vs Dialog)

| Overlay Type | Use Case | Accessibility Requirements |
|--------------|----------|---------------------------|
| **Tooltip** | Short visual label only (icon hover) | `role="tooltip"`, no interactive content, hover/focus only |
| **Popover** | Rich content, interactive (menus, pickers) | `role="dialog"` or `menu`, focus trap, ESC to close |
| **Dialog** | Actions, forms, confirmations | `role="dialog"`, `aria-modal="true"`, focus trap, ESC closes, restore focus |

### Overlay Implementation
```tsx
// ✅ GOOD - Tooltip for short label
<Tooltip content="Edit settings"><IconButton aria-label="Settings"><SettingsIcon /></IconButton></Tooltip>

// ✅ GOOD - Popover for rich content
<Popover>
  <PopoverTrigger asChild><IconButton aria-label="User menu"><UserIcon /></IconButton></PopoverTrigger>
  <PopoverContent><UserMenu /></PopoverContent>
</Popover>

// ✅ GOOD - Dialog for actions
<Dialog>
  <DialogTrigger asChild><Button>Delete</Button></DialogTrigger>
  <DialogContent>
    <DialogTitle>Delete document?</DialogTitle>
    <DialogDescription>This cannot be undone.</DialogDescription>
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button variant="destructive" onClick={onConfirm}>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Forms

### Required Attributes
```tsx
<input
  id="email"
  name="email"                    // Stable name for form submission
  type="email"
  autoComplete="email"            // Browser autofill
  required                        // Native validation
  aria-describedby={errorId}      // Links to error message
/>

// AutoComplete values: https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
// Common: "email", "username", "current-password", "new-password", "organization", "street-address", "postal-code"
```

### Validation
- Client-side: Zod schema (shared with backend via generated types)
- Server-side: Same Zod schema
- Error messages: specific, actionable, not just "invalid"

## Motion & Animation

### Respect Prefers-Reduced-Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Avoid Transition-All
```css
/* ❌ BAD - Triggers layout recalc on any property change */
transition: all 0.2s ease;

/* ✅ GOOD - Explicit properties */
transition: opacity 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
```

## Color Contrast (P0)
- Text: 4.5:1 (normal), 3:1 (large text 18pt+ / 14pt+ bold)
- UI components: 3:1 against adjacent colors
- Test with: axe-core, Lighthouse, manual verification

## Testing Checklist
- [ ] Tab through entire page — all interactive elements reachable
- [ ] Screen reader (NVDA/VoiceOver) — labels announced correctly
- [ ] Zoom 200% — no horizontal scrolling, content reflows
- [ ] High contrast mode — all borders/indicators visible
- [ ] Reduced motion — animations disabled