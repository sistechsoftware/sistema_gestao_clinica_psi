import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase letters, digits and hyphens'),
  timezone: z.string().default('America/Sao_Paulo'),
});

export const updateTenantSchema = createTenantSchema.partial();

export const addTenantUserSchema = z.object({
  email: z.email(),
  name: z.string().min(2).max(120),
  role: z.enum(['ADMIN', 'PROFESSIONAL', 'SECRETARY']),
  password: z.string().min(10).max(200),
});

export const updateTenantUserSchema = z.object({
  role: z.enum(['ADMIN', 'PROFESSIONAL', 'SECRETARY']).optional(),
  isActive: z.boolean().optional(),
  extraPerms: z.array(z.string()).optional(),
  revokedPerms: z.array(z.string()).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type AddTenantUserInput = z.infer<typeof addTenantUserSchema>;
export type UpdateTenantUserInput = z.infer<typeof updateTenantUserSchema>;
