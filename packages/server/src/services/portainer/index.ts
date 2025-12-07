/**
 * Portainer Migration Module
 *
 * This module provides tools for migrating from Portainer to Dokploy.
 * It supports two data sources:
 * 1. Portainer API - For live Portainer instances
 * 2. BoltDB - For offline migration from Portainer data directory
 *
 * Features:
 * - Full data analysis before migration
 * - Dry run capability
 * - Progress tracking and logging
 * - Failure management and retry
 * - Support for all Portainer data types
 */

// API Client
export {
	PortainerApiClient,
	createPortainerApiClient,
	testPortainerConnection,
	PortainerApiError,
	type PortainerAuthConfig,
	type PortainerEndpoint,
	type PortainerEndpointSnapshot,
	type PortainerStack,
	type PortainerStackFile,
	type PortainerRegistry,
	type PortainerUser,
	type PortainerTeam,
	type PortainerTeamMembership,
	type PortainerResourceControl,
	type PortainerEndpointGroup,
	type PortainerSettings,
	type PortainerStatus,
} from "./portainer-api-client";

// BoltDB Reader
export {
	PortainerBoltDbReader,
	createBoltDbReader,
	testBoltDbFile,
	BoltDbError,
	type BoltDbConfig,
	type BoltDbData,
} from "./portainer-boltdb-reader";

// Transformer
export {
	PortainerTransformer,
	createTransformer,
	type DokployServer,
	type DokployProject,
	type DokployEnvironment,
	type DokployCompose,
	type DokployRegistry,
	type DokployUser,
	type DokployMember,
	type MigrationAnalysis,
} from "./portainer-transformer";

// Migration Service
export {
	PortainerMigrationService,
	createMigrationService,
	createPortainerMigration,
	findPortainerMigrationById,
	findPortainerMigrationsByOrganization,
	updatePortainerMigration,
	deletePortainerMigration,
	getPortainerMigrationLogs,
	getPortainerMigrationItems,
	retryMigrationItem,
	getMigrationStatistics,
	type MigrationOptions,
	type MigrationProgress,
	type MigrationLogLevel,
} from "./portainer-migration-service";
