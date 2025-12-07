/**
 * Portainer to Dokploy Data Transformer
 *
 * Transforms Portainer data structures into Dokploy-compatible formats.
 * Handles mapping of concepts that don't have direct equivalents.
 */

import type {
	PortainerEndpoint,
	PortainerEndpointGroup,
	PortainerRegistry,
	PortainerStack,
	PortainerTeam,
	PortainerTeamMembership,
	PortainerUser,
} from "./portainer-api-client";
import type {
	PortainerEndpointAnalysis,
	PortainerRegistryAnalysis,
	PortainerStackAnalysis,
	PortainerTeamAnalysis,
	PortainerUserAnalysis,
} from "../../db/schema/portainer-migration";

// Dokploy types (based on schema)
export interface DokployServer {
	name: string;
	description?: string;
	ipAddress: string;
	port: number;
	username: string;
	sshKeyId?: string;
	serverType: "deploy" | "build";
}

export interface DokployProject {
	name: string;
	description?: string;
}

export interface DokployEnvironment {
	name: string;
	description?: string;
	projectId: string;
}

export interface DokployCompose {
	name: string;
	description?: string;
	composeFile: string;
	env?: string;
	sourceType: "git" | "github" | "gitlab" | "bitbucket" | "gitea" | "raw";
	composeType: "docker-compose" | "stack";
	environmentId: string;
	serverId?: string;
	// Git options
	customGitUrl?: string;
	customGitBranch?: string;
}

export interface DokployRegistry {
	registryName: string;
	registryUrl: string;
	username: string;
	password: string;
	registryType: "selfHosted" | "cloud";
	imagePrefix?: string;
}

export interface DokployUser {
	email: string;
	name: string;
	password?: string;
}

export interface DokployMember {
	userId: string;
	organizationId: string;
	role: "owner" | "admin" | "member";
	canCreateProjects: boolean;
	canAccessToSSHKeys: boolean;
	canCreateServices: boolean;
	canDeleteProjects: boolean;
	canDeleteServices: boolean;
	canAccessToDocker: boolean;
	canAccessToAPI: boolean;
	canAccessToGitProviders: boolean;
	canAccessToTraefikFiles: boolean;
}

/**
 * Analysis result for migration planning
 */
export interface MigrationAnalysis {
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
		migratable: {
			endpoints: number;
			stacks: number;
			registries: number;
			users: number;
			teams: number;
		};
		warnings: string[];
		errors: string[];
	};
}

/**
 * Portainer endpoint types
 */
const ENDPOINT_TYPES: Record<number, string> = {
	1: "Docker",
	2: "Agent on Docker",
	3: "Azure ACI",
	4: "Edge Agent on Docker",
	5: "Kubernetes",
	6: "Agent on Kubernetes",
	7: "Edge Agent on Kubernetes",
};

/**
 * Portainer stack types
 */
const STACK_TYPES: Record<number, string> = {
	1: "Swarm",
	2: "Compose",
	3: "Kubernetes",
};

/**
 * Portainer registry types
 */
const REGISTRY_TYPES: Record<number, string> = {
	1: "Quay.io",
	2: "Azure Container Registry",
	3: "Custom Registry",
	4: "GitLab Registry",
	5: "ProGet Registry",
	6: "Docker Hub",
	7: "Amazon ECR",
	8: "GitHub Registry",
};

/**
 * Portainer user roles
 */
const USER_ROLES: Record<number, string> = {
	1: "Administrator",
	2: "Standard User",
	3: "Read-Only User",
};

/**
 * Portainer Data Transformer
 */
export class PortainerTransformer {
	private endpointGroups: Map<number, PortainerEndpointGroup>;
	private teamMemberships: Map<number, PortainerTeamMembership[]>;

