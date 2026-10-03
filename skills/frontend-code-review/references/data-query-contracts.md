# Data & Query Contracts (Generated Types)

## Generated Contracts Are Authoritative

### Rule
**NÃO** hand-write DTO mirrors. **NÃO** widen generated fields/enums. **NÃO** edite generated output.
Use generated options **diretamente**.

```tsx
// ✅ GOOD - Use generated query options directly
import { consoleQuery } from '@/generated/orpc';

function useWorkspaces() {
  return useQuery(consoleQuery.workspace.list.queryOptions());
}

// ✅ GOOD - Use generated mutation options
function useCreateWorkspace() {
  return useMutation(consoleQuery.workspace.create.mutationOptions({
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workspace', 'list'] }); }
  }));
}

// ❌ BAD - Hand-written DTO mirror
interface Workspace { id: string; name: string; } // Don't duplicate!

// ❌ BAD - Widening generated enum
type MyWorkspaceStatus = 'active' | 'archived' | 'pending'; // Generated has only 'active' | 'archived'
```

## SkipToken for Missing Required Input

### Rule
Quando input required está missing → branch **whole input** com `skipToken`. Não coloque dentro de placeholder payload.

```tsx
// ✅ GOOD - skipToken branches entire query
function useWorkspaceDetail(workspaceId: string | undefined) {
  return useQuery(
    consoleQuery.workspace.get.queryOptions({
      workspaceId: workspaceId ?? skipToken
    })
  );
}

// ❌ BAD - Placeholder payload
function useWorkspaceDetail(workspaceId: string | undefined) {
  return useQuery(
    consoleQuery.workspace.get.queryOptions({
      workspaceId: workspaceId || 'placeholder'  // Wrong! Executes with bad data
    })
  );
}
```

## Mutations

### Use Generated MutationOptions
```tsx
// ✅ GOOD
const mutation = useMutation(consoleQuery.workspace.update.mutationOptions({
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: ['workspace', 'list'] });
    const previous = queryClient.getQueryData(['workspace', 'list']);
    queryClient.setQueryData(['workspace', 'list'], (old) => 
      old.map(w => w.id === variables.workspaceId ? { ...w, ...variables.data } : w)
    );
    return { previous };
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['workspace', 'list'], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['workspace', 'list'] });
  }
}));
```

### Shared Invalidation/Retries/Cache
Centralize em `createTanstackQueryUtils`:
```tsx
// lib/query-utils.ts
export const queryUtils = createTanstackQueryUtils({
  defaultOptions: {
    queries: { retry: 3, staleTime: 30000 },
    mutations: { retry: 1 }
  }
});
```

## SSR / Auth / Tenant Boundaries

### Request-Dependent Decisions
Decisões dependentes de request (auth, tenant, feature flags) acontecem em **SSR/runtime boundaries** — nunca reutilize tenant-scoped state após workspace switch.

```tsx
// ✅ GOOD - Server Component reads request context
async function WorkspacePage({ params }: { params: { workspaceId: string } }) {
  const session = await getSession(); // Request-bound
  const workspace = await getWorkspace(params.workspaceId, session.tenantId);
  return <WorkspaceView workspace={workspace} />;
}

// ✅ GOOD - Client Component receives data as props
function WorkspaceView({ workspace }: { workspace: Workspace }) {
  // No tenant logic here - received from parent
  return <WorkspaceContent workspace={workspace} />;
}

// ❌ BAD - Client Component accessing tenant state directly
function WorkspaceView() {
  const { currentTenant } = useAuth(); // Stale after workspace switch!
  const workspace = useQuery(workspaceQuery(currentTenant.id));
}
```

### Hydration Safety
```tsx
// ✅ GOOD - Suppress hydration mismatch for request-dependent content
function UserAvatar({ userId }: { userId: string }) {
  const { data: user } = useQuery(userQuery(userId));
  return (
    <suppressHydrationWarning>
      <img src={user?.avatarUrl} alt={user?.name} />
    </suppressHydrationWarning>
  );
}
```

## URL State (Shareable)

### nuqs for URL State
```tsx
import { useQueryState } from 'nuqs';

function WorkspaceList() {
  const [filters, setFilters] = useQueryState('filters', 
    parseAsJson<WorkspaceFilters>().withDefault(defaultFilters)
  );
  const [page, setPage] = useQueryState('page', parseAsInt.withDefault(1));
  
  const { data } = useQuery(workspaceListQueryOptions({ filters, page }));
  
  return (
    <WorkspaceFiltersPanel filters={filters} onChange={setFilters} />
    <WorkspaceTable data={data} />
    <Pagination page={page} onPageChange={setPage} />
  );
}
```

### What Goes in URL
- Shareable filters/tabs/pagination/search
- **NOT** one-shot signals (toast, modal open, transient UI state)

## Persistence (Feature-Owned)

### Low-Frequency Preferences Only
```tsx
// lib/storage/createLocalStorageState.ts
export function createLocalStorageState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? defaultValue; }
    catch { return defaultValue; }
  });
  
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  
  return [value, setValue] as const;
}

// Feature-owned usage
// features/preferences/store.ts
export const [sidebarCollapsed, setSidebarCollapsed] = createLocalStorageState(
  'preferences:sidebar-collapsed', 
  false
);
```

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| Hand-written DTO mirroring generated types | Drift, duplication, maintenance burden | Use generated types directly |
| `queryKey` as string arrays with dynamic parts | Cache fragmentation, hard to invalidate | Use `queryOptions()` from generated client |
| Storing tenant-scoped data in global state | Stale after workspace switch | Pass via props, use SSR boundaries |
| Mutations without optimistic updates | Poor UX, perceived slowness | Use `onMutate`/`onError`/`onSettled` |
| URL state for transient UI (modals, toasts) | Pollutes URL, breaks back button | Use local state for one-shot signals |