/**
 * Database Schema using Drizzle ORM with SQLite
 */

import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Migrations table
export const migrations = sqliteTable("migrations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sourceType: text("source_type", { enum: ["api", "boltdb"] }).notNull(),
  status: text("status", {
    enum: ["pending", "analyzing", "ready", "running", "completed", "failed", "cancelled"],
  })
    .notNull()
    .default("pending"),
  progress: integer("progress").notNull().default(0),
  currentStep: text("current_step"),

  // Source configuration (encrypted)
  portainerUrl: text("portainer_url"),
  portainerApiKey: text("portainer_api_key"),
  portainerUsername: text("portainer_username"),
  portainerPassword: text("portainer_password"),
  boltDbPath: text("boltdb_path"),
  stackFilesPath: text("stack_files_path"),

  // Options
  isDryRun: integer("is_dry_run", { mode: "boolean" }).notNull().default(true),
  migrateStacks: integer("migrate_stacks", { mode: "boolean" }).notNull().default(true),
  migrateRegistries: integer("migrate_registries", { mode: "boolean" }).notNull().default(true),
  migrateEndpoints: integer("migrate_endpoints", { mode: "boolean" }).notNull().default(true),
  migrateEnvironmentVariables: integer("migrate_environment_variables", { mode: "boolean" })
    .notNull()
    .default(true),
  migrateUsers: integer("migrate_users", { mode: "boolean" }).notNull().default(false),
  autoDeployAfterMigration: integer("auto_deploy_after_migration", { mode: "boolean" })
    .notNull()
    .default(false),

  // Target
  targetProjectId: text("target_project_id"),
  targetEnvironmentId: text("target_environment_id"),
  targetServerId: text("target_server_id"),

  // Results (stored as JSON)
  analysisResult: text("analysis_result", { mode: "json" }),
  migrationMapping: text("migration_mapping", { mode: "json" }),
  errorMessage: text("error_message"),
  errorDetails: text("error_details", { mode: "json" }),

  // Timestamps
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
});

// Migration items table
export const migrationItems = sqliteTable("migration_items", {
  id: text("id").primaryKey(),
  migrationId: text("migration_id")
    .notNull()
    .references(() => migrations.id, { onDelete: "cascade" }),
  itemType: text("item_type", {
    enum: ["endpoint", "stack", "registry", "user", "team", "environment_variable", "volume", "network"],
  }).notNull(),
  portainerId: text("portainer_id").notNull(),
  portainerName: text("portainer_name").notNull(),
  status: text("status", {
    enum: ["pending", "in_progress", "completed", "failed", "skipped"],
  })
    .notNull()
    .default("pending"),

  // Data (stored as JSON)
  sourceData: text("source_data", { mode: "json" }),
  transformedData: text("transformed_data", { mode: "json" }),

  // Result
  dokployId: text("dokploy_id"),
  dokployType: text("dokploy_type"),
  errorMessage: text("error_message"),

  // Timestamps
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  processedAt: text("processed_at"),
});

