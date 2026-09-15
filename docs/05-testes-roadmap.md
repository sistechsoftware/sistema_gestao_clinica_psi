# 05 — Estratégia de Testes e Roadmap (Fase 0)

Status: **Proposta para validação**.

## 1. Estratégia de testes (§51)

| Camada                  | Ferramenta                             | Escopo                                                                                                                                   |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Unitários               | **Vitest**                             | regras de negócio puras: dinheiro (centavos), datas/fuso, CPF, geração de ocorrências de série, conflito de agenda, criptografia AES-GCM |
| Integração              | **Vitest + Testcontainers (Postgres)** | Prisma + migrations reais + API `app.inject()` + auth/JWT + fila de notificações                                                         |
| E2E                     | **Playwright**                         | login → criar paciente → agendar → realizar sessão → cobrar → registrar pagamento → lembrete                                             |
| Isolamento multi-tenant | Vitest (integração)                    | **suite obrigatória** (R3)                                                                                                               |

### Testes de isolamento multi-tenant (obrigatórios)

Para cada módulo: criar Tenant A e B com dados idênticos; autenticar em A; tentar ler/alterar/excluir recurso de B:

- GET recurso de B → **404** (nunca 200; não revelar existência)
- PUT/DELETE de B → 404
- Listagem de A jamais contém itens de B
- Query sem tenant context em modelo tenant-scoped → erro do TenantScopeExtension

### E2E — fluxo principal (§51)

```text
login → paciente → agendamento → sessão → cobrança → pagamento → notificação
```

## 2. Roadmap (§59)

| Fase         | Entregas                                                                                                       | Definition of Done (§62)                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **0** (esta) | Análise, decisões, ERD, migrations plan, estrutura, ambientes                                                  | docs validadas por você                                                           |
| **1**        | Monorepo, Fastify, Prisma + migrations 1–8, auth (JWT + refresh + rate limit), tenants, RBAC,healthcheck, seed | login/logout/refresh ok; RBAC bloqueando; testes de isolamento do núcleo passando |
| **2**        | Pacientes (CRUD, contatos, busca)                                                                              | CRUD + validações Zod + auditoria + testes de isolamento do módulo                |
| **3**        | Agenda/sessões (calendário, slots, bloqueios, séries, reagendamento, faltas)                                   | anti double-booking ativo (unique parcial), histórico preservado                  |
| **4**        | Clínico (prontuário, notas cifradas)                                                                           | cifragem AES-GCM, permissões clínicas isoladas, sem leak em logs                  |
| **5**        | Financeiro (receber, pagar, pagamentos, relatórios)                                                            | centavos inteiros, idempotência de pagamentos, relatórios                         |
| **6**        | Documentos (R2, URLs assinadas, templates)                                                                     | upload/download auditado, sem URLs públicas                                       |
| **7**        | Notificações (fila + worker + push/email/WhatsApp/SMS, lembretes)                                              | rastreabilidade fim a fim (§52), retries com backoff, idempotência                |
| **8**        | Portal do paciente + agendamento público                                                                       | sem acesso ao prontuário; consentimentos LGPD                                     |
| **9**        | SaaS (planos, limites, métricas, Super Admin)                                                                  | limites por plano aplicados, painel global sem dado clínico                       |
| **10**       | Escala (Sentry, DR runbook, otimizações)                                                                       | DR documentado e testado                                                          |

Cada fase entra por **branch** (`feature/fase-N-*`), com PR, checks de CI e validação de isolamento multi-tenant antes do merge (§7).
