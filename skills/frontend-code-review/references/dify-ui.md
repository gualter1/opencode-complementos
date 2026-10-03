# Dify UI Integration Rules

## Subpath Imports Only (Mandatory)

```tsx
// ✅ GOOD - Subpath imports
import { Button } from '@langgenius/dify-ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@langgenius/dify-ui/dialog';
import { Input } from '@langgenius/dify-ui/input';
import { cn } from '@langgenius/dify-ui/utils';

// ❌ BAD - Barrel imports (tree-shaking breaks, bundle bloat)
import { Button, Dialog, Input } from '@langgenius/dify-ui';
import { cn } from '@langgenius/dify-ui';
```

## Semantic Tokens (No Hardcoded Values)

### Colors
```tsx
// ✅ GOOD - Semantic tokens
<div className="bg-background-primary text-text-primary border-border-primary" />

// ❌ BAD - Hardcoded colors
<div className="bg-white text-gray-900 border-gray-200" />
<div style={{ backgroundColor: '#ffffff', color: '#1a1a1a' }} />
```

### Spacing / Sizing
```tsx
// ✅ GOOD - Token-based spacing
<Stack gap="space-3" p="space-4" />

// ❌ BAD - Magic numbers
<div style={{ gap: '12px', padding: '16px' }} />
<Stack gap={12} p={16} />
```

### Typography
```tsx
// ✅ GOOD - Semantic typography
<Text as="h1" variant="heading-xl">Title</Text>
<Text variant="body-md">Description</Text>

// ❌ BAD - Hardcoded font sizes
<h1 style={{ fontSize: '24px', fontWeight: 600 }}>Title</h1>
```

## `cn()` Utility for Conditional Classes

### Pattern
```tsx
import { cn } from '@langgenius/dify-ui/utils';

// ✅ GOOD - cn() merges Tailwind classes, incoming className last
<Button className={cn(variant === 'primary' && 'bg-primary', isLoading && 'opacity-50', className)}>

// ❌ BAD - Manual class concatenation
<Button className={`${variant === 'primary' ? 'bg-primary' : ''} ${isLoading ? 'opacity-50' : ''} ${className || ''}`}>
```

## Overlay Primitives

### Follow `packages/dify-ui/docs/overlays.md`
| Primitive | Use Case | Portal | Layer |
|-----------|----------|--------|-------|
| `Tooltip` | Short label on hover/focus | Yes | tooltip |
| `Popover` | Rich content, interactive | Yes | popover |
| `Dialog` | Modal actions/forms | Yes | dialog |
| `DropdownMenu` | Action menus | Yes | popover |
| `HoverCard` | Preview on hover | Yes | popover |

### Overlay Implementation
```tsx
// ✅ GOOD - Dialog for confirmations
<Dialog>
  <DialogTrigger asChild><Button variant="outline">Delete</Button></DialogTrigger>
  <DialogContent>
    <DialogTitle>Delete workspace?</DialogTitle>
    <DialogDescription>This action cannot be undone.</DialogDescription>
    <DialogFooter>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button variant="destructive" onClick={onConfirm}>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// ✅ GOOD - Popover for complex menus
<Popover>
  <PopoverTrigger asChild><Button variant="outline">Options</Button></PopoverTrigger>
  <PopoverContent side="bottom" align="end" className="w-56">
    <DropdownMenu>
      <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
      <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-destructive" onClick={onDelete}>Delete</DropdownMenuItem>
    </DropdownMenu>
  </PopoverContent>
</Popover>
```

## Forms (Follow `packages/dify-ui/docs/forms.md`)

### Field Semantics
```tsx
// ✅ GOOD - Controlled with Dify UI primitives
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input placeholder="you@example.com" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Validation
- Client: Zod schema (shared with backend via generated types)
- Server: Same Zod schema
- Display: `FormMessage` from react-hook-form

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| Barrel imports from `@langgenius/dify-ui` | Bundle bloat, no tree-shaking | Subpath imports only |
| Hardcoded colors/spacing/typography | Theme breaks, inconsistent | Use semantic tokens |
| Manual `className` concatenation | Tailwind merge conflicts, order issues | Use `cn()` utility |
| Custom overlay implementations | Accessibility bugs, z-index wars | Use Dify UI overlay primitives |
| Bypassing FormField/FormItem | Missing validation display, a11y gaps | Use Form primitives |