	constructor(
		endpointGroups: PortainerEndpointGroup[] = [],
		teamMemberships: PortainerTeamMembership[] = [],
	) {
		this.endpointGroups = new Map(endpointGroups.map((g) => [g.Id, g]));
		this.teamMemberships = new Map();

		// Group memberships by team
		for (const membership of teamMemberships) {
			const existing = this.teamMemberships.get(membership.TeamID) || [];
			existing.push(membership);
			this.teamMemberships.set(membership.TeamID, existing);
		}
	}

	/**
	 * Analyze Portainer data for migration
	 */
	analyzeData(data: {
		endpoints: PortainerEndpoint[];
		stacks: Array<PortainerStack & { fileContent?: string }>;
		registries: PortainerRegistry[];
		users: PortainerUser[];
		teams: PortainerTeam[];
	}): MigrationAnalysis {
		const warnings: string[] = [];
		const errors: string[] = [];

		// Analyze endpoints
		const endpointAnalysis = data.endpoints.map((endpoint) =>
			this.analyzeEndpoint(endpoint, warnings, errors),
		);

		// Analyze stacks
		const stackAnalysis = data.stacks.map((stack) =>
			this.analyzeStack(stack, warnings, errors),
		);

		// Analyze registries
		const registryAnalysis = data.registries.map((registry) =>
			this.analyzeRegistry(registry, warnings, errors),
		);

		// Analyze users
		const userAnalysis = data.users.map((user) => this.analyzeUser(user, warnings, errors));

		// Analyze teams
		const teamAnalysis = data.teams.map((team) => this.analyzeTeam(team, warnings, errors));

		return {
			endpoints: endpointAnalysis,
			stacks: stackAnalysis,
			registries: registryAnalysis,
			users: userAnalysis,
			teams: teamAnalysis,
			summary: {
				totalEndpoints: data.endpoints.length,
				totalStacks: data.stacks.length,
				totalRegistries: data.registries.length,
				totalUsers: data.users.length,
				totalTeams: data.teams.length,
				migratable: {
					endpoints: endpointAnalysis.filter((e) => e.canMigrate).length,
					stacks: stackAnalysis.filter((s) => s.canMigrate).length,
					registries: registryAnalysis.filter((r) => r.canMigrate).length,
					users: userAnalysis.filter((u) => u.canMigrate).length,
					teams: teamAnalysis.filter((t) => t.canMigrate).length,
				},
				warnings,
				errors,
			},
		};
	}

	/**
	 * Analyze a single endpoint
	 */
	private analyzeEndpoint(
		endpoint: PortainerEndpoint,
		warnings: string[],
		errors: string[],
	): PortainerEndpointAnalysis {
		const notes: string[] = [];
		const endpointWarnings: string[] = [];
		let canMigrate = true;

		const typeName = ENDPOINT_TYPES[endpoint.Type] || `Unknown (${endpoint.Type})`;
		notes.push(`Type: ${typeName}`);

		// Check endpoint type compatibility
		if (endpoint.Type === 3) {
			// Azure ACI
			canMigrate = false;
			endpointWarnings.push("Azure ACI endpoints are not supported in Dokploy");
			errors.push(`Endpoint "${endpoint.Name}": Azure ACI is not supported`);
		} else if (endpoint.Type === 5 || endpoint.Type === 6 || endpoint.Type === 7) {
			// Kubernetes
			canMigrate = false;
			endpointWarnings.push("Kubernetes endpoints are not supported in Dokploy");
			warnings.push(`Endpoint "${endpoint.Name}": Kubernetes endpoints will be skipped`);
		} else if (endpoint.Type === 4 || endpoint.Type === 7) {
			// Edge Agent
			endpointWarnings.push(
				"Edge Agent endpoints may require manual reconfiguration",
			);
			warnings.push(
				`Endpoint "${endpoint.Name}": Edge Agent may need manual setup`,
			);
		}

		// Check TLS configuration
		if (endpoint.TLSConfig?.TLS) {
			notes.push("TLS enabled - will need SSH key configuration in Dokploy");
			if (endpoint.TLSConfig.TLSSkipVerify) {
				endpointWarnings.push("TLS certificate verification is disabled");
			}
		}

		// Parse URL to extract IP and port
		let url = endpoint.URL;
		if (url.startsWith("tcp://")) {
			url = url.replace("tcp://", "");
		} else if (url.startsWith("unix://")) {
			notes.push("Unix socket connection - will need SSH access for migration");
		}

		// Check status
		if (endpoint.Status !== 1) {
			endpointWarnings.push("Endpoint is not in active status");
		}

		return {
			id: endpoint.Id,
			name: endpoint.Name,
			type: endpoint.Type,
			url: endpoint.URL,
			publicUrl: endpoint.PublicURL,
			status: endpoint.Status,
			tlsConfig: endpoint.TLSConfig
				? {
						tls: endpoint.TLSConfig.TLS,
						tlsSkipVerify: endpoint.TLSConfig.TLSSkipVerify,
					}
				: undefined,
			canMigrate,
			migrationNotes: notes,
			warnings: endpointWarnings,
		};
	}

