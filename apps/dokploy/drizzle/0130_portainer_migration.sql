-- Portainer Migration Tool Tables
-- This migration adds tables for tracking Portainer to Dokploy migrations

-- Create enums for migration source type
DO $$ BEGIN
    CREATE TYPE "migrationSourceType" AS ENUM('api', 'boltdb');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Create enums for migration status
DO $$ BEGIN
    CREATE TYPE "migrationStatus" AS ENUM('pending', 'analyzing', 'ready', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Create enums for migration item status
DO $$ BEGIN
    CREATE TYPE "migrationItemStatus" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Create enums for migration item type
DO $$ BEGIN
    CREATE TYPE "migrationItemType" AS ENUM('endpoint', 'stack', 'registry', 'user', 'team', 'environment_variable', 'volume', 'network');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Create the main portainer migration table
CREATE TABLE IF NOT EXISTS "portainer_migration" (
    "migrationId" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "sourceType" "migrationSourceType" NOT NULL,
    "portainerUrl" text,
    "portainerApiKey" text,
    "portainerUsername" text,
    "portainerPassword" text,
    "boltDbPath" text,
    "stackFilesPath" text,
    "isDryRun" boolean DEFAULT true NOT NULL,
    "migrateStacks" boolean DEFAULT true NOT NULL,
    "migrateRegistries" boolean DEFAULT true NOT NULL,
    "migrateUsers" boolean DEFAULT false NOT NULL,
    "migrateEndpoints" boolean DEFAULT true NOT NULL,
    "migrateEnvironmentVariables" boolean DEFAULT true NOT NULL,
    "autoDeployAfterMigration" boolean DEFAULT false NOT NULL,
    "targetProjectId" text,
    "targetEnvironmentId" text,
    "targetServerId" text,
    "status" "migrationStatus" DEFAULT 'pending' NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "currentStep" text,
    "analysisResult" jsonb,
    "migrationMapping" jsonb,
    "createdAt" text NOT NULL,
    "startedAt" text,
    "completedAt" text,
    "errorMessage" text,
    "errorDetails" jsonb,
    "organizationId" text NOT NULL
);--> statement-breakpoint

-- Create the portainer migration log table
CREATE TABLE IF NOT EXISTS "portainer_migration_log" (
    "logId" text PRIMARY KEY NOT NULL,
    "migrationId" text NOT NULL,
    "level" text DEFAULT 'info' NOT NULL,
    "message" text NOT NULL,
    "details" jsonb,
    "itemType" "migrationItemType",
    "itemId" text,
    "itemName" text,
    "status" "migrationItemStatus",
    "timestamp" text NOT NULL
);--> statement-breakpoint

-- Create the portainer migration item table
CREATE TABLE IF NOT EXISTS "portainer_migration_item" (
    "itemId" text PRIMARY KEY NOT NULL,
    "migrationId" text NOT NULL,
    "itemType" "migrationItemType" NOT NULL,
    "portainerId" text NOT NULL,
    "portainerName" text NOT NULL,
    "sourceData" jsonb,
    "transformedData" jsonb,
    "dokployId" text,
    "dokployType" text,
    "status" "migrationItemStatus" DEFAULT 'pending' NOT NULL,
    "errorMessage" text,
    "createdAt" text NOT NULL,
    "processedAt" text
);--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "portainer_migration" ADD CONSTRAINT "portainer_migration_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "portainer_migration_log" ADD CONSTRAINT "portainer_migration_log_migrationId_portainer_migration_migrationId_fk" FOREIGN KEY ("migrationId") REFERENCES "public"."portainer_migration"("migrationId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "portainer_migration_item" ADD CONSTRAINT "portainer_migration_item_migrationId_portainer_migration_migrationId_fk" FOREIGN KEY ("migrationId") REFERENCES "public"."portainer_migration"("migrationId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_portainer_migration_org" ON "portainer_migration" ("organizationId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portainer_migration_status" ON "portainer_migration" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portainer_migration_log_migration" ON "portainer_migration_log" ("migrationId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portainer_migration_log_level" ON "portainer_migration_log" ("level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portainer_migration_item_migration" ON "portainer_migration_item" ("migrationId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portainer_migration_item_status" ON "portainer_migration_item" ("status");
