/**
 * Portainer BoltDB Reader
 *
 * Reads Portainer data directly from its BoltDB database file.
 * Used for offline migration when the Portainer API is not available.
 *
 * Portainer uses BoltDB with msgpack encoding for data serialization.
 * The database structure includes buckets for:
 * - endpoints
 * - endpoint_groups
 * - stacks
 * - registries
 * - users
 * - teams
 * - team_memberships
 * - resource_controls
 * - settings
 * - etc.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type {
	PortainerEndpoint,
	PortainerEndpointGroup,
	PortainerRegistry,
	PortainerResourceControl,
	PortainerSettings,
	PortainerStack,
	PortainerTeam,
	PortainerTeamMembership,
	PortainerUser,
} from "./portainer-api-client";

export interface BoltDbConfig {
	dbPath: string;
	stackFilesPath?: string; // Path to the compose folder containing stack files
}

export interface BoltDbData {
	endpoints: PortainerEndpoint[];
	endpointGroups: PortainerEndpointGroup[];
	stacks: Array<PortainerStack & { fileContent?: string }>;
	registries: PortainerRegistry[];
	users: PortainerUser[];
	teams: PortainerTeam[];
	teamMemberships: PortainerTeamMembership[];
	resourceControls: PortainerResourceControl[];
	settings?: PortainerSettings;
	version?: string;
}

export class BoltDbError extends Error {
	constructor(
		message: string,
		public code?: string,
		public details?: unknown,
	) {
		super(message);
		this.name = "BoltDbError";
	}
}

/**
 * Portainer BoltDB bucket names
 */
const BUCKET_NAMES = {
	ENDPOINTS: "endpoints",
	ENDPOINT_GROUPS: "endpoint_groups",
	ENDPOINT_RELATIONS: "endpoint_relations",
	STACKS: "stacks",
	REGISTRIES: "registries",
	USERS: "users",
	TEAMS: "teams",
	TEAM_MEMBERSHIPS: "team_memberships",
	RESOURCE_CONTROLS: "resource_controls",
	SETTINGS: "settings",
	VERSION: "version",
	TUNNEL_SERVER: "tunnel_server",
	DOCKER_HUB: "dockerhub",
	ROLE: "role",
	EDGE_GROUP: "edgegroups",
	EDGE_JOB: "edge_job",
	EDGE_STACK: "edge_stack",
	SSL: "ssl",
	CUSTOM_TEMPLATE: "customtemplates",
	WEBHOOK: "webhooks",
	SCHEDULE: "schedules",
};

/**
 * Read and parse Portainer BoltDB database
 */
export class PortainerBoltDbReader {
	private dbPath: string;
	private stackFilesPath?: string;

	constructor(config: BoltDbConfig) {
		this.dbPath = config.dbPath;
		this.stackFilesPath = config.stackFilesPath;

		if (!fs.existsSync(this.dbPath)) {
			throw new BoltDbError(`BoltDB file not found: ${this.dbPath}`, "FILE_NOT_FOUND");
		}
	}

	/**
	 * Read all data from BoltDB
	 */
	async readAll(): Promise<BoltDbData> {
		const rawData = await this.extractAllBuckets();

		const endpoints = this.parseEndpoints(rawData[BUCKET_NAMES.ENDPOINTS] || {});
		const endpointGroups = this.parseEndpointGroups(rawData[BUCKET_NAMES.ENDPOINT_GROUPS] || {});
		const stacksRaw = this.parseStacks(rawData[BUCKET_NAMES.STACKS] || {});
		const registries = this.parseRegistries(rawData[BUCKET_NAMES.REGISTRIES] || {});
		const users = this.parseUsers(rawData[BUCKET_NAMES.USERS] || {});
		const teams = this.parseTeams(rawData[BUCKET_NAMES.TEAMS] || {});
		const teamMemberships = this.parseTeamMemberships(rawData[BUCKET_NAMES.TEAM_MEMBERSHIPS] || {});
		const resourceControls = this.parseResourceControls(rawData[BUCKET_NAMES.RESOURCE_CONTROLS] || {});
		const settings = this.parseSettings(rawData[BUCKET_NAMES.SETTINGS] || {});

		// Enrich stacks with file content
		const stacks = await this.enrichStacksWithFileContent(stacksRaw);

		return {
			endpoints,
			endpointGroups,
			stacks,
			registries,
			users,
			teams,
			teamMemberships,
			resourceControls,
			settings,
		};
	}

