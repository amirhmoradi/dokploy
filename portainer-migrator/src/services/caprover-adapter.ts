/**
 * CapRover Adapter - v2.0.0
 * Handles migration from Portainer to CapRover
 */

import type {
  PortainerStack,
  PortainerRegistry,
  PortainerEndpoint,
  MigrationResult,
} from "../types";

export interface CapRoverConfig {
  url: string;
  password: string;
  appToken?: string;
}

export interface CapRoverApp {
  appName: string;
  instanceCount: number;
  captainDefinitionRelativeFilePath: string;
  notExposeAsWebApp: boolean;
  forceSsl: boolean;
  websocketSupport: boolean;
  containerHttpPort: number;
  volumes: CapRoverVolume[];
  envVars: CapRoverEnvVar[];
  ports: CapRoverPort[];
  description: string;
  hasPersistentData: boolean;
}

export interface CapRoverVolume {
  volumeName: string;
  containerPath: string;
  hostPath?: string;
}

export interface CapRoverEnvVar {
  key: string;
  value: string;
}

export interface CapRoverPort {
  containerPort: number;
  hostPort: number;
  protocol?: "tcp" | "udp";
}

export interface CapRoverCaptainDefinition {
  schemaVersion: number;
  dockerfileLines?: string[];
  imageName?: string;
  dockerCompose?: string;
}

export interface CapRoverRegistry {
  id: string;
  registryDomain: string;
  registryImagePrefix: string;
  registryUser: string;
  registryPassword: string;
  registryType: "remote" | "local";
}

export interface CapRoverTransformResult {
  apps: Partial<CapRoverApp>[];
  registries: Partial<CapRoverRegistry>[];
  captainDefinitions: Map<string, CapRoverCaptainDefinition>;
  warnings: string[];
}

export class CapRoverAdapter {
  private config: CapRoverConfig | null = null;
  private authToken: string = "";

