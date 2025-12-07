/**
 * Portainer Migration tRPC Router
 *
 * Provides API endpoints for the Portainer to Dokploy migration tool.
 */

import {
	createMigrationService,
	createPortainerMigration,
	deletePortainerMigration,
	findPortainerMigrationById,
	findPortainerMigrationsByOrganization,
	getPortainerMigrationItems,
	getPortainerMigrationLogs,
	getMigrationStatistics,
	retryMigrationItem,
	testBoltDbFile,
	testPortainerConnection,
	updatePortainerMigration,
} from "@dokploy/server";
import {
	apiAnalyzePortainer,
	apiCancelMigration,
	apiCreatePortainerMigration,
	apiDeletePortainerMigration,
	apiExecuteMigration,
	apiFindPortainerMigration,
	apiGetMigrationItems,
	apiGetMigrationLogs,
	apiRetryMigrationItem,
	apiTestPortainerConnection,
	apiUpdatePortainerMigration,
	apiUploadBoltDb,
} from "@dokploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import * as fs from "fs";
import * as path from "path";
import { nanoid } from "nanoid";

// Store for active migration service instances
const activeMigrations = new Map<string, ReturnType<typeof createMigrationService>>();

export const portainerMigrationRouter = createTRPCRouter({
	/**
	 * Test connection to Portainer
	 */
	testConnection: protectedProcedure
		.input(apiTestPortainerConnection)
		.mutation(async ({ input }) => {
			if (input.sourceType === "api") {
				if (!input.portainerUrl) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Portainer URL is required for API source type",
					});
				}

				const result = await testPortainerConnection({
					url: input.portainerUrl,
					apiKey: input.portainerApiKey,
					username: input.portainerUsername,
					password: input.portainerPassword,
				});

				return result;
			} else {
				if (!input.boltDbPath) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "BoltDB path is required for BoltDB source type",
					});
				}

				const result = await testBoltDbFile(input.boltDbPath);
				return {
					success: result.valid,
					error: result.error,
				};
			}
		}),

	/**
	 * Create a new migration
	 */
	create: protectedProcedure
		.input(apiCreatePortainerMigration)
		.mutation(async ({ ctx, input }) => {
			// Validate source configuration
			if (input.sourceType === "api") {
				if (!input.portainerUrl) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Portainer URL is required for API source type",
					});
				}
				if (!input.portainerApiKey && (!input.portainerUsername || !input.portainerPassword)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "API key or username/password is required for API source type",
					});
				}
			} else if (input.sourceType === "boltdb") {
				if (!input.boltDbPath) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "BoltDB path is required for BoltDB source type",
					});
				}
			}

			const migration = await createPortainerMigration({
				...input,
				organizationId: ctx.session.activeOrganizationId,
			});

			return migration;
		}),

	/**
	 * Get all migrations for the current organization
	 */
	all: protectedProcedure.query(async ({ ctx }) => {
		const migrations = await findPortainerMigrationsByOrganization(
			ctx.session.activeOrganizationId,
		);
		return migrations;
	}),

	/**
	 * Get a specific migration by ID
	 */
	one: protectedProcedure
		.input(apiFindPortainerMigration)
		.query(async ({ ctx, input }) => {
			const migration = await findPortainerMigrationById(input.migrationId);

			if (!migration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (migration.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			return migration;
		}),

	/**
	 * Update migration settings
	 */
	update: protectedProcedure
		.input(apiUpdatePortainerMigration)
		.mutation(async ({ ctx, input }) => {
			const existing = await findPortainerMigrationById(input.migrationId);

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (existing.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			if (existing.status === "running") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot update a running migration",
				});
			}

			const updated = await updatePortainerMigration(input.migrationId, input);
			return updated;
		}),

	/**
	 * Delete a migration
	 */
	delete: protectedProcedure
		.input(apiDeletePortainerMigration)
		.mutation(async ({ ctx, input }) => {
			const existing = await findPortainerMigrationById(input.migrationId);

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (existing.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			if (existing.status === "running") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot delete a running migration. Cancel it first.",
				});
			}

			await deletePortainerMigration(input.migrationId);
			return { success: true };
		}),

	/**
	 * Analyze Portainer data source
	 */
	analyze: protectedProcedure
		.input(apiAnalyzePortainer)
		.mutation(async ({ ctx, input }) => {
			const migration = await findPortainerMigrationById(input.migrationId);

			if (!migration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (migration.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			if (migration.status === "running") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Migration is already running",
				});
			}

			const service = createMigrationService(
				input.migrationId,
				ctx.session.activeOrganizationId,
			);

			try {
				const analysis = await service.analyze(migration);
				return analysis;
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: error instanceof Error ? error.message : "Analysis failed",
				});
			}
		}),

	/**
	 * Execute migration
	 */
	execute: protectedProcedure
		.input(apiExecuteMigration)
		.mutation(async ({ ctx, input }) => {
			const migration = await findPortainerMigrationById(input.migrationId);

			if (!migration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (migration.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			if (migration.status === "running") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Migration is already running",
				});
			}

			if (migration.status !== "ready" && migration.status !== "failed" && migration.status !== "completed") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Migration must be analyzed before execution",
				});
			}

			const service = createMigrationService(
				input.migrationId,
				ctx.session.activeOrganizationId,
			);

			// Store the service instance for cancellation
			activeMigrations.set(input.migrationId, service);

			try {
				// Execute in background (don't await fully)
				const resultPromise = service.execute({
					isDryRun: input.isDryRun,
				});

				// Wait a short time to catch immediate errors
				const timeoutPromise = new Promise<null>((resolve) =>
					setTimeout(() => resolve(null), 100),
				);

				const result = await Promise.race([resultPromise, timeoutPromise]);

				if (result === null) {
					// Migration is running in background
					return {
						started: true,
						message: input.isDryRun
							? "Dry run started in background"
							: "Migration started in background",
					};
				}

				// Migration completed quickly
				activeMigrations.delete(input.migrationId);
				return {
					started: false,
					completed: true,
					result,
				};
			} catch (error) {
				activeMigrations.delete(input.migrationId);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: error instanceof Error ? error.message : "Migration failed to start",
				});
			}
		}),

	/**
	 * Cancel a running migration
	 */
	cancel: protectedProcedure
		.input(apiCancelMigration)
		.mutation(async ({ ctx, input }) => {
			const migration = await findPortainerMigrationById(input.migrationId);

			if (!migration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (migration.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			if (migration.status !== "running" && migration.status !== "analyzing") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Migration is not running",
				});
			}

			const service = activeMigrations.get(input.migrationId);
			if (service) {
				service.cancel();
				activeMigrations.delete(input.migrationId);
			}

			await updatePortainerMigration(input.migrationId, {
				status: "cancelled",
				completedAt: new Date().toISOString(),
			});

			return { success: true };
		}),

	/**
	 * Get migration logs
	 */
	logs: protectedProcedure
		.input(apiGetMigrationLogs)
		.query(async ({ ctx, input }) => {
			const migration = await findPortainerMigrationById(input.migrationId);

			if (!migration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (migration.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			const logs = await getPortainerMigrationLogs(input.migrationId, {
				limit: input.limit,
				offset: input.offset,
				level: input.level,
			});

			return logs;
		}),

	/**
	 * Get migration items
	 */
	items: protectedProcedure
		.input(apiGetMigrationItems)
		.query(async ({ ctx, input }) => {
			const migration = await findPortainerMigrationById(input.migrationId);

			if (!migration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (migration.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			const items = await getPortainerMigrationItems(input.migrationId, {
				itemType: input.itemType,
				status: input.status,
			});

			return items;
		}),

	/**
	 * Get migration statistics
	 */
	statistics: protectedProcedure
		.input(apiFindPortainerMigration)
		.query(async ({ ctx, input }) => {
			const migration = await findPortainerMigrationById(input.migrationId);

			if (!migration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (migration.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			const stats = await getMigrationStatistics(input.migrationId);
			return stats;
		}),

	/**
	 * Retry a failed migration item
	 */
	retryItem: protectedProcedure
		.input(apiRetryMigrationItem)
		.mutation(async ({ ctx, input }) => {
			// Get the item first to check migration ownership
			const items = await getPortainerMigrationItems("dummy", {});
			const item = items.find((i) => i.itemId === input.itemId);

			if (!item) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration item not found",
				});
			}

			const migration = await findPortainerMigrationById(item.migrationId);

			if (!migration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (migration.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			await retryMigrationItem(input.itemId);
			return { success: true };
		}),

	/**
	 * Upload BoltDB file
	 */
	uploadBoltDb: protectedProcedure
		.input(apiUploadBoltDb)
		.mutation(async ({ ctx, input }) => {
			const migration = await findPortainerMigrationById(input.migrationId);

			if (!migration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (migration.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			// Decode and save the file
			const uploadDir = path.join("/tmp", "portainer-migrations", input.migrationId);
			await fs.promises.mkdir(uploadDir, { recursive: true });

			const filePath = path.join(uploadDir, input.fileName || "portainer.db");
			const fileBuffer = Buffer.from(input.fileData, "base64");
			await fs.promises.writeFile(filePath, fileBuffer);

			// Validate the file
			const validation = await testBoltDbFile(filePath);
			if (!validation.valid) {
				await fs.promises.unlink(filePath);
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: validation.error || "Invalid BoltDB file",
				});
			}

			// Update migration with file path
			await updatePortainerMigration(input.migrationId, {
				boltDbPath: filePath,
			});

			return {
				success: true,
				filePath,
			};
		}),

	/**
	 * Upload stack files directory (as a zip)
	 */
	uploadStackFiles: protectedProcedure
		.input(
			z.object({
				migrationId: z.string().min(1),
				fileData: z.string(), // base64 encoded zip
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const migration = await findPortainerMigrationById(input.migrationId);

			if (!migration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Migration not found",
				});
			}

			if (migration.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this migration",
				});
			}

			// Save the zip file
			const uploadDir = path.join("/tmp", "portainer-migrations", input.migrationId);
			await fs.promises.mkdir(uploadDir, { recursive: true });

			const zipPath = path.join(uploadDir, "stack-files.zip");
			const extractPath = path.join(uploadDir, "stacks");
			const fileBuffer = Buffer.from(input.fileData, "base64");
			await fs.promises.writeFile(zipPath, fileBuffer);

			// Extract the zip file
			const { execAsync } = await import("@dokploy/server");
			await execAsync(`unzip -o "${zipPath}" -d "${extractPath}"`);

			// Update migration with stack files path
			await updatePortainerMigration(input.migrationId, {
				stackFilesPath: extractPath,
			});

			return {
				success: true,
				stackFilesPath: extractPath,
			};
		}),

	/**
	 * Get available projects for target selection
	 */
	getProjects: protectedProcedure.query(async ({ ctx }) => {
		const { db } = await import("@/server/db");
		const { projects } = await import("@/server/db/schema");
		const { eq } = await import("drizzle-orm");

		const projectList = await db.query.projects.findMany({
			where: eq(projects.organizationId, ctx.session.activeOrganizationId),
			with: {
				environments: true,
			},
		});

		return projectList;
	}),

	/**
	 * Get available servers for target selection
	 */
	getServers: protectedProcedure.query(async ({ ctx }) => {
		const { db } = await import("@/server/db");
		const { server } = await import("@/server/db/schema");
		const { eq } = await import("drizzle-orm");

		const serverList = await db.query.server.findMany({
			where: eq(server.organizationId, ctx.session.activeOrganizationId),
		});

		return serverList;
	}),
});