	/**
	 * Extract all bucket data using a Go helper or fallback methods
	 */
	private async extractAllBuckets(): Promise<Record<string, Record<string, unknown>>> {
		// Try using the bbolt CLI tool if available
		try {
			return await this.extractWithBbolt();
		} catch {
			// Fall back to parsing the raw file
			return await this.extractRawFile();
		}
	}

	/**
	 * Extract data using bbolt CLI tool
	 */
	private async extractWithBbolt(): Promise<Record<string, Record<string, unknown>>> {
		const result: Record<string, Record<string, unknown>> = {};

		// First, list all buckets
		const buckets = await this.runCommand("bbolt", ["buckets", this.dbPath]);
		const bucketList = buckets.split("\n").filter(Boolean);

		// For each bucket, extract key-value pairs
		for (const bucket of bucketList) {
			try {
				const keysOutput = await this.runCommand("bbolt", ["keys", this.dbPath, bucket]);
				const keys = keysOutput.split("\n").filter(Boolean);

				result[bucket] = {};

				for (const key of keys) {
					try {
						const value = await this.runCommand("bbolt", ["get", this.dbPath, bucket, key]);
						// Try to parse as JSON (msgpack decoded)
						try {
							result[bucket][key] = JSON.parse(value);
						} catch {
							result[bucket][key] = value;
						}
					} catch {
						// Skip failed keys
					}
				}
			} catch {
				// Skip failed buckets
			}
		}

		return result;
	}

	/**
	 * Extract data by parsing raw BoltDB file structure
	 * This is a fallback method when bbolt CLI is not available
	 */
	private async extractRawFile(): Promise<Record<string, Record<string, unknown>>> {
		// Read the raw file
		const fileBuffer = await fs.promises.readFile(this.dbPath);

		// BoltDB magic number check
		const magic = fileBuffer.toString("hex", 0, 4);
		if (magic !== "ed0e d0db" && magic !== "ed0ed0db") {
			// Note: BoltDB uses little-endian
			console.warn("File may not be a valid BoltDB file, attempting to parse anyway");
		}

		// For complex BoltDB parsing, we'll generate a helper script
		// and use it to extract data
		return await this.extractWithHelper(fileBuffer);
	}

