/**
 * Portainer BoltDB Reader
 *
 * Reads Portainer data directly from its BoltDB database file.
 * Used for offline migration when the Portainer API is not available.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type {
  PortainerEndpoint,
  PortainerEndpointGroup,
  PortainerRegistry,
  PortainerStack,
  PortainerTeam,
  PortainerTeamMembership,
  PortainerUser,
  PortainerResourceControl,
  PortainerSettings,
} from "../types/index.js";

export interface BoltDbConfig {
  dbPath: string;
  stackFilesPath?: string;
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
    public details?: unknown
  ) {
    super(message);
    this.name = "BoltDbError";
  }
}

const BUCKET_NAMES = {
  ENDPOINTS: "endpoints",
  ENDPOINT_GROUPS: "endpoint_groups",
  STACKS: "stacks",
  REGISTRIES: "registries",
  USERS: "users",
  TEAMS: "teams",
  TEAM_MEMBERSHIPS: "team_memberships",
  RESOURCE_CONTROLS: "resource_controls",
  SETTINGS: "settings",
  VERSION: "version",
};

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

  private async extractAllBuckets(): Promise<Record<string, Record<string, unknown>>> {
    try {
      return await this.extractWithBbolt();
    } catch {
      return await this.extractRawFile();
    }
  }

  private async extractWithBbolt(): Promise<Record<string, Record<string, unknown>>> {
    const result: Record<string, Record<string, unknown>> = {};

    const buckets = await this.runCommand("bbolt", ["buckets", this.dbPath]);
    const bucketList = buckets.split("\n").filter(Boolean);

    for (const bucket of bucketList) {
      try {
        const keysOutput = await this.runCommand("bbolt", ["keys", this.dbPath, bucket]);
        const keys = keysOutput.split("\n").filter(Boolean);

        result[bucket] = {};

        for (const key of keys) {
          try {
            const value = await this.runCommand("bbolt", ["get", this.dbPath, bucket, key]);
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

  private async extractRawFile(): Promise<Record<string, Record<string, unknown>>> {
    const fileBuffer = await fs.promises.readFile(this.dbPath);
    return await this.extractWithHelper(fileBuffer);
  }

  private async extractWithHelper(_fileBuffer: Buffer): Promise<Record<string, Record<string, unknown>>> {
    throw new BoltDbError(
      "Raw BoltDB parsing not fully implemented. Please install bbolt CLI tool.",
      "PARSER_NOT_AVAILABLE"
    );
  }

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

  private parseTeams(data: Record<string, unknown>): PortainerTeam[] {
    return Object.values(data)
      .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
      .map((item) => ({
        Id: Number(item.Id || item.id || 0),
        Name: String(item.Name || item.name || ""),
      }));
  }

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

  private async enrichStacksWithFileContent(
    stacks: PortainerStack[]
  ): Promise<Array<PortainerStack & { fileContent?: string }>> {
    if (!this.stackFilesPath) {
      return stacks.map((s) => ({ ...s, fileContent: undefined }));
    }

    return Promise.all(
      stacks.map(async (stack) => {
        try {
          const possiblePaths = [
            path.join(this.stackFilesPath!, "compose", String(stack.Id), "docker-compose.yml"),
            path.join(this.stackFilesPath!, "compose", String(stack.Id), "docker-compose.yaml"),
            stack.EntryPoint
              ? path.join(this.stackFilesPath!, "compose", String(stack.Id), stack.EntryPoint)
              : null,
            stack.ProjectPath ? path.join(stack.ProjectPath, "docker-compose.yml") : null,
            stack.ProjectPath ? path.join(stack.ProjectPath, "docker-compose.yaml") : null,
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
      })
    );
  }
}

export function createBoltDbReader(config: BoltDbConfig): PortainerBoltDbReader {
  return new PortainerBoltDbReader(config);
}

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

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
