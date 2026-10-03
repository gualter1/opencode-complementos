---
name: backend-code-review
description: Use para review/auditoria de código backend (api/). Suporta review de diff pendente, arquivo específico, ou diff colado. NÃO use para implementação, diagnóstico sem review intent, frontend, ou código fora de api/.
---

# Backend Code Review

Review do escopo solicitado por defeitos concretos e reproduzíveis. O `AGENTS.md` mais próximo (`api/AGENTS.md`) possui fatos do pacote e comandos; esta skill possui o workflow de review e roteia para seus rule packs.

## Evidence First

1. Estabeleça o escopo de review solicitado e inspecione o diff ou arquivos relevantes.
2. Leia as linhas alteradas, seu behavior owner, testes próximos, e docstrings/comentários locais que definem contratos.
3. Trace callers, boundaries de persistência, autorização, schemas gerados, ou I/O externo **apenas quando decidem correção**.
4. Reporte apenas achados ligados a: falha observável, contrato violado, boundary de segurança, risco de integridade de dados, ou problema de manutenção demonstrado.

## Rule Routing

Leia **apenas** os packs correspondentes ao diff:

- Models ou migrations: `references/db-schema-rule.md`
- Controller, service, core/domain, library, ou direção de dependência de model: `references/architecture-rule.md`
- Acesso a tabela fora de boundary de repository estabelecido: `references/repositories-rule.md`
- Sessões SQLAlchemy, queries, transações, CRUD, concorrência, ou raw SQL: `references/sqlalchemy-rule.md`

Quando nenhum pack se aplica, revise correção, segurança, mudanças de comportamento, e evidência de testes diretamente. Consulte documentação oficial atual **apenas** quando código local e contratos não resolvem comportamento de framework/biblioteca.

## Severity And Output

- **P0**: exposição de segurança/privacidade, perda de dados, ou outage generalizado em produção.
- **P1**: regressão user-visible, autorização/isolamento de tenant quebrado, contrato público inválido, ou falha de workflow primário.
- **P2**: defeito concreto de correção, performance, manutenibilidade, ou teste que provavelmente causa comportamento incorreto.
- **P3**: limpeza acionável menor; omita a menos que usuário pediu auditoria thorough.

Lidere com achados ordenados por severidade. Inclua referência tight de arquivo e linha, contrato falhando ou caminho de reprodução, impacto, e direção de fix concreta. Se nenhum achado, diga `No issues found.` e declare qualquer gap de verificação material. **Não adicione seções de elogio, riscos especulativos, ou oferta não solicitada de implementar fixes.**

## Integração com Tranquilão

Quando **Tranquilão** chamar esta skill para review de backend:
1. Tranquilão passa o diff/arquivos para revisar
2. Esta skill executa o workflow acima
3. Retorna achados no formato P0-P3
4. Tranquilão consolida com seu próprio checklist (TypeScript, lint, tests, coverage, secrets, etc.)

## References Structure
```
references/
├── architecture-rule.md      # Dependency direction, repository pattern, domain isolation
├── db-schema-rule.md         # Tenant_id, no @property queries, indexes, dialect portability
├── repositories-rule.md      # When to use/create repositories, abstraction boundaries
└── sqlalchemy-rule.md        # Session management, tenant scoping, concurrency safeguards
```