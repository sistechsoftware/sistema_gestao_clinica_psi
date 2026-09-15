// ============================================================================
// Permissões — fonte única do RBAC (doc 02 §3; §11 do Prompt Mestre)
// Formato: <recurso>:<ação>. Toda checagem de acesso usa estes códigos.
// ============================================================================

export const PERMISSIONS = [
  // Pacientes
  'patients:read',
  'patients:create',
  'patients:update',
  'patients:delete',

  // Clínico (prontuário — leitura isolada de patients:read, §11)
  'clinical:read',
  'clinical:create',
  'clinical:update',
  'clinical:delete',

  // Agenda
  'appointments:read',
  'appointments:create',
  'appointments:update',
  'appointments:delete',

  // Pacotes
  'packages:read',
  'packages:create',
  'packages:update',
  'packages:delete',

  // Financeiro
  'finance:read',
  'finance:create',
  'finance:update',
  'finance:delete',

  // Documentos
  'documents:read',
  'documents:create',
  'documents:update',
  'documents:delete',

  // Notificações
  'notifications:read',
  'notifications:manage',

  // Configurações do tenant
  'settings:read',
  'settings:manage',

  // Usuários / RBAC do tenant
  'users:read',
  'users:manage',
  'roles:read',
  'roles:manage',

  // Auditoria
  'audit:read',

  // Plataforma (Super Admin, global — R10)
  'platform:manage',
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

/**
 * Permissões que expõem dados de saúde — acesso excepcional deve ser
 * registrado em auditoria (§11, §34).
 */
export const SENSITIVE_PERMISSIONS: readonly PermissionCode[] = [
  'clinical:read',
  'clinical:create',
  'clinical:update',
  'clinical:delete',
] satisfies readonly PermissionCode[];

// Permissões por papel padrão (semeadas em prisma/seed.mjs; §11)
export const ROLE_DEFAULT_PERMISSIONS: Record<
  'ADMIN' | 'PROFESSIONAL' | 'SECRETARY',
  readonly PermissionCode[]
> = {
  ADMIN: PERMISSIONS.filter((p) => p !== 'platform:manage'),
  PROFESSIONAL: [
    'patients:read',
    'patients:create',
    'patients:update',
    'clinical:read',
    'clinical:create',
    'clinical:update',
    'appointments:read',
    'appointments:create',
    'appointments:update',
    'appointments:delete',
    'packages:read',
    'packages:create',
    'packages:update',
    'finance:read',
    'documents:read',
    'documents:create',
    'notifications:read',
    'settings:read',
    'audit:read',
  ],
  SECRETARY: [
    'patients:read',
    'patients:create',
    'patients:update',
    'appointments:read',
    'appointments:create',
    'appointments:update',
    'packages:read',
    'finance:read',
    'finance:create',
    'finance:update',
    'documents:read',
    'documents:create',
    'notifications:read',
    'settings:read',
  ],
};
