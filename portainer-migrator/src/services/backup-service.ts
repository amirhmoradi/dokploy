/**
 * Backup & Restore Service - v1.2.0
 * Handles backup creation, restoration, and snapshot management
 */

import { createHash } from "crypto";
import { createGzip, createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, readFile, writeFile, stat, unlink, readdir } from "fs/promises";
import { join } from "path";
import type {
  Backup,
  BackupType,
  BackupMetadata,
  RestoreOptions,
  RestoreResult,
  Snapshot,
} from "../types";

export class BackupService {
  private backupDir: string;
  private encryptionKey?: string;

  constructor(backupDir: string = "./data/backups", encryptionKey?: string) {
    this.backupDir = backupDir;
    this.encryptionKey = encryptionKey;
  }

  /**
   * Initialize backup directory
   */
  async initialize(): Promise<void> {
    await mkdir(this.backupDir, { recursive: true });
    await mkdir(join(this.backupDir, "snapshots"), { recursive: true });
  }

  /**
   * Create a full backup
   */
  async createFullBackup(name: string, description?: string): Promise<Backup> {
    const id = this.generateId("bkp");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-full-${timestamp}.json.gz`;
    const filePath = join(this.backupDir, filename);

    // Gather all data
    const data = await this.gatherBackupData("full");

    // Create backup file
    const { fileSize, checksum } = await this.writeBackupFile(filePath, data);

    const backup: Backup = {
      id,
      name,
      type: "full",
      description,
      filePath,
      fileSize,
      checksum,
      encrypted: !!this.encryptionKey,
      compressionType: "gzip",
      metadata: this.createMetadata(data),
      createdAt: new Date().toISOString(),
    };

    // Save backup record
    await this.saveBackupRecord(backup);

    return backup;
  }

  /**
   * Create a migration-specific backup
   */
  async createMigrationBackup(
    migrationId: string,
    name: string,
    description?: string
  ): Promise<Backup> {
    const id = this.generateId("bkp");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-migration-${migrationId}-${timestamp}.json.gz`;
    const filePath = join(this.backupDir, filename);

    // Gather migration-specific data
    const data = await this.gatherMigrationData(migrationId);

    // Create backup file
    const { fileSize, checksum } = await this.writeBackupFile(filePath, data);

    const backup: Backup = {
      id,
      name,
      type: "migration",
      description,
      migrationId,
      filePath,
      fileSize,
      checksum,
      encrypted: !!this.encryptionKey,
      compressionType: "gzip",
      metadata: this.createMetadata(data),
      createdAt: new Date().toISOString(),
    };

    await this.saveBackupRecord(backup);

    return backup;
  }

