/**
 * Coolify Adapter - v2.0.0
 * Handles migration from Portainer to Coolify
 */

import type {
  PortainerStack,
  PortainerRegistry,
  PortainerEndpoint,
  MigrationResult,
} from "../types";

export interface CoolifyConfig {
  url: string;
  apiToken: string;
  teamId?: string;
}

export interface CoolifyService {
  id: string;
  name: string;
  description?: string;
  type: "application" | "database" | "service";
  fqdn?: string;
  environmentId: string;
  status: string;
}

export interface CoolifyApplication {
  id: string;
  name: string;
  description?: string;
  fqdn?: string;
  gitRepository?: string;
  buildPack?: string;
  dockerComposeFile?: string;
  environmentId: string;
  destinationId: string;
  settings: {
    isStatic?: boolean;
    isCoolifyProxyUsed?: boolean;
  };
}

export interface CoolifyEnvironment {
  id: string;
  name: string;
  projectId: string;
  description?: string;
}

export interface CoolifyProject {
  id: string;
  name: string;
  description?: string;
  environments: CoolifyEnvironment[];
}

export interface CoolifyDestination {
  id: string;
  name: string;
  engine: string;
  network: string;
}

export interface CoolifyPrivateKey {
  id: string;
  name: string;
  teamId: string;
}

export interface CoolifyTransformResult {
  applications: CoolifyApplication[];
  databases: CoolifyService[];
  warnings: string[];
}

export class CoolifyAdapter {
  private config: CoolifyConfig | null = null;

