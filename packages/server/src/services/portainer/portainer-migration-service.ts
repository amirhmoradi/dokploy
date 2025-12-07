/**
 * Portainer Migration Service
 *
 * Orchestrates the migration of Portainer data to Dokploy.
 * Supports both API-based and BoltDB-based data extraction.
 * Provides dry-run capability for testing migrations.
 */

import { eq, desc, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../db";
import {
	portainerMigration,
	portainerMigrationItem,
	portainerMigrationLog,
	type PortainerMigration,
	type PortainerMigrationItem,
	type PortainerMigrationLog,
	type NewPortainerMigration,
	type NewPortainerMigrationItem,
	type NewPortainerMigrationLog,
} from "../../db/schema/portainer-migration";
import { compose } from "../../db/schema/compose";
import { registry } from "../../db/schema/registry";
import { server } from "../../db/schema/server";
import { projects } from "../../db/schema/project";
import { environments } from "../../db/schema/environment";
import { generateAppName } from "../../db/schema/utils";
import {
	createPortainerApiClient,
	type PortainerEndpoint,
	type PortainerEndpointGroup,
	type PortainerRegistry,
	type PortainerStack,
	type PortainerTeam,
	type PortainerTeamMembership,
	type PortainerUser,
} from "./portainer-api-client";
import { createBoltDbReader } from "./portainer-boltdb-reader";
import { createTransformer, type MigrationAnalysis } from "./portainer-transformer";

export interface MigrationOptions {
	isDryRun?: boolean;
	migrateStacks?: boolean;
	migrateRegistries?: boolean;
	migrateUsers?: boolean;
	migrateEndpoints?: boolean;
	migrateEnvironmentVariables?: boolean;
	autoDeployAfterMigration?: boolean;
	targetProjectId?: string;
	targetEnvironmentId?: string;
	targetServerId?: string;
}

export interface MigrationProgress {
	currentStep: string;
	progress: number;
	totalItems: number;
	processedItems: number;
	successCount: number;
	failureCount: number;
	skippedCount: number;
}

export type MigrationLogLevel = "info" | "warning" | "error" | "debug";

/**
 * Migration Service class
 */
export class PortainerMigrationService {
	private migrationId: string;
	private organizationId: string;
	private abortController: AbortController;

	constructor(migrationId: string, organizationId: string) {
		this.migrationId = migrationId;
		this.organizationId = organizationId;
		this.abortController = new AbortController();
	}

	/**
	 * Log a migration event
	 */
	async log(
		level: MigrationLogLevel,
		message: string,
		details?: Record<string, unknown>,
		itemInfo?: {
			itemType?: string;
			itemId?: string;
			itemName?: string;
			status?: string;
		},
	): Promise<void> {
		const logEntry: NewPortainerMigrationLog = {
			migrationId: this.migrationId,
			level,
			message,
			details,
			itemType: itemInfo?.itemType as NewPortainerMigrationLog["itemType"],
			itemId: itemInfo?.itemId,
			itemName: itemInfo?.itemName,
			status: itemInfo?.status as NewPortainerMigrationLog["status"],
		};

		await db.insert(portainerMigrationLog).values(logEntry);
	}

	/**
	 * Update migration status
	 */
	async updateStatus(
		status: PortainerMigration["status"],
		progress?: number,
		currentStep?: string,
		error?: { message: string; details?: Record<string, unknown> },
	): Promise<void> {
		const updates: Partial<PortainerMigration> = {
			status,
		};

		if (progress !== undefined) {
			updates.progress = progress;
		}

		if (currentStep !== undefined) {
			updates.currentStep = currentStep;
		}

		if (status === "running" && !updates.startedAt) {
			updates.startedAt = new Date().toISOString();
		}

		if (status === "completed" || status === "failed" || status === "cancelled") {
			updates.completedAt = new Date().toISOString();
		}

		if (error) {
			updates.errorMessage = error.message;
			updates.errorDetails = {
				code: "MIGRATION_ERROR",
				message: error.message,
				context: error.details,
			};
		}

		await db
			.update(portainerMigration)
			.set(updates)
			.where(eq(portainerMigration.migrationId, this.migrationId));
	}

	/**
	 * Cancel the migration
	 */
	cancel(): void {
		this.abortController.abort();
	}

	/**
	 * Check if migration is cancelled
	 */
	isCancelled(): boolean {
		return this.abortController.signal.aborted;
	}

	/**
	 * Analyze Portainer data source
	 */
	async analyze(migration: PortainerMigration): Promise<MigrationAnalysis> {
		await this.updateStatus("analyzing", 0, "Connecting to Portainer");
		await this.log("info", "Starting Portainer data analysis");

		try {
			let data: {
				endpoints: PortainerEndpoint[];
				endpointGroups: PortainerEndpointGroup[];
				stacks: Array<PortainerStack & { fileContent?: string }>;
				registries: PortainerRegistry[];
				users: PortainerUser[];
				teams: PortainerTeam[];
				teamMemberships: PortainerTeamMembership[];
			};

			if (migration.sourceType === "api") {
				await this.log("info", "Fetching data from Portainer API");
				const client = createPortainerApiClient({
					url: migration.portainerUrl!,
					apiKey: migration.portainerApiKey || undefined,
					username: migration.portainerUsername || undefined,
					password: migration.portainerPassword || undefined,
				});

				const apiData = await client.fetchAllData();
				data = {
					endpoints: apiData.endpoints,
					endpointGroups: apiData.endpointGroups,
					stacks: apiData.stacks,
					registries: apiData.registries,
					users: apiData.users,
					teams: apiData.teams,
					teamMemberships: apiData.teamMemberships,
				};
			} else {
				await this.log("info", "Reading data from BoltDB file");
				const reader = createBoltDbReader({
					dbPath: migration.boltDbPath!,
					stackFilesPath: migration.stackFilesPath || undefined,
				});

				const boltData = await reader.readAll();
				data = {
					endpoints: boltData.endpoints,
					endpointGroups: boltData.endpointGroups,
					stacks: boltData.stacks,
					registries: boltData.registries,
					users: boltData.users,
					teams: boltData.teams,
					teamMemberships: boltData.teamMemberships,
				};
			}

			await this.updateStatus("analyzing", 50, "Analyzing data compatibility");
			await this.log("info", "Data fetched successfully, analyzing compatibility", {
				endpointCount: data.endpoints.length,
				stackCount: data.stacks.length,
				registryCount: data.registries.length,
				userCount: data.users.length,
				teamCount: data.teams.length,
			});

			// Create transformer and analyze
			const transformer = createTransformer(data.endpointGroups, data.teamMemberships);
			const analysis = transformer.analyzeData(data);

			// Store analysis result
			await db
				.update(portainerMigration)
				.set({
					analysisResult: analysis,
					status: "ready",
					progress: 100,
					currentStep: "Analysis complete",
				})
				.where(eq(portainerMigration.migrationId, this.migrationId));

			await this.log("info", "Analysis completed successfully", {
				summary: analysis.summary,
			});

			return analysis;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error during analysis";
			await this.updateStatus("failed", 0, "Analysis failed", {
				message: errorMessage,
			});
			await this.log("error", `Analysis failed: ${errorMessage}`);
			throw error;
		}
	}

	/**
	 * Execute migration
	 */
	async execute(options: MigrationOptions = {}): Promise<{
		success: boolean;
		stats: {
			total: number;
			migrated: number;
			failed: number;
			skipped: number;
		};
		errors: Array<{ item: string; error: string }>;
	}> {
		const migration = await this.getMigration();
		if (!migration) {
			throw new Error("Migration not found");
		}

		const isDryRun = options.isDryRun ?? migration.isDryRun;
		await this.updateStatus("running", 0, isDryRun ? "Starting dry run" : "Starting migration");
		await this.log("info", isDryRun ? "Starting dry run migration" : "Starting actual migration");

		const stats = {
			total: 0,
			migrated: 0,
			failed: 0,
			skipped: 0,
		};
		const errors: Array<{ item: string; error: string }> = [];

		try {
			// Get source data
			let data: {
				endpoints: PortainerEndpoint[];
				endpointGroups: PortainerEndpointGroup[];
				stacks: Array<PortainerStack & { fileContent?: string }>;
				registries: PortainerRegistry[];
				users: PortainerUser[];
				teams: PortainerTeam[];
				teamMemberships: PortainerTeamMembership[];
			};

			if (migration.sourceType === "api") {
				const client = createPortainerApiClient({
					url: migration.portainerUrl!,
					apiKey: migration.portainerApiKey || undefined,
					username: migration.portainerUsername || undefined,
					password: migration.portainerPassword || undefined,
				});
				const apiData = await client.fetchAllData();
				data = {
					endpoints: apiData.endpoints,
					endpointGroups: apiData.endpointGroups,
					stacks: apiData.stacks,
					registries: apiData.registries,
					users: apiData.users,
					teams: apiData.teams,
					teamMemberships: apiData.teamMemberships,
				};
			} else {
				const reader = createBoltDbReader({
					dbPath: migration.boltDbPath!,
					stackFilesPath: migration.stackFilesPath || undefined,
				});
				const boltData = await reader.readAll();
				data = {
					endpoints: boltData.endpoints,
					endpointGroups: boltData.endpointGroups,
					stacks: boltData.stacks,
					registries: boltData.registries,
					users: boltData.users,
					teams: boltData.teams,
					teamMemberships: boltData.teamMemberships,
				};
			}

			const transformer = createTransformer(data.endpointGroups, data.teamMemberships);
			const mappings: {
				endpoints: Record<string, string>;
				stacks: Record<string, string>;
				registries: Record<string, string>;
				users: Record<string, string>;
				projects: Record<string, string>;
			} = {
				endpoints: {},
				stacks: {},
				registries: {},
				users: {},
				projects: {},
			};

			// Calculate total items
			const migrateStacks = options.migrateStacks ?? migration.migrateStacks;
			const migrateRegistries = options.migrateRegistries ?? migration.migrateRegistries;
			const migrateEndpoints = options.migrateEndpoints ?? migration.migrateEndpoints;

			if (migrateEndpoints) stats.total += data.endpoints.length;
			if (migrateRegistries) stats.total += data.registries.length;
			if (migrateStacks) stats.total += data.stacks.length;

			let processedItems = 0;
			const updateProgress = () => {
				const progress = stats.total > 0 ? Math.round((processedItems / stats.total) * 100) : 0;
				return this.updateStatus("running", progress);
			};

			// Ensure we have a target environment
			let targetEnvironmentId = options.targetEnvironmentId || migration.targetEnvironmentId;
			let targetProjectId = options.targetProjectId || migration.targetProjectId;

			if (!targetEnvironmentId && !isDryRun) {
				// Create a default project and environment
				if (!targetProjectId) {
					const newProject = await db
						.insert(projects)
						.values({
							name: `Portainer Migration - ${migration.name}`,
							description: "Project created by Portainer migration tool",
							organizationId: this.organizationId,
						})
						.returning();
					targetProjectId = newProject[0].projectId;
					await this.log("info", `Created new project: ${newProject[0].name}`);
				}

				const newEnv = await db
					.insert(environments)
					.values({
						name: "Production",
						description: "Default environment created by migration",
						projectId: targetProjectId,
					})
					.returning();
				targetEnvironmentId = newEnv[0].environmentId;
				await this.log("info", `Created new environment: ${newEnv[0].name}`);
			}

			// Step 1: Migrate Registries
			if (migrateRegistries) {
				await this.updateStatus("running", undefined, "Migrating registries");
				for (const portainerRegistry of data.registries) {
					if (this.isCancelled()) break;

					processedItems++;
					await updateProgress();

					try {
						await this.log(
							"info",
							`Processing registry: ${portainerRegistry.Name}`,
							undefined,
							{
								itemType: "registry",
								itemId: String(portainerRegistry.Id),
								itemName: portainerRegistry.Name,
								status: "in_progress",
							},
						);

						const transformed = transformer.transformRegistry(portainerRegistry);

						// Create migration item
						const itemId = nanoid();
						await db.insert(portainerMigrationItem).values({
							itemId,
							migrationId: this.migrationId,
							itemType: "registry",
							portainerId: String(portainerRegistry.Id),
							portainerName: portainerRegistry.Name,
							sourceData: portainerRegistry as unknown as Record<string, unknown>,
							transformedData: transformed as unknown as Record<string, unknown>,
							status: isDryRun ? "skipped" : "in_progress",
						});

						if (!isDryRun) {
							const newRegistry = await db
								.insert(registry)
								.values({
									registryName: transformed.registryName,
									registryUrl: transformed.registryUrl,
									username: transformed.username,
									password: transformed.password,
									registryType: transformed.registryType,
									imagePrefix: transformed.imagePrefix,
									organizationId: this.organizationId,
								})
								.returning();

							mappings.registries[String(portainerRegistry.Id)] =
								newRegistry[0].registryId;

							await db
								.update(portainerMigrationItem)
								.set({
									status: "completed",
									dokployId: newRegistry[0].registryId,
									dokployType: "registry",
									processedAt: new Date().toISOString(),
								})
								.where(eq(portainerMigrationItem.itemId, itemId));

							await this.log(
								"info",
								`Migrated registry: ${portainerRegistry.Name}`,
								undefined,
								{
									itemType: "registry",
									itemId: String(portainerRegistry.Id),
									itemName: portainerRegistry.Name,
									status: "completed",
								},
							);
						}

						stats.migrated++;
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : "Unknown error";
						stats.failed++;
						errors.push({
							item: `Registry: ${portainerRegistry.Name}`,
							error: errorMessage,
						});
						await this.log(
							"error",
							`Failed to migrate registry: ${portainerRegistry.Name} - ${errorMessage}`,
							undefined,
							{
								itemType: "registry",
								itemId: String(portainerRegistry.Id),
								itemName: portainerRegistry.Name,
								status: "failed",
							},
						);
					}
				}
			}

			// Step 2: Migrate Endpoints as Servers
			if (migrateEndpoints) {
				await this.updateStatus("running", undefined, "Migrating endpoints");
				for (const endpoint of data.endpoints) {
					if (this.isCancelled()) break;

					processedItems++;
					await updateProgress();

					try {
						await this.log(
							"info",
							`Processing endpoint: ${endpoint.Name}`,
							undefined,
							{
								itemType: "endpoint",
								itemId: String(endpoint.Id),
								itemName: endpoint.Name,
								status: "in_progress",
							},
						);

						const transformed = transformer.transformEndpoint(endpoint);

						if (!transformed) {
							stats.skipped++;
							await this.log(
								"warning",
								`Skipped endpoint: ${endpoint.Name} (not compatible)`,
								undefined,
								{
									itemType: "endpoint",
									itemId: String(endpoint.Id),
									itemName: endpoint.Name,
									status: "skipped",
								},
							);
							continue;
						}

						const itemId = nanoid();
						await db.insert(portainerMigrationItem).values({
							itemId,
							migrationId: this.migrationId,
							itemType: "endpoint",
							portainerId: String(endpoint.Id),
							portainerName: endpoint.Name,
							sourceData: endpoint as unknown as Record<string, unknown>,
							transformedData: transformed as unknown as Record<string, unknown>,
							status: isDryRun ? "skipped" : "in_progress",
						});

						if (!isDryRun) {
							// Note: Server creation requires SSH key which needs manual setup
							// We'll create a placeholder entry that needs configuration
							const newServer = await db
								.insert(server)
								.values({
									name: transformed.name,
									description: transformed.description,
									ipAddress: transformed.ipAddress,
									port: transformed.port,
									username: transformed.username,
									serverType: transformed.serverType,
									appName: generateAppName("server"),
									organizationId: this.organizationId,
									createdAt: new Date().toISOString(),
									serverStatus: "inactive", // Needs SSH key configuration
								})
								.returning();

							mappings.endpoints[String(endpoint.Id)] = newServer[0].serverId;

							await db
								.update(portainerMigrationItem)
								.set({
									status: "completed",
									dokployId: newServer[0].serverId,
									dokployType: "server",
									processedAt: new Date().toISOString(),
								})
								.where(eq(portainerMigrationItem.itemId, itemId));

							await this.log(
								"info",
								`Migrated endpoint: ${endpoint.Name} (requires SSH configuration)`,
								undefined,
								{
									itemType: "endpoint",
									itemId: String(endpoint.Id),
									itemName: endpoint.Name,
									status: "completed",
								},
							);
						}

						stats.migrated++;
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : "Unknown error";
						stats.failed++;
						errors.push({
							item: `Endpoint: ${endpoint.Name}`,
							error: errorMessage,
						});
						await this.log(
							"error",
							`Failed to migrate endpoint: ${endpoint.Name} - ${errorMessage}`,
							undefined,
							{
								itemType: "endpoint",
								itemId: String(endpoint.Id),
								itemName: endpoint.Name,
								status: "failed",
							},
						);
					}
				}
			}

			// Step 3: Migrate Stacks as Compose
			if (migrateStacks && targetEnvironmentId) {
				await this.updateStatus("running", undefined, "Migrating stacks");
				const targetServerId = options.targetServerId || migration.targetServerId;

				for (const stack of data.stacks) {
					if (this.isCancelled()) break;

					processedItems++;
					await updateProgress();

					try {
						await this.log("info", `Processing stack: ${stack.Name}`, undefined, {
							itemType: "stack",
							itemId: String(stack.Id),
							itemName: stack.Name,
							status: "in_progress",
						});

						// Use mapped server if available
						const serverId =
							targetServerId || mappings.endpoints[String(stack.EndpointId)];

						const transformed = transformer.transformStack(
							stack,
							targetEnvironmentId,
							serverId,
						);

						if (!transformed) {
							stats.skipped++;
							await this.log(
								"warning",
								`Skipped stack: ${stack.Name} (no compose file or Kubernetes stack)`,
								undefined,
								{
									itemType: "stack",
									itemId: String(stack.Id),
									itemName: stack.Name,
									status: "skipped",
								},
							);
							continue;
						}

						const itemId = nanoid();
						await db.insert(portainerMigrationItem).values({
							itemId,
							migrationId: this.migrationId,
							itemType: "stack",
							portainerId: String(stack.Id),
							portainerName: stack.Name,
							sourceData: stack as unknown as Record<string, unknown>,
							transformedData: transformed as unknown as Record<string, unknown>,
							status: isDryRun ? "skipped" : "in_progress",
						});

						if (!isDryRun) {
							const newCompose = await db
								.insert(compose)
								.values({
									name: transformed.name,
									description: transformed.description,
									composeFile: transformed.composeFile,
									env: transformed.env,
									sourceType: transformed.sourceType,
									composeType: transformed.composeType,
									environmentId: transformed.environmentId,
									serverId: transformed.serverId,
									customGitUrl: transformed.customGitUrl,
									customGitBranch: transformed.customGitBranch,
									appName: generateAppName("compose"),
								})
								.returning();

							mappings.stacks[String(stack.Id)] = newCompose[0].composeId;

							await db
								.update(portainerMigrationItem)
								.set({
									status: "completed",
									dokployId: newCompose[0].composeId,
									dokployType: "compose",
									processedAt: new Date().toISOString(),
								})
								.where(eq(portainerMigrationItem.itemId, itemId));

							await this.log(
								"info",
								`Migrated stack: ${stack.Name}`,
								undefined,
								{
									itemType: "stack",
									itemId: String(stack.Id),
									itemName: stack.Name,
									status: "completed",
								},
							);
						}

						stats.migrated++;
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : "Unknown error";
						stats.failed++;
						errors.push({
							item: `Stack: ${stack.Name}`,
							error: errorMessage,
						});
						await this.log(
							"error",
							`Failed to migrate stack: ${stack.Name} - ${errorMessage}`,
							undefined,
							{
								itemType: "stack",
								itemId: String(stack.Id),
								itemName: stack.Name,
								status: "failed",
							},
						);
					}
				}
			}

			// Save mappings
			await db
				.update(portainerMigration)
				.set({
					migrationMapping: mappings,
				})
				.where(eq(portainerMigration.migrationId, this.migrationId));

			// Finalize
			const finalStatus = this.isCancelled()
				? "cancelled"
				: stats.failed > 0
					? "completed"
					: "completed";

			await this.updateStatus(finalStatus, 100, isDryRun ? "Dry run completed" : "Migration completed");
			await this.log(
				"info",
				`Migration ${isDryRun ? "dry run " : ""}completed`,
				{
					stats,
					errors: errors.length > 0 ? errors : undefined,
				},
			);

			return {
				success: stats.failed === 0 && !this.isCancelled(),
				stats,
				errors,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error during migration";
			await this.updateStatus("failed", undefined, "Migration failed", {
				message: errorMessage,
			});
			await this.log("error", `Migration failed: ${errorMessage}`);
			throw error;
		}
	}

	/**
	 * Get migration record
	 */
	private async getMigration(): Promise<PortainerMigration | null> {
		const result = await db.query.portainerMigration.findFirst({
			where: eq(portainerMigration.migrationId, this.migrationId),
		});
		return result || null;
	}
}

// CRUD Operations

/**
 * Create a new migration
 */
export async function createPortainerMigration(
	input: Omit<NewPortainerMigration, "migrationId" | "createdAt">,
): Promise<PortainerMigration> {
	const result = await db
		.insert(portainerMigration)
		.values(input)
		.returning();
	return result[0];
}

/**
 * Find migration by ID
 */
export async function findPortainerMigrationById(
	migrationId: string,
): Promise<PortainerMigration | null> {
	const result = await db.query.portainerMigration.findFirst({
		where: eq(portainerMigration.migrationId, migrationId),
	});
	return result || null;
}

/**
 * Find all migrations for an organization
 */
export async function findPortainerMigrationsByOrganization(
	organizationId: string,
): Promise<PortainerMigration[]> {
	const result = await db.query.portainerMigration.findMany({
		where: eq(portainerMigration.organizationId, organizationId),
		orderBy: desc(portainerMigration.createdAt),
	});
	return result;
}

/**
 * Update migration
 */
export async function updatePortainerMigration(
	migrationId: string,
	input: Partial<PortainerMigration>,
): Promise<PortainerMigration | null> {
	const result = await db
		.update(portainerMigration)
		.set(input)
		.where(eq(portainerMigration.migrationId, migrationId))
		.returning();
	return result[0] || null;
}

/**
 * Delete migration
 */
export async function deletePortainerMigration(migrationId: string): Promise<void> {
	await db
		.delete(portainerMigration)
		.where(eq(portainerMigration.migrationId, migrationId));
}

/**
 * Get migration logs
 */
export async function getPortainerMigrationLogs(
	migrationId: string,
	options: {
		limit?: number;
		offset?: number;
		level?: string;
	} = {},
): Promise<PortainerMigrationLog[]> {
	const { limit = 100, offset = 0, level } = options;

	const conditions = [eq(portainerMigrationLog.migrationId, migrationId)];
	if (level) {
		conditions.push(eq(portainerMigrationLog.level, level));
	}

	const result = await db.query.portainerMigrationLog.findMany({
		where: and(...conditions),
		orderBy: desc(portainerMigrationLog.timestamp),
		limit,
		offset,
	});
	return result;
}

/**
 * Get migration items
 */
export async function getPortainerMigrationItems(
	migrationId: string,
	options: {
		itemType?: string;
		status?: string;
	} = {},
): Promise<PortainerMigrationItem[]> {
	const conditions = [eq(portainerMigrationItem.migrationId, migrationId)];

	if (options.itemType) {
		conditions.push(
			eq(
				portainerMigrationItem.itemType,
				options.itemType as PortainerMigrationItem["itemType"],
			),
		);
	}

	if (options.status) {
		conditions.push(
			eq(
				portainerMigrationItem.status,
				options.status as PortainerMigrationItem["status"],
			),
		);
	}

	const result = await db.query.portainerMigrationItem.findMany({
		where: and(...conditions),
		orderBy: desc(portainerMigrationItem.createdAt),
	});
	return result;
}

/**
 * Retry a failed migration item
 */
export async function retryMigrationItem(itemId: string): Promise<void> {
	await db
		.update(portainerMigrationItem)
		.set({
			status: "pending",
			errorMessage: null,
			processedAt: null,
		})
		.where(eq(portainerMigrationItem.itemId, itemId));
}

/**
 * Get migration statistics
 */
export async function getMigrationStatistics(
	migrationId: string,
): Promise<{
	total: number;
	pending: number;
	inProgress: number;
	completed: number;
	failed: number;
	skipped: number;
}> {
	const items = await db
		.select({
			status: portainerMigrationItem.status,
			count: sql<number>`count(*)::int`,
		})
		.from(portainerMigrationItem)
		.where(eq(portainerMigrationItem.migrationId, migrationId))
		.groupBy(portainerMigrationItem.status);

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

	return stats;
}

/**
 * Create migration service instance
 */
export function createMigrationService(
	migrationId: string,
	organizationId: string,
): PortainerMigrationService {
	return new PortainerMigrationService(migrationId, organizationId);
}
