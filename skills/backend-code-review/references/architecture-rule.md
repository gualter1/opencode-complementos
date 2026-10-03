# Architecture Rules (Backend)

## Dependency Direction (Dify Pattern)

### Core Principle
**Transport layers** (controllers, handlers, resolvers) podem depender de **services** e **domain contracts**.
**Domain code** (entities, value objects, domain services, policies) **NÃO** deve importar:
- Controller/handler/resolver code
- Request context (Gin context, FastAPI Request, etc.)
- Framework-specific types

### Correct Pattern
```python
# ✅ GOOD: Service receives validated data explicitly
class UserService:
    def create_user(self, actor: Actor, tenant_id: str, data: CreateUserDTO) -> User:
        # Domain logic here - no framework deps
        pass

# Controller passes validated data DOWN
@router.post("/users")
async def create_user(request: Request, data: CreateUserDTO, actor: Actor = Depends(get_actor)):
    return user_service.create_user(actor, actor.tenant_id, data)
```

### Anti-Patterns (Blockers)
```python
# ❌ BAD: Domain reaching up to transport
class User:
    @property
    def is_admin(self) -> bool:
        return current_request.user.role == "admin"  # NEVER do this

# ❌ BAD: Service importing controller types
from api.controllers.user_controller import UserController  # NEVER

# ❌ BAD: Domain using framework request context
from fastapi import Request
def process(request: Request):  # NEVER in domain
```

## api/core/ — Migration Only
- **Não propõe novos arquivos** em `api/core/`
- **Não extrai código** para `api/core/` (exceto migrations)
- Esta pasta é para compatibilidade de migração apenas

## api/libs/ — Infrastructure Only
- Deve conter **apenas infraestrutura reutilizável**: database connection, HTTP client wrappers, cache clients, etc.
- **Sem product policy** (business rules, validation logic, orchestration)
- **Sem orchestration** (workflow coordination, multi-service calls)

## Repository Pattern

### When to Use Existing Repository
Se tabela/modelo **já tem** repository abstraction → **USE ELA** para **todos** reads/writes/queries.
Não faça queries ad-hoc via SQLAlchemy session diretamente.

### When to Introduce New Repository
Apenas quando complexidade justifica:
- Large/high-volume tables
- Repeated complex queries
- Likely storage strategy variation (e.g., might swap PostgreSQL for DynamoDB)

### Implementation Rules
```python
# ✅ GOOD: Protocol-based abstraction
class UserRepository(Protocol):
    def get_by_id(self, user_id: str, tenant_id: str) -> User | None: ...
    def list_by_tenant(self, tenant_id: str, filters: UserFilters) -> list[User]: ...

# Implementation in infrastructure layer
class SQLAlchemyUserRepository:
    def __init__(self, session: Session): ...
```

## Multi-Tenancy (Mandatory)

### Tenant Scoping
**TODAS** queries em shared tables **DEVEM** ter predicate `tenant_id`:
```python
# ✅ GOOD
session.query(User).filter(User.tenant_id == tenant_id).all()

# ❌ BAD - missing tenant scoping
session.query(User).all()  # Data leak risk!
```

### Actor Propagation
Passe `actor` (validated user + tenant + permissions) explicitamente através de service calls:
```python
# Service signature
def transfer_ownership(actor: Actor, resource_id: str, new_owner_id: str) -> Resource:
    # actor.tenant_id used for all queries
    # actor.permissions checked for authorization
```

## Error Handling
- Domain errors = custom exceptions (not HTTP exceptions)
- Transport layer maps domain exceptions → HTTP status codes
- Never leak stack traces or internal details to client

## Concurrency Safeguards (Write Paths)
Para write paths contested, use UMA das estratégias:
1. **Optimistic locking** (version column) — low contention
2. **Redis distributed lock** — cross-worker critical sections
3. **SELECT ... FOR UPDATE** — high contention, keep transactions SHORT