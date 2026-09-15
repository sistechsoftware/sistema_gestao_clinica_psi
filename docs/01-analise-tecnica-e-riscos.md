# 01 — Análise Técnica e Riscos (Fase 0)

Status: **Proposta para validação** — nenhuma implementação iniciada antes da aprovação.

## 1. Leitura geral da proposta

A proposta do Prompt Mestre v2.1 é tecnicamente coerente e os pontos mais importantes estão corretos:

- Multi-tenancy desde o primeiro dia ✔ (decisão correta; retrofit de multi-tenant é o erro mais caro possível)
- PostgreSQL + Prisma, nunca SQLite como banco principal ✔
- Abstrações de infraestrutura (`StorageService`, `NotificationService` com providers) ✔
- Não acoplar regras de negócio à Vercel/Cloudflare ✔
- Prio­ridade declarada: Segurança → Integridade → Isolamento → Confiabilidade → Usabilidade → Performance → Escalabilidade ✔

Os riscos abaixo não invalidam a proposta; são ajustes de implementação que precisam ser decididos **antes** da Fase 1.

## 2. Problemas e incompatibilidades identificados

### R1 — Serverless (Vercel) + Prisma + PostgreSQL: pooling de conexões

Serverless escala em funções efêmeras; cada instância abre conexões próprias e um PostgreSQL gerenciado com limite de conexões satura rápido.

**Decisão proposta:** usar um provedor gerenciado com pooler nativo (Neon pooler / PgBouncer). Duas `DATABASE_URL`: `DATABASE_URL` (pooler, runtime) e `DIRECT_URL` (migrations e `prisma db pull`). Isso fica encapsulado em `infrastructure/database`, sem vazar para o domínio.

### R2 — Jobs em background não existem nativamente na Vercel

A fila de notificações (§28, §52) não pode rodar como processo persistente na Vercel.

**Decisão proposta:** Fase 1–7 usa **fila em tabela PostgreSQL** (`NotificationQueue`) + **Vercel Cron** disparando um endpoint de worker idempotente que processa lotes curtos (retry com backoff exponencial, `idempotencyKey` único). O worker é um caso de uso comum ao domínio (`ProcessNotificationQueue`), executável por cron, CLI ou worker dedicado futuro (Railway/Fly). Sem Redis nesta fase — a tabela com índice `status + scheduledFor` atende bem a dezenas de milhares de itens/hora.

### R3 — Enforcement de tenant: uma camada só não basta

`WHERE tenantId = ?` espalhado à mão eventualmente falha (esquecimento em nova query).

**Decisão proposta — defesa em 3 camadas:**

1. **Contexto autenticado**: `tenantId` vem **sempre** do JWT/sessão (via `TenantUser`), nunca do payload do cliente. Middleware injeta `TenantContext` na request.
2. **Prisma Client Extension** (` TenantScopeExtension`): toda query em modelos tenant-scoped recebe `tenantId` automaticamente do contexto; query sem contexto em modelo protegido → exceção. Negócio não escreve `where tenantId` manualmente.
3. **Teste obrigatório de isolamento** por módulo (Tenant A não lê/grava nada do Tenant B), mais um conjunto de testes de penetração de API (`/patients/:id` de outro tenant ⇒ 404, não 403 — não revelar existência).

Row-Level Security no PostgreSQL fica **documentado como hardening futuro opcional** (exige `SET app.tenant_id` por transação e conflita com pooling serverless); a camada 2 + testes cobrem o risco inicial.

### R4 — Dados clínicos sensíveis (LGPD art. 5º, II — dados de saúde)

