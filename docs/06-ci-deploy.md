# 06 — CI, Branch Protection e Convenções de Deploy

Status: **Ativo** (implementado em `.github/workflows/ci.yml` + `vercel.json`).

## 1. Pipeline de CI — checks obrigatórios por PR

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

| Job       | O que roda                                                                                                                                                   | Por quê                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `quality` | Prettier `--check`, `tsc --noEmit` (todos os workspaces)                                                                                                     | Estilo e tipos (doc 05)                                                |
| `build`   | `npm run build` + asserção dos artefatos (`packages/shared/dist`, `apps/api/dist`)                                                                           | §62 — build é parte do DoD                                             |
| `prisma`  | `prisma validate`, `format --check`, **drift check** (`migrate diff` migrations→schema), `migrate deploy` contra Postgres 17 real + contagem de tabelas ≥ 37 | Doc 04 §5 — sem drift schema↔migrations; migration realmente aplicável |
| `tests`   | Unit + **integração com Postgres real** (banco efêmero por execução) + suíte **tenant-isolation**                                                            | R3 + §51 — isolamento multi-tenant é obrigatório                       |

Gatilhos: `pull_request` (main, develop) e `push` (main, develop). `concurrency` cancela execuções obsoletas. Segredos de CI são **valores de teste** (nunca de produção; doc 03 §2).

### Isolamento multi-tenant no CI

A suíte `tests/isolation.multi-tenant.test.ts` roda no job `tests` contra um banco real. Se alguém quebrar a `TenantScopeExtension`, o CI fica vermelho **no PR** — é a porta de entrada do R3 (a barreira mais crítica do sistema).

### Drift check (schema.prisma ↔ migrations)

`prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url ...` — se o schema mudar sem migration correspondente, o job `prisma` falha com instrução para rodar `npm run db:migrate` e commitar a migration.

## 2. Convenções Vercel ([vercel.json](../vercel.json))

| Branch                           | Ambiente Vercel               | Migration                                                 |
| -------------------------------- | ----------------------------- | --------------------------------------------------------- |
| `main`                           | **Production**                | `prisma migrate deploy` no build                          |
| `develop`                        | **Development** (alias `dev`) | `prisma migrate deploy` no build                          |
| `feature/*`, `fix/*`, `hotfix/*` | Preview efêmero (sem aliases) | **Sem migrations** (preview não toca banco compartilhado) |

Projetos esperados (doc 03 §2): `psa-web` (apps/web, Fase 2) e `psa-api` (apps/api).

- Env vars por ambiente na Vercel (`DATABASE_URL` pooler, `DIRECT_URL`, `JWT_SECRET`, `AES_MASTER_KEY`, `R2_*`, ...). Nenhuma no Git.
- `installCommand`/`buildCommand` no `vercel.json` garantem que `migrate deploy` rode no build (doc 03 §3: produção só via deploy; nunca manual).
- Rollback = redeploy do build anterior; migrations sempre aditivas (expand/contract) para compatibilidade N-1.

## 3. Branch protection (configurar no GitHub — Settings → Branches)

Regra sugerida para `main` e `develop`:

- Require pull request before merging ✔
- Required status checks: `Lint & Typecheck`, `Build (shared + api)`, `Prisma validate & migrate-check`, `Tests (unit + integration + tenant-isolation)`
- Require branches to be up to date before merging ✔
- Require linear history ✔ (facilita revert cirúrgico)
- Nunca permitir force-push / delete em `main`/`develop` (§7)

Fluxo de branch (§6):

```text
feature/* → PR → CI verde → merge → develop → deploy development
develop → release/* (opcional) → PR → CI verde → merge → main → deploy production
hotfix/* → PR direto para main → cherry-pick para develop
```

## 4. Segredos usados no CI

| Var                                                           | Valor                           | Origem                             |
| ------------------------------------------------------------- | ------------------------------- | ---------------------------------- |
| `JWT_SECRET`                                                  | fixo de teste (32+ chars)       | workflow                           |
| `AES_MASTER_KEY`                                              | base64 fixo de teste (32 bytes) | workflow                           |
| `TEST_DATABASE_URL` / `DATABASE_URL` / `DIRECT_URL`           | service container `psa_test`    | workflow                           |
| (futuro) `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub Secrets                  | deploy programático, se necessário |

Nenhum segredo de produção existe no repositório (§5).
