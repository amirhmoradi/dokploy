/**
 * Portainer API Client
 *
 * Handles all communication with Portainer API for migration purposes.
 * Supports both API key and username/password authentication.
 */

export interface PortainerAuthConfig {
	url: string;
	apiKey?: string;
	username?: string;
	password?: string;
}

export interface PortainerEndpoint {
	Id: number;
	Name: string;
	Type: number; // 1=Docker, 2=AgentOnDocker, 3=Azure, 4=EdgeAgentDocker, 5=Kubernetes, 6=AgentOnKubernetes, 7=EdgeAgentKubernetes
	URL: string;
	PublicURL: string;
	GroupId: number;
	Status: number;
	TLSConfig?: {
		TLS: boolean;
		TLSSkipVerify: boolean;
		TLSCACertPath: string;
		TLSCertPath: string;
		TLSKeyPath: string;
	};
	AuthorizedUsers: number[];
	AuthorizedTeams: number[];
	TagIds: number[];
	Snapshots?: PortainerEndpointSnapshot[];
}

export interface PortainerEndpointSnapshot {
	DockerVersion: string;
	TotalCPU: number;
	TotalMemory: number;
	RunningContainerCount: number;
	StoppedContainerCount: number;
	HealthyContainerCount: number;
	UnhealthyContainerCount: number;
	VolumeCount: number;
	ImageCount: number;
	ServiceCount: number;
	StackCount: number;
}

export interface PortainerStack {
	Id: number;
	Name: string;
	Type: number; // 1=Swarm, 2=Compose, 3=Kubernetes
	EndpointId: number;
	Status: number;
	CreationDate: number;
	UpdateDate?: number;
	ProjectPath?: string;
	EntryPoint?: string;
	Env?: Array<{ name: string; value: string }>;
	ResourceControl?: PortainerResourceControl;
	GitConfig?: {
		URL: string;
		ReferenceName: string;
		ConfigFilePath: string;
		Authentication?: {
			Username: string;
			Password: string;
		};
	};
	AutoUpdate?: {
		Interval: string;
		Webhook: string;
	};
	AdditionalFiles?: string[];
	Option?: {
		Prune: boolean;
	};
	FromAppTemplate?: boolean;
}

export interface PortainerStackFile {
	StackFileContent: string;
}

export interface PortainerRegistry {
	Id: number;
	Type: number; // 1=Quay, 2=Azure, 3=Custom, 4=GitLab, 5=ProGet, 6=DockerHub, 7=ECR, 8=GitHub
	Name: string;
	URL: string;
	BaseURL?: string;
	Authentication: boolean;
	Username?: string;
	Password?: string;
	AuthorizedUsers?: number[];
	AuthorizedTeams?: number[];
	ManagementConfiguration?: {
		Type: number;
		Authentication: boolean;
	};
}

export interface PortainerUser {
	Id: number;
	Username: string;
	Role: number; // 1=Admin, 2=Standard, 3=ReadOnly
	AuthenticationMethod?: number;
	TokenIssueDate?: number;
	EndpointAuthorizations?: Record<string, Record<string, boolean>>;
	PortainerAuthorizations?: Record<string, boolean>;
}

export interface PortainerTeam {
	Id: number;
	Name: string;
}

export interface PortainerTeamMembership {
	Id: number;
	UserID: number;
	TeamID: number;
	Role: number;
}

export interface PortainerResourceControl {
	Id: number;
	ResourceId: string;
	SubResourceIds?: string[];
	Type: number;
	UserAccesses?: Array<{ UserId: number; AccessLevel: number }>;
	TeamAccesses?: Array<{ TeamId: number; AccessLevel: number }>;
	Public: boolean;
	System: boolean;
}

export interface PortainerEndpointGroup {
	Id: number;
	Name: string;
	Description: string;
	AuthorizedUsers?: number[];
	AuthorizedTeams?: number[];
	TagIds?: number[];
}

export interface PortainerSettings {
	LogoURL?: string;
	BlackListedLabels?: Array<{ name: string; value: string }>;
	AuthenticationMethod?: number;
	LDAPSettings?: Record<string, unknown>;
	OAuthSettings?: Record<string, unknown>;
	EnableEdgeComputeFeatures?: boolean;
	EnableTelemetry?: boolean;
	SnapshotInterval?: string;
	TemplatesURL?: string;
}