- **Segregação estrutural**: dados administrativos (agenda, financeiro, cadastro) separados de dados clínicos (`ClinicalRecord`/`ClinicalNote`) no schema e nas permissões (`clinical:*` isoladas de `patients:*`).
- **Criptografia em nível de campo**: conteúdo do prontuário/notas clínicas cifrado com AES-256-GCM antes de tocar o banco (`contentEncrypted`), chave em segredo de ambiente (evolução futura para KMS). O `Super Admin` e a `Secretária` não têm permissão `clinical:read`; acesso excepcional exige permissão dedicada + `AuditLog`.
- **Nunca** enviar conteúdo clínico por Push/SMS/WhatsApp/e-mail — templates só com dados administrativos (§14).
- Backup/restauração de produção somente com política escrita; ambiente de teste nunca recebe dado real.

### R5 — PWA e Push no iOS

Web Push no Safari/iOS exige o app **instalado na tela de início (iOS ≥ 16.4)**. Service Worker: cache **apenas do shell estático**; respostas da API são sempre `network-only` (nada de dado clínico em cache local). Preferências de push por dispositivo (`PushSubscription` por `User` + device).

### R6 — WhatsApp: apenas API oficial

Somente **WhatsApp Business Platform (Meta Cloud API)** com templates aprovados, webhook verificado e idempotência. Nenhuma automação não oficial (violação de ToS = risco de banimento e LGPD). A abstração `WhatsAppProvider` permite trocar de provedor BSP (Meta direto, Twilio, 360dialog) sem tocar no domínio.

### R7 — Tempo, fuso e dinheiro

- Datas/horas de agenda: `timestamptz` (UTC) no banco + `timezone` do tenant (default `America/Sao_Paulo`) nas settings; toda renderização/cálculo de "24h antes" usa o fuso do tenant.
- Dinheiro: **inteiros em centavos** (`amountCents`), nunca float; formatação BRL apenas na apresentação.

### R8 — Recorrência de agenda

`AppointmentSeries` define a regra (dia da semana, horário, duração, período) e o sistema **materializa** instâncias `Appointment` (janela de materialização p.ex. 90 dias, expandida por job/cron). Reagendamento/cancelamento de uma ocorrência nunca destrói a série nem o histórico (`rescheduledFromId` preserva origem).

### R9 — Anti double-booking

Além da verificação de conflito no serviço, uma **unique parcial** no PostgreSQL (`(tenantId, professionalUserId, startsAt) WHERE status IN ('AGENDADA','CONFIRMADA')`) via migration SQL crua garante integridade mesmo sob corrida.

### R10 — Super Admin não é um papel de tenant

`SUPER_ADMIN` é **flag global em `User`** (plataforma), não um `TenantUser`. Painel admin global acessa apenas metadados de tenants/planos/métricas — nunca conteúdo clínico (§48). Modelar como papel de tenant criaria o risco exato que o §11 proíbe.

## 3. Decisões de escopo inicial

| Tema                      | Decisão                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Monorepo                  | 1 repositório, npm workspaces (`apps/web`, `apps/api`, `packages/shared`)          |
| Compartilhamento de tipos | `packages/shared` com schemas Zod usados no backend e tipagem inferida no frontend |
| Validação                 | Zod no backend (fonte única) + espelho fino no frontend                            |
| Redis                     | Não nesta fase (R2/R3)                                                             |
| RLS no Postgres           | Não nesta fase (hardening futuro documentado)                                      |
| Billing SaaS              | Tabelas `Plan/PlanFeature/Subscription/UsageMetric` criadas, sem cobrança (§47)    |
| IA                        | Somente interface `AIService` reservada, sem implementação (§49)                   |

## 4. Riscos aceitos conscientemente (registrados)

- Vercel Cron tem granularidade mínima de 1 min — lembretes "30 min antes" podem atrasar até ~1 min. Aceitável; worker dedicado no futuro elimina isso.
- Presigned URLs do R2 (upload/download direto) reduzem custo e latency, mas exigem validação server-side de tipo/tamanho e `AuditLog` de download (§53).
- Migrations em produção: somente `prisma migrate deploy` (nunca `db push`), executado em pipeline com checkpoint de backup.
