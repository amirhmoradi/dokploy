/**
 * API Routes using Hono
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db, migrations, migrationItems, migrationLogs } from "../db/index.js";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  testPortainerConnection,
  createPortainerApiClient,
} from "../services/portainer-api-client.js";
import { createBoltDbReader, testBoltDbFile } from "../services/portainer-boltdb-reader.js";
import { createTransformer } from "../services/portainer-transformer.js";
import { validateLicense, getActiveLicense, hasFeature, FEATURES } from "../license/license-validator.js";
import type { Migration, MigrationAnalysis } from "../types/index.js";

const app = new Hono();

// ============================================================================
// Middleware
// ============================================================================

// License check middleware
app.use("/api/*", async (c, next) => {
  // Skip license check for license activation endpoint
  if (c.req.path === "/api/license/activate") {
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

    // For now, return immediately and run in background
    // In production, use a job queue like BullMQ
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
    version: "1.0",
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
// Health Check
// ============================================================================

app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    version: "1.0.0",
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

    // Complete migration
    await db.update(migrations)
      .set({
        status: "completed",
        progress: 100,
        currentStep: isDryRun ? "Dry run completed" : "Migration completed",
        completedAt: new Date().toISOString(),
      })
      .where(eq(migrations.id, migrationId));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Migration failed";

    await db.update(migrations)
      .set({
        status: "failed",
        errorMessage,
        currentStep: "Migration failed",
        completedAt: new Date().toISOString(),
      })
      .where(eq(migrations.id, migrationId));
  }
}

async function updateProgress(migrationId: string, processed: number, total: number): Promise<void> {
  const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

  await db.update(migrations)
    .set({ progress })
    .where(eq(migrations.id, migrationId));
}

export { app };