	/**
	 * Analyze a single stack
	 */
	private analyzeStack(
		stack: PortainerStack & { fileContent?: string },
		warnings: string[],
		errors: string[],
	): PortainerStackAnalysis {
		const notes: string[] = [];
		const stackWarnings: string[] = [];
		let canMigrate = true;

		const typeName = STACK_TYPES[stack.Type] || `Unknown (${stack.Type})`;
		notes.push(`Type: ${typeName}`);

		// Check stack type
		if (stack.Type === 3) {
			// Kubernetes
			canMigrate = false;
			stackWarnings.push("Kubernetes stacks are not supported in Dokploy");
			errors.push(`Stack "${stack.Name}": Kubernetes stacks cannot be migrated`);
		}

		// Check for compose file
		if (!stack.fileContent) {
			canMigrate = false;
			stackWarnings.push("Compose file content not available");
			errors.push(`Stack "${stack.Name}": Could not retrieve compose file`);
		} else {
			notes.push(`Compose file: ${stack.fileContent.length} characters`);
		}

		// Check for git configuration
		if (stack.GitConfig?.URL) {
			notes.push(`Git source: ${stack.GitConfig.URL}`);
			if (stack.GitConfig.Authentication) {
				stackWarnings.push("Git authentication will need to be reconfigured");
			}
		}

		// Check environment variables
		if (stack.Env && stack.Env.length > 0) {
			notes.push(`Environment variables: ${stack.Env.length}`);
		}

		// Check auto-update
		if (stack.AutoUpdate) {
			notes.push("Auto-update enabled - will be migrated to Dokploy schedule");
		}

		// Check additional files
		if (stack.AdditionalFiles && stack.AdditionalFiles.length > 0) {
			stackWarnings.push(
				`${stack.AdditionalFiles.length} additional files may need manual migration`,
			);
			warnings.push(
				`Stack "${stack.Name}": Has ${stack.AdditionalFiles.length} additional files`,
			);
		}

		return {
			id: stack.Id,
			name: stack.Name,
			type: stack.Type,
			endpointId: stack.EndpointId,
			status: stack.Status,
			composeFile: stack.fileContent,
			env: stack.Env,
			gitConfig: stack.GitConfig
				? {
						url: stack.GitConfig.URL,
						referenceName: stack.GitConfig.ReferenceName,
						authentication: Boolean(stack.GitConfig.Authentication),
					}
				: undefined,
			canMigrate,
			migrationNotes: notes,
			warnings: stackWarnings,
		};
	}