export interface PortainerStatus {
	Version: string;
	InstanceID: string;
}

export class PortainerApiError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public details?: unknown,
	) {
		super(message);
		this.name = "PortainerApiError";
	}
}

export class PortainerApiClient {
	private baseUrl: string;
	private authToken?: string;
	private apiKey?: string;

	constructor(private config: PortainerAuthConfig) {
		// Normalize URL (remove trailing slash)
		this.baseUrl = config.url.replace(/\/+$/, "");
		this.apiKey = config.apiKey;
	}

	/**
	 * Authenticate with Portainer and get a JWT token
	 */
	async authenticate(): Promise<void> {
		// If using API key, no authentication needed
		if (this.apiKey) {
			return;
		}

		if (!this.config.username || !this.config.password) {
			throw new PortainerApiError("Username and password are required for authentication");
		}

		const response = await this.rawRequest("/api/auth", {
			method: "POST",
			body: JSON.stringify({
				username: this.config.username,
				password: this.config.password,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new PortainerApiError(
				`Authentication failed: ${error}`,
				response.status,
			);
		}

		const data = await response.json();
		this.authToken = data.jwt;
	}

	/**
	 * Test connection to Portainer
	 */
	async testConnection(): Promise<PortainerStatus> {
		if (!this.apiKey && !this.authToken) {
			await this.authenticate();
		}
		return await this.request<PortainerStatus>("/api/status");
	}

	/**
	 * Get all endpoints
	 */
	async getEndpoints(): Promise<PortainerEndpoint[]> {
		return await this.request<PortainerEndpoint[]>("/api/endpoints");
	}

	/**
	 * Get a specific endpoint
	 */
	async getEndpoint(id: number): Promise<PortainerEndpoint> {
		return await this.request<PortainerEndpoint>(`/api/endpoints/${id}`);
	}

	/**
	 * Get endpoint groups
	 */
	async getEndpointGroups(): Promise<PortainerEndpointGroup[]> {
		return await this.request<PortainerEndpointGroup[]>("/api/endpoint_groups");
	}

	/**
	 * Get all stacks
	 */
	async getStacks(): Promise<PortainerStack[]> {
		return await this.request<PortainerStack[]>("/api/stacks");
	}

	/**
	 * Get a specific stack
	 */
	async getStack(id: number): Promise<PortainerStack> {
		return await this.request<PortainerStack>(`/api/stacks/${id}`);
	}

	/**
	 * Get stack file content
	 */
	async getStackFile(id: number): Promise<string> {
		const response = await this.request<PortainerStackFile>(`/api/stacks/${id}/file`);
		return response.StackFileContent;
	}

	/**
	 * Get all registries
	 */
	async getRegistries(): Promise<PortainerRegistry[]> {
		return await this.request<PortainerRegistry[]>("/api/registries");
	}

	/**
	 * Get a specific registry
	 */
	async getRegistry(id: number): Promise<PortainerRegistry> {
		return await this.request<PortainerRegistry>(`/api/registries/${id}`);
	}

	/**
	 * Get all users
	 */
	async getUsers(): Promise<PortainerUser[]> {
		return await this.request<PortainerUser[]>("/api/users");
	}

	/**
	 * Get a specific user
	 */
	async getUser(id: number): Promise<PortainerUser> {
		return await this.request<PortainerUser>(`/api/users/${id}`);
	}

	/**
	 * Get all teams
	 */
	async getTeams(): Promise<PortainerTeam[]> {
		return await this.request<PortainerTeam[]>("/api/teams");
	}

	/**
	 * Get a specific team
	 */
	async getTeam(id: number): Promise<PortainerTeam> {
		return await this.request<PortainerTeam>(`/api/teams/${id}`);
	}

	/**
	 * Get team memberships
	 */
	async getTeamMemberships(): Promise<PortainerTeamMembership[]> {
		return await this.request<PortainerTeamMembership[]>("/api/team_memberships");
	}

	/**
	 * Get Portainer settings
	 */
	async getSettings(): Promise<PortainerSettings> {
		return await this.request<PortainerSettings>("/api/settings");
	}

	/**
	 * Get containers for a specific endpoint
	 */
	async getContainers(endpointId: number): Promise<unknown[]> {
		return await this.request<unknown[]>(
			`/api/endpoints/${endpointId}/docker/containers/json?all=true`,
		);
	}

	/**
	 * Get volumes for a specific endpoint
	 */
	async getVolumes(endpointId: number): Promise<{ Volumes: unknown[] }> {
		return await this.request<{ Volumes: unknown[] }>(
			`/api/endpoints/${endpointId}/docker/volumes`,
		);
	}

	/**
	 * Get networks for a specific endpoint
	 */
	async getNetworks(endpointId: number): Promise<unknown[]> {
		return await this.request<unknown[]>(
			`/api/endpoints/${endpointId}/docker/networks`,
		);
	}

	/**
	 * Get images for a specific endpoint
	 */
	async getImages(endpointId: number): Promise<unknown[]> {
		return await this.request<unknown[]>(
			`/api/endpoints/${endpointId}/docker/images/json`,
		);
	}

	/**
	 * Get resource controls
	 */
	async getResourceControls(): Promise<PortainerResourceControl[]> {
		return await this.request<PortainerResourceControl[]>("/api/resource_controls");
	}

	/**
	 * Fetch all data needed for migration
	 */
	async fetchAllData(): Promise<{
		status: PortainerStatus;
		endpoints: PortainerEndpoint[];
		endpointGroups: PortainerEndpointGroup[];
		stacks: Array<PortainerStack & { fileContent?: string }>;
		registries: PortainerRegistry[];
		users: PortainerUser[];
		teams: PortainerTeam[];
		teamMemberships: PortainerTeamMembership[];
		settings: PortainerSettings;
	}> {
		// Ensure we're authenticated
		if (!this.apiKey && !this.authToken) {
			await this.authenticate();
		}

		// Fetch all data in parallel where possible
		const [status, endpoints, endpointGroups, stacks, registries, users, teams, teamMemberships, settings] =
			await Promise.all([
				this.getStatus(),
				this.getEndpoints(),
				this.getEndpointGroups(),
				this.getStacks(),
				this.getRegistries(),
				this.getUsers(),
				this.getTeams(),
				this.getTeamMemberships(),
				this.getSettings(),
			]);

		// Fetch stack files for each stack
		const stacksWithFiles = await Promise.all(
			stacks.map(async (stack) => {
				try {
					const fileContent = await this.getStackFile(stack.Id);
					return { ...stack, fileContent };
				} catch (error) {
					console.warn(`Failed to fetch stack file for stack ${stack.Id}:`, error);
					return { ...stack, fileContent: undefined };
				}
			}),
		);

		return {
			status,
			endpoints,
			endpointGroups,
			stacks: stacksWithFiles,
			registries,
			users,
			teams,
			teamMemberships,
			settings,
		};
	}

	/**
	 * Get Portainer status
	 */
	async getStatus(): Promise<PortainerStatus> {
		return await this.request<PortainerStatus>("/api/status");
	}

	/**
	 * Raw fetch request without auth headers
	 */
	private async rawRequest(path: string, options: RequestInit = {}): Promise<Response> {
		const url = `${this.baseUrl}${path}`;

		return await fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
		});
	}

	/**
	 * Make authenticated request to Portainer API
	 */
	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const url = `${this.baseUrl}${path}`;

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		// Add authentication
		if (this.apiKey) {
			headers["X-API-Key"] = this.apiKey;
		} else if (this.authToken) {
			headers["Authorization"] = `Bearer ${this.authToken}`;
		}

		const response = await fetch(url, {
			...options,
			headers: {
				...headers,
				...options.headers,
			},
		});

		if (!response.ok) {
			let errorMessage = `Request failed with status ${response.status}`;
			try {
				const errorBody = await response.text();
				errorMessage = `${errorMessage}: ${errorBody}`;
			} catch {
				// Ignore error parsing
			}
			throw new PortainerApiError(errorMessage, response.status);
		}

		return await response.json();
	}
}

/**
 * Create a new Portainer API client
 */
export function createPortainerApiClient(config: PortainerAuthConfig): PortainerApiClient {
	return new PortainerApiClient(config);
}

/**
 * Test Portainer connection
 */
export async function testPortainerConnection(config: PortainerAuthConfig): Promise<{
	success: boolean;
	version?: string;
	instanceId?: string;
	error?: string;
}> {
	try {
		const client = createPortainerApiClient(config);
		const status = await client.testConnection();
		return {
			success: true,
			version: status.Version,
			instanceId: status.InstanceID,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
