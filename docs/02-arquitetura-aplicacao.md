# 02 — Arquitetura de Aplicação (Fase 0)

Status: **Proposta para validação**.

## 1. Decisão de framework backend: **Fastify** (Etapa 3)

Critérios do §3: escalabilidade, organização, testes, segurança, manutenção, arquitetura modular, integrações, crescimento SaaS.

| Critério                                  | Fastify                                                                                      | NestJS                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Cold start / custo em serverless (Vercel) | **Excelente** — bundle pequeno, startup ~ms                                                  | Ruim — decoradores/reflection DI inflam bundle e cold start em lambda |
| Organização / modularidade                | Boa via plugins + composição; exige disciplina                                               | **Excelente** — módulos/DI nativos                                    |
| Testes                                    | **Ótimo** — `app.inject()` sem rede                                                          | Ótimo                                                                 |
| Segurança                                 | Plugins oficiais (`@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cors`, `@fastify/jwt`) | Bom (é Express/Fastify por baixo)                                     |
| Manutenção                                | Simples, explícito, pouca "mágica"                                                           | Mais abstração; curva e indireção maiores                             |
| Crescimento SaaS                          | Suficiente: módulos por domínio + casos de uso; migração futura p/ outro runtime trivial     | Suficiente                                                            |
| Risco de lock-in                          | Baixo                                                                                        | Médio (ecossistema próprio)                                           |

**Justificativa da escolha — Fastify:**

1. O deploy inicial é **Vercel serverless**; cold start e bundle dominam. NestJS paga imposto permanente de runtime que não compra nada essencial aqui.
2. O que NestJS daria de "organização" nós obtemos de graça com: módulos por domínio (rotas Fastify encapsuladas em plugins), **casos de uso** como fronteira (`ApplicationService`), e **Prisma** já cobrindo a camada de dados — o DI do Nest resolveria um problema que quase não temos.
3. Menos indireção = auditoria de segurança e LGPD mais simples (§35) — cada request tem caminho explícito: rota → permissão → caso de uso → Prisma scopeado.
4. Migração futura para Workers/Railway/Fly: Fastify roda em qualquer Node/bordeiro; as regras de negócio vivem fora do HTTP (casos de uso puros).

Quando NestJS valeria a pena: equipe grande, times múltiplos, forte convenção sobre configuração. Para 1–3 devs na fundação, Fastify é a escolha sustentável. **Decisão: Fastify 5.x + Zod (type provider) + @fastify/jwt.**

## 2. Camadas e fluxo de request

```text
HTTP (Fastify route, schema Zod)
  → Middleware de auth (JWT) → TenantContext (tenantId via TenantUser ativo)
  → Guard de permissão (RBAC, permission code)
  → Caso de uso (Application/Domain — puro, sem HTTP)
  → Prisma com TenantScopeExtension (tenantId forçado)
  → Resposta HTTP (mapeamento de erros central)
```

Regras:

- **Casos de uso não conhecem HTTP nem Vercel** — podem ser chamados por rota, cron de worker, CLI ou fila.
- Erros de domínio (`DomainError` e subclasses) → handler central → HTTP status correto; nada de `try/catch` espalhado.
- Toda mutation relevante grava `AuditLog` (usuário, tenant, ação, entidade, entityId, IP, metadados).

## 3. Estrutura de pastas (Etapa 9)

### Monorepo (npm workspaces)

```text
/
├── apps/
│   ├── web/                     # React + Vite (SPA + PWA)
│   └── api/                     # Fastify
├── packages/
│   └── shared/                  # schemas Zod, tipos, constantes, permissões
├── prisma/                      # schema + migrations (fonte única)
├── docs/                        # esta documentação
└── package.json                 # workspaces, scripts orquestradores
```

### apps/api

```text
apps/api/src/
├── modules/
│   ├── auth/            # rotas + casos de uso (login, refresh, logout, senha)
│   ├── tenants/
│   ├── users/
│   ├── patients/
│   ├── clinical/        # prontuário e notas (permissões próprias)
│   ├── appointments/
│   ├── packages/
│   ├── finance/
│   ├── documents/
│   ├── notifications/
│   ├── communications/
│   ├── reports/
│   └── admin/           # super admin (plataforma)
│       cada módulo: routes.ts, usecases/, dto.ts
├── infrastructure/
│   ├── database/        # client Prisma, TenantScopeExtension
│   ├── storage/         # StorageService + R2StorageProvider (S3 API)
│   ├── email/           # EmailProvider (SES/Resend) + templates
│   ├── whatsapp/        # WhatsAppProvider (Meta Cloud API)
│   ├── sms/             # SmsProvider
│   ├── push/            # WebPushProvider (VAPID)
│   └── queue/           # NotificationQueueRepository + worker runner
├── shared/
│   ├── errors/          # DomainError, mapeamento HTTP
│   ├── security/        # hash de senha, AES-GCM, JWT utils, rate limit
│   ├── validation/
│   └── utils/           # dinheiro (centavos), datas/tz, CPF
├── config/              # env parsing (Zod), settings por ambiente
└── server.ts            # composição: plugins → rotas → handlers
```

### apps/web

```text
apps/web/src/
├── app/                 # router, providers (QueryClient, theme)
├── components/          # UI reutilizável (design system leve)
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── patients/
│   ├── clinical/
│   ├── appointments/
│   ├── finance/
│   ├── documents/
│   ├── notifications/
│   └── settings/
├── hooks/
├── services/            # api client (fetch tipado a partir do shared)
├── lib/                 # utils de apresentação (BRL, datas)
├── routes/
└── types/
```

### packages/shared

```text
packages/shared/src/
├── permissions.ts       # códigos de permissão (fonte única RBAC)
├── schemas/             # Zod: patient, appointment, finance...
├── enums.ts             # status de sessão, métodos de pagamento, canais
└── money.ts
```

## 4. Frontend: arquitetura

- React 18 + Vite + React Router 6 + TanStack Query 5 + Tailwind CSS.
- **Server state** exclusivamente no TanStack Query; keys normalizadas por módulo. Nada de estado global pesado (Zustand só se surgir necessidade real de UI state compartilhado).
- **RBAC no frontend é UX, não segurança**: rotas/botões escondidos por permissão, mas toda decisão de acesso é do backend.
- Lazy loading por feature (`React.lazy`), code splitting automático por rota.
- PWA: `vite-plugin-pwa` (manifest, ícones, Service Worker Workbox), cache **apenas** do shell; chamadas de API `network-only` (R5).

## 5. Padrões transversais

| Tema         | Padrão                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------ |
| IDs          | UUID v7 (ordenável no tempo)                                                                     |
| Timestamps   | `createdAt`/`updatedAt` em tudo; deleção **lógica** (`deletedAt`) em entidades de negócio (§61)  |
| Dinheiro     | inteiros em centavos + moeda (default BRL)                                                       |
| Fuso         | `timestamptz` UTC + `timezone` do tenant                                                         |
| Idempotência | `idempotencyKey` único em fila, webhooks, cobranças e pagamentos (§46)                           |
| Auditoria    | serviço `AuditService` chamado dentro dos casos de uso                                           |
| Notificações | eventos de domínio → `NotificationQueue` → worker → provider → `NotificationDelivery` (§28, §52) |
| Documentos   | metadados no banco; binário no R2; acesso sempre via URL assinada de curta duração (§53)         |
| Config       | nada hardcoded: `Setting` por tenant + env por ambiente (§54)                                    |