	/**
	 * Analyze a single registry
	 */
	private analyzeRegistry(
		registry: PortainerRegistry,
		_warnings: string[],
		_errors: string[],
	): PortainerRegistryAnalysis {
		const notes: string[] = [];
		const registryWarnings: string[] = [];
		const canMigrate = true;

		const typeName = REGISTRY_TYPES[registry.Type] || `Unknown (${registry.Type})`;
		notes.push(`Type: ${typeName}`);

		if (registry.Authentication) {
			notes.push("Authentication enabled");
			if (!registry.Username || !registry.Password) {
				registryWarnings.push("Credentials may need to be re-entered");
			}
		} else {
			notes.push("No authentication (public registry)");
		}

		// Map registry type
		if (registry.Type === 6) {
			notes.push("Docker Hub will be migrated as cloud registry");
		} else if (registry.Type === 7) {
			registryWarnings.push("AWS ECR may need additional configuration");
		} else if (registry.Type === 2) {
			registryWarnings.push("Azure Container Registry may need additional configuration");
		}

		return {
			id: registry.Id,
			name: registry.Name,
			type: registry.Type,
			url: registry.URL,
			authentication: registry.Authentication,
			canMigrate,
			migrationNotes: notes,
			warnings: registryWarnings,
		};
	}

	/**
	 * Analyze a single user
	 */
	private analyzeUser(
		user: PortainerUser,
		warnings: string[],
		_errors: string[],
	): PortainerUserAnalysis {
		const notes: string[] = [];
		const userWarnings: string[] = [];
		const canMigrate = true;

		const roleName = USER_ROLES[user.Role] || `Unknown (${user.Role})`;
		notes.push(`Role: ${roleName}`);

		// Check authentication method
		if (user.AuthenticationMethod && user.AuthenticationMethod !== 1) {
			userWarnings.push("Non-internal authentication will require reconfiguration");
			warnings.push(`User "${user.Username}": Uses external authentication`);
		}

		// Check endpoint authorizations
		if (user.EndpointAuthorizations) {
			const endpointCount = Object.keys(user.EndpointAuthorizations).length;
			notes.push(`Has access to ${endpointCount} endpoints`);
		}

		return {
			id: user.Id,
			username: user.Username,
			role: user.Role,
			canMigrate,
			migrationNotes: notes,
			warnings: userWarnings,
		};
	}

	/**
	 * Analyze a single team
	 */
	private analyzeTeam(
		team: PortainerTeam,
		_warnings: string[],
		_errors: string[],
	): PortainerTeamAnalysis {
		const notes: string[] = [];
		const teamWarnings: string[] = [];
		const canMigrate = true;

		// Get member count
		const members = this.teamMemberships.get(team.Id) || [];
		notes.push(`Members: ${members.length}`);

		if (members.length === 0) {
			teamWarnings.push("Team has no members");
		}

		// Note about team migration
		notes.push("Teams will be migrated as organization member roles");

		return {
			id: team.Id,
			name: team.Name,
			memberCount: members.length,
			canMigrate,
			migrationNotes: notes,
			warnings: teamWarnings,
		};
	}

	/**
	 * Transform endpoint to Dokploy server
	 */
	transformEndpoint(endpoint: PortainerEndpoint): DokployServer | null {
		// Skip non-Docker endpoints
		if (endpoint.Type === 3 || endpoint.Type >= 5) {
			return null;
		}

		// Parse URL
		let url = endpoint.URL;
		let ipAddress = "127.0.0.1";
		let port = 22; // Default SSH port

		if (url.startsWith("tcp://")) {
			url = url.replace("tcp://", "");
			const parts = url.split(":");
			ipAddress = parts[0];
			// Note: Portainer uses Docker port (2375/2376), Dokploy uses SSH port
		} else if (url.startsWith("unix://")) {
			// Local Docker socket - assume localhost
			ipAddress = "127.0.0.1";
		}

		// Get endpoint group for description
		const group = endpoint.GroupId ? this.endpointGroups.get(endpoint.GroupId) : null;

		return {
			name: endpoint.Name,
			description: group?.Description || `Migrated from Portainer endpoint ${endpoint.Id}`,
			ipAddress,
			port,
			username: "root", // Will need to be configured
			serverType: "deploy",
		};
	}