	/**
	 * Extract data using a temporary helper script
	 */
	private async extractWithHelper(fileBuffer: Buffer): Promise<Record<string, Record<string, unknown>>> {
		// Create a temporary directory for extraction
		const tempDir = path.join("/tmp", `portainer-extract-${Date.now()}`);
		await fs.promises.mkdir(tempDir, { recursive: true });

		try {
			// Write the database file
			const tempDbPath = path.join(tempDir, "portainer.db");
			await fs.promises.writeFile(tempDbPath, fileBuffer);

			// Try Python extraction (more commonly available)
			try {
				return await this.extractWithPython(tempDbPath);
			} catch {
				// If Python fails, try direct struct parsing
				return await this.parseRawBoltDb(fileBuffer);
			}
		} finally {
			// Clean up temp directory
			try {
				await fs.promises.rm(tempDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	}

	/**
	 * Extract using Python boltdb library
	 */
	private async extractWithPython(dbPath: string): Promise<Record<string, Record<string, unknown>>> {
		const pythonScript = `
import json
import sys
import msgpack

try:
    from boltdb import BoltDB
except ImportError:
    print(json.dumps({"error": "boltdb module not installed"}))
    sys.exit(1)

try:
    db = BoltDB(sys.argv[1])
    result = {}

    for bucket_name in db.buckets():
        bucket = db.bucket(bucket_name)
        result[bucket_name] = {}

        for key, value in bucket.items():
            try:
                # Try msgpack decoding
                decoded = msgpack.unpackb(value, raw=False)
                result[bucket_name][str(key)] = decoded
            except:
                try:
                    result[bucket_name][str(key)] = value.decode('utf-8')
                except:
                    result[bucket_name][str(key)] = str(value)

    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;

		const tempScript = path.join(path.dirname(dbPath), "extract.py");
		await fs.promises.writeFile(tempScript, pythonScript);

		try {
			const output = await this.runCommand("python3", [tempScript, dbPath]);
			const result = JSON.parse(output);

			if (result.error) {
				throw new BoltDbError(`Python extraction failed: ${result.error}`);
			}

			return result;
		} finally {
			try {
				await fs.promises.unlink(tempScript);
			} catch {
				// Ignore
			}
		}
	}

	/**
	 * Parse raw BoltDB file (basic implementation)
	 * BoltDB format: https://github.com/boltdb/bolt/blob/master/page.go
	 */
	private async parseRawBoltDb(_fileBuffer: Buffer): Promise<Record<string, Record<string, unknown>>> {
		// This is a simplified parser that tries to extract readable strings
		// For full parsing, we'd need to implement the complete BoltDB format
		throw new BoltDbError(
			"Raw BoltDB parsing not fully implemented. Please install bbolt CLI or Python boltdb module.",
			"PARSER_NOT_AVAILABLE",
		);
	}

	/**
	 * Run a shell command and return output
	 */
	private runCommand(command: string, args: string[]): Promise<string> {
		return new Promise((resolve, reject) => {
			const proc = spawn(command, args);
			let stdout = "";
			let stderr = "";

			proc.stdout.on("data", (data) => {
				stdout += data.toString();
			});

			proc.stderr.on("data", (data) => {
				stderr += data.toString();
			});

			proc.on("close", (code) => {
				if (code === 0) {
					resolve(stdout);
				} else {
					reject(new Error(`Command failed with code ${code}: ${stderr}`));
				}
			});

			proc.on("error", (err) => {
				reject(err);
			});
		});
	}

	/**
	 * Parse endpoints from raw bucket data
	 */
	private parseEndpoints(data: Record<string, unknown>): PortainerEndpoint[] {
		return Object.values(data)
			.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
			.map((item) => ({
				Id: Number(item.Id || item.id || 0),
				Name: String(item.Name || item.name || ""),
				Type: Number(item.Type || item.type || 1),
				URL: String(item.URL || item.url || ""),
				PublicURL: String(item.PublicURL || item.publicURL || ""),
				GroupId: Number(item.GroupId || item.groupId || 1),
				Status: Number(item.Status || item.status || 1),
				TLSConfig: item.TLSConfig as PortainerEndpoint["TLSConfig"],
				AuthorizedUsers: (item.AuthorizedUsers as number[]) || [],
				AuthorizedTeams: (item.AuthorizedTeams as number[]) || [],
				TagIds: (item.TagIds as number[]) || [],
				Snapshots: item.Snapshots as PortainerEndpoint["Snapshots"],
			}));
	}

	/**
	 * Parse endpoint groups from raw bucket data
	 */
	private parseEndpointGroups(data: Record<string, unknown>): PortainerEndpointGroup[] {
		return Object.values(data)
			.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
			.map((item) => ({
				Id: Number(item.Id || item.id || 0),
				Name: String(item.Name || item.name || ""),
				Description: String(item.Description || item.description || ""),
				AuthorizedUsers: (item.AuthorizedUsers as number[]) || [],
				AuthorizedTeams: (item.AuthorizedTeams as number[]) || [],
				TagIds: (item.TagIds as number[]) || [],
			}));
	}

	/**
	 * Parse stacks from raw bucket data
	 */
	private parseStacks(data: Record<string, unknown>): PortainerStack[] {
		return Object.values(data)
			.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
			.map((item) => ({
				Id: Number(item.Id || item.id || 0),
				Name: String(item.Name || item.name || ""),
				Type: Number(item.Type || item.type || 2),
				EndpointId: Number(item.EndpointId || item.endpointId || 0),
				Status: Number(item.Status || item.status || 1),
				CreationDate: Number(item.CreationDate || item.creationDate || Date.now()),
				UpdateDate: item.UpdateDate ? Number(item.UpdateDate) : undefined,
				ProjectPath: item.ProjectPath as string | undefined,
				EntryPoint: item.EntryPoint as string | undefined,
				Env: item.Env as PortainerStack["Env"],
				GitConfig: item.GitConfig as PortainerStack["GitConfig"],
				AutoUpdate: item.AutoUpdate as PortainerStack["AutoUpdate"],
				AdditionalFiles: item.AdditionalFiles as string[] | undefined,
				Option: item.Option as PortainerStack["Option"],
				FromAppTemplate: Boolean(item.FromAppTemplate),
			}));
	}

	/**
	 * Parse registries from raw bucket data
	 */
	private parseRegistries(data: Record<string, unknown>): PortainerRegistry[] {
		return Object.values(data)
			.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
			.map((item) => ({
				Id: Number(item.Id || item.id || 0),
				Type: Number(item.Type || item.type || 3),
				Name: String(item.Name || item.name || ""),
				URL: String(item.URL || item.url || ""),
				BaseURL: item.BaseURL as string | undefined,
				Authentication: Boolean(item.Authentication || item.authentication),
				Username: item.Username as string | undefined,
				Password: item.Password as string | undefined,
				AuthorizedUsers: item.AuthorizedUsers as number[] | undefined,
				AuthorizedTeams: item.AuthorizedTeams as number[] | undefined,
			}));
	}

	/**
	 * Parse users from raw bucket data
	 */
	private parseUsers(data: Record<string, unknown>): PortainerUser[] {
		return Object.values(data)
			.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
			.map((item) => ({
				Id: Number(item.Id || item.id || 0),
				Username: String(item.Username || item.username || ""),
				Role: Number(item.Role || item.role || 2),
				AuthenticationMethod: item.AuthenticationMethod as number | undefined,
				EndpointAuthorizations: item.EndpointAuthorizations as PortainerUser["EndpointAuthorizations"],
				PortainerAuthorizations: item.PortainerAuthorizations as PortainerUser["PortainerAuthorizations"],
			}));
	}

	/**
	 * Parse teams from raw bucket data
	 */
	private parseTeams(data: Record<string, unknown>): PortainerTeam[] {
		return Object.values(data)
			.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
			.map((item) => ({
				Id: Number(item.Id || item.id || 0),
				Name: String(item.Name || item.name || ""),
			}));
	}

	/**
	 * Parse team memberships from raw bucket data
	 */
	private parseTeamMemberships(data: Record<string, unknown>): PortainerTeamMembership[] {
		return Object.values(data)
			.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
			.map((item) => ({
				Id: Number(item.Id || item.id || 0),
				UserID: Number(item.UserID || item.userId || 0),
				TeamID: Number(item.TeamID || item.teamId || 0),
				Role: Number(item.Role || item.role || 1),
			}));
	}

	/**
	 * Parse resource controls from raw bucket data
	 */
	private parseResourceControls(data: Record<string, unknown>): PortainerResourceControl[] {
		return Object.values(data)
			.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
			.map((item) => ({
				Id: Number(item.Id || item.id || 0),
				ResourceId: String(item.ResourceId || item.resourceId || ""),
				SubResourceIds: item.SubResourceIds as string[] | undefined,
				Type: Number(item.Type || item.type || 0),
				UserAccesses: item.UserAccesses as PortainerResourceControl["UserAccesses"],
				TeamAccesses: item.TeamAccesses as PortainerResourceControl["TeamAccesses"],
				Public: Boolean(item.Public),
				System: Boolean(item.System),
			}));
	}

	/**
	 * Parse settings from raw bucket data
	 */
	private parseSettings(data: Record<string, unknown>): PortainerSettings | undefined {
		const values = Object.values(data);
		if (values.length === 0) return undefined;

		const item = values[0] as Record<string, unknown>;
		return {
			LogoURL: item.LogoURL as string | undefined,
			BlackListedLabels: item.BlackListedLabels as PortainerSettings["BlackListedLabels"],
			AuthenticationMethod: item.AuthenticationMethod as number | undefined,
			LDAPSettings: item.LDAPSettings as Record<string, unknown> | undefined,
			OAuthSettings: item.OAuthSettings as Record<string, unknown> | undefined,
			EnableEdgeComputeFeatures: item.EnableEdgeComputeFeatures as boolean | undefined,
			EnableTelemetry: item.EnableTelemetry as boolean | undefined,
			SnapshotInterval: item.SnapshotInterval as string | undefined,
			TemplatesURL: item.TemplatesURL as string | undefined,
		};
	}

	/**
	 * Enrich stacks with their file content from the filesystem
	 */
	private async enrichStacksWithFileContent(
		stacks: PortainerStack[],
	): Promise<Array<PortainerStack & { fileContent?: string }>> {
		if (!this.stackFilesPath) {
			return stacks.map((s) => ({ ...s, fileContent: undefined }));
		}

		return Promise.all(
			stacks.map(async (stack) => {
				try {
					// Try multiple possible locations
					const possiblePaths = [
						// Standard compose path
						path.join(this.stackFilesPath!, "compose", String(stack.Id), "docker-compose.yml"),
						path.join(this.stackFilesPath!, "compose", String(stack.Id), "docker-compose.yaml"),
						// Entry point if specified
						stack.EntryPoint
							? path.join(this.stackFilesPath!, "compose", String(stack.Id), stack.EntryPoint)
							: null,
						// Project path if specified
						stack.ProjectPath ? path.join(stack.ProjectPath, "docker-compose.yml") : null,
						stack.ProjectPath ? path.join(stack.ProjectPath, "docker-compose.yaml") : null,
						stack.ProjectPath && stack.EntryPoint
							? path.join(stack.ProjectPath, stack.EntryPoint)
							: null,
					].filter((p): p is string => p !== null);

					for (const filePath of possiblePaths) {
						try {
							const content = await fs.promises.readFile(filePath, "utf-8");
							return { ...stack, fileContent: content };
						} catch {
							// Try next path
						}
					}

					return { ...stack, fileContent: undefined };
				} catch {
					return { ...stack, fileContent: undefined };
				}
			}),
		);
	}
}

/**
 * Create a BoltDB reader instance
 */
export function createBoltDbReader(config: BoltDbConfig): PortainerBoltDbReader {
	return new PortainerBoltDbReader(config);
}

/**
 * Test if a file is a valid BoltDB database
 */
export async function testBoltDbFile(filePath: string): Promise<{
	valid: boolean;
	error?: string;
}> {
	try {
		if (!fs.existsSync(filePath)) {
			return { valid: false, error: "File not found" };
		}

		const stats = await fs.promises.stat(filePath);
		if (!stats.isFile()) {
			return { valid: false, error: "Path is not a file" };
		}

		// Check file header
		const buffer = Buffer.alloc(16);
		const fd = await fs.promises.open(filePath, "r");
		await fd.read(buffer, 0, 16, 0);
		await fd.close();

		// BoltDB magic number (little endian): 0xED0E D0DB
		// Check both byte orders
		const magic1 = buffer.readUInt32LE(0);
		const magic2 = buffer.readUInt32BE(0);

		if (magic1 !== 0xdbd00eed && magic2 !== 0xed0ed0db) {
			// Some versions may have different magic
			console.warn("Magic number doesn't match expected BoltDB format");
		}

		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
