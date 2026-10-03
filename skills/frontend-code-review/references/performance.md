# Performance Rules (Frontend)

## Core Web Vitals Targets

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | 2.5s - 4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | ≤ 200ms | 200ms - 500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | 0.1 - 0.25 | > 0.25 |

## Async Waterfalls (P1)

### Parallelize Independent Work
```tsx
// ✅ GOOD - Promise.all for independent queries
const [workspaces, user, settings] = await Promise.all([
  queryClient.fetchQuery(workspaceListQueryOptions()),
  queryClient.fetchQuery(userQueryOptions()),
  queryClient.fetchQuery(settingsQueryOptions()),
]);

// ❌ BAD - Sequential awaits
const workspaces = await queryClient.fetchQuery(workspaceListQueryOptions());
const user = await queryClient.fetchQuery(userQueryOptions());
const settings = await queryClient.fetchQuery(settingsQueryOptions());
```

### Branch-Local Awaits for Conditional Data
```tsx
// ✅ GOOD - Only await what's needed
function Dashboard({ showAnalytics }: { showAnalytics: boolean }) {
  const workspaces = useQuery(workspaceListQueryOptions());
  const analytics = useQuery(
    analyticsQueryOptions(), 
    { enabled: showAnalytics }  // Branch-local
  );
  
  return (
    <WorkspaceList workspaces={workspaces.data} />
    {showAnalytics && <AnalyticsChart data={analytics.data} />}
  );
}
```

## Bundle Size

### Direct Imports
```tsx
// ✅ GOOD - Direct import (tree-shakeable)
import { Button } from '@langgenius/dify-ui/button';
import { debounce } from 'lodash-es/debounce';

// ❌ BAD - Barrel import (pulls entire library)
import { Button } from '@langgenius/dify-ui';
import { debounce } from 'lodash';
```

### Dynamic Import for Heavy Components
```tsx
// ✅ GOOD - Lazy load behind dialog/tab/command
const HeavyChart = dynamic(() import('@/features/analytics/HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

function AnalyticsTab() {
  return <TabsContent><HeavyChart /></TabsContent>; // Only loads when tab active
}
```

## Re-Rendering Optimization

### Move State Down Before Memo
```tsx
// ✅ GOOD - State in smallest consumer
function Parent() {
  return (
    <>
      <StaticHeader />
      <ExpensiveChild /> {/* Only this re-renders when count changes */}
    </>
  );
}

function ExpensiveChild() {
  const [count, setCount] = useState(0); // Local state
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// ❌ BAD - State lifted, memo attempted
function Parent() {
  const [count, setCount] = useState(0);
  return (
    <>
      <StaticHeader />
      <ExpensiveChild count={count} /> {/* Re-renders even with memo! */}
    </>
  );
}

const ExpensiveChild = memo(function ExpensiveChild({ count }: { count: number }) {
  return <button>{count}</button>;
});
```

### Avoid Premature Memoization
```tsx
// ❌ BAD - memo/useMemo/useCallback without demonstrated consumer
const MemoizedComponent = memo(function Component({ data }: { data: Data }) {
  const computed = useMemo(() => expensive(data), [data]); // Unnecessary!
  const handler = useCallback(() => doSomething(), []); // Unnecessary!
  return <div>{computed}</div>;
});

// ✅ GOOD - Only when profiler shows actual benefit
// 1. Profile first
// 2. Identify actual bottleneck
// 3. Apply minimal memoization
```

## Lists & Virtualization

### Large Lists → Virtualization
```tsx
// ✅ GOOD - FlashList for 100+ items
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={({ item }) => <ListItem item={item} />}
  estimatedItemSize={120}
  keyExtractor={item => item.id}
  onEndReached={loadMore}
  maintainVisibleContentPosition
  removeClippedSubviews
/>

// ✅ GOOD - content-visibility for simpler cases
<ul style={{ contain: 'content' }}>
  {items.map(item => <li key={item.id} style={{ contentVisibility: 'auto' }}>{item.name}</li>)}
</ul>
```

## DOM Access Patterns

### Avoid Layout Reads in Render
```tsx
// ❌ BAD - Layout read during render
function Component() {
  const ref = useRef<HTMLDivElement>(null);
  const width = ref.current?.getBoundingClientRect().width; // Layout thrash!
  return <div ref={ref}>{width}</div>;
}

// ✅ GOOD - Read in useEffect/useLayoutEffect
function Component() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  
  useLayoutEffect(() => {
    if (ref.current) setWidth(ref.current.getBoundingClientRect().width);
  }, []);
  
  return <div ref={ref}>{width}</div>;
}
```

### Avoid Interleaved Reads/Writes
```tsx
// ❌ BAD - Read, write, read, write
element.style.width = '100px';
const h1 = element.offsetHeight; // Forces layout
element.style.height = '200px';
const w2 = element.offsetWidth;  // Forces layout again

// ✅ GOOD - Batch reads, then batch writes
const h1 = element.offsetHeight;
const w1 = element.offsetWidth;
element.style.width = '100px';
element.style.height = '200px';
```

## Images

### Next.js Image / Picture Element
```tsx
// ✅ GOOD - Next.js Image (auto-optimizes)
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority // For LCP images
  sizes="(max-width: 768px) 100vw, 50vw"
/>

// ✅ GOOD - Picture for art direction
<picture>
  <source media="(max-width: 768px)" srcSet="/hero-mobile.webp" type="image/webp" />
  <source srcSet="/hero-desktop.webp" type="image/webp" />
  <img src="/hero-desktop.jpg" alt="Hero" width="1200" height="600" loading="lazy" />
</picture>
```

## Fonts

### Preload / Font Display
```tsx
// ✅ GOOD - next/font with display: swap
import { Inter } from 'next/font/google';

const inter = Inter({ 
  subsets: ['latin'], 
  display: 'swap',  // Text visible during font load
  variable: '--font-inter'
});

// In layout
<html className={inter.variable}>...</html>
```

## Anti-Patterns

| Pattern | Impact | Fix |
|---------|--------|-----|
| Sequential awaits for independent data | Waterfall, slower TTI | `Promise.all` |
| Barrel imports | Bundle bloat | Direct subpath imports |
| State lifted too high | Unnecessary re-renders | Move state down |
| `transition-all` | Layout thrash, Jank | Explicit transition properties |
| Large lists without virtualization | Memory, render cost | FlashList / content-visibility |
| `getBoundingClientRect` in render | Forced synchronous layout | Move to useLayoutEffect |
| Unoptimized images | LCP degradation | next/image, WebP/AVIF, priority |
| Missing font-display: swap | FOIT (Flash of Invisible Text) | `display: 'swap'` |