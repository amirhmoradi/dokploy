/**
 * Database Connection and Setup
 */

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema.js";
import { config } from "../config.js";
import * as fs from "fs";
import * as path from "path";

// Ensure data directory exists
const dataDir = path.dirname(config.databasePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite database connection
const sqlite = new Database(config.databasePath);

// Enable WAL mode for better concurrent access
sqlite.pragma("journal_mode = WAL");

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

// Export schema for use elsewhere
export * from "./schema.js";

/**
 * Initialize database with tables
 */
export function initializeDatabase(): void {
  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source_type TEXT NOT NULL CHECK (source_type IN ('api', 'boltdb')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'ready', 'running', 'completed', 'failed', 'cancelled')),
      progress INTEGER NOT NULL DEFAULT 0,
      current_step TEXT,
      portainer_url TEXT,
      portainer_api_key TEXT,
      portainer_username TEXT,
      portainer_password TEXT,
      boltdb_path TEXT,
      stack_files_path TEXT,
      is_dry_run INTEGER NOT NULL DEFAULT 1,
      migrate_stacks INTEGER NOT NULL DEFAULT 1,
      migrate_registries INTEGER NOT NULL DEFAULT 1,
      migrate_endpoints INTEGER NOT NULL DEFAULT 1,
      migrate_environment_variables INTEGER NOT NULL DEFAULT 1,
      migrate_users INTEGER NOT NULL DEFAULT 0,
      auto_deploy_after_migration INTEGER NOT NULL DEFAULT 0,
      target_project_id TEXT,
      target_environment_id TEXT,
      target_server_id TEXT,
      analysis_result TEXT,
      migration_mapping TEXT,
      error_message TEXT,
      error_details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS migration_items (
      id TEXT PRIMARY KEY,
      migration_id TEXT NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK (item_type IN ('endpoint', 'stack', 'registry', 'user', 'team', 'environment_variable', 'volume', 'network')),
      portainer_id TEXT NOT NULL,
      portainer_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
      source_data TEXT,
      transformed_data TEXT,
      dokploy_id TEXT,
      dokploy_type TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS migration_logs (
      id TEXT PRIMARY KEY,
      migration_id TEXT NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
      level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error')),
      message TEXT NOT NULL,
      details TEXT,
      item_type TEXT,
      item_id TEXT,
      item_name TEXT,
      item_status TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id TEXT PRIMARY KEY,
      license_key TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('trial', 'standard', 'professional', 'enterprise')),
      holder TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      features TEXT,
      max_migrations INTEGER,
      max_stacks INTEGER,
      is_valid INTEGER NOT NULL DEFAULT 1,
      activated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_validated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_migration_items_migration_id ON migration_items(migration_id);
    CREATE INDEX IF NOT EXISTS idx_migration_logs_migration_id ON migration_logs(migration_id);
    CREATE INDEX IF NOT EXISTS idx_migration_logs_timestamp ON migration_logs(timestamp);
  `);
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  sqlite.close();
}