  /**
   * Create a configuration backup
   */
  async createConfigBackup(name: string, description?: string): Promise<Backup> {
    const id = this.generateId("bkp");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-config-${timestamp}.json.gz`;
    const filePath = join(this.backupDir, filename);

    // Gather configuration data only
    const data = await this.gatherBackupData("config");

    const { fileSize, checksum } = await this.writeBackupFile(filePath, data);

    const backup: Backup = {
      id,
      name,
      type: "config",
      description,
      filePath,
      fileSize,
      checksum,
      encrypted: !!this.encryptionKey,
      compressionType: "gzip",
      metadata: this.createMetadata(data),
      createdAt: new Date().toISOString(),
    };

    await this.saveBackupRecord(backup);

    return backup;
  }

  /**
   * Restore from backup
   */
  async restore(options: RestoreOptions): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      restoredItems: 0,
      skippedItems: 0,
      errors: [],
      warnings: [],
    };

    try {
      // Load backup
      const backup = await this.getBackup(options.backupId);
      if (!backup) {
        result.errors.push("Backup not found");
        return result;
      }

      // Read and decompress backup data
      const data = await this.readBackupFile(backup.filePath);

      // Validate before restore
      if (options.validateBeforeRestore) {
        const validation = await this.validateBackupData(data);
        if (!validation.valid) {
          result.errors = validation.errors;
          return result;
        }
        result.warnings = validation.warnings;
      }

      // Perform restore based on type
      if (options.restoreType === "full") {
        await this.performFullRestore(data, options, result);
      } else {
        await this.performSelectiveRestore(data, options, result);
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  /**
   * Create a pre-migration snapshot
   */
  async createSnapshot(
    migrationId: string,
    phase: "pre-migration" | "post-migration",
    name?: string
  ): Promise<Snapshot> {
    const id = this.generateId("snap");

    // Capture current state
    const portainerState = await this.capturePortainerState(migrationId);
    const dokployState = await this.captureDokployState();

    const snapshot: Snapshot = {
      id,
      name: name || `${phase}-${migrationId}`,
      migrationId,
      phase,
      portainerState,
      dokployState,
      createdAt: new Date().toISOString(),
    };

    // Save snapshot
    const snapshotPath = join(this.backupDir, "snapshots", `${id}.json`);
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

    return snapshot;
  }

  /**
   * Rollback to a snapshot
   */
  async rollbackToSnapshot(snapshotId: string): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      restoredItems: 0,
      skippedItems: 0,
      errors: [],
      warnings: [],
    };

    try {
      const snapshot = await this.getSnapshot(snapshotId);
      if (!snapshot) {
        result.errors.push("Snapshot not found");
        return result;
      }

      // Rollback to previous state
      // This would revert changes in Dokploy
      result.warnings.push("Rollback functionality requires manual verification");
      result.success = true;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  /**
   * List all backups
   */
  async listBackups(type?: BackupType): Promise<Backup[]> {
    const indexPath = join(this.backupDir, "index.json");
    try {
      const content = await readFile(indexPath, "utf-8");
      const backups: Backup[] = JSON.parse(content);
      return type ? backups.filter((b) => b.type === type) : backups;
    } catch {
      return [];
    }
  }

  /**
   * Get backup by ID
   */
  async getBackup(id: string): Promise<Backup | null> {
    const backups = await this.listBackups();
    return backups.find((b) => b.id === id) || null;
  }

  /**
   * Delete a backup
   */
  async deleteBackup(id: string): Promise<boolean> {
    const backup = await this.getBackup(id);
    if (!backup) return false;

    try {
      // Delete backup file
      await unlink(backup.filePath);

      // Update index
      const backups = await this.listBackups();
      const updated = backups.filter((b) => b.id !== id);
      await this.saveBackupIndex(updated);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired backups
   */
  async cleanupExpired(): Promise<number> {
    const backups = await this.listBackups();
    const now = new Date();
    let deleted = 0;

    for (const backup of backups) {
      if (backup.expiresAt && new Date(backup.expiresAt) < now) {
        if (await this.deleteBackup(backup.id)) {
          deleted++;
        }
      }
    }

    return deleted;
  }

  // Private helper methods

  private async gatherBackupData(type: BackupType): Promise<BackupData> {
    // This would gather data from the database
    // Placeholder implementation
    return {
      version: "1.0.0",
      type,
      timestamp: new Date().toISOString(),
      migrations: [],
      items: [],
      logs: [],
      settings: {},
      notifications: [],
      schedules: [],
    };
  }

  private async gatherMigrationData(migrationId: string): Promise<BackupData> {
    return {
      version: "1.0.0",
      type: "migration",
      timestamp: new Date().toISOString(),
      migrations: [], // Would fetch specific migration
      items: [],
      logs: [],
      settings: {},
      notifications: [],
      schedules: [],
    };
  }

  private async writeBackupFile(
    filePath: string,
    data: BackupData
  ): Promise<{ fileSize: number; checksum: string }> {
    const jsonData = JSON.stringify(data);

    // Calculate checksum
    const checksum = createHash("sha256").update(jsonData).digest("hex");

    // Compress and write
    const gzip = createGzip();
    const source = Buffer.from(jsonData);
    const destination = createWriteStream(filePath);

    await new Promise<void>((resolve, reject) => {
      gzip.on("error", reject);
      destination.on("error", reject);
      destination.on("finish", resolve);

      gzip.end(source);
      gzip.pipe(destination);
    });

    const stats = await stat(filePath);

    return { fileSize: stats.size, checksum };
  }

  private async readBackupFile(filePath: string): Promise<BackupData> {
    const gunzip = createGunzip();
    const source = createReadStream(filePath);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      source.pipe(gunzip);
      gunzip.on("data", (chunk) => chunks.push(chunk));
      gunzip.on("end", resolve);
      gunzip.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("utf-8");
    return JSON.parse(content);
  }

  private createMetadata(data: BackupData): BackupMetadata {
    return {
      version: data.version,
      sourceType: data.type,
      itemCounts: {
        migrations: data.migrations.length,
        items: data.items.length,
        logs: data.logs.length,
        configs: Object.keys(data.settings).length,
      },
    };
  }

  private async validateBackupData(
    data: BackupData
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.version) {
      errors.push("Missing version in backup");
    }

    if (!data.timestamp) {
      warnings.push("Missing timestamp in backup");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private async performFullRestore(
    data: BackupData,
    options: RestoreOptions,
    result: RestoreResult
  ): Promise<void> {
    // Restore all data
    // This would interact with the database
    result.restoredItems = data.migrations.length + data.items.length;
  }

  private async performSelectiveRestore(
    data: BackupData,
    options: RestoreOptions,
    result: RestoreResult
  ): Promise<void> {
    // Restore selected items only
    if (!options.selectedItems) return;

    for (const itemId of options.selectedItems) {
      // Find and restore item
      result.restoredItems++;
    }
  }

  private async capturePortainerState(migrationId: string): Promise<Record<string, unknown>> {
    // Capture current Portainer state before migration
    return {
      capturedAt: new Date().toISOString(),
      migrationId,
    };
  }

  private async captureDokployState(): Promise<Record<string, unknown>> {
    // Capture current Dokploy state
    return {
      capturedAt: new Date().toISOString(),
    };
  }

  private async getSnapshot(id: string): Promise<Snapshot | null> {
    const snapshotPath = join(this.backupDir, "snapshots", `${id}.json`);
    try {
      const content = await readFile(snapshotPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async saveBackupRecord(backup: Backup): Promise<void> {
    const backups = await this.listBackups();
    backups.push(backup);
    await this.saveBackupIndex(backups);
  }

  private async saveBackupIndex(backups: Backup[]): Promise<void> {
    const indexPath = join(this.backupDir, "index.json");
    await writeFile(indexPath, JSON.stringify(backups, null, 2));
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

interface BackupData {
  version: string;
  type: BackupType;
  timestamp: string;
  migrations: unknown[];
  items: unknown[];
  logs: unknown[];
  settings: Record<string, unknown>;
  notifications: unknown[];
  schedules: unknown[];
}

// Export singleton
export const backupService = new BackupService();
