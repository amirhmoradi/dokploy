/**
 * Portainer API Client
 *
 * Handles communication with the Portainer REST API for migration purposes.
 */

import type {
  PortainerEndpoint,
  PortainerEndpointGroup,
  PortainerRegistry,
  PortainerStack,
  PortainerTeam,
  PortainerTeamMembership,
  PortainerUser,
  PortainerSettings,
} from "../types/index.js";

export interface PortainerApiConfig {
  url: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

export interface PortainerStatus {
  version: string;
  instanceId: string;
}

export class PortainerApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "PortainerApiError";
  }
}

export class PortainerApiClient {
  private baseUrl: string;
  private apiKey?: string;
  private username?: string;
  private password?: string;
  private authToken?: string;

  constructor(config: PortainerApiConfig) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.username = config.username;
    this.password = config.password;
  }

  /**
   * Authenticate with Portainer
   */
  async authenticate(): Promise<void> {
    if (this.apiKey) {
      // API key doesn't need authentication
      return;
    }

    if (!this.username || !this.password) {
      throw new PortainerApiError("Username and password required for authentication");
    }

    const response = await this.request<{ jwt: string }>("POST", "/api/auth", {
      username: this.username,
      password: this.password,
    });

    this.authToken = response.jwt;
  }

  /**
   * Test connection to Portainer
   */
  async testConnection(): Promise<PortainerStatus> {
    await this.authenticate();
    const status = await this.request<PortainerStatus>("GET", "/api/status");
    return status;
  }

  /**
   * Get all endpoints
   */
  async getEndpoints(): Promise<PortainerEndpoint[]> {
    return this.request<PortainerEndpoint[]>("GET", "/api/endpoints");
  }

  /**
   * Get all endpoint groups
   */
  async getEndpointGroups(): Promise<PortainerEndpointGroup[]> {
    return this.request<PortainerEndpointGroup[]>("GET", "/api/endpoint_groups");
  }

  /**
   * Get all stacks
   */
  async getStacks(): Promise<PortainerStack[]> {
    return this.request<PortainerStack[]>("GET", "/api/stacks");
  }

  /**
   * Get stack file content
   */
  async getStackFile(stackId: number): Promise<string> {
    const response = await this.request<{ StackFileContent: string }>(
      "GET",
      `/api/stacks/${stackId}/file`
    );
    return response.StackFileContent;
  }

  /**
   * Get all registries
   */
  async getRegistries(): Promise<PortainerRegistry[]> {
    return this.request<PortainerRegistry[]>("GET", "/api/registries");
  }

  /**
   * Get all users
   */
  async getUsers(): Promise<PortainerUser[]> {
    return this.request<PortainerUser[]>("GET", "/api/users");
  }

  /**
   * Get all teams
   */
  async getTeams(): Promise<PortainerTeam[]> {
    return this.request<PortainerTeam[]>("GET", "/api/teams");
  }

  /**
   * Get team memberships
   */
  async getTeamMemberships(): Promise<PortainerTeamMembership[]> {
    return this.request<PortainerTeamMembership[]>("GET", "/api/team_memberships");
  }

  /**
   * Get settings
   */
  async getSettings(): Promise<PortainerSettings> {
    return this.request<PortainerSettings>("GET", "/api/settings");
  }

  /**
   * Fetch all data needed for migration
   */
  async fetchAllData(): Promise<{
    endpoints: PortainerEndpoint[];
    endpointGroups: PortainerEndpointGroup[];
    stacks: Array<PortainerStack & { fileContent?: string }>;
    registries: PortainerRegistry[];
    users: PortainerUser[];
    teams: PortainerTeam[];
    teamMemberships: PortainerTeamMembership[];
    settings?: PortainerSettings;
  }> {
    await this.authenticate();

    const [endpoints, endpointGroups, stacksRaw, registries, users, teams, teamMemberships] =
      await Promise.all([
        this.getEndpoints(),
        this.getEndpointGroups(),
        this.getStacks(),
        this.getRegistries(),
        this.getUsers(),
        this.getTeams(),
        this.getTeamMemberships(),
      ]);

    // Fetch stack file contents
    const stacks = await Promise.all(
      stacksRaw.map(async (stack) => {
        try {
          const fileContent = await this.getStackFile(stack.Id);
          return { ...stack, fileContent };
        } catch {
          return { ...stack, fileContent: undefined };
        }
      })
    );

    let settings: PortainerSettings | undefined;
    try {
      settings = await this.getSettings();
    } catch {
      // Settings might not be accessible
    }

    return {
      endpoints,
      endpointGroups,
      stacks,
      registries,
      users,
      teams,
      teamMemberships,
      settings,
    };
  }

  /**
   * Make an HTTP request to Portainer API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    } else if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }

      throw new PortainerApiError(
        `Portainer API error: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    return response.json() as Promise<T>;
  }
}

/**
 * Test connection to Portainer
 */
export async function testPortainerConnection(
  config: PortainerApiConfig
): Promise<{ success: boolean; version?: string; error?: string }> {
  try {
    const client = new PortainerApiClient(config);
    const status = await client.testConnection();
    return { success: true, version: status.version };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a new Portainer API client
 */
export function createPortainerApiClient(config: PortainerApiConfig): PortainerApiClient {
  return new PortainerApiClient(config);
}
