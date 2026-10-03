# Repository Rules

## When to Use Repository Abstraction

### Use Existing Repository (Mandatory)
Se a tabela/modelo **já possui** uma repository abstraction definida → **VOCÊ DEVE USÁ-LA** para **TODOS** reads, writes e queries.

```python
# ✅ GOOD - Using repository
user = user_repository.get_by_id(user_id, tenant_id)
users = user_repository.list_by_tenant(tenant_id, filters)
user_repository.save(user)

# ❌ BAD - Bypassing repository
user = session.query(User).filter(User.id == user_id).first()  # Don't do this
session.add(user)  # Don't do this
```

### When to Introduce NEW Repository
Só introduza nova repository quando a complexidade **justifica**:
- **Large/high-volume tables** — performance tuning, custom indexing, partitioning
- **Repeated complex queries** — mesma query complexa em 3+ lugares
- **Likely storage strategy variation** — pode trocar PostgreSQL por DynamoDB, Elasticsearch, etc.

### When NOT to Introduce Repository
- Simple CRUD em tabela pequena/baixo volume
- Queries ad-hoc usadas 1-2 vezes
- "Future proofing" sem requisito concreto (YAGNI)

## Repository Implementation Rules

### Protocol First (Dependency Inversion)
Services dependem de **Protocol/Interface**, infraestrutura fornece implementação.

```python
# Domain layer (api/services/user_service.py)
from typing import Protocol

class UserRepository(Protocol):
    def get_by_id(self, user_id: str, tenant_id: str) -> User | None: ...
    def list_by_tenant(self, tenant_id: str, filters: UserFilters) -> list[User]: ...
    def save(self, user: User) -> User: ...
    def delete(self, user_id: str, tenant_id: str) -> bool: ...

# Infrastructure layer (api/repositories/sqlalchemy_user_repo.py)
class SQLAlchemyUserRepository:
    def __init__(self, session: Session):
        self.session = session
    
    def get_by_id(self, user_id: str, tenant_id: str) -> User | None:
        return self.session.query(User).filter(
            User.id == user_id, User.tenant_id == tenant_id
        ).first()
    
    # ... implement all protocol methods
```

### Repository Location
- **Protocol/Interface**: Domain layer (`api/services/` or `api/domain/`)
- **Implementation**: Infrastructure layer (`api/repositories/` or `api/infrastructure/repositories/`)
- **NUNCA** em `api/core/` (migration only)
- **NUNCA** em `api/libs/` (infrastructure only, no product policy)

## Query Methods

### Naming Convention
```python
# Read methods
get_by_id(id, tenant_id)           # Single by PK
get_by_*(field, tenant_id)         # Single by unique field
list_by_tenant(tenant_id, filters) # Multiple with filters
count_by_tenant(tenant_id, filters) # Count only
exists_by_*(field, tenant_id)      # Boolean existence

# Write methods
save(entity)                       # Insert or update (upsert)
create(entity)                     # Insert only (fail if exists)
update(entity)                     # Update only (fail if not exists)
delete(id, tenant_id)              # Soft or hard delete
```

### Filter Objects
Use typed filter objects, não kwargs soltos:
```python
# ✅ GOOD
@dataclass
class UserFilters:
    status: UserStatus | None = None
    role: UserRole | None = None
    created_after: datetime | None = None
    page: int = 1
    page_size: int = 50

users = repo.list_by_tenant(tenant_id, UserFilters(status=UserStatus.ACTIVE, page=1))

# ❌ BAD
users = repo.list_by_tenant(tenant_id, status="active", role="admin", page=1, page_size=50)
```

## Transaction Boundaries

### Repository Does NOT Manage Transactions
Repository methods **NÃO** fazem `commit()` ou `rollback()`.
Transaction control pertence ao **Service/Use Case** layer.

```python
# ✅ GOOD - Service manages transaction
class UserService:
    def __init__(self, session: Session, user_repo: UserRepository):
        self.session = session
        self.user_repo = user_repo
    
    def transfer_ownership(self, actor: Actor, resource_id: str, new_owner_id: str):
        with self.session.begin():  # Explicit transaction
            resource = self.resource_repo.get_by_id(resource_id, actor.tenant_id)
            new_owner = self.user_repo.get_by_id(new_owner_id, actor.tenant_id)
            resource.owner_id = new_owner_id
            self.resource_repo.save(resource)
            self.audit_log_repo.log(actor, "ownership_transferred", resource_id)

# ❌ BAD - Repository doing commit
class SQLAlchemyUserRepository:
    def save(self, user):
        self.session.add(user)
        self.session.commit()  # WRONG - removes caller's control
```

## Anti-Patterns

| Pattern | Why It's Wrong |
|---------|----------------|
| Repository returning `Query` objects | Leaks ORM abstraction, couples callers to SQLAlchemy |
| Repository with `session` as global/singleton | Breaks testability, request isolation |
| Service doing raw SQLAlchemy queries | Bypasses repository contract, untestable |
| Repository in `api/core/` | Violates migration-only rule |
| Repository doing business logic | Violates single responsibility |