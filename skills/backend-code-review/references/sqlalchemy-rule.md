# SQLAlchemy Rules

## Session Management

### Explicit Transaction Control (Mandatory)
**NUNCA** use autocommit. Sempre controle transações explicitamente.

```python
# ✅ GOOD - Explicit commit
session.add(user)
session.commit()

# ✅ GOOD - Context manager (preferred for complex operations)
with session.begin():
    session.add(user)
    session.add(profile)
    # Auto-commits on success, rolls back on exception

# ❌ BAD - No explicit transaction
session.add(user)
# Missing commit = data not persisted!

# ❌ BAD - Implicit transaction via flush-only
session.flush()  # Not a commit! Data lost on rollback
```

### Session Lifecycle
- **Request-scoped**: One session per HTTP request (FastAPI Depends, Flask-SQLAlchemy)
- **Worker-scoped**: One session per background job/task
- **NUNCA** global/singleton session
- **SEMPRE** close/remove session after use (context manager handles this)

## Tenant Scoping (Mandatory for Multi-Tenant)

### Every Query on Shared Tables
```python
# ✅ GOOD - Explicit tenant_id filter
def get_user_by_email(session: Session, email: str, tenant_id: str) -> User | None:
    return session.query(User).filter(
        User.email == email,
        User.tenant_id == tenant_id  # ALWAYS REQUIRED
    ).first()

# ✅ GOOD - Using repository (enforces tenant scoping)
user = user_repo.get_by_email(email, tenant_id)

# ❌ BAD - Missing tenant_id
session.query(User).filter(User.email == email).first()  # DATA LEAK!
```

### Tenant Scoping in Relationships
```python
# ✅ GOOD - Explicit join with tenant filter
documents = session.query(Document).join(User).filter(
    User.id == user_id,
    User.tenant_id == tenant_id,
    Document.tenant_id == tenant_id  # Both sides!
).all()

# ❌ BAD - Relying on relationship without tenant filter
user.documents  # May leak cross-tenant data!
```

## Query Patterns

### Prefer SQLAlchemy Expressions Over Raw SQL
```python
# ✅ GOOD - Composable, type-safe, portable
from sqlalchemy import select, func, and_
stmt = select(User).where(
    and_(
        User.tenant_id == tenant_id,
        User.status == UserStatus.ACTIVE,
        func.lower(User.email).like(f"%{domain}%")
    )
).order_by(User.created_at.desc()).limit(50)

# ❌ BAD - Raw SQL (fragile, not portable, injection risk)
session.execute(text("SELECT * FROM users WHERE tenant_id = :tid AND email LIKE :domain"), {...})
```

### Avoid N+1 with Selectinload/Joinedload
```python
# ✅ GOOD - Eager loading
from sqlalchemy.orm import selectinload
users = session.execute(
    select(User)
    .where(User.tenant_id == tenant_id)
    .options(selectinload(User.documents))
).scalars().all()

# ❌ BAD - N+1 queries
users = session.query(User).filter(User.tenant_id == tenant_id).all()
for user in users:
    print(len(user.documents))  # Triggers query PER user!
```

### Bulk Operations
```python
# ✅ GOOD - Bulk insert/update
session.bulk_insert_mappings(User, [{"id": u.id, "email": u.email, "tenant_id": tenant_id} for u in users])
session.bulk_update_mappings(User, [{"id": u.id, "status": "inactive"} for u in users])

# ❌ BAD - Loop with individual adds
for user in users:
    session.add(user)  # Slow, many round trips
```

## Concurrency Safeguards

### Choose ONE Strategy Per Write Path

#### 1. Optimistic Locking (Low Contention)
```python
class Document(Base):
    version = Column(Integer, default=1, nullable=False)  # Version column

# Service
def update_document(doc_id: str, tenant_id: str, data: dict, expected_version: int):
    with session.begin():
        doc = session.query(Document).filter(
            Document.id == doc_id,
            Document.tenant_id == tenant_id,
            Document.version == expected_version  # Check version
        ).with_for_update().first()  # Lock row
        
        if not doc:
            raise ConcurrentModificationError("Document modified by another user")
        
        for k, v in data.items():
            setattr(doc, k, v)
        doc.version += 1  # Increment version
```

#### 2. Redis Distributed Lock (Cross-Worker Critical Sections)
```python
import redis
from contextlib import contextmanager

@contextmanager
def distributed_lock(redis_client: redis.Redis, key: str, timeout: int = 30):
    lock = redis_client.lock(key, timeout=timeout)
    acquired = lock.acquire(blocking=True, blocking_timeout=5)
    if not acquired:
        raise LockAcquisitionError(f"Could not acquire lock for {key}")
    try:
        yield
    finally:
        lock.release()

# Usage
with distributed_lock(redis, f"lock:billing:{tenant_id}:{invoice_id}"):
    # Critical section - only one worker at a time
    process_billing(invoice_id)
```

#### 3. SELECT FOR UPDATE (High Contention, Short Transactions)
```python
# ✅ GOOD - Short transaction, row-level lock
with session.begin():
    account = session.query(Account).filter(
        Account.id == account_id,
        Account.tenant_id == tenant_id
    ).with_for_update().first()  # Locks row until commit
    
    account.balance -= amount
    # Transaction commits quickly - lock held briefly
```

## Common Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| `session.query(Model).filter(...).update({...})` | Bypasses ORM events, no version increment | Load entity, modify, save |
| `session.execute(text("UPDATE ..."))` | Raw SQL, no ORM safety, no tenant scoping | Use ORM expressions |
| `Model.property` doing queries | Hidden N+1, breaks serialization | Move to service/repository |
| `session.flush()` without commit | Data not persisted, lost on error | Use `session.commit()` or context manager |
| Long-running transactions | Lock contention, connection pool exhaustion | Keep transactions SHORT (< 100ms) |

## Type Hints
```python
# ✅ GOOD - Proper typing
from sqlalchemy.orm import Session
from typing import Sequence

def list_users(session: Session, tenant_id: str, filters: UserFilters) -> Sequence[User]:
    ...

# Use Sequence[T] not List[T] for query results (immutable)
# Use Session not session (abstract)
```