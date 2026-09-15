-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantUserRole" AS ENUM ('ADMIN', 'PROFESSIONAL', 'SECRETARY');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('AGENDADA', 'CONFIRMADA', 'REALIZADA', 'CANCELADA', 'FALTOU', 'REAGENDADA');

-- CreateEnum
CREATE TYPE "SessionModality" AS ENUM ('ONLINE', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CASH', 'CARD', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('CONTRACT', 'PDF', 'IMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'WHATSAPP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SESSION_REMINDER', 'SESSION_CONFIRMATION', 'SESSION_CANCELLED', 'PAYMENT_DUE', 'PAYMENT_RECEIVED', 'ADMINISTRATIVE', 'MARKETING');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('CREATED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "TenantUserRole" NOT NULL,
    "extra_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "revoked_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "active_tenant_id" UUID,
    "refresh_token" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "rotated_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cpf_hash" TEXT,
    "cpf_masked" TEXT,
    "birth_date" DATE,
    "address" JSONB,
    "admin_notes" TEXT,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_contacts" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "emergency_name" TEXT,
    "emergency_phone" TEXT,
    "emergency_relation" TEXT,

    CONSTRAINT "patient_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_records" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "anamnesis_enc" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clinical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_notes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clinical_record_id" UUID NOT NULL,
    "appointmentId" UUID,
    "author_user_id" UUID NOT NULL,
    "content_enc" TEXT NOT NULL,
    "noteType" TEXT NOT NULL DEFAULT 'SESSION',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "professional_user_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "modality" "SessionModality" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_blocks" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "professional_user_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_series" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "professional_user_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "modality" "SessionModality" NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "professional_user_id" UUID NOT NULL,
    "series_id" UUID,
    "rescheduled_from_id" UUID,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "modality" "SessionModality" NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'AGENDADA',
    "admin_notes" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "preferred_weekdays" INTEGER[],
    "preferred_period" TEXT NOT NULL,
    "modality" "SessionModality" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sessions_count" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "valid_for_days" INTEGER,
    "expires_at" TIMESTAMP(3),
    "status" "PackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "receivable_id" UUID,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_sessions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "used_by_id" UUID,
    "used_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),

    CONSTRAINT "package_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_receivables" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "ReceivableStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "account_receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_payables" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" TIMESTAMP(3),
    "status" "PayableStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "account_payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "appointmentId" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "account_receivable_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "templateId" UUID,
    "uploaded_by_user_id" UUID,
    "name" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "checksum" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "userId" UUID,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_queue" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'CREATED',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "last_error" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT,
    "status" "QueueStatus" NOT NULL,
    "error" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "userId" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "template_code" TEXT,
    "body_preview" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "external_id" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_cents" INTEGER,
    "yearly_cents" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "limit_value" INTEGER,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_metrics" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "tenant_users_userId_idx" ON "tenant_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenantId_userId_key" ON "tenant_users"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_key" ON "sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_userId_revoked_at_idx" ON "sessions"("userId", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_tenantId_key_key" ON "settings"("tenantId", "key");

-- CreateIndex
CREATE INDEX "patients_tenantId_name_idx" ON "patients"("tenantId", "name");

-- CreateIndex
CREATE INDEX "patients_tenantId_status_idx" ON "patients"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "patients_tenantId_cpf_hash_key" ON "patients"("tenantId", "cpf_hash");

-- CreateIndex
CREATE INDEX "patient_contacts_patientId_idx" ON "patient_contacts"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_records_patientId_key" ON "clinical_records"("patientId");

-- CreateIndex
CREATE INDEX "clinical_records_tenantId_idx" ON "clinical_records"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_notes_tenantId_clinical_record_id_created_at_idx" ON "clinical_notes"("tenantId", "clinical_record_id", "created_at");

-- CreateIndex
CREATE INDEX "availability_slots_tenantId_professional_user_id_idx" ON "availability_slots"("tenantId", "professional_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "availability_slots_tenantId_professional_user_id_weekday_st_key" ON "availability_slots"("tenantId", "professional_user_id", "weekday", "start_minute");

-- CreateIndex
CREATE INDEX "availability_blocks_tenantId_professional_user_id_starts_at_idx" ON "availability_blocks"("tenantId", "professional_user_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointment_series_tenantId_patientId_idx" ON "appointment_series"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "appointment_series_tenantId_professional_user_id_idx" ON "appointment_series"("tenantId", "professional_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_rescheduled_from_id_key" ON "appointments"("rescheduled_from_id");

-- CreateIndex
CREATE INDEX "appointments_tenantId_starts_at_idx" ON "appointments"("tenantId", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_tenantId_patientId_starts_at_idx" ON "appointments"("tenantId", "patientId", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_tenantId_professional_user_id_starts_at_key" ON "appointments"("tenantId", "professional_user_id", "starts_at");

-- CreateIndex
CREATE INDEX "waitlist_entries_tenantId_isActive_idx" ON "waitlist_entries"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "packages_receivable_id_key" ON "packages"("receivable_id");

-- CreateIndex
CREATE INDEX "packages_tenantId_patientId_idx" ON "packages"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "package_sessions_used_by_id_key" ON "package_sessions"("used_by_id");

-- CreateIndex
CREATE INDEX "package_sessions_tenantId_packageId_idx" ON "package_sessions"("tenantId", "packageId");

-- CreateIndex
CREATE UNIQUE INDEX "package_sessions_packageId_index_key" ON "package_sessions"("packageId", "index");

-- CreateIndex
CREATE INDEX "account_receivables_tenantId_status_due_date_idx" ON "account_receivables"("tenantId", "status", "due_date");

-- CreateIndex
CREATE INDEX "account_receivables_tenantId_patientId_idx" ON "account_receivables"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "account_payables_tenantId_status_due_date_idx" ON "account_payables"("tenantId", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_tenantId_paid_at_idx" ON "payments"("tenantId", "paid_at");

-- CreateIndex
CREATE INDEX "payment_allocations_tenantId_account_receivable_id_idx" ON "payment_allocations"("tenantId", "account_receivable_id");

-- CreateIndex
CREATE INDEX "document_templates_tenantId_status_idx" ON "document_templates"("tenantId", "status");

-- CreateIndex
CREATE INDEX "documents_tenantId_patientId_idx" ON "documents"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_created_at_idx" ON "notifications"("tenantId", "created_at");

-- CreateIndex
CREATE INDEX "notifications_tenantId_patientId_idx" ON "notifications"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_queue_notificationId_key" ON "notification_queue"("notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_queue_idempotency_key_key" ON "notification_queue"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_queue_status_scheduled_for_idx" ON "notification_queue"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "notification_queue_tenantId_idx" ON "notification_queue"("tenantId");

-- CreateIndex
CREATE INDEX "notification_deliveries_tenantId_notificationId_idx" ON "notification_deliveries"("tenantId", "notificationId");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE INDEX "notification_preferences_tenantId_idx" ON "notification_preferences"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_tenantId_patientId_userId_channel__key" ON "notification_preferences"("tenantId", "patientId", "userId", "channel", "category");

-- CreateIndex
CREATE INDEX "communication_logs_tenantId_patientId_created_at_idx" ON "communication_logs"("tenantId", "patientId", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenantId_userId_idx" ON "push_subscriptions"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_planId_feature_key" ON "plan_features"("planId", "feature");

-- CreateIndex
CREATE INDEX "subscriptions_tenantId_status_idx" ON "subscriptions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "usage_metrics_tenantId_period_idx" ON "usage_metrics"("tenantId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "usage_metrics_tenantId_metric_period_key" ON "usage_metrics"("tenantId", "metric", "period");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_created_at_idx" ON "audit_logs"("tenantId", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_userId_created_at_idx" ON "audit_logs"("userId", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_tenant_id_fkey" FOREIGN KEY ("active_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_contacts" ADD CONSTRAINT "patient_contacts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_clinical_record_id_fkey" FOREIGN KEY ("clinical_record_id") REFERENCES "clinical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_professional_user_id_fkey" FOREIGN KEY ("professional_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "appointment_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "account_receivables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_sessions" ADD CONSTRAINT "package_sessions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_sessions" ADD CONSTRAINT "package_sessions_used_by_id_fkey" FOREIGN KEY ("used_by_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_receivables" ADD CONSTRAINT "account_receivables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_receivables" ADD CONSTRAINT "account_receivables_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_payables" ADD CONSTRAINT "account_payables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_account_receivable_id_fkey" FOREIGN KEY ("account_receivable_id") REFERENCES "account_receivables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

