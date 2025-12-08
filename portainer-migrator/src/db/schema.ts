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
