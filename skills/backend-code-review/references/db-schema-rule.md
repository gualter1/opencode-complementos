# Database Schema Rules

## Tenant ID (Mandatory for Multi-Tenant)

### Rule
**TODOS** modelos que pertencem a dados owned by tenant **DEVEM** incluir `tenant_id` column.

```python
# ✅ GOOD
class Document(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True, nullable=False)  # REQUIRED
    name = Column(String)
    content = Column(Text)

# ❌ BAD - missing tenant isolation
class Document(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True)
    name = Column(String)  # No tenant_id = data leak across tenants
```

### Foreign Keys
Se tabela referencia outra tabela multi-tenant, **AMBAS** devem ter `tenant_id` e FK deve ser composite:
```python
# ✅ GOOD
class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(String, primary_key=True)
    document_id = Column(String, nullable=False)
    tenant_id = Column(String, index=True, nullable=False)
    # Composite FK
    __table_args__ = (
        ForeignKeyConstraint(
            ['document_id', 'tenant_id'],
            ['documents.id', 'documents.tenant_id']
        ),
    )
```

## No Queries in @property

### Rule
**NUNCA** faça database queries em `@property` ou `@hybrid_property`. Escondem dependências, causam N+1, quebram serialização.

```python
# ❌ BAD - hidden query, N+1 risk
class User(Base):
    @property
    def document_count(self) -> int:
        return session.query(Document).filter(Document.user_id == self.id).count()

# ✅ GOOD - explicit in service/repository
class UserService:
    def get_user_with_doc_count(self, user_id: str, tenant_id: str) -> UserWithCount:
        user = self.repo.get_by_id(user_id, tenant_id)
        count = self.doc_repo.count_by_user(user_id, tenant_id)
        return UserWithCount(user=user, document_count=count)
```

## Index Strategy

### Leftmost Prefix Rule
Índice `(a, b, c)` cobre queries em `(a)`, `(a, b)`, `(a, b, c)`.
**NÃO crie índices redundantes** que são prefixos de outros.

```sql
-- ✅ GOOD: Single composite index covers all three patterns
CREATE INDEX idx_documents_tenant_status_created ON documents (tenant_id, status, created_at);

-- ❌ BAD: Redundant indexes
CREATE INDEX idx_documents_tenant ON documents (tenant_id);           -- covered by composite
CREATE INDEX idx_documents_tenant_status ON documents (tenant_id, status);  -- covered by composite
```

### Index Guidelines
- **Always index** `tenant_id` em tabelas multi-tenant
- **Index foreign keys** usados em JOINs frequentes
- **Partial indexes** para filtered queries comuns: `CREATE INDEX ... WHERE status = 'active'`
- **Covering indexes** (INCLUDE) para queries que só leem poucas colunas
- **Monitor unused indexes** via `pg_stat_user_indexes` — drop if never scanned

## Dialect Portability

### Rule
Evite types PostgreSQL-specific (`JSONB`, `ARRAY`, `INET`, `UUID` nativo) em models compartilhados.
Use **wrappers em `models.types`** para portabilidade.

```python
# models/types.py
from sqlalchemy import TypeDecorator, Text
import json

class AdjustedJSON(TypeDecorator):
    """JSON stored as TEXT, works on PostgreSQL, MySQL, SQLite"""
    impl = Text
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        return json.dumps(value) if value is not None else None
    
    def process_result_value(self, value, dialect):
        return json.loads(value) if value is not None else None

# Usage
class Document(Base):
    metadata = Column(AdjustedJSON, default=dict)  # Portable!
```

### Migration Strategy
Para DDL incompatível entre dialects (PostgreSQL vs MySQL):
- **Branch por dialect** em migrations
- Use `op.get_bind().dialect.name` para conditional DDL
- Teste migrations em ambos dialects no CI

## Naming Conventions
- Tables: `snake_case`, plural (`documents`, `user_sessions`)
- Columns: `snake_case` (`tenant_id`, `created_at`, `is_deleted`)
- Indexes: `idx_{table}_{columns}` (`idx_documents_tenant_status`)
- FKs: `fk_{table}_{referenced_table}` (`fk_documents_user`)
- Constraints: `ck_{table}_{constraint}` (`ck_documents_status_valid`)