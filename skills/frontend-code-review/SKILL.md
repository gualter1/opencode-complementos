---
name: frontend-code-review
description: Use para review/auditoria de código frontend (web/, packages/dify-ui/). Suporta review de diff pendente, arquivo específico, ou diff colado. NÃO use para implementação-only, diagnóstico sem review intent, ou backend-only code.
---

# Frontend Code Review

Review do escopo solicitado por defeitos concretos e violações de contratos explícitos do projeto. Esta skill possui decisões de review; suas references roteiam para regras canônicas sem ativar workflow de implementação de outra skill.

## Evidence First

1. Estabeleça o escopo de review a partir dos arquivos solicitados ou diff atual.
2. Leia as linhas alteradas, seu behavior owner, e o `AGENTS.md` scoped mais próximo.
3. Trace public consumers, generated contracts, primitive APIs, ou runtime configuration **apenas quando decidem correção**.
4. Reporte achados ligados a: falha observável, contrato violado, boundary de segurança, ou risco de manutenção demonstrado. Convenções explícitas do time são contratos: estabeleça seu escopo e exceções, e não invente user impact para justificar finding de convenção.

## Rule Routing

Leia **apenas** os packs correspondentes ao diff:

- DOM semantics, focus, keyboard, forms, disabled state, ou visible interaction: `references/accessibility-ui.md`
- Dify UI imports, Base UI wrappers, overlays, tokens, ou primitive contracts: `references/dify-ui.md`
- Component ownership, props, state, Effects, navigation, ou module boundaries: `references/component-architecture.md`
- Generated clients, Query, mutations, auth, SSR, URL state, ou persistence: `references/data-query-contracts.md`
- Test files ou finding concreto de missing-regression-test: `references/testing.md`
- Bundle, waterfall, rendering, ou subscription cost supported by evidence: `references/performance.md`
- Stable Dify runtime invariants nos paths nomeados: `references/dify-invariants.md`
- General TypeScript ou styling quality não owned acima: `references/code-quality.md`

Leia `packages/dify-ui/README.md`, `packages/dify-ui/AGENTS.md`, `packages/dify-ui/docs/overlays.md`, ou `web/docs/test.md` **apenas quando** o código revisado cai sob aquele contrato. Consulte documentação oficial atual quando código local e bundled references não resolvem comportamento de framework, browser, ou accessibility.

## Severity And Output

- **P0**: security/privacy leak, data loss, production crash, ou inaccessible critical workflow.
- **P1**: user-visible regression, invalid API/authorization contract, hydration failure, ou broken primary interaction.
- **P2**: defeito concreto de manutenibilidade, performance, teste, ou acessibilidade, ou violação material de contrato explícito do projeto.
- **P3**: limpeza acionável menor; omita a menos que usuário pediu auditoria thorough.

Lidere com achados ordenados por severidade. Inclua referência tight de arquivo e linha, falha observada ou regra de projeto aplicável, e direção de fix concreta. Explique aplicabilidade da regra para findings de convenção; descreva consequências downstream apenas quando supported by evidence. Quando nenhum achado reste, diga brevemente e declare qualquer gap de verificação material. **Não adicione seções de elogio, riscos especulativos, ou oferta não solicitada de implementar fixes.**

## Integração com Tranquilão

Quando **Tranquilão** chamar esta skill para review de frontend:
1. Tranquilão passa o diff/arquivos para revisar
2. Esta skill executa o workflow acima
3. Retorna achados no formato P0-P3
4. Tranquilão consolida com seu próprio checklist (TypeScript, lint, tests, coverage, secrets, a11y, etc.)

## References Structure
```
references/
├── accessibility-ui.md           # WCAG 2.1 AA, semantic HTML, focus, forms, overlays
├── component-architecture.md     # Vertical modules, ownership, boundaries, props
├── code-quality.md               # TypeScript strict, naming, complexity, formatting
├── data-query-contracts.md       # Generated contracts, TanStack Query, mutations, SSR
├── dify-invariants.md            # Runtime invariants, feature flags, auth boundaries
├── dify-ui.md                    # Subpath imports, tokens, cn(), overlay primitives
├── performance.md                # Bundle, waterfalls, re-renders, Core Web Vitals
└── testing.md                    # Vitest/RTL patterns, coverage, flaky prevention
```