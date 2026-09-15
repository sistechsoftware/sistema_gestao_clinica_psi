// ============================================================================
// Seed inicial (doc 04 §6). Idempotente — pode rodar várias vezes.
// Uso: npm run db:seed
// ============================================================================
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '../packages/shared/dist/permissions.js';

// Convenção do monorepo: rodar `npm run build` garante packages/shared/dist.
// Se o build não rodou ainda, cuidamos disso aqui (uma vez, cache-friendly).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const permissionsModule = path.join(__dirname, '../packages/shared/dist/permissions.js');
if (!existsSync(permissionsModule)) {
  console.warn('[seed] packages/shared não compilado — compilando...');
  const result = spawnSync('npm', ['run', 'build', '-w', '@psa/shared'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error('Falha ao compilar packages/shared');
}

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

async function seedPermissions() {
  for (const code of PERMISSIONS) {
    const sensitive = code.startsWith('clinical:');
    await prisma.permission.upsert({
      where: { code },
      update: { isSensitive: sensitive },
      create: { code, isSensitive: sensitive },
    });
  }
  console.log(`permissions: ${PERMISSIONS.length} ok`);
}

async function seedRoles() {
  const roles = [
    ['ADMIN', 'Administrador', 'Administra o tenant: usuários, financeiro e configurações'],
    ['PROFESSIONAL', 'Profissional', 'Psicanalista que atende pacientes'],
    ['SECRETARY', 'Secretária', 'Operação de agenda, pacientes e cobranças'],
  ];
  const allPerms = await prisma.permission.findMany();
  const byCode = new Map(allPerms.map((p) => [p.code, p.id]));

  for (const [key, name, description] of roles) {
    const role = await prisma.role.upsert({
      where: { key },
      update: { name, description, isSystem: true },
      create: { key, name, description, isSystem: true },
    });
    const codes = ROLE_DEFAULT_PERMISSIONS[key] ?? [];
    for (const code of codes) {
      const permissionId = byCode.get(code);
      if (!permissionId) throw new Error(`permission not seeded: ${code}`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
    console.log(`role ${key}: ${codes.length} permissões`);
  }
}

async function seedPlans() {
  const plans = [
    {
      key: 'FREE',
      name: 'Free',
      monthlyCents: 0,
      yearlyCents: 0,
      features: { max_patients: 30, max_users: 1, storage_mb: 512 },
    },
    {
      key: 'BASIC',
      name: 'Basic',
      monthlyCents: 4900,
      yearlyCents: 47000,
      features: { max_patients: 150, max_users: 2, storage_mb: 2048 },
    },
    {
      key: 'PROFESSIONAL',
      name: 'Professional',
      monthlyCents: 9900,
      yearlyCents: 95000,
      features: { max_patients: 500, max_users: 5, storage_mb: 10240 },
    },
    {
      key: 'BUSINESS',
      name: 'Business',
      monthlyCents: 19900,
      yearlyCents: 191000,
      features: { max_patients: 2000, max_users: 15, storage_mb: 51200 },
    },
    { key: 'ENTERPRISE', name: 'Enterprise', monthlyCents: null, yearlyCents: null, features: {} },
  ];
  for (const p of plans) {
    const plan = await prisma.plan.upsert({
      where: { key: p.key },
      update: { name: p.name, monthlyCents: p.monthlyCents, yearlyCents: p.yearlyCents },
      create: {
        key: p.key,
        name: p.name,
        monthlyCents: p.monthlyCents,
        yearlyCents: p.yearlyCents,
      },
    });
    for (const [feature, limitValue] of Object.entries(p.features)) {
      await prisma.planFeature.upsert({
        where: { planId_feature: { planId: plan.id, feature } },
        update: { limitValue },
        create: { planId: plan.id, feature, limitValue },
      });
    }
  }
  console.log(`plans: ${plans.length} ok`);
}

async function seedDemoTenant() {
  const slug = 'demo';
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    console.log('tenant demo: já existe (seed idempotente)');
    return;
  }

  const password = await bcrypt.hash(
    process.env.SEED_DEMO_PASSWORD ?? 'TroqueEstaSenha!2026',
    BCRYPT_ROUNDS,
  );
  const users = [
    { email: 'admin@demo.local', name: 'Ana Admin', role: 'ADMIN' },
    { email: 'profissional@demo.local', name: 'Paulo Psicanalista', role: 'PROFESSIONAL' },
    { email: 'secretaria@demo.local', name: 'Sara Secretária', role: 'SECRETARY' },
  ];

  const tenant = await prisma.tenant.create({
    data: { name: 'Clínica Demo', slug, timezone: 'America/Sao_Paulo' },
  });

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, passwordHash: password },
    });
    await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      update: { role: u.role },
      create: { tenantId: tenant.id, userId: user.id, role: u.role },
    });
  }

  const freePlan = await prisma.plan.findUnique({ where: { key: 'PROFESSIONAL' } });
  if (freePlan) {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: freePlan.id,
        status: 'TRIALING',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('tenant demo criado — admin@demo.local / TroqueEstaSenha!2026');
}

try {
  await seedPermissions();
  await seedRoles();
  await seedPlans();
  await seedDemoTenant();
  console.log('seed concluído');
} catch (err) {
  console.error('seed falhou:', err instanceof Error ? err.message : err);
  if (
    err instanceof Error &&
    'code' in err &&
    typeof err.code === 'string' &&
    err.code === 'P1001'
  ) {
    console.error('\nBanco inacessível. Suba o Postgres local primeiro:  npm run db:up');
  }
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
