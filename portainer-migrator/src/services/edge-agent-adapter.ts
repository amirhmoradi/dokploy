/**
 * Edge Agent Adapter - v2.0.0
 * Handles Edge Agent, Edge Groups, Edge Stacks, and Edge Jobs migration
 */

import type {
  EdgeGroup,
  EdgeStack,
  EdgeJob,
  TunnelConfig,
  EdgeAgentMigrationConfig,
  PortainerEndpoint,
  DokployCompose,
} from "../types";

export class EdgeAgentAdapter {
  private portainerUrl: string = "";
  private apiKey: string = "";

  /**
   * Connect to Portainer with Edge features
   */
  async connect(portainerUrl: string, apiKey: string): Promise<boolean> {
    this.portainerUrl = portainerUrl;
    this.apiKey = apiKey;

    try {
      // Verify edge features are available
      const response = await fetch(`${portainerUrl}/api/settings`, {
        headers: { "X-API-Key": apiKey },
      });
      const settings = await response.json();
      return settings.EnableEdgeComputeFeatures === true;
    } catch {
      return false;
    }
  }

  /**
   * Get all Edge Groups
   */
  async getEdgeGroups(): Promise<EdgeGroup[]> {
    try {
      const response = await fetch(`${this.portainerUrl}/api/edge_groups`, {
        headers: { "X-API-Key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`Failed to get edge groups: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Failed to get edge groups:", error);
      return [];
    }
  }

  /**
   * Get all Edge Stacks
   */
  async getEdgeStacks(): Promise<EdgeStack[]> {
    try {
      const response = await fetch(`${this.portainerUrl}/api/edge_stacks`, {
        headers: { "X-API-Key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`Failed to get edge stacks: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Failed to get edge stacks:", error);
      return [];
    }
  }

  /**
   * Get Edge Stack compose file
   */
  async getEdgeStackFile(stackId: number): Promise<string> {
    try {
      const response = await fetch(
        `${this.portainerUrl}/api/edge_stacks/${stackId}/file`,
        {
          headers: { "X-API-Key": this.apiKey },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get edge stack file: ${response.status}`);
      }

      const data = await response.json();
      return data.StackFileContent || "";
    } catch (error) {
      console.error(`Failed to get edge stack file for ${stackId}:`, error);
      return "";
    }
  }

  /**
   * Get all Edge Jobs
   */
  async getEdgeJobs(): Promise<EdgeJob[]> {
    try {
      const response = await fetch(`${this.portainerUrl}/api/edge_jobs`, {
        headers: { "X-API-Key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`Failed to get edge jobs: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Failed to get edge jobs:", error);
      return [];
    }
  }

  /**
   * Get Edge endpoints (agents)
   */
  async getEdgeEndpoints(): Promise<PortainerEndpoint[]> {
    try {
      const response = await fetch(`${this.portainerUrl}/api/endpoints`, {
        headers: { "X-API-Key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`Failed to get endpoints: ${response.status}`);
      }

      const endpoints: PortainerEndpoint[] = await response.json();
      // Filter to only Edge types (4 = Edge Agent)
      return endpoints.filter((e) => e.Type === 4);
    } catch (error) {
      console.error("Failed to get edge endpoints:", error);
      return [];
    }
  }

  /**
   * Discover all Edge resources
   */
  async discoverResources(config: EdgeAgentMigrationConfig): Promise<EdgeDiscoveryResult> {
    const result: EdgeDiscoveryResult = {
      edgeGroups: [],
      edgeStacks: [],
      edgeJobs: [],
      edgeEndpoints: [],
      warnings: [],
    };

    if (config.migrateEdgeGroups) {
      result.edgeGroups = await this.getEdgeGroups();
    }

    if (config.migrateEdgeStacks) {
      result.edgeStacks = await this.getEdgeStacks();

      // Get compose files for each stack
      for (const stack of result.edgeStacks) {
        const composeFile = await this.getEdgeStackFile(stack.Id);
        (stack as EdgeStackWithFile).composeFile = composeFile;
      }
    }

    if (config.migrateEdgeJobs) {
      result.edgeJobs = await this.getEdgeJobs();
      result.warnings.push(
        "Edge Jobs will be noted but require manual recreation in Dokploy"
      );
    }

    // Get edge endpoints for reference
    result.edgeEndpoints = await this.getEdgeEndpoints();

    return result;
  }

  /**
   * Convert Edge Stack to standard Docker Compose for Dokploy
   */
  convertEdgeStackToCompose(
    stack: EdgeStackWithFile,
    edgeGroups: EdgeGroup[]
  ): DokployCompose {
    // Get associated edge groups
    const groups = edgeGroups.filter((g) => stack.EdgeGroups.includes(g.Id));
    const groupNames = groups.map((g) => g.Name).join(", ");

    // Add metadata as comments to the compose file
    let composeContent = `# Converted from Edge Stack: ${stack.Name}\n`;
    composeContent += `# Original Edge Groups: ${groupNames}\n`;
    composeContent += `# Deployments: ${stack.NumDeployments}\n`;
    composeContent += `# Note: Edge-specific features may require manual configuration\n\n`;
    composeContent += stack.composeFile;

    return {
      name: stack.Name,
      description: `Migrated from Edge Stack (Groups: ${groupNames})`,
      composeFile: composeContent,
      sourceType: "raw",
      composeType: "docker-compose",
      environmentId: "", // To be set during migration
    };
  }

  /**
   * Convert Edge Job to documentation (can't be directly migrated)
   */
  convertEdgeJobToDoc(job: EdgeJob): EdgeJobDoc {
    return {
      name: job.Name,
      image: job.Image,
      schedule: job.CronExpression,
      recurring: job.Recurring,
      scriptPath: job.ScriptPath,
      targetEndpoints: job.Endpoints.length,
      targetEdgeGroups: job.EdgeGroups.length,
      notes: [
        "Edge Jobs cannot be directly migrated to Dokploy",
        "Consider using cron containers or external schedulers",
        `Original schedule: ${job.CronExpression}`,
      ],
    };
  }

  /**
   * Analyze Edge resources for migration compatibility
   */
  analyzeCompatibility(
    config: EdgeAgentMigrationConfig,
    discovery: EdgeDiscoveryResult
  ): EdgeAnalysisResult {
    const result: EdgeAnalysisResult = {
      canMigrate: [],
      needsManualConfig: [],
      cannotMigrate: [],
      recommendations: [],
    };

    // Analyze Edge Groups
    for (const group of discovery.edgeGroups) {
      if (group.Dynamic) {
        result.needsManualConfig.push({
          type: "edge_group",
          id: group.Id.toString(),
          name: group.Name,
          reason: "Dynamic edge groups require manual server assignment in Dokploy",
        });
      } else {
        result.canMigrate.push({
          type: "edge_group",
          id: group.Id.toString(),
          name: group.Name,
        });
      }
    }

    // Analyze Edge Stacks
    for (const stack of discovery.edgeStacks) {
      if (config.convertToStandardStacks) {
        result.canMigrate.push({
          type: "edge_stack",
          id: stack.Id.toString(),
          name: stack.Name,
        });
      } else {
        result.needsManualConfig.push({
          type: "edge_stack",
          id: stack.Id.toString(),
          name: stack.Name,
          reason: "Edge-specific deployment features will be lost",
        });
      }
    }

    // Edge Jobs cannot be directly migrated
    for (const job of discovery.edgeJobs) {
      result.cannotMigrate.push({
        type: "edge_job",
        id: job.Id.toString(),
        name: job.Name,
        reason: "Edge Jobs have no Dokploy equivalent - consider cron containers",
      });
    }

    // Generate recommendations
    if (discovery.edgeEndpoints.length > 0) {
      result.recommendations.push(
        `Found ${discovery.edgeEndpoints.length} Edge Agents. These will need to be reconnected to Dokploy servers manually.`
      );
    }

    if (discovery.edgeJobs.length > 0) {
      result.recommendations.push(
        `${discovery.edgeJobs.length} Edge Jobs found. Consider converting them to cron-based containers in your compose files.`
      );
    }

    if (discovery.edgeStacks.some((s) => s.DeploymentType === 2)) {
      result.recommendations.push(
        "Some edge stacks use Kubernetes manifests. These require the Kubernetes adapter for migration."
      );
    }

    return result;
  }

  /**
   * Transform Edge resources to Dokploy format
   */
  transformToDokloy(
    discovery: EdgeDiscoveryResult,
    config: EdgeAgentMigrationConfig
  ): EdgeTransformResult {
    const result: EdgeTransformResult = {
      composes: [],
      documentedJobs: [],
      groupMapping: {},
    };

    // Transform edge stacks to composes
    for (const stack of discovery.edgeStacks) {
      const compose = this.convertEdgeStackToCompose(
        stack as EdgeStackWithFile,
        discovery.edgeGroups
      );
      result.composes.push(compose);
    }

    // Document edge jobs
    for (const job of discovery.edgeJobs) {
      result.documentedJobs.push(this.convertEdgeJobToDoc(job));
    }

    // Create group mapping (edge group ID -> suggested project name)
    for (const group of discovery.edgeGroups) {
      const mappedName = config.edgeGroupMapping?.[group.Id] || group.Name;
      result.groupMapping[group.Id] = mappedName;
    }

    return result;
  }
}

// Type definitions
interface EdgeStackWithFile extends EdgeStack {
  composeFile: string;
}

interface EdgeDiscoveryResult {
  edgeGroups: EdgeGroup[];
  edgeStacks: EdgeStack[];
  edgeJobs: EdgeJob[];
  edgeEndpoints: PortainerEndpoint[];
  warnings: string[];
}

interface EdgeJobDoc {
  name: string;
  image: string;
  schedule: string;
  recurring: boolean;
  scriptPath: string;
  targetEndpoints: number;
  targetEdgeGroups: number;
  notes: string[];
}

interface MigratableItem {
  type: string;
  id: string;
  name: string;
  reason?: string;
}

interface EdgeAnalysisResult {
  canMigrate: MigratableItem[];
  needsManualConfig: MigratableItem[];
  cannotMigrate: MigratableItem[];
  recommendations: string[];
}

interface EdgeTransformResult {
  composes: DokployCompose[];
  documentedJobs: EdgeJobDoc[];
  groupMapping: Record<number, string>;
}

// Export singleton
export const edgeAgentAdapter = new EdgeAgentAdapter();