  /**
   * Connect to Coolify instance
   */
  async connect(config: CoolifyConfig): Promise<boolean> {
    this.config = config;

    try {
      const response = await fetch(`${config.url}/api/v1/teams`, {
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Failed to connect to Coolify:", error);
      return false;
    }
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<CoolifyProject[]> {
    if (!this.config) throw new Error("Not connected to Coolify");

    try {
      const response = await fetch(`${this.config.url}/api/v1/projects`, {
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get projects: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Failed to get projects:", error);
      return [];
    }
  }

  /**
   * Get all destinations (Docker servers)
   */
  async getDestinations(): Promise<CoolifyDestination[]> {
    if (!this.config) throw new Error("Not connected to Coolify");

    try {
      const response = await fetch(`${this.config.url}/api/v1/destinations`, {
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get destinations: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Failed to get destinations:", error);
      return [];
    }
  }

  /**
   * Create a project
   */
  async createProject(name: string, description?: string): Promise<CoolifyProject | null> {
    if (!this.config) throw new Error("Not connected to Coolify");

    try {
      const response = await fetch(`${this.config.url}/api/v1/projects`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Failed to create project:", error);
      return null;
    }
  }

  /**
   * Create an environment within a project
   */
  async createEnvironment(
    projectId: string,
    name: string,
    description?: string
  ): Promise<CoolifyEnvironment | null> {
    if (!this.config) throw new Error("Not connected to Coolify");

    try {
      const response = await fetch(
        `${this.config.url}/api/v1/projects/${projectId}/environments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, description }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create environment: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Failed to create environment:", error);
      return null;
    }
  }

  /**
   * Create a Docker Compose application
   */
  async createDockerComposeApp(
    environmentId: string,
    destinationId: string,
    name: string,
    composeFile: string,
    envVars?: Record<string, string>
  ): Promise<CoolifyApplication | null> {
    if (!this.config) throw new Error("Not connected to Coolify");

    try {
      const response = await fetch(`${this.config.url}/api/v1/applications`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          type: "dockercompose",
          environmentId,
          destinationId,
          dockerComposeFile: composeFile,
          environmentVariables: envVars,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create application: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Failed to create application:", error);
      return null;
    }
  }

  /**
   * Transform Portainer stack to Coolify application
   */
  transformStack(
    stack: PortainerStack,
    composeFile: string,
    envVars?: Record<string, string>
  ): Partial<CoolifyApplication> {
    return {
      name: this.sanitizeName(stack.Name),
      description: `Migrated from Portainer stack: ${stack.Name}`,
      dockerComposeFile: composeFile,
      settings: {
        isCoolifyProxyUsed: false, // User needs to configure
      },
    };
  }

  /**
   * Transform Portainer endpoint to Coolify destination mapping
   */
  transformEndpoint(endpoint: PortainerEndpoint): {
    name: string;
    engine: string;
    suggestedDestination: string;
  } {
    return {
      name: endpoint.Name,
      engine: endpoint.URL || "local",
      suggestedDestination: `portainer-${endpoint.Id}`,
    };
  }

  /**
   * Full migration from Portainer to Coolify
   */
  async migrate(
    stacks: PortainerStack[],
    composeFiles: Map<number, string>,
    envVars: Map<number, Record<string, string>>,
    projectName: string,
    destinationId: string,
    dryRun: boolean = true
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedStacks: [],
      migratedRegistries: [],
      migratedEndpoints: [],
      errors: [],
      warnings: [],
      startTime: new Date().toISOString(),
      endTime: "",
      duration: 0,
    };

    const warnings: string[] = [];

    try {
      // Step 1: Create project and environment
      let project: CoolifyProject | null = null;
      let environment: CoolifyEnvironment | null = null;

      if (!dryRun) {
        project = await this.createProject(projectName, "Migrated from Portainer");
        if (!project) {
          result.success = false;
          result.errors.push({ resource: "project", error: "Failed to create project" });
          return result;
        }

        environment = await this.createEnvironment(
          project.id,
          "production",
          "Default environment"
        );
        if (!environment) {
          result.success = false;
          result.errors.push({ resource: "environment", error: "Failed to create environment" });
          return result;
        }
      } else {
        // Dry run - simulate
        console.log(`[DRY RUN] Would create project: ${projectName}`);
        console.log(`[DRY RUN] Would create environment: production`);
      }

      // Step 2: Migrate stacks as Docker Compose applications
      for (const stack of stacks) {
        const composeFile = composeFiles.get(stack.Id);
        if (!composeFile) {
          result.warnings.push(`No compose file for stack ${stack.Name}`);
          continue;
        }

        const stackEnvVars = envVars.get(stack.Id);

        if (!dryRun && environment) {
          const app = await this.createDockerComposeApp(
            environment.id,
            destinationId,
            this.sanitizeName(stack.Name),
            composeFile,
            stackEnvVars
          );

          if (app) {
            result.migratedStacks.push({
              id: stack.Id,
              name: stack.Name,
              targetId: app.id,
            });
          } else {
            result.errors.push({
              resource: `stack:${stack.Name}`,
              error: "Failed to create application",
            });
          }
        } else {
          console.log(`[DRY RUN] Would create application: ${stack.Name}`);
          result.migratedStacks.push({
            id: stack.Id,
            name: stack.Name,
            targetId: "dry-run",
          });
        }
      }

      // Add migration-specific warnings
      result.warnings.push(
        "Coolify uses its own proxy system - network configuration may need adjustment"
      );
      result.warnings.push(
        "Environment variables may need to be reconfigured in Coolify's UI"
      );
      result.warnings.push(
        "Custom domains and SSL certificates need manual configuration"
      );
    } catch (error) {
      result.success = false;
      result.errors.push({
        resource: "migration",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    result.endTime = new Date().toISOString();
    result.duration =
      new Date(result.endTime).getTime() - new Date(result.startTime).getTime();

    return result;
  }

  /**
   * Analyze compatibility for Coolify migration
   */
  analyzeCompatibility(stacks: PortainerStack[]): {
    compatible: PortainerStack[];
    needsAdjustment: { stack: PortainerStack; issues: string[] }[];
    incompatible: { stack: PortainerStack; reason: string }[];
  } {
    const compatible: PortainerStack[] = [];
    const needsAdjustment: { stack: PortainerStack; issues: string[] }[] = [];
    const incompatible: { stack: PortainerStack; reason: string }[] = [];

    for (const stack of stacks) {
      // Swarm stacks need adjustment
      if (stack.Type === 1) {
        needsAdjustment.push({
          stack,
          issues: [
            "Swarm-specific configurations will be removed",
            "Deploy constraints may not apply",
            "Replicas setting will need manual configuration",
          ],
        });
        continue;
      }

      // Kubernetes stacks are not compatible
      if (stack.Type === 3) {
        incompatible.push({
          stack,
          reason: "Kubernetes stacks cannot be migrated to Coolify",
        });
        continue;
      }

      // Standard compose stacks are compatible
      compatible.push(stack);
    }

    return { compatible, needsAdjustment, incompatible };
  }

  /**
   * Sanitize name for Coolify
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
}

// Export singleton
export const coolifyAdapter = new CoolifyAdapter();
