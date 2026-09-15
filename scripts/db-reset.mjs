// Reset destrutivo — SOMENTE local (doc 04 §5; §8 do Prompt Mestre).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const appEnv = process.env.APP_ENV ?? 'local';
if (appEnv !== 'local') {
  console.error(`ABORTADO: db:reset só pode rodar com APP_ENV=local (atual: ${appEnv})`);
  process.exit(1);
}

try {
  console.log('Apagando dados (ordem segura de dependências)...');
  const tables = [
    'audit_logs',
    'usage_metrics',
    'subscriptions',
    'plan_features',
    'plans',
    'push_subscriptions',
    'communication_logs',
    'notification_preferences',
    'notification_deliveries',
    'notification_queue',
    'notifications',
    'documents',
    'document_templates',
    'payment_allocations',
    'payments',
    'account_payables',
    'account_receivables',
    'package_sessions',
    'packages',
    'waitlist_entries',
    'appointments',
    'appointment_series',
    'availability_blocks',
    'availability_slots',
    'clinical_notes',
    'clinical_records',
    'patient_contacts',
    'patients',
    'settings',
    'password_reset_tokens',
    'sessions',
    'tenant_users',
    'tenants',
    'role_permissions',
    'roles',
    'permissions',
    'users',
  ];
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE`,
  );
  console.log('Banco local zerado. Rode `npm run db:seed` para repopular.');
} finally {
  await prisma.$disconnect();
}