// Migration logs table
export const migrationLogs = sqliteTable("migration_logs", {
  id: text("id").primaryKey(),
  migrationId: text("migration_id")
    .notNull()
    .references(() => migrations.id, { onDelete: "cascade" }),
  level: text("level", { enum: ["debug", "info", "warning", "error"] }).notNull(),
  message: text("message").notNull(),
  details: text("details", { mode: "json" }),

  // Item context (optional)
  itemType: text("item_type"),
  itemId: text("item_id"),
  itemName: text("item_name"),
  itemStatus: text("item_status"),

  // Timestamp
  timestamp: text("timestamp")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// License table
export const licenses = sqliteTable("licenses", {
  id: text("id").primaryKey(),
  licenseKey: text("license_key").notNull().unique(),
  type: text("type", { enum: ["trial", "standard", "professional", "enterprise"] }).notNull(),
  holder: text("holder").notNull(),
  email: text("email").notNull(),
  expiresAt: text("expires_at").notNull(),
  features: text("features", { mode: "json" }),
  maxMigrations: integer("max_migrations"),
  maxStacks: integer("max_stacks"),
  isValid: integer("is_valid", { mode: "boolean" }).notNull().default(true),
  activatedAt: text("activated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  lastValidatedAt: text("last_validated_at"),
});

// Settings table
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================================
// v1.1.0 - Notification System
// ============================================================================

export const notificationConfigs = sqliteTable("notification_configs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel", {
    enum: ["email", "webhook", "slack", "discord", "teams"]
  }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  events: text("events", { mode: "json" }).notNull(), // NotificationEvent[]
  config: text("config", { mode: "json" }).notNull(), // Channel-specific config
  templateId: text("template_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const notificationTemplates = sqliteTable("notification_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  event: text("event").notNull(),
  subject: text("subject"),
  bodyTemplate: text("body_template").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const notificationHistory = sqliteTable("notification_history", {
  id: text("id").primaryKey(),
  configId: text("config_id").references(() => notificationConfigs.id),
  event: text("event").notNull(),
  channel: text("channel").notNull(),
  recipient: text("recipient"),
  subject: text("subject"),
  body: text("body"),
  status: text("status", { enum: ["pending", "sent", "failed"] }).notNull(),
  errorMessage: text("error_message"),
  sentAt: text("sent_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================================
// v1.2.0 - Scheduled Migrations
// ============================================================================

export const scheduledMigrations = sqliteTable("scheduled_migrations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  migrationConfigId: text("migration_config_id"), // Template migration config (JSON)
  migrationConfig: text("migration_config", { mode: "json" }), // Full config as JSON
  frequency: text("frequency", {
    enum: ["once", "hourly", "daily", "weekly", "monthly", "cron"],
  }).notNull(),
  cronExpression: text("cron_expression"),
  scheduledAt: text("scheduled_at"), // For "once" frequency
  timezone: text("timezone").notNull().default("UTC"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: text("last_run_at"),
  nextRunAt: text("next_run_at"),
  runCount: integer("run_count").notNull().default(0),
  maxRuns: integer("max_runs"),
  retryOnFailure: integer("retry_on_failure", { mode: "boolean" }).notNull().default(true),
  maxRetries: integer("max_retries").notNull().default(3),
  maintenanceWindow: text("maintenance_window", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const scheduledMigrationRuns = sqliteTable("scheduled_migration_runs", {
  id: text("id").primaryKey(),
  scheduleId: text("schedule_id")
    .notNull()
    .references(() => scheduledMigrations.id, { onDelete: "cascade" }),
  migrationId: text("migration_id"),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed", "skipped"],
  }).notNull(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================================
// v1.2.0 - Backup & Restore
// ============================================================================

export const backups = sqliteTable("backups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["full", "migration", "config"] }).notNull(),
  description: text("description"),
  migrationId: text("migration_id"),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  checksum: text("checksum").notNull(),
  encrypted: integer("encrypted", { mode: "boolean" }).notNull().default(false),
  compressionType: text("compression_type", {
    enum: ["none", "gzip", "zip"]
  }).notNull().default("gzip"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  expiresAt: text("expires_at"),
});

export const snapshots = sqliteTable("snapshots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  migrationId: text("migration_id")
    .notNull()
    .references(() => migrations.id, { onDelete: "cascade" }),
  phase: text("phase", { enum: ["pre-migration", "post-migration"] }).notNull(),
  portainerState: text("portainer_state", { mode: "json" }),
  dokployState: text("dokploy_state", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================================
// v1.2.0 - Advanced Reporting
// ============================================================================

export const reportTemplates = sqliteTable("report_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type", {
    enum: ["migration", "comparison", "audit", "compliance", "trend"],
  }).notNull(),
  format: text("format", { enum: ["json", "pdf", "csv", "html"] }).notNull(),
  template: text("template").notNull(),
  styles: text("styles"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const generatedReports = sqliteTable("generated_reports", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  templateId: text("template_id").references(() => reportTemplates.id),
  config: text("config", { mode: "json" }),
  format: text("format", { enum: ["json", "pdf", "csv", "html"] }).notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  generatedAt: text("generated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  expiresAt: text("expires_at"),
});

// ============================================================================
// v1.2.0 - Audit & Compliance
// ============================================================================

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp")
    .notNull()
    .default(sql`(datetime('now'))`),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  resourceName: text("resource_name"),
  userId: text("user_id"),
  userEmail: text("user_email"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  oldValue: text("old_value", { mode: "json" }),
  newValue: text("new_value", { mode: "json" }),
  result: text("result", { enum: ["success", "failure"] }).notNull(),
  errorMessage: text("error_message"),
  metadata: text("metadata", { mode: "json" }),
});

export const dataRetentionPolicies = sqliteTable("data_retention_policies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  resourceType: text("resource_type", {
    enum: ["migrations", "logs", "backups", "reports", "audits"],
  }).notNull(),
  retentionDays: integer("retention_days").notNull(),
  action: text("action", { enum: ["delete", "archive", "anonymize"] }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: text("last_run_at"),
  nextRunAt: text("next_run_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================================
// v1.2.0 - Multi-Instance Support
// ============================================================================

export const portainerInstances = sqliteTable("portainer_instances", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  apiKey: text("api_key"),
  username: text("username"),
  password: text("password"),
  boltDbPath: text("boltdb_path"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastSyncAt: text("last_sync_at"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================================
// v2.0.0 - Plugin System
// ============================================================================

export const plugins = sqliteTable("plugins", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description"),
  author: text("author"),
  homepage: text("homepage"),
  repository: text("repository"),
  license: text("license"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  config: text("config", { mode: "json" }),
  hooks: text("hooks", { mode: "json" }),
  installedAt: text("installed_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const pluginStorage = sqliteTable("plugin_storage", {
  id: text("id").primaryKey(),
  pluginId: text("plugin_id")
    .notNull()
    .references(() => plugins.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================================
// v2.0.0 - Integration Hub
// ============================================================================

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["github-actions", "gitlab-ci", "jenkins", "circleci", "azure-devops", "custom"],
  }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  config: text("config", { mode: "json" }),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================================
// v2.0.0 - Kubernetes Support
// ============================================================================

export const kubernetesResources = sqliteTable("kubernetes_resources", {
  id: text("id").primaryKey(),
  migrationId: text("migration_id")
    .notNull()
    .references(() => migrations.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // Deployment, Service, ConfigMap, Secret, etc.
  apiVersion: text("api_version").notNull(),
  namespace: text("namespace"),
  name: text("name").notNull(),
  spec: text("spec", { mode: "json" }),
  status: text("status", {
    enum: ["pending", "in_progress", "completed", "failed", "skipped"],
  }).notNull().default("pending"),
  transformedData: text("transformed_data", { mode: "json" }),
  dokployId: text("dokploy_id"),
  errorMessage: text("error_message"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  processedAt: text("processed_at"),
});

// ============================================================================
// v2.0.0 - Edge Agent Support
// ============================================================================

export const edgeGroups = sqliteTable("edge_groups", {
  id: text("id").primaryKey(),
  migrationId: text("migration_id")
    .notNull()
    .references(() => migrations.id, { onDelete: "cascade" }),
  portainerId: integer("portainer_id").notNull(),
  name: text("name").notNull(),
  dynamic: integer("dynamic", { mode: "boolean" }).notNull().default(false),
  tagIds: text("tag_ids", { mode: "json" }),
  endpoints: text("endpoints", { mode: "json" }),
  status: text("status", {
    enum: ["pending", "in_progress", "completed", "failed", "skipped"],
  }).notNull().default("pending"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const edgeStacks = sqliteTable("edge_stacks", {
  id: text("id").primaryKey(),
  migrationId: text("migration_id")
    .notNull()
    .references(() => migrations.id, { onDelete: "cascade" }),
  portainerId: integer("portainer_id").notNull(),
  name: text("name").notNull(),
  edgeGroups: text("edge_groups", { mode: "json" }),
  projectPath: text("project_path"),
  entryPoint: text("entry_point"),
  composeFile: text("compose_file"),
  status: text("status", {
    enum: ["pending", "in_progress", "completed", "failed", "skipped"],
  }).notNull().default("pending"),
  transformedData: text("transformed_data", { mode: "json" }),
  dokployId: text("dokploy_id"),
  errorMessage: text("error_message"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  processedAt: text("processed_at"),
});

// ============================================================================
// Extended Migrations table (add new fields)
// ============================================================================

export const migrationsExtended = sqliteTable("migrations_extended", {
  migrationId: text("migration_id")
    .primaryKey()
    .references(() => migrations.id, { onDelete: "cascade" }),

  // v1.1.0 - Selective Migration
  selectionCriteria: text("selection_criteria", { mode: "json" }),

  // v1.1.0 - Advanced Mapping
  mappingConfig: text("mapping_config", { mode: "json" }),

  // v1.2.0 - Multi-Instance
  sourceInstances: text("source_instances", { mode: "json" }),
  multiInstanceConfig: text("multi_instance_config", { mode: "json" }),

  // v1.2.0 - Scheduling
  scheduleId: text("schedule_id"),

  // v1.2.0 - Backup
  preBackupId: text("pre_backup_id"),
  postSnapshotId: text("post_snapshot_id"),

  // v2.0.0 - Kubernetes
  kubernetesConfig: text("kubernetes_config", { mode: "json" }),

  // v2.0.0 - Edge
  edgeConfig: text("edge_config", { mode: "json" }),

  // v2.0.0 - Multi-Platform
  platformConfig: text("platform_config", { mode: "json" }),

  // Performance
  parallelism: integer("parallelism").default(1),
  batchSize: integer("batch_size").default(10),
});

// Export types
export type Migration = typeof migrations.$inferSelect;
export type NewMigration = typeof migrations.$inferInsert;
export type MigrationItem = typeof migrationItems.$inferSelect;
export type NewMigrationItem = typeof migrationItems.$inferInsert;
export type MigrationLog = typeof migrationLogs.$inferSelect;
export type NewMigrationLog = typeof migrationLogs.$inferInsert;
export type License = typeof licenses.$inferSelect;
export type NewLicense = typeof licenses.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

// v1.1.0
export type NotificationConfigDB = typeof notificationConfigs.$inferSelect;
export type NewNotificationConfig = typeof notificationConfigs.$inferInsert;
export type NotificationTemplateDB = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;

// v1.2.0
export type ScheduledMigrationDB = typeof scheduledMigrations.$inferSelect;
export type NewScheduledMigration = typeof scheduledMigrations.$inferInsert;
export type BackupDB = typeof backups.$inferSelect;
export type NewBackup = typeof backups.$inferInsert;
export type SnapshotDB = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;
export type ReportTemplateDB = typeof reportTemplates.$inferSelect;
export type NewReportTemplate = typeof reportTemplates.$inferInsert;
export type GeneratedReportDB = typeof generatedReports.$inferSelect;
export type NewGeneratedReport = typeof generatedReports.$inferInsert;
export type AuditLogDB = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type PortainerInstanceDB = typeof portainerInstances.$inferSelect;
export type NewPortainerInstance = typeof portainerInstances.$inferInsert;

// v2.0.0
export type PluginDB = typeof plugins.$inferSelect;
export type NewPlugin = typeof plugins.$inferInsert;
export type IntegrationDB = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type KubernetesResourceDB = typeof kubernetesResources.$inferSelect;
export type NewKubernetesResource = typeof kubernetesResources.$inferInsert;
export type EdgeGroupDB = typeof edgeGroups.$inferSelect;
export type NewEdgeGroup = typeof edgeGroups.$inferInsert;
export type EdgeStackDB = typeof edgeStacks.$inferSelect;
export type NewEdgeStack = typeof edgeStacks.$inferInsert;
export type MigrationExtendedDB = typeof migrationsExtended.$inferSelect;
export type NewMigrationExtended = typeof migrationsExtended.$inferInsert;
