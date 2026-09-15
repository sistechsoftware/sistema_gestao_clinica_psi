# sistema_gestao_clinica_psi

Plataforma SaaS multi-tenant para gestão profissional de psicanalistas — pacientes, agenda, prontuário, financeiro, documentos, notificações e portal do paciente.

> **Status atual: Fase 1 (Fundação) — implementada.** Monorepo, Fastify + Zod, Prisma/PostgreSQL, autenticação JWT com refresh rotativo, tenants e RBAC.

## Como rodar (local)

```bash
npm run db:up                # PostgreSQL 17 local via Docker (cria psa_dev + psa_test)
cp .env.example .env         # ajuste se necessário (o .env padrão já serve p/ local)
npm install
npm run db:migrate           # aplica migrations (ou db:deploy em CI)
npm run db:seed              # permissões, papéis, planos + tenant demo (idempotente)
npm run dev                  # API em http://localhost:3000
```

Healthcheck: `GET /api/health`.
Seed do tenant demo: `admin@demo.local` / `TroqueEstaSenha!2026` (troque em qualquer uso real).

## Scripts

| Comando                                                                                                   | Função                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run dev`                                                                                             | API em watch mode (tsx)                                                                  |
| `npm run build`                                                                                           | build shared + api                                                                       |
| `npm run typecheck`                                                                                       | tsc --noEmit em todos os workspaces                                                      |
| `npm test`                                                                                                | unit + integração (integração exige `TEST_DATABASE_URL`/`DATABASE_URL`; sem banco, pula) |     | `npm run db:up` / `db:down` | sobe/para o Postgres local (Docker Compose; `PSA_PG_PORT` troca a porta) |
| `npm run db:generate` / `db:migrate` / `db:deploy` / `db:seed` / `db:reset` / `db:snapshot` / `db:studio` | ciclo de banco (reset destrutivo **somente** `APP_ENV=local`)                            |

## CI (GitHub Actions) e Deploy

Todo PR para `main`/`develop` roda: typecheck + Prettier, build, `prisma validate` + drift check + `migrate deploy` contra Postgres 17 real, e testes unit + integração + **suíte de isolamento multi-tenant** (R3) num banco efêmero. Detalhes, branch protection e convenções Vercel (`main` → production, `develop` → development, previews sem migrations): [docs/06-ci-deploy.md](docs/06-ci-deploy.md).

## Estrutura

```text
apps/api/          Fastify 5 + Zod 4 + Prisma — módulos auth e tenants
apps/web/          (Fase 2) React + Vite
packages/shared/   permissions (RBAC), enums, money (centavos), cpf
prisma/            schema + migration inicial + seed
docs/              documentação da Fase 0 (aprovada)
scripts/           db reset/snapshot com guardas de ambiente
```

## Documentação (Fase 0 — aprovada)

| Doc                                                                  | Conteúdo                                                                                                                                                                               |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01 — Análise técnica e riscos](docs/01-analise-tecnica-e-riscos.md) | Etapas 1–2: análise da proposta, riscos (pooling serverless, fila, tenant enforcement, LGPD, PWA/iOS, WhatsApp oficial, dinheiro/tempo, recorrência, anti double-booking, Super Admin) |
| [02 — Arquitetura de aplicação](docs/02-arquitetura-aplicacao.md)    | Etapas 3–4, 9: decisão Fastify vs NestJS, camadas, estrutura de pastas (monorepo)                                                                                                      |
| [03 — Infra, ambientes e CI/CD](docs/03-infra-ambientes-cicd.md)     | Etapas 5–6: GitHub/Vercel/Cloudflare/PostgreSQL/R2, ambientes local→production, pipeline, backup                                                                                       |
| [04 — ERD e modelo de dados](docs/04-erd-modelo-de-dados.md)         | Etapas 7–8: entidades, relacionamentos, migrations planejadas, seed                                                                                                                    |     | [05 — Testes e roadmap](docs/05-testes-roadmap.md) | Estratégia de testes (unit/integração/E2E + isolamento multi-tenant) e fases 0–10 |
| [06 — CI e deploy](docs/06-ci-deploy.md)                             | Pipeline de CI, branch protection, convenções Vercel e segredos                                                                                                                        |

Fonte de verdade do modelo: [`prisma/schema.prisma`](prisma/schema.prisma).

## Segurança implementada (Fase 1)

- Tenant **sempre** do JWT (`tid`) validado contra `TenantUser` ativo — nunca do frontend (§37)
- `TenantScopeExtension`: injeta `tenantId` em toda operação Prisma em modelos tenanted; bulk sem filtro é bloqueado
- Senhas com bcrypt (rounds configurável); política mínima de força
- Refresh token opaco (32 bytes, hash SHA-256 no banco), **rotação com detecção de reuso** → revoga a cadeia e audita
- Cookie `httpOnly`/`sameSite=lax`/`secure` (fora de local) escopado a `/api/auth`
- Rate limit global + restritivo no login (brute force, §10)
- RBAC granular: permissões do papel + `extraPerms` − `revokedPerms` por membership (§11)
- Auditoria append-only (`AuditLog`) em login, falha de login, reuso de refresh, troca de senha, tenants e memberships (§34)
- Helpers prontos para LGPD: CPF como HMAC + máscara (R4), AES-256-GCM por campo para dados clínicos (usado na Fase 4)
- Helmet + CORS restrito ao `WEB_URL` + error handler central que nunca vaza internos e mapeia P2025 → 404 (isolation-first)

## Stack

- **Backend:** Node.js + Fastify 5 + TypeScript + Zod 4 (type provider)
- **Banco:** PostgreSQL gerenciado + Prisma (pooler + direct URL)
- **Frontend (Fase 2):** React + TypeScript + Vite + React Router + TanStack Query + Tailwind + PWA
- **Storage (Fase 6):** Cloudflare R2 (S3-compatible, buckets privados + URLs assinadas)
- **Infra:** GitHub + Vercel + Cloudflare (DNS/SSL/WAF)

## Roadmap

0. Arquitetura ✔
1. Fundação (monorepo, Prisma, auth, tenants, RBAC) ✔ ← **você está aqui**
2. Pacientes → 3. Agenda → 4. Clínico → 5. Financeiro → 6. Documentos → 7. Notificações → 8. Portal → 9. SaaS → 10. Escala

Detalhes e Definition of Done por fase: [docs/05-testes-roadmap.md](docs/05-testes-roadmap.md).