  /**
   * Connect to CapRover instance
   */
  async connect(config: CapRoverConfig): Promise<boolean> {
    this.config = config;

    try {
      // Login to get auth token
      const response = await fetch(`${config.url}/api/v2/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-namespace": "captain",
        },
        body: JSON.stringify({ password: config.password }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      if (data.status === 100 && data.data?.token) {
        this.authToken = data.data.token;
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to connect to CapRover:", error);
      return false;
    }
  }

  /**
   * Get all apps
   */
  async getApps(): Promise<CapRoverApp[]> {
    if (!this.config || !this.authToken) {
      throw new Error("Not connected to CapRover");
    }

    try {
      const response = await fetch(`${this.config.url}/api/v2/user/apps/appDefinitions`, {
        headers: {
          "x-captain-auth": this.authToken,
          "x-namespace": "captain",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get apps: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.appDefinitions || [];
    } catch (error) {
      console.error("Failed to get apps:", error);
      return [];
    }
  }

  /**
   * Create a new app
   */
  async createApp(appName: string, hasPersistentData: boolean = false): Promise<boolean> {
    if (!this.config || !this.authToken) {
      throw new Error("Not connected to CapRover");
    }

    try {
      const response = await fetch(`${this.config.url}/api/v2/user/apps/appDefinitions/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-captain-auth": this.authToken,
          "x-namespace": "captain",
        },
        body: JSON.stringify({
          appName: this.sanitizeAppName(appName),
          hasPersistentData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create app: ${response.status}`);
      }

      const data = await response.json();
      return data.status === 100;
    } catch (error) {
      console.error("Failed to create app:", error);
      return false;
    }
  }

  /**
   * Update app configuration
   */
  async updateApp(appName: string, config: Partial<CapRoverApp>): Promise<boolean> {
    if (!this.config || !this.authToken) {
      throw new Error("Not connected to CapRover");
    }

    try {
      const response = await fetch(`${this.config.url}/api/v2/user/apps/appDefinitions/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-captain-auth": this.authToken,
          "x-namespace": "captain",
        },
        body: JSON.stringify({
          appName: this.sanitizeAppName(appName),
          ...config,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update app: ${response.status}`);
      }

      const data = await response.json();
      return data.status === 100;
    } catch (error) {
      console.error("Failed to update app:", error);
      return false;
    }
  }

  /**
   * Deploy app from image
   */
  async deployAppFromImage(appName: string, imageName: string): Promise<boolean> {
    if (!this.config || !this.authToken) {
      throw new Error("Not connected to CapRover");
    }

    try {
      const captainDefinition: CapRoverCaptainDefinition = {
        schemaVersion: 2,
        imageName,
      };

      const response = await fetch(`${this.config.url}/api/v2/user/apps/appData/${this.sanitizeAppName(appName)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-captain-auth": this.authToken,
          "x-namespace": "captain",
        },
        body: JSON.stringify({
          captainDefinitionContent: JSON.stringify(captainDefinition),
          gitHash: "",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to deploy app: ${response.status}`);
      }

      const data = await response.json();
      return data.status === 100;
    } catch (error) {
      console.error("Failed to deploy app:", error);
      return false;
    }
  }

  /**
   * Set environment variables for app
   */
  async setEnvVars(appName: string, envVars: CapRoverEnvVar[]): Promise<boolean> {
    return this.updateApp(appName, { envVars } as Partial<CapRoverApp>);
  }

  /**
   * Add a registry
   */
  async addRegistry(registry: Partial<CapRoverRegistry>): Promise<boolean> {
    if (!this.config || !this.authToken) {
      throw new Error("Not connected to CapRover");
    }

    try {
      const response = await fetch(`${this.config.url}/api/v2/user/registries/insert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-captain-auth": this.authToken,
          "x-namespace": "captain",
        },
        body: JSON.stringify(registry),
      });

      if (!response.ok) {
        throw new Error(`Failed to add registry: ${response.status}`);
      }

      const data = await response.json();
      return data.status === 100;
    } catch (error) {
      console.error("Failed to add registry:", error);
      return false;
    }
  }

  /**
   * Transform Portainer stack to CapRover app
   */
  transformStack(
    stack: PortainerStack,
    composeFile: string,
    envVars?: Record<string, string>
  ): CapRoverTransformResult {
    const warnings: string[] = [];
    const apps: Partial<CapRoverApp>[] = [];
    const captainDefinitions = new Map<string, CapRoverCaptainDefinition>();

    // Parse compose file to extract services
    const services = this.parseComposeServices(composeFile);

    if (services.length === 0) {
      warnings.push(`No services found in stack ${stack.Name}`);
      return { apps: [], registries: [], captainDefinitions, warnings };
    }

    // CapRover works best with single-service apps
    if (services.length > 1) {
      warnings.push(
        `Stack ${stack.Name} has ${services.length} services. ` +
        `CapRover creates separate apps for each service.`
      );
    }

    for (const service of services) {
      const appName = services.length === 1
        ? stack.Name
        : `${stack.Name}-${service.name}`;

      const app: Partial<CapRoverApp> = {
        appName: this.sanitizeAppName(appName),
        description: `Migrated from Portainer: ${stack.Name}/${service.name}`,
        instanceCount: 1,
        hasPersistentData: service.volumes.length > 0,
        containerHttpPort: service.port || 80,
        notExposeAsWebApp: !service.expose,
        volumes: service.volumes.map((v) => ({
          volumeName: v.name,
          containerPath: v.path,
        })),
        ports: service.ports.map((p) => ({
          containerPort: p.container,
          hostPort: p.host,
        })),
      };

      // Convert env vars
      if (envVars) {
        app.envVars = Object.entries(envVars).map(([key, value]) => ({
          key,
          value,
        }));
      }

      apps.push(app);

      // Create captain definition
      const definition: CapRoverCaptainDefinition = {
        schemaVersion: 2,
      };

      if (service.image) {
        definition.imageName = service.image;
      } else {
        // Need to build from Dockerfile
        warnings.push(
          `Service ${service.name} requires build context. ` +
          `Manual configuration needed in CapRover.`
        );
      }

      captainDefinitions.set(appName, definition);
    }

    return { apps, registries: [], captainDefinitions, warnings };
  }

  /**
   * Transform Portainer registry to CapRover format
   */
  transformRegistry(registry: PortainerRegistry): Partial<CapRoverRegistry> {
    return {
      registryDomain: registry.URL,
      registryUser: registry.Username || "",
      registryPassword: "", // Password needs to be provided separately
      registryImagePrefix: registry.URL.replace(/https?:\/\//, ""),
      registryType: "remote",
    };
  }

  /**
   * Full migration from Portainer to CapRover
   */
  async migrate(
    stacks: PortainerStack[],
    composeFiles: Map<number, string>,
    envVars: Map<number, Record<string, string>>,
    registries: PortainerRegistry[],
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

    try {
      // Step 1: Add registries
      for (const registry of registries) {
        const caproverRegistry = this.transformRegistry(registry);

        if (!dryRun) {
          const success = await this.addRegistry(caproverRegistry);
          if (success) {
            result.migratedRegistries.push({
              id: registry.Id,
              name: registry.Name,
              targetId: caproverRegistry.registryDomain || "",
            });
          } else {
            result.errors.push({
              resource: `registry:${registry.Name}`,
              error: "Failed to add registry",
            });
          }
        } else {
          console.log(`[DRY RUN] Would add registry: ${registry.Name}`);
          result.migratedRegistries.push({
            id: registry.Id,
            name: registry.Name,
            targetId: "dry-run",
          });
        }
      }

      // Step 2: Create and deploy apps from stacks
      for (const stack of stacks) {
        const composeFile = composeFiles.get(stack.Id);
        if (!composeFile) {
          result.warnings.push(`No compose file for stack ${stack.Name}`);
          continue;
        }

        const stackEnvVars = envVars.get(stack.Id);
        const transformed = this.transformStack(stack, composeFile, stackEnvVars);

        result.warnings.push(...transformed.warnings);

        for (const app of transformed.apps) {
          if (!app.appName) continue;

          if (!dryRun) {
            // Create app
            const created = await this.createApp(app.appName, app.hasPersistentData);
            if (!created) {
              result.errors.push({
                resource: `app:${app.appName}`,
                error: "Failed to create app",
              });
              continue;
            }

            // Update app config
            await this.updateApp(app.appName, app);

            // Deploy if we have an image
            const definition = transformed.captainDefinitions.get(app.appName);
            if (definition?.imageName) {
              await this.deployAppFromImage(app.appName, definition.imageName);
            }

            result.migratedStacks.push({
              id: stack.Id,
              name: stack.Name,
              targetId: app.appName,
            });
          } else {
            console.log(`[DRY RUN] Would create app: ${app.appName}`);
            result.migratedStacks.push({
              id: stack.Id,
              name: stack.Name,
              targetId: "dry-run",
            });
          }
        }
      }

      // Add CapRover-specific warnings
      result.warnings.push(
        "CapRover uses its own domain management - configure domains in the web UI"
      );
      result.warnings.push(
        "SSL certificates are managed by CapRover's Let's Encrypt integration"
      );
      result.warnings.push(
        "Multi-container stacks are split into separate CapRover apps"
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
   * Parse compose file to extract services
   */
  private parseComposeServices(composeFile: string): ParsedService[] {
    const services: ParsedService[] = [];

    try {
      // Simple YAML parsing for compose files
      // In production, use a proper YAML parser
      const lines = composeFile.split("\n");
      let currentService: ParsedService | null = null;
      let inServices = false;
      let indent = 0;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === "services:") {
          inServices = true;
          continue;
        }

        if (inServices) {
          const lineIndent = line.length - line.trimStart().length;

          // Service name (2 spaces indent)
          if (lineIndent === 2 && trimmed.endsWith(":") && !trimmed.includes(" ")) {
            if (currentService) {
              services.push(currentService);
            }
            currentService = {
              name: trimmed.slice(0, -1),
              image: "",
              volumes: [],
              ports: [],
              expose: false,
              port: 80,
            };
            continue;
          }

          if (currentService && lineIndent >= 4) {
            // Service properties
            if (trimmed.startsWith("image:")) {
              currentService.image = trimmed.split(":").slice(1).join(":").trim();
            }
            if (trimmed.startsWith("- ") && line.includes(":")) {
              // Port or volume
              const value = trimmed.slice(2);
              if (value.includes("/")) {
                // Volume
                const [host, container] = value.split(":");
                currentService.volumes.push({
                  name: host.replace(/[^a-z0-9]/gi, "-"),
                  path: container || host,
                });
              } else if (value.match(/^\d+:\d+/)) {
                // Port
                const [host, container] = value.split(":");
                currentService.ports.push({
                  host: parseInt(host),
                  container: parseInt(container),
                });
              }
            }
          }
        }
      }

      if (currentService) {
        services.push(currentService);
      }
    } catch (error) {
      console.error("Failed to parse compose file:", error);
    }

    return services;
  }

  /**
   * Analyze compatibility for CapRover migration
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
      // Swarm stacks need significant adjustment
      if (stack.Type === 1) {
        needsAdjustment.push({
          stack,
          issues: [
            "CapRover doesn't support Swarm mode",
            "Services will be converted to standalone apps",
            "Replicas and placement constraints will be lost",
            "Overlay networks not supported",
          ],
        });
        continue;
      }

      // Kubernetes stacks are not compatible
      if (stack.Type === 3) {
        incompatible.push({
          stack,
          reason: "Kubernetes stacks cannot be migrated to CapRover",
        });
        continue;
      }

      // Standard compose stacks may need adjustment
      needsAdjustment.push({
        stack,
        issues: [
          "Multi-service stacks will be split into separate apps",
          "Network configuration may need manual setup",
        ],
      });
    }

    return { compatible, needsAdjustment, incompatible };
  }

  /**
   * Sanitize app name for CapRover (lowercase, alphanumeric, hyphens)
   */
  private sanitizeAppName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50); // CapRover has name length limits
  }
}

interface ParsedService {
  name: string;
  image: string;
  volumes: { name: string; path: string }[];
  ports: { host: number; container: number }[];
  expose: boolean;
  port: number;
}

// Export singleton
export const caproverAdapter = new CapRoverAdapter();
