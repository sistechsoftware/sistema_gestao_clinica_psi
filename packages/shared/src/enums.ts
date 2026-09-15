// ============================================================================
// Enums de domínio compartilhados (frontend + backend) — espelham o schema
// Prisma. Alterações no schema devem ser refletidas aqui.
// ============================================================================

export type TenantUserRole = 'ADMIN' | 'PROFESSIONAL' | 'SECRETARY';
export type PermissionEffect = 'ALLOW' | 'DENY';
export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type AppointmentStatus =
  'AGENDADA' | 'CONFIRMADA' | 'REALIZADA' | 'CANCELADA' | 'FALTOU' | 'REAGENDADA';
export type SessionModality = 'ONLINE' | 'IN_PERSON';
export type PackageStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
export type PaymentMethod = 'PIX' | 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
export type ReceivableStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type PayableStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type DocumentKind = 'CONTRACT' | 'PDF' | 'IMAGE' | 'OTHER';
export type TemplateStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type NotificationChannel = 'PUSH' | 'WHATSAPP' | 'SMS' | 'EMAIL';
export type NotificationCategory =
  | 'SESSION_REMINDER'
  | 'SESSION_CONFIRMATION'
  | 'SESSION_CANCELLED'
  | 'PAYMENT_DUE'
  | 'PAYMENT_RECEIVED'
  | 'ADMINISTRATIVE'
  | 'MARKETING';
export type QueueStatus = 'CREATED' | 'PROCESSING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
export type PlanInterval = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

export const PATIENT_STATUSES: readonly PatientStatus[] = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'AGENDADA',
  'CONFIRMADA',
  'REALIZADA',
  'CANCELADA',
  'FALTOU',
  'REAGENDADA',
];
/** Status que ocupam a janela do profissional (unique parcial, R9). */
export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ['AGENDADA', 'CONFIRMADA'];
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'PIX',
  'CASH',
  'CARD',
  'TRANSFER',
  'OTHER',
];
export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = [
  'PUSH',
  'WHATSAPP',
  'SMS',
  'EMAIL',
];
