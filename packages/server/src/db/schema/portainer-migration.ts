import { relations } from "drizzle-orm";
import { boolean, integer, jsonb, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { organization } from "./account";

// Migration source type
export const migrationSourceType = pgEnum("migrationSourceType", [
	"api",
	"boltdb",
]);

// Migration status
export const migrationStatus = pgEnum("migrationStatus", [
	"pending",
	"analyzing",
	"ready",
	"running",
	"completed",
	"failed",
	"cancelled",
]);

// Migration item status
export const migrationItemStatus = pgEnum("migrationItemStatus", [
	"pending",
	"in_progress",
	"completed",
	"failed",
	"skipped",
]);

// Migration item type
export const migrationItemType = pgEnum("migrationItemType", [
	"endpoint",
	"stack",
	"registry",
	"user",
	"team",
	"environment_variable",
	"volume",
	"network",
]);

// Portainer migration job
export const portainerMigration = pgTable("portainer_migration", {
	migrationId: text("migrationId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	name: text("name").notNull(),
	description: text("description"),

	// Source configuration
	sourceType: migrationSourceType("sourceType").notNull(),

	// API source config
	portainerUrl: text("portainerUrl"),
	portainerApiKey: text("portainerApiKey"),
	portainerUsername: text("portainerUsername"),
	portainerPassword: text("portainerPassword"),

	// BoltDB source config
	boltDbPath: text("boltDbPath"),
	stackFilesPath: text("stackFilesPath"),

	// Migration options
	isDryRun: boolean("isDryRun").notNull().default(true),
	migrateStacks: boolean("migrateStacks").notNull().default(true),
	migrateRegistries: boolean("migrateRegistries").notNull().default(true),
	migrateUsers: boolean("migrateUsers").notNull().default(false),
	migrateEndpoints: boolean("migrateEndpoints").notNull().default(true),
	migrateEnvironmentVariables: boolean("migrateEnvironmentVariables").notNull().default(true),
	autoDeployAfterMigration: boolean("autoDeployAfterMigration").notNull().default(false),

	// Target configuration
	targetProjectId: text("targetProjectId"),
	targetEnvironmentId: text("targetEnvironmentId"),
	targetServerId: text("targetServerId"),

	// Status and progress
	status: migrationStatus("status").notNull().default("pending"),
	progress: integer("progress").notNull().default(0),
	currentStep: text("currentStep"),

	// Analysis results (stored as JSON)
	analysisResult: jsonb("analysisResult").$type<{
		endpoints: PortainerEndpointAnalysis[];
		stacks: PortainerStackAnalysis[];
		registries: PortainerRegistryAnalysis[];
		users: PortainerUserAnalysis[];
		teams: PortainerTeamAnalysis[];
		summary: {
			totalEndpoints: number;
			totalStacks: number;
			totalRegistries: number;
			totalUsers: number;
			totalTeams: number;
			warnings: string[];
			errors: string[];
		};
	}>(),

	// Migration mapping (stores relationship between Portainer IDs and Dokploy IDs)
	migrationMapping: jsonb("migrationMapping").$type<{
		endpoints: Record<string, string>;  // Portainer endpoint ID -> Dokploy server ID
		stacks: Record<string, string>;     // Portainer stack ID -> Dokploy compose ID
		registries: Record<string, string>; // Portainer registry ID -> Dokploy registry ID
		users: Record<string, string>;      // Portainer user ID -> Dokploy user ID
		projects: Record<string, string>;   // Portainer endpoint group ID -> Dokploy project ID
	}>(),

	// Timestamps
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	startedAt: text("startedAt"),
	completedAt: text("completedAt"),

	// Error tracking
	errorMessage: text("errorMessage"),
	errorDetails: jsonb("errorDetails").$type<{
		code: string;
		message: string;
		stack?: string;
		context?: Record<string, unknown>;
	}>(),

	// Organization reference
	organizationId: text("organizationId")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
});

// Migration log entries
export const portainerMigrationLog = pgTable("portainer_migration_log", {
	logId: text("logId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	migrationId: text("migrationId")
		.notNull()
		.references(() => portainerMigration.migrationId, { onDelete: "cascade" }),

	// Log details
	level: text("level").notNull().default("info"), // info, warning, error, debug
	message: text("message").notNull(),
	details: jsonb("details").$type<Record<string, unknown>>(),

	// Item tracking
	itemType: migrationItemType("itemType"),
	itemId: text("itemId"),
	itemName: text("itemName"),

	// Status
	status: migrationItemStatus("status"),

	// Timestamp
	timestamp: text("timestamp")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// Migration items (tracks individual migrated resources)
export const portainerMigrationItem = pgTable("portainer_migration_item", {
	itemId: text("itemId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	migrationId: text("migrationId")
		.notNull()
		.references(() => portainerMigration.migrationId, { onDelete: "cascade" }),

	// Item details
	itemType: migrationItemType("itemType").notNull(),
	portainerId: text("portainerId").notNull(),
	portainerName: text("portainerName").notNull(),

	// Source data (original Portainer data)
	sourceData: jsonb("sourceData").$type<Record<string, unknown>>(),

	// Transformed data (data prepared for Dokploy)
	transformedData: jsonb("transformedData").$type<Record<string, unknown>>(),

	// Result
	dokployId: text("dokployId"),
	dokployType: text("dokployType"),

	// Status
	status: migrationItemStatus("status").notNull().default("pending"),
	errorMessage: text("errorMessage"),

	// Timestamps
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	processedAt: text("processedAt"),
});

// Types for analysis results
export interface PortainerEndpointAnalysis {
	id: number;
	name: string;
	type: number;
	url: string;
	publicUrl?: string;
	status: number;
	tlsConfig?: {
		tls: boolean;
		tlsSkipVerify: boolean;
	};
	canMigrate: boolean;
	migrationNotes: string[];
	warnings: string[];
}

export interface PortainerStackAnalysis {
	id: number;
	name: string;
	type: number;
	endpointId: number;
	status: number;
	composeFile?: string;
	env?: Array<{ name: string; value: string }>;
	gitConfig?: {
		url?: string;
		referenceName?: string;
		authentication?: boolean;
	};
	canMigrate: boolean;
	migrationNotes: string[];
	warnings: string[];
}

export interface PortainerRegistryAnalysis {
	id: number;
	name: string;
	type: number;
	url: string;
	authentication: boolean;
	canMigrate: boolean;
	migrationNotes: string[];
	warnings: string[];
}

export interface PortainerUserAnalysis {
	id: number;
	username: string;
	role: number;
	canMigrate: boolean;
	migrationNotes: string[];
	warnings: string[];
}

export interface PortainerTeamAnalysis {
	id: number;
	name: string;
	memberCount: number;
	canMigrate: boolean;
	migrationNotes: string[];
	warnings: string[];
}

// Relations
export const portainerMigrationRelations = relations(portainerMigration, ({ one, many }) => ({
	organization: one(organization, {
		fields: [portainerMigration.organizationId],
		references: [organization.id],
	}),
	logs: many(portainerMigrationLog),
	items: many(portainerMigrationItem),
}));

export const portainerMigrationLogRelations = relations(portainerMigrationLog, ({ one }) => ({
	migration: one(portainerMigration, {
		fields: [portainerMigrationLog.migrationId],
		references: [portainerMigration.migrationId],
	}),
}));

export const portainerMigrationItemRelations = relations(portainerMigrationItem, ({ one }) => ({
	migration: one(portainerMigration, {
		fields: [portainerMigrationItem.migrationId],
		references: [portainerMigration.migrationId],
	}),
}));

// Zod schemas for validation
const createMigrationSchema = createInsertSchema(portainerMigration, {
	migrationId: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	sourceType: z.enum(["api", "boltdb"]),
	portainerUrl: z.string().url().optional(),
	portainerApiKey: z.string().optional(),
	portainerUsername: z.string().optional(),
	portainerPassword: z.string().optional(),
	boltDbPath: z.string().optional(),
	stackFilesPath: z.string().optional(),
});

export const apiCreatePortainerMigration = createMigrationSchema.pick({
	name: true,
	description: true,
	sourceType: true,
	portainerUrl: true,
	portainerApiKey: true,
	portainerUsername: true,
	portainerPassword: true,
	boltDbPath: true,
	stackFilesPath: true,
	isDryRun: true,
	migrateStacks: true,
	migrateRegistries: true,
	migrateUsers: true,
	migrateEndpoints: true,
	migrateEnvironmentVariables: true,
	autoDeployAfterMigration: true,
	targetProjectId: true,
	targetEnvironmentId: true,
	targetServerId: true,
});

export const apiFindPortainerMigration = z.object({
	migrationId: z.string().min(1),
});

export const apiUpdatePortainerMigration = createMigrationSchema.partial().extend({
	migrationId: z.string().min(1),
});

export const apiTestPortainerConnection = z.object({
	sourceType: z.enum(["api", "boltdb"]),
	portainerUrl: z.string().url().optional(),
	portainerApiKey: z.string().optional(),
	portainerUsername: z.string().optional(),
	portainerPassword: z.string().optional(),
	boltDbPath: z.string().optional(),
});

export const apiAnalyzePortainer = z.object({
	migrationId: z.string().min(1),
});

export const apiExecuteMigration = z.object({
	migrationId: z.string().min(1),
	isDryRun: z.boolean().default(true),
});

export const apiGetMigrationLogs = z.object({
	migrationId: z.string().min(1),
	limit: z.number().optional().default(100),
	offset: z.number().optional().default(0),
	level: z.enum(["info", "warning", "error", "debug"]).optional(),
});

export const apiGetMigrationItems = z.object({
	migrationId: z.string().min(1),
	itemType: z.enum(["endpoint", "stack", "registry", "user", "team", "environment_variable", "volume", "network"]).optional(),
	status: z.enum(["pending", "in_progress", "completed", "failed", "skipped"]).optional(),
});

export const apiRetryMigrationItem = z.object({
	itemId: z.string().min(1),
});

export const apiCancelMigration = z.object({
	migrationId: z.string().min(1),
});

export const apiDeletePortainerMigration = z.object({
	migrationId: z.string().min(1),
});

export const apiUploadBoltDb = z.object({
	migrationId: z.string().min(1),
	fileData: z.string(), // base64 encoded
	fileName: z.string(),
});

// Export types
export type PortainerMigration = typeof portainerMigration.$inferSelect;
export type PortainerMigrationLog = typeof portainerMigrationLog.$inferSelect;
export type PortainerMigrationItem = typeof portainerMigrationItem.$inferSelect;
export type NewPortainerMigration = typeof portainerMigration.$inferInsert;
export type NewPortainerMigrationLog = typeof portainerMigrationLog.$inferInsert;
export type NewPortainerMigrationItem = typeof portainerMigrationItem.$inferInsert;