	/**
	 * Transform stack to Dokploy compose
	 */
	transformStack(
		stack: PortainerStack & { fileContent?: string },
		environmentId: string,
		serverId?: string,
	): DokployCompose | null {
		if (!stack.fileContent || stack.Type === 3) {
			return null;
		}

		// Convert environment variables to string format
		let envString = "";
		if (stack.Env && stack.Env.length > 0) {
			envString = stack.Env.map((e) => `${e.name}=${e.value}`).join("\n");
		}

		const compose: DokployCompose = {
			name: stack.Name,
			description: `Migrated from Portainer stack ${stack.Id}`,
			composeFile: stack.fileContent,
			env: envString || undefined,
			sourceType: stack.GitConfig?.URL ? "git" : "raw",
			composeType: stack.Type === 1 ? "stack" : "docker-compose",
			environmentId,
			serverId,
		};

		// Add git configuration if present
		if (stack.GitConfig?.URL) {
			compose.customGitUrl = stack.GitConfig.URL;
			compose.customGitBranch = stack.GitConfig.ReferenceName || "main";
		}

		return compose;
	}

	/**
	 * Transform registry to Dokploy registry
	 */
	transformRegistry(registry: PortainerRegistry): DokployRegistry {
		// Determine registry type
		let registryType: "selfHosted" | "cloud" = "selfHosted";
		let registryUrl = registry.URL;

		// Docker Hub and major cloud providers
		if (registry.Type === 6 || registry.URL.includes("docker.io")) {
			registryType = "cloud";
			registryUrl = "https://index.docker.io/v1/";
		} else if (registry.Type === 7 || registry.URL.includes("amazonaws.com")) {
			registryType = "cloud";
		} else if (registry.Type === 2 || registry.URL.includes("azurecr.io")) {
			registryType = "cloud";
		} else if (registry.Type === 8 || registry.URL.includes("ghcr.io")) {
			registryType = "cloud";
			registryUrl = "https://ghcr.io";
		} else if (registry.Type === 4 || registry.URL.includes("registry.gitlab.com")) {
			registryType = "cloud";
		}

		return {
			registryName: registry.Name,
			registryUrl,
			username: registry.Username || "",
			password: registry.Password || "",
			registryType,
			imagePrefix: registry.BaseURL,
		};
	}

	/**
	 * Transform user to Dokploy user
	 */
	transformUser(user: PortainerUser): DokployUser {
		return {
			name: user.Username,
			email: `${user.Username.toLowerCase().replace(/[^a-z0-9]/g, "")}@migrated.local`,
		};
	}

	/**
	 * Get Dokploy role from Portainer user role
	 */
	getRoleForUser(user: PortainerUser): "owner" | "admin" | "member" {
		switch (user.Role) {
			case 1:
				return "admin";
			case 2:
				return "member";
			case 3:
				return "member"; // Read-only becomes member with limited permissions
			default:
				return "member";
		}
	}

	/**
	 * Transform Portainer permissions to Dokploy member permissions
	 */
	getPermissionsForUser(user: PortainerUser): Partial<DokployMember> {
		const isAdmin = user.Role === 1;
		const isReadOnly = user.Role === 3;

		return {
			canCreateProjects: isAdmin,
			canAccessToSSHKeys: isAdmin,
			canCreateServices: !isReadOnly,
			canDeleteProjects: isAdmin,
			canDeleteServices: !isReadOnly,
			canAccessToDocker: !isReadOnly,
			canAccessToAPI: !isReadOnly,
			canAccessToGitProviders: !isReadOnly,
			canAccessToTraefikFiles: isAdmin,
		};
	}

	/**
	 * Create a project from endpoint group
	 */
	transformEndpointGroup(group: PortainerEndpointGroup): DokployProject {
		return {
			name: group.Name || "Migrated Project",
			description: group.Description || `Migrated from Portainer endpoint group ${group.Id}`,
		};
	}
}

/**
 * Create a new transformer instance
 */
export function createTransformer(
	endpointGroups: PortainerEndpointGroup[] = [],
	teamMemberships: PortainerTeamMembership[] = [],
): PortainerTransformer {
	return new PortainerTransformer(endpointGroups, teamMemberships);
}
