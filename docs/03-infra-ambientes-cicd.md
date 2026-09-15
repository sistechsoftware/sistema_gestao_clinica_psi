# 03 — Infraestrutura, Ambientes, Deploy e Backup (Fase 0)

Status: **Proposta para validação**.

## 1. Arquitetura de infraestrutura (Etapa 5)

```text
                         INTERNET
                            │
                            ▼
                    ┌─────────────────┐
                    │    CLOUDFLARE   │
                    │ DNS / SSL / WAF │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │     VERCEL      │
                    │  apps/web (SPA) │
                    │  apps/api (FN)  │
                    └───────┬─────────┘
              ┌─────────────┴──────────────┐
              ▼                            ▼
     ┌─────────────────┐          ┌─────────────────┐
     │ PostgreSQL ger. │          │ Cloudflare R2   │
     │ + pooler (R1)   │          │ buckets privados│
     └─────────────────┘          └─────────────────┘
```

| Componente  | Escolha inicial                                  | Notas                                               |
| ----------- | ------------------------------------------------ | --------------------------------------------------- |
| Frontend    | Vercel (SPA estática)                            | Cloudflare na frente (DNS/SSL/WAF)                  |
| API         | Vercel Functions (Fastify adaptado)              | sem API da Vercel nas regras de negócio (§55)       |
| Banco       | PostgreSQL gerenciado + pooler (Neon ou similar) | `DATABASE_URL` (pooler) / `DIRECT_URL` (migrations) |
| ORM         | Prisma                                           | `migrate deploy` em produção                        |
| Storage     | Cloudflare R2 (S3-compatible, privados)          | URLs assinadas de curta duração                     |
| DNS/SSL/WAF | Cloudflare                                       | proxy ativo, regras de rate no edge                 |
| Código/CI   | GitHub + Vercel integration                      | ver fluxo abaixo                                    |
| Secrets     | Vercel env vars por ambiente; nunca no Git       | `.env*` no `.gitignore`                             |

**Desacoplamento (§55):** regras de negócio dependem apenas de interfaces (`StorageService`, `EmailProvider`, `WhatsAppProvider`, `SmsProvider`, `WebPushProvider`, `QueueRunner`). Adaptadores por fornecedor em `infrastructure/`. Migração futura (Railway/Fly/Workers) = novo adaptador + novo runner de queue; domínio intocado.

## 2. Ambientes (Etapa 6)

| Ambiente      | Branch de deploy                 | Banco                         | Dados                      |
| ------------- | -------------------------------- | ----------------------------- | -------------------------- |
| `local`       | —                                | Postgres via Docker           | seed sintético (`db:seed`) |
| `development` | `develop` → preview Vercel       | banco dev gerenciado (pooler) | sintético/anonimizado      |
| `staging`     | `release/*` ou `develop` marcada | banco staging próprio         | sintético/anonimizado      |
| `production`  | `main`                           | banco produção (backups PITR) | real                       |

Regras:

- Nunca apontar `local`/`development` para banco de produção (checagem de guard no startup: `NODE_ENV === 'production'` se recusa a rodar migrations destrutivas).
- Nenhum dado clínico real em `development`/`staging` (R4); seed gera pacientes fake com CPFs válidos porém sintéticos.
- `vercel.json`/projeto Vercel por ambiente; env vars nomeadas e separadas (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `AES_MASTER_KEY`, `R2_*`, `VAPID_*`, provedores futuros).

## 3. CI/CD

```text
feature/* → PR → checks → merge → develop → deploy development
release/* ou develop → PR → checks → merge → main → deploy production
```

Checks obrigatórios no PR (GitHub Actions):

1. `typecheck` (tsc em todos os workspaces)
2. `lint`
3. `test` (unit + integração com Postgres efêmero)
4. `test:tenant-isolation` (suite dedicada — R3)
5. `prisma migrate diff` (revisão de migrations) + `prisma validate`
6. `build` web + api

Deploy: Vercel conectado ao GitHub; `main` → production, `develop` → preview/development. **Produção roda `prisma migrate deploy` no build com guard de backup recente.** Rollback = redeploy do build anterior; migrations são sempre aditivas (expand/contract) para compatibilidade de N-1.

## 4. Backup e recuperação (§43)

- Banco: PITR no provedor gerenciado (retenção mín. 7 dias, alvo 30), backup lógico semanal externo ao provedor (dump cifrado → R2 bucket de backup).
- R2: versionamento de buckets de documentos; bucket de backup separado.
- Executar restore de teste trimestral (procedimento documentado).
- `docs/discovery` futura: runbook de desastre (`docs/DR.md`) na Fase 9.

## 5. Observabilidade inicial (§44)

- Logs estruturados JSON (request id, tenantId, userId, rota, status, latência).
- Handler de erros central → log único; sem segredos nem dado clínico em logs.
- Vercel Analytics + healthcheck `/api/health` (banco + fila).
- Sentry reservado para Fase 9 (não instalar agora — §44: sem dependências sem necessidade).
