/**
 * API Routes using Hono - v2.0.0
 * Extended with all roadmap features
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db, migrations, migrationItems, migrationLogs } from "../db/index.js";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import {
  testPortainerConnection,
  createPortainerApiClient,
} from "../services/portainer-api-client.js";
import { createBoltDbReader, testBoltDbFile } from "../services/portainer-boltdb-reader.js";
import { createTransformer } from "../services/portainer-transformer.js";
import { validateLicense, getActiveLicense, hasFeature, FEATURES } from "../license/license-validator.js";
import { selectionFilterService } from "../services/selection-filter-service.js";
import { notificationService } from "../services/notification-service.js";
import { schedulerService } from "../services/scheduler-service.js";
import { backupService } from "../services/backup-service.js";
import { reportService } from "../services/report-service.js";
import { pluginService } from "../services/plugin-service.js";
import { kubernetesAdapter } from "../services/kubernetes-adapter.js";
import { edgeAgentAdapter } from "../services/edge-agent-adapter.js";
import { coolifyAdapter } from "../services/coolify-adapter.js";
import { caproverAdapter } from "../services/caprover-adapter.js";
import type { Migration, MigrationAnalysis, SelectionFilter, NotificationConfig, ScheduledMigration, ReportConfig } from "../types/index.js";

const app = new Hono();

// ============================================================================
// Middleware
// ============================================================================

// License check middleware
app.use("/api/*", async (c, next) => {
  // Skip license check for certain endpoints
  const skipPaths = ["/api/license/activate", "/api/health"];
  if (skipPaths.includes(c.req.path)) {
    return next();
  }

  const license = await getActiveLicense();
  if (!license) {
    return c.json({ error: "No valid license. Please activate a license key." }, 403);
  }

  c.set("license", license);
  return next();
});

// ============================================================================
// License Routes
// ============================================================================

app.post(
  "/api/license/activate",
  zValidator(
    "json",
    z.object({
      licenseKey: z.string().min(1),
    })
  ),
  async (c) => {
    const { licenseKey } = c.req.valid("json");

    const result = await validateLicense(licenseKey);

    if (!result.valid) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, license: result.license });
  }
);

app.get("/api/license", async (c) => {
  const license = await getActiveLicense();
  return c.json({ license });
});

// ============================================================================
// Connection Test Routes
// ============================================================================

app.post(
  "/api/test-connection",
  zValidator(
    "json",
    z.object({
      sourceType: z.enum(["api", "boltdb"]),
      portainerUrl: z.string().url().optional(),
      portainerApiKey: z.string().optional(),
      portainerUsername: z.string().optional(),
      portainerPassword: z.string().optional(),
      boltDbPath: z.string().optional(),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    if (input.sourceType === "api") {
      if (!input.portainerUrl) {
        return c.json({ error: "Portainer URL is required" }, 400);
      }

      const result = await testPortainerConnection({
        url: input.portainerUrl,
        apiKey: input.portainerApiKey,
        username: input.portainerUsername,
        password: input.portainerPassword,
      });

      return c.json(result);
    } else {
      if (!input.boltDbPath) {
        return c.json({ error: "BoltDB path is required" }, 400);
      }

      // Check feature availability
      const hasBoltDb = await hasFeature(FEATURES.BOLTDB_SUPPORT);
      if (!hasBoltDb) {
        return c.json({ error: "BoltDB support requires Standard license or higher" }, 403);
      }

      const result = await testBoltDbFile(input.boltDbPath);
      return c.json({ success: result.valid, error: result.error });
    }
  }
);

// ============================================================================
// Migration CRUD Routes
// ============================================================================

// Create migration
app.post(
  "/api/migrations",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      sourceType: z.enum(["api", "boltdb"]),
      portainerUrl: z.string().url().optional(),
      portainerApiKey: z.string().optional(),
      portainerUsername: z.string().optional(),
      portainerPassword: z.string().optional(),
      boltDbPath: z.string().optional(),
      stackFilesPath: z.string().optional(),
      isDryRun: z.boolean().default(true),
      migrateStacks: z.boolean().default(true),
      migrateRegistries: z.boolean().default(true),
      migrateEndpoints: z.boolean().default(true),
      migrateEnvironmentVariables: z.boolean().default(true),
      migrateUsers: z.boolean().default(false),
      autoDeployAfterMigration: z.boolean().default(false),
      targetProjectId: z.string().optional(),
      targetEnvironmentId: z.string().optional(),
      targetServerId: z.string().optional(),
      // v2.0 - Target platform
      targetPlatform: z.enum(["dokploy", "coolify", "caprover"]).default("dokploy"),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    // Validate source configuration
    if (input.sourceType === "api" && !input.portainerUrl) {
      return c.json({ error: "Portainer URL is required for API source" }, 400);
    }

    if (input.sourceType === "boltdb") {
      const hasBoltDb = await hasFeature(FEATURES.BOLTDB_SUPPORT);
      if (!hasBoltDb) {
        return c.json({ error: "BoltDB support requires Standard license or higher" }, 403);
      }
      if (!input.boltDbPath) {
        return c.json({ error: "BoltDB path is required" }, 400);
      }
    }

    const id = nanoid();

    await db.insert(migrations).values({
      id,
      ...input,
    });

    const migration = await db.query.migrations.findFirst({
      where: eq(migrations.id, id),
    });

    // Send notification
    await notificationService.sendNotification("migration_created", {
      migrationId: id,
      migrationName: input.name,
    });

    return c.json(migration, 201);
  }
);

// List migrations
app.get("/api/migrations", async (c) => {
  const allMigrations = await db.query.migrations.findMany({
    orderBy: desc(migrations.createdAt),
  });

  return c.json(allMigrations);
});

// Get single migration
app.get("/api/migrations/:id", async (c) => {
  const id = c.req.param("id");

  const migration = await db.query.migrations.findFirst({
    where: eq(migrations.id, id),
  });

  if (!migration) {
    return c.json({ error: "Migration not found" }, 404);
  }

  return c.json(migration);
});

// Update migration
app.patch(
  "/api/migrations/:id",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      isDryRun: z.boolean().optional(),
      migrateStacks: z.boolean().optional(),
      migrateRegistries: z.boolean().optional(),
      migrateEndpoints: z.boolean().optional(),
      migrateEnvironmentVariables: z.boolean().optional(),
      migrateUsers: z.boolean().optional(),
      autoDeployAfterMigration: z.boolean().optional(),
      targetProjectId: z.string().optional(),
      targetEnvironmentId: z.string().optional(),
      targetServerId: z.string().optional(),
    })
  ),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");

    const existing = await db.query.migrations.findFirst({
      where: eq(migrations.id, id),
    });

    if (!existing) {
      return c.json({ error: "Migration not found" }, 404);
    }

    if (existing.status === "running") {
      return c.json({ error: "Cannot update a running migration" }, 400);
    }

    await db.update(migrations).set(input).where(eq(migrations.id, id));

    const updated = await db.query.migrations.findFirst({
      where: eq(migrations.id, id),
    });

    return c.json(updated);
  }
);

// Delete migration
app.delete("/api/migrations/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await db.query.migrations.findFirst({
    where: eq(migrations.id, id),
  });

  if (!existing) {
    return c.json({ error: "Migration not found" }, 404);
  }

  if (existing.status === "running") {
    return c.json({ error: "Cannot delete a running migration" }, 400);
  }

  await db.delete(migrations).where(eq(migrations.id, id));

  return c.json({ success: true });
});

// ============================================================================
// Migration Actions
// ============================================================================

// Analyze migration
app.post("/api/migrations/:id/analyze", async (c) => {
  const id = c.req.param("id");

  const migration = await db.query.migrations.findFirst({
    where: eq(migrations.id, id),
  });

  if (!migration) {
    return c.json({ error: "Migration not found" }, 404);
  }

  if (migration.status === "running") {
    return c.json({ error: "Migration is already running" }, 400);
  }

  // Update status
  await db.update(migrations)
    .set({ status: "analyzing", progress: 0, currentStep: "Connecting to source" })
    .where(eq(migrations.id, id));

  try {
    let data;

    if (migration.sourceType === "api") {
      const client = createPortainerApiClient({
        url: migration.portainerUrl!,
        apiKey: migration.portainerApiKey || undefined,
        username: migration.portainerUsername || undefined,
        password: migration.portainerPassword || undefined,
      });
      data = await client.fetchAllData();
    } else {
      const reader = createBoltDbReader({
        dbPath: migration.boltDbPath!,
        stackFilesPath: migration.stackFilesPath || undefined,
      });
      data = await reader.readAll();
    }

    // Analyze data
    const transformer = createTransformer(data.endpointGroups, data.teamMemberships);
    const analysis = transformer.analyzeData(data);

    // Store analysis result
    await db.update(migrations)
      .set({
        status: "ready",
        progress: 100,
        currentStep: "Analysis complete",
        analysisResult: analysis as any,
      })
      .where(eq(migrations.id, id));

    return c.json(analysis);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Analysis failed";

    await db.update(migrations)
      .set({
        status: "failed",
        errorMessage,
        currentStep: "Analysis failed",
      })
      .where(eq(migrations.id, id));

    // Send failure notification
    await notificationService.sendNotification("migration_failed", {
      migrationId: id,
      migrationName: migration.name,
      error: errorMessage,
    });

    return c.json({ error: errorMessage }, 500);
  }
});

// Execute migration
app.post(
  "/api/migrations/:id/execute",
  zValidator(
    "json",
    z.object({
      isDryRun: z.boolean().optional(),
    }).optional()
  ),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json") || {};

    const migration = await db.query.migrations.findFirst({
      where: eq(migrations.id, id),
    });

    if (!migration) {
      return c.json({ error: "Migration not found" }, 404);
    }

    if (migration.status === "running") {
      return c.json({ error: "Migration is already running" }, 400);
    }

    if (migration.status !== "ready" && migration.status !== "failed" && migration.status !== "completed") {
      return c.json({ error: "Migration must be analyzed first" }, 400);
    }

    const isDryRun = input.isDryRun ?? migration.isDryRun;

    // Check dry run feature
    if (isDryRun) {
      const hasDryRun = await hasFeature(FEATURES.DRY_RUN);
      if (!hasDryRun) {
        return c.json({ error: "Dry run requires a valid license" }, 403);
      }
    }

    // Update status
    await db.update(migrations)
      .set({
        status: "running",
        progress: 0,
        currentStep: isDryRun ? "Starting dry run" : "Starting migration",
        startedAt: new Date().toISOString(),
      })
      .where(eq(migrations.id, id));

    // Send notification
    await notificationService.sendNotification("migration_started", {
      migrationId: id,
      migrationName: migration.name,
      isDryRun,
    });

    // For now, return immediately and run in background
    executeMigrationInBackground(id, isDryRun).catch(console.error);

    return c.json({
      started: true,
      message: isDryRun ? "Dry run started" : "Migration started",
    });
  }
);

// Cancel migration
app.post("/api/migrations/:id/cancel", async (c) => {
  const id = c.req.param("id");

  const migration = await db.query.migrations.findFirst({
    where: eq(migrations.id, id),
  });

  if (!migration) {
    return c.json({ error: "Migration not found" }, 404);
  }

  if (migration.status !== "running" && migration.status !== "analyzing") {
    return c.json({ error: "Migration is not running" }, 400);
  }

  await db.update(migrations)
    .set({
      status: "cancelled",
      completedAt: new Date().toISOString(),
    })
    .where(eq(migrations.id, id));

  return c.json({ success: true });
});

// ============================================================================
// Selection Filters (v1.1.0)
// ============================================================================

// Get available presets
app.get("/api/filters/presets", async (c) => {
  const presets = ["production", "development", "testing", "all-stacks", "all-registries"];
  return c.json(presets.map(preset => ({
    id: preset,
    name: preset.charAt(0).toUpperCase() + preset.slice(1).replace("-", " "),
    filter: selectionFilterService.createPresetFilter(preset as any),
  })));
});

// Create filter
app.post(
  "/api/filters",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1),
      resourceTypes: z.array(z.enum(["stack", "registry", "endpoint", "container", "volume", "network"])).optional(),
      criteria: z.object({
        namePatterns: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        createdAfter: z.string().optional(),
        createdBefore: z.string().optional(),
        environmentIds: z.array(z.number()).optional(),
        customMetadata: z.record(z.unknown()).optional(),
      }).optional(),
      excludePatterns: z.array(z.string()).optional(),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    const filter: SelectionFilter = {
      id: nanoid(),
      name: input.name,
      resourceTypes: input.resourceTypes || [],
      criteria: input.criteria,
      excludePatterns: input.excludePatterns,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    const validation = selectionFilterService.validateFilter(filter);
    if (!validation.valid) {
      return c.json({ error: "Invalid filter", details: validation.errors }, 400);
    }

    return c.json(filter, 201);
  }
);

// Preview filter results
app.post(
  "/api/filters/preview",
  zValidator(
    "json",
    z.object({
      migrationId: z.string(),
      filter: z.any(),
    })
  ),
  async (c) => {
    const { migrationId, filter } = c.req.valid("json");

    const migration = await db.query.migrations.findFirst({
      where: eq(migrations.id, migrationId),
    });

    if (!migration || !migration.analysisResult) {
      return c.json({ error: "Migration analysis not found" }, 404);
    }

    // Get resources from analysis
    const analysis = migration.analysisResult as any;
    const resources = [
      ...selectionFilterService.stacksToFilterable(analysis.stacks || []),
      ...selectionFilterService.registriesToFilterable(analysis.registries || []),
      ...selectionFilterService.endpointsToFilterable(analysis.endpoints || []),
    ];

    const result = selectionFilterService.applyFilter(resources, filter);
    const summary = selectionFilterService.getSummary(result);

    return c.json({ result, summary });
  }
);

// ============================================================================
// Notifications (v1.1.0)
// ============================================================================

// Get notification configs
app.get("/api/notifications/configs", async (c) => {
  // In production, fetch from database
  return c.json([]);
});

// Create notification config
app.post(
  "/api/notifications/configs",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1),
      type: z.enum(["email", "slack", "discord", "teams", "webhook"]),
      enabled: z.boolean().default(true),
      events: z.array(z.string()),
      config: z.record(z.unknown()),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    const config: NotificationConfig = {
      id: nanoid(),
      ...input,
      createdAt: new Date().toISOString(),
    } as NotificationConfig;

    // In production, save to database
    return c.json(config, 201);
  }
);

// Test notification
app.post(
  "/api/notifications/test",
  zValidator(
    "json",
    z.object({
      configId: z.string(),
    })
  ),
  async (c) => {
    const { configId } = c.req.valid("json");

    // Send test notification
    const results = await notificationService.sendNotification("test", {
      message: "This is a test notification from Portainer Migrator",
    });

    return c.json({ success: results.every(r => r.success), results });
  }
);

// ============================================================================
// Scheduled Migrations (v1.2.0)
// ============================================================================

// List scheduled migrations
app.get("/api/schedules", async (c) => {
  const schedules = schedulerService.getSchedules();
  return c.json(schedules);
});

// Create schedule
app.post(
  "/api/schedules",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1),
      migrationId: z.string(),
      cronExpression: z.string(),
      timezone: z.string().default("UTC"),
      enabled: z.boolean().default(true),
      maintenanceWindow: z.object({
        start: z.string(),
        end: z.string(),
        daysOfWeek: z.array(z.number()),
      }).optional(),
      retryConfig: z.object({
        maxRetries: z.number().default(3),
        retryDelay: z.number().default(300),
      }).optional(),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    const schedule: ScheduledMigration = {
      id: nanoid(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    schedulerService.createSchedule(schedule);

    return c.json(schedule, 201);
  }
);

// Update schedule
app.patch(
  "/api/schedules/:id",
  zValidator(
    "json",
    z.object({
      enabled: z.boolean().optional(),
      cronExpression: z.string().optional(),
    })
  ),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");

    schedulerService.updateSchedule(id, input);

    return c.json({ success: true });
  }
);

// Delete schedule
app.delete("/api/schedules/:id", async (c) => {
  const id = c.req.param("id");
  schedulerService.deleteSchedule(id);
  return c.json({ success: true });
});

// Get next run time
app.get("/api/schedules/:id/next-run", async (c) => {
  const id = c.req.param("id");
  const schedules = schedulerService.getSchedules();
  const schedule = schedules.find(s => s.id === id);

  if (!schedule) {
    return c.json({ error: "Schedule not found" }, 404);
  }

  const nextRun = schedulerService.getNextRunTime(schedule);
  return c.json({ nextRun: nextRun?.toISOString() });
});

// ============================================================================
// Backup & Restore (v1.2.0)
// ============================================================================

// List backups
app.get("/api/backups", async (c) => {
  const backups = await backupService.listBackups();
  return c.json(backups);
});

// Create backup
app.post(
  "/api/backups",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(["full", "migration", "config"]).default("full"),
      migrationId: z.string().optional(),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    let backup;
    if (input.type === "migration" && input.migrationId) {
      backup = await backupService.createMigrationBackup(input.migrationId, input.name);
    } else if (input.type === "config") {
      backup = await backupService.createConfigBackup(input.name, input.description);
    } else {
      backup = await backupService.createFullBackup(input.name, input.description);
    }

    return c.json(backup, 201);
  }
);

// Restore from backup
app.post(
  "/api/backups/:id/restore",
  zValidator(
    "json",
    z.object({
      dryRun: z.boolean().default(true),
      restoreMigrations: z.boolean().default(true),
      restoreConfig: z.boolean().default(true),
      restoreLogs: z.boolean().default(false),
    })
  ),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");

    const backups = await backupService.listBackups();
    const backup = backups.find(b => b.id === id);

    if (!backup) {
      return c.json({ error: "Backup not found" }, 404);
    }

    const result = await backupService.restore({
      backupId: id,
      ...input,
    });

    return c.json(result);
  }
);

// Delete backup
app.delete("/api/backups/:id", async (c) => {
  const id = c.req.param("id");
  await backupService.deleteBackup(id);
  return c.json({ success: true });
});

// ============================================================================
// Reports (v1.2.0)
// ============================================================================

// Generate report
app.post(
  "/api/reports",
  zValidator(
    "json",
    z.object({
      type: z.enum(["migration", "summary", "audit", "trend"]),
      format: z.enum(["json", "pdf", "csv", "html"]).default("json"),
      migrationId: z.string().optional(),
      dateRange: z.object({
        start: z.string(),
        end: z.string(),
      }).optional(),
      includeDetails: z.boolean().default(true),
      includeLogs: z.boolean().default(false),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    // Check feature
    const canExport = await hasFeature(FEATURES.EXPORT_REPORTS);
    if (!canExport) {
      return c.json({ error: "Reports require Professional license or higher" }, 403);
    }

    let report;
    if (input.type === "migration" && input.migrationId) {
      report = await reportService.generateMigrationReport(input.migrationId, input.format);
    } else if (input.type === "trend" && input.dateRange) {
      report = await reportService.generateTrendReport(input.dateRange);
    } else {
      report = await reportService.generateReport({
        type: input.type,
        format: input.format,
        dateRange: input.dateRange,
        includeDetails: input.includeDetails,
        includeLogs: input.includeLogs,
      } as ReportConfig);
    }

    return c.json(report);
  }
);

// Download report
app.get("/api/reports/:id/download", async (c) => {
  const id = c.req.param("id");

  // In production, fetch from database and return file
  c.header("Content-Type", "application/octet-stream");
  c.header("Content-Disposition", `attachment; filename="report-${id}.pdf"`);

  return c.body("Report content here");
});

// ============================================================================
// Plugins (v2.0.0)
// ============================================================================

// List plugins
app.get("/api/plugins", async (c) => {
  const plugins = pluginService.getLoadedPlugins();
  return c.json(plugins);
});

// Install plugin
app.post(
  "/api/plugins/install",
  zValidator(
    "json",
    z.object({
      source: z.string(), // URL or path
    })
  ),
  async (c) => {
    const { source } = c.req.valid("json");

    const plugin = await pluginService.loadPlugin(source);
    if (!plugin) {
      return c.json({ error: "Failed to load plugin" }, 400);
    }

    return c.json(plugin, 201);
  }
);

// Enable/disable plugin
app.patch(
  "/api/plugins/:id",
  zValidator(
    "json",
    z.object({
      enabled: z.boolean(),
    })
  ),
  async (c) => {
    const id = c.req.param("id");
    const { enabled } = c.req.valid("json");

    if (enabled) {
      await pluginService.enablePlugin(id);
    } else {
      await pluginService.disablePlugin(id);
    }

    return c.json({ success: true });
  }
);

// Uninstall plugin
app.delete("/api/plugins/:id", async (c) => {
  const id = c.req.param("id");
  await pluginService.uninstallPlugin(id);
  return c.json({ success: true });
});

// ============================================================================
// Kubernetes Migration (v2.0.0)
// ============================================================================

// Connect to Kubernetes endpoint
app.post(
  "/api/kubernetes/connect",
  zValidator(
    "json",
    z.object({
      name: z.string(),
      server: z.string(),
      token: z.string().optional(),
      kubeconfig: z.string().optional(),
      namespace: z.string().default("default"),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    const connected = await kubernetesAdapter.connect({
      name: input.name,
      server: input.server,
      token: input.token,
      kubeconfig: input.kubeconfig,
      namespace: input.namespace,
    });

    if (!connected) {
      return c.json({ error: "Failed to connect to Kubernetes" }, 400);
    }

    return c.json({ success: true });
  }
);

// Discover Kubernetes resources
app.post(
  "/api/kubernetes/discover",
  zValidator(
    "json",
    z.object({
      namespace: z.string().default("default"),
      includeDeployments: z.boolean().default(true),
      includeStatefulSets: z.boolean().default(true),
      includeServices: z.boolean().default(true),
      includeConfigMaps: z.boolean().default(true),
      includeSecrets: z.boolean().default(true),
      includeIngresses: z.boolean().default(true),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    const resources = await kubernetesAdapter.discoverResources(input.namespace, input);

    return c.json(resources);
  }
);

// Transform Kubernetes to Compose
app.post(
  "/api/kubernetes/transform",
  zValidator(
    "json",
    z.object({
      resources: z.array(z.any()),
      namespaceMapping: z.array(z.object({
        sourceNamespace: z.string(),
        targetProjectName: z.string(),
      })),
    })
  ),
  async (c) => {
    const { resources, namespaceMapping } = c.req.valid("json");

    const composes = kubernetesAdapter.transformToDokloy(resources, namespaceMapping);

    return c.json(composes);
  }
);

// ============================================================================
// Edge Agent Migration (v2.0.0)
// ============================================================================

// Connect to Portainer with Edge features
app.post(
  "/api/edge/connect",
  zValidator(
    "json",
    z.object({
      portainerUrl: z.string().url(),
      apiKey: z.string(),
    })
  ),
  async (c) => {
    const { portainerUrl, apiKey } = c.req.valid("json");

    const connected = await edgeAgentAdapter.connect(portainerUrl, apiKey);
    if (!connected) {
      return c.json({ error: "Failed to connect or Edge features not enabled" }, 400);
    }

    return c.json({ success: true });
  }
);

// Discover Edge resources
app.post(
  "/api/edge/discover",
  zValidator(
    "json",
    z.object({
      migrateEdgeGroups: z.boolean().default(true),
      migrateEdgeStacks: z.boolean().default(true),
      migrateEdgeJobs: z.boolean().default(true),
      convertToStandardStacks: z.boolean().default(true),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    const result = await edgeAgentAdapter.discoverResources(input);
    const analysis = edgeAgentAdapter.analyzeCompatibility(input, result);

    return c.json({ discovery: result, analysis });
  }
);

// ============================================================================
// Multi-Platform Migration (v2.0.0)
// ============================================================================

// Connect to Coolify
app.post(
  "/api/platforms/coolify/connect",
  zValidator(
    "json",
    z.object({
      url: z.string().url(),
      apiToken: z.string(),
      teamId: z.string().optional(),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    const connected = await coolifyAdapter.connect(input);
    if (!connected) {
      return c.json({ error: "Failed to connect to Coolify" }, 400);
    }

    const projects = await coolifyAdapter.getProjects();
    const destinations = await coolifyAdapter.getDestinations();

    return c.json({ success: true, projects, destinations });
  }
);

// Analyze Coolify compatibility
app.post(
  "/api/platforms/coolify/analyze",
  zValidator(
    "json",
    z.object({
      stacks: z.array(z.any()),
    })
  ),
  async (c) => {
    const { stacks } = c.req.valid("json");

    const analysis = coolifyAdapter.analyzeCompatibility(stacks);

    return c.json(analysis);
  }
);

// Connect to CapRover
app.post(
  "/api/platforms/caprover/connect",
  zValidator(
    "json",
    z.object({
      url: z.string().url(),
      password: z.string(),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");

    const connected = await caproverAdapter.connect(input);
    if (!connected) {
      return c.json({ error: "Failed to connect to CapRover" }, 400);
    }

    const apps = await caproverAdapter.getApps();

    return c.json({ success: true, existingApps: apps.length });
  }
);

// Analyze CapRover compatibility
app.post(
  "/api/platforms/caprover/analyze",
  zValidator(
    "json",
    z.object({
      stacks: z.array(z.any()),
    })
  ),
  async (c) => {
    const { stacks } = c.req.valid("json");

    const analysis = caproverAdapter.analyzeCompatibility(stacks);

    return c.json(analysis);
  }
);

// ============================================================================
// Migration Items and Logs
// ============================================================================

// Get migration items
app.get("/api/migrations/:id/items", async (c) => {
  const id = c.req.param("id");
  const itemType = c.req.query("itemType");
  const status = c.req.query("status");

  const conditions = [eq(migrationItems.migrationId, id)];

  if (itemType) {
    conditions.push(eq(migrationItems.itemType, itemType as any));
  }
  if (status) {
    conditions.push(eq(migrationItems.status, status as any));
  }

  const items = await db.query.migrationItems.findMany({
    where: and(...conditions),
    orderBy: desc(migrationItems.createdAt),
  });

  return c.json(items);
});

// Get migration logs
app.get("/api/migrations/:id/logs", async (c) => {
  const id = c.req.param("id");
  const level = c.req.query("level");
  const limit = parseInt(c.req.query("limit") || "100");
  const offset = parseInt(c.req.query("offset") || "0");

  const conditions = [eq(migrationLogs.migrationId, id)];

  if (level) {
    conditions.push(eq(migrationLogs.level, level as any));
  }

  const logs = await db.query.migrationLogs.findMany({
    where: and(...conditions),
    orderBy: desc(migrationLogs.timestamp),
    limit,
    offset,
  });

  return c.json(logs);
});

// Get migration statistics
app.get("/api/migrations/:id/statistics", async (c) => {
  const id = c.req.param("id");

  const items = await db
    .select({
      status: migrationItems.status,
      count: sql<number>`count(*)`,
    })
    .from(migrationItems)
    .where(eq(migrationItems.migrationId, id))
    .groupBy(migrationItems.status);

  const stats = {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const item of items) {
    const count = Number(item.count);
    stats.total += count;

    switch (item.status) {
      case "pending":
        stats.pending = count;
        break;
      case "in_progress":
        stats.inProgress = count;
        break;
      case "completed":
        stats.completed = count;
        break;
      case "failed":
        stats.failed = count;
        break;
      case "skipped":
        stats.skipped = count;
        break;
    }
  }

  return c.json(stats);
});

// Retry failed item
app.post("/api/migrations/items/:itemId/retry", async (c) => {
  const itemId = c.req.param("itemId");

  await db.update(migrationItems)
    .set({
      status: "pending",
      errorMessage: null,
      processedAt: null,
    })
    .where(eq(migrationItems.id, itemId));

  return c.json({ success: true });
});

// ============================================================================
// Export Configuration
// ============================================================================

// Export migration as Dokploy import file
app.get("/api/migrations/:id/export", async (c) => {
  const id = c.req.param("id");

  const migration = await db.query.migrations.findFirst({
    where: eq(migrations.id, id),
  });

  if (!migration) {
    return c.json({ error: "Migration not found" }, 404);
  }

  if (migration.status !== "completed") {
    return c.json({ error: "Migration must be completed to export" }, 400);
  }

  // Check feature
  const canExport = await hasFeature(FEATURES.EXPORT_REPORTS);
  if (!canExport) {
    return c.json({ error: "Export requires Professional license or higher" }, 403);
  }

  const items = await db.query.migrationItems.findMany({
    where: and(
      eq(migrationItems.migrationId, id),
      eq(migrationItems.status, "completed")
    ),
  });

  const exportData = {
    version: "2.0",
    generatedAt: new Date().toISOString(),
    migration: {
      name: migration.name,
      description: migration.description,
    },
    items: items.map((item) => ({
      type: item.itemType,
      name: item.portainerName,
      data: item.transformedData,
    })),
  };

  c.header("Content-Type", "application/json");
  c.header("Content-Disposition", `attachment; filename="dokploy-import-${id}.json"`);

  return c.json(exportData);
});

// ============================================================================
// Settings
// ============================================================================

// Get settings
app.get("/api/settings", async (c) => {
  // In production, fetch from database
  return c.json({
    darkMode: false,
    parallelMigrations: 3,
    defaultTimeout: 30000,
    retentionDays: 90,
  });
});

// Update settings
app.patch(
  "/api/settings",
  zValidator(
    "json",
    z.object({
      darkMode: z.boolean().optional(),
      parallelMigrations: z.number().min(1).max(10).optional(),
      defaultTimeout: z.number().min(5000).max(600000).optional(),
      retentionDays: z.number().min(7).max(365).optional(),
    })
  ),
  async (c) => {
    const input = c.req.valid("json");
    // In production, save to database
    return c.json({ success: true, settings: input });
  }
);

// ============================================================================
// Health Check
// ============================================================================

app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Background Migration Execution
// ============================================================================

async function executeMigrationInBackground(migrationId: string, isDryRun: boolean): Promise<void> {
  const migration = await db.query.migrations.findFirst({
    where: eq(migrations.id, migrationId),
  });

  if (!migration) return;

  try {
    // Execute plugin hooks before migration
    await pluginService.executeHooks("pre_migration", {
      migrationId,
      config: migration as any,
    });

    // Fetch data
    let data;

    if (migration.sourceType === "api") {
      const client = createPortainerApiClient({
        url: migration.portainerUrl!,
        apiKey: migration.portainerApiKey || undefined,
        username: migration.portainerUsername || undefined,
        password: migration.portainerPassword || undefined,
      });
      data = await client.fetchAllData();
    } else {
      const reader = createBoltDbReader({
        dbPath: migration.boltDbPath!,
        stackFilesPath: migration.stackFilesPath || undefined,
      });
      data = await reader.readAll();
    }

    const transformer = createTransformer(data.endpointGroups, data.teamMemberships);

    let totalItems = 0;
    let processedItems = 0;

    if (migration.migrateEndpoints) totalItems += data.endpoints.length;
    if (migration.migrateRegistries) totalItems += data.registries.length;
    if (migration.migrateStacks) totalItems += data.stacks.length;

    // Process registries
    if (migration.migrateRegistries) {
      for (const registry of data.registries) {
        const transformed = transformer.transformRegistry(registry);

        // Execute plugin hooks
        await pluginService.executeHooks("transform_registry", {
          migrationId,
          sourceData: registry,
          transformedData: transformed,
        });

        await db.insert(migrationItems).values({
          id: nanoid(),
          migrationId,
          itemType: "registry",
          portainerId: String(registry.Id),
          portainerName: registry.Name,
          sourceData: registry as any,
          transformedData: transformed as any,
          status: isDryRun ? "skipped" : "completed",
          processedAt: new Date().toISOString(),
        });

        processedItems++;
        await updateProgress(migrationId, processedItems, totalItems);
      }
    }

    // Process endpoints
    if (migration.migrateEndpoints) {
      for (const endpoint of data.endpoints) {
        const transformed = transformer.transformEndpoint(endpoint);

        await db.insert(migrationItems).values({
          id: nanoid(),
          migrationId,
          itemType: "endpoint",
          portainerId: String(endpoint.Id),
          portainerName: endpoint.Name,
          sourceData: endpoint as any,
          transformedData: transformed as any,
          status: transformed ? (isDryRun ? "skipped" : "completed") : "skipped",
          processedAt: new Date().toISOString(),
        });

        processedItems++;
        await updateProgress(migrationId, processedItems, totalItems);
      }
    }

    // Process stacks
    if (migration.migrateStacks) {
      for (const stack of data.stacks) {
        const transformed = transformer.transformStack(stack, "placeholder-env-id");

        // Execute plugin hooks
        await pluginService.executeHooks("transform_stack", {
          migrationId,
          sourceData: stack,
          transformedData: transformed,
        });

        await db.insert(migrationItems).values({
          id: nanoid(),
          migrationId,
          itemType: "stack",
          portainerId: String(stack.Id),
          portainerName: stack.Name,
          sourceData: stack as any,
          transformedData: transformed as any,
          status: transformed ? (isDryRun ? "skipped" : "completed") : "skipped",
          processedAt: new Date().toISOString(),
        });

        processedItems++;
        await updateProgress(migrationId, processedItems, totalItems);
      }
    }

    // Execute plugin hooks after migration
    await pluginService.executeHooks("post_migration", {
      migrationId,
      success: true,
    });

    // Complete migration
    await db.update(migrations)
      .set({
        status: "completed",
        progress: 100,
        currentStep: isDryRun ? "Dry run completed" : "Migration completed",
        completedAt: new Date().toISOString(),
      })
      .where(eq(migrations.id, migrationId));

    // Send completion notification
    await notificationService.sendNotification("migration_completed", {
      migrationId,
      migrationName: migration.name,
      itemsProcessed: processedItems,
      isDryRun,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Migration failed";

    // Execute plugin hooks on failure
    await pluginService.executeHooks("post_migration", {
      migrationId,
      success: false,
      error: errorMessage,
    });

    await db.update(migrations)
      .set({
        status: "failed",
        errorMessage,
        currentStep: "Migration failed",
        completedAt: new Date().toISOString(),
      })
      .where(eq(migrations.id, migrationId));

    // Send failure notification
    await notificationService.sendNotification("migration_failed", {
      migrationId,
      migrationName: migration.name,
      error: errorMessage,
    });
  }
}

async function updateProgress(migrationId: string, processed: number, total: number): Promise<void> {
  const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

  await db.update(migrations)
    .set({ progress })
    .where(eq(migrations.id, migrationId));
}

export { app };
