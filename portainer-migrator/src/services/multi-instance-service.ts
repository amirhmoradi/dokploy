/**
 * Multi-Instance Service - v1.2.0
 * Handles migration from multiple Portainer instances
 */

import type {
  PortainerStack,
  PortainerRegistry,
  PortainerEndpoint,
  MigrationResult,
} from "../types";

export interface PortainerInstance {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  username?: string;
  password?: string;
  isConnected: boolean;
  lastConnected?: string;
  version?: string;
  stackCount?: number;
  registryCount?: number;
  endpointCount?: number;
  tags?: string[];
  status: "pending" | "connected" | "error" | "disconnected";
  error?: string;
}

export interface InstanceDiscovery {
  instance: PortainerInstance;
  stacks: PortainerStack[];
  registries: PortainerRegistry[];
  endpoints: PortainerEndpoint[];
}

export interface MultiInstanceConfig {
  instances: PortainerInstance[];
  mergeStrategy: "sequential" | "parallel";
  conflictResolution: "skip" | "overwrite" | "rename" | "prompt";
  deduplicateResources: boolean;
  groupByInstance: boolean;
  targetMapping: Record<string, string>; // instance ID -> target project/server
}

export interface ConflictInfo {
  type: "stack" | "registry" | "endpoint";
  name: string;
  instances: string[]; // Instance IDs where the resource exists
  resolution?: "skip" | "overwrite" | "rename";
  newName?: string;
}

export interface MultiInstanceMigrationResult extends MigrationResult {
  instanceResults: Map<string, MigrationResult>;
  conflicts: ConflictInfo[];
  deduplicatedCount: number;
}

export class MultiInstanceService {
  private instances: Map<string, PortainerInstance> = new Map();
  private discoveries: Map<string, InstanceDiscovery> = new Map();
  private conflicts: ConflictInfo[] = [];

  /**
   * Add a Portainer instance
   */
  addInstance(instance: PortainerInstance): void {
    this.instances.set(instance.id, instance);
  }

  /**
   * Remove a Portainer instance
   */
  removeInstance(instanceId: string): void {
    this.instances.delete(instanceId);
    this.discoveries.delete(instanceId);
  }

  /**
   * Get all instances
   */
  getInstances(): PortainerInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Connect to all instances and test connectivity
   */
  async connectAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const promises = Array.from(this.instances.entries()).map(
      async ([id, instance]) => {
        try {
          const connected = await this.testConnection(instance);
          instance.isConnected = connected;
          instance.status = connected ? "connected" : "error";
          instance.lastConnected = connected ? new Date().toISOString() : undefined;

          if (connected) {
            // Get version info
            const info = await this.getInstanceInfo(instance);
            instance.version = info.version;
          }

          results.set(id, connected);
        } catch (error) {
          instance.isConnected = false;
          instance.status = "error";
          instance.error = error instanceof Error ? error.message : "Connection failed";
          results.set(id, false);
        }
      }
    );

    await Promise.all(promises);
    return results;
  }

  /**
   * Test connection to a single instance
   */
  private async testConnection(instance: PortainerInstance): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (instance.apiKey) {
        headers["X-API-Key"] = instance.apiKey;
      }

      const response = await fetch(`${instance.url}/api/status`, { headers });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get instance info
   */
  private async getInstanceInfo(instance: PortainerInstance): Promise<{ version: string }> {
    try {
      const headers: Record<string, string> = {};
      if (instance.apiKey) {
        headers["X-API-Key"] = instance.apiKey;
      }

      const response = await fetch(`${instance.url}/api/status`, { headers });
      if (!response.ok) {
        return { version: "unknown" };
      }

      const data = await response.json();
      return { version: data.Version || "unknown" };
    } catch {
      return { version: "unknown" };
    }
  }

  /**
   * Discover resources from all connected instances
   */
  async discoverAll(): Promise<Map<string, InstanceDiscovery>> {
    this.discoveries.clear();
    this.conflicts = [];

    const promises = Array.from(this.instances.entries())
      .filter(([_, instance]) => instance.isConnected)
      .map(async ([id, instance]) => {
        const discovery = await this.discoverInstance(instance);
        this.discoveries.set(id, discovery);
      });

    await Promise.all(promises);

    // Detect conflicts
    this.detectConflicts();

    return this.discoveries;
  }

  /**
   * Discover resources from a single instance
   */
  private async discoverInstance(instance: PortainerInstance): Promise<InstanceDiscovery> {
    const headers: Record<string, string> = {};
    if (instance.apiKey) {
      headers["X-API-Key"] = instance.apiKey;
    }

    const [stacksResponse, registriesResponse, endpointsResponse] = await Promise.all([
      fetch(`${instance.url}/api/stacks`, { headers }),
      fetch(`${instance.url}/api/registries`, { headers }),
      fetch(`${instance.url}/api/endpoints`, { headers }),
    ]);

    const stacks: PortainerStack[] = stacksResponse.ok ? await stacksResponse.json() : [];
    const registries: PortainerRegistry[] = registriesResponse.ok ? await registriesResponse.json() : [];
    const endpoints: PortainerEndpoint[] = endpointsResponse.ok ? await endpointsResponse.json() : [];

    // Update instance counts
    instance.stackCount = stacks.length;
    instance.registryCount = registries.length;
    instance.endpointCount = endpoints.length;

    return {
      instance,
      stacks,
      registries,
      endpoints,
    };
  }

  /**
   * Detect conflicts between instances
   */
  private detectConflicts(): void {
    const stackNames = new Map<string, string[]>(); // name -> instance IDs
    const registryNames = new Map<string, string[]>();
    const endpointNames = new Map<string, string[]>();

    for (const [instanceId, discovery] of this.discoveries.entries()) {
      // Check stacks
      for (const stack of discovery.stacks) {
        const existing = stackNames.get(stack.Name) || [];
        existing.push(instanceId);
        stackNames.set(stack.Name, existing);
      }

      // Check registries
      for (const registry of discovery.registries) {
        const existing = registryNames.get(registry.Name) || [];
        existing.push(instanceId);
        registryNames.set(registry.Name, existing);
      }

      // Check endpoints
      for (const endpoint of discovery.endpoints) {
        const existing = endpointNames.get(endpoint.Name) || [];
        existing.push(instanceId);
        endpointNames.set(endpoint.Name, existing);
      }
    }

    // Find conflicts (names that appear in multiple instances)
    for (const [name, instances] of stackNames.entries()) {
      if (instances.length > 1) {
        this.conflicts.push({
          type: "stack",
          name,
          instances,
        });
      }
    }

    for (const [name, instances] of registryNames.entries()) {
      if (instances.length > 1) {
        this.conflicts.push({
          type: "registry",
          name,
          instances,
        });
      }
    }

    for (const [name, instances] of endpointNames.entries()) {
      if (instances.length > 1) {
        this.conflicts.push({
          type: "endpoint",
          name,
          instances,
        });
      }
    }
  }

  /**
   * Get detected conflicts
   */
  getConflicts(): ConflictInfo[] {
    return this.conflicts;
  }

  /**
   * Resolve a conflict
   */
  resolveConflict(
    type: "stack" | "registry" | "endpoint",
    name: string,
    resolution: "skip" | "overwrite" | "rename",
    newName?: string
  ): void {
    const conflict = this.conflicts.find(
      (c) => c.type === type && c.name === name
    );

    if (conflict) {
      conflict.resolution = resolution;
      if (resolution === "rename" && newName) {
        conflict.newName = newName;
      }
    }
  }

  /**
   * Resolve all conflicts with a default strategy
   */
  resolveAllConflicts(resolution: "skip" | "rename"): void {
    for (const conflict of this.conflicts) {
      conflict.resolution = resolution;
      if (resolution === "rename") {
        // Generate unique name by appending instance ID
        const instanceId = conflict.instances[1]; // Keep first, rename second
        const instance = this.instances.get(instanceId);
        const suffix = instance?.name || instanceId;
        conflict.newName = `${conflict.name}-${suffix}`;
      }
    }
  }

  /**
   * Get combined resources with conflict resolution
   */
  getCombinedResources(config: MultiInstanceConfig): {
    stacks: Array<PortainerStack & { sourceInstance: string }>;
    registries: Array<PortainerRegistry & { sourceInstance: string }>;
    endpoints: Array<PortainerEndpoint & { sourceInstance: string }>;
    skipped: Array<{ type: string; name: string; reason: string }>;
  } {
    const result = {
      stacks: [] as Array<PortainerStack & { sourceInstance: string }>,
      registries: [] as Array<PortainerRegistry & { sourceInstance: string }>,
      endpoints: [] as Array<PortainerEndpoint & { sourceInstance: string }>,
      skipped: [] as Array<{ type: string; name: string; reason: string }>,
    };

    const processedNames = {
      stacks: new Set<string>(),
      registries: new Set<string>(),
      endpoints: new Set<string>(),
    };

    for (const [instanceId, discovery] of this.discoveries.entries()) {
      // Process stacks
      for (const stack of discovery.stacks) {
        const conflict = this.conflicts.find(
          (c) => c.type === "stack" && c.name === stack.Name
        );

        if (conflict) {
          if (conflict.resolution === "skip") {
            if (!processedNames.stacks.has(stack.Name)) {
              // Keep first occurrence, skip others
              result.stacks.push({ ...stack, sourceInstance: instanceId });
              processedNames.stacks.add(stack.Name);
            } else {
              result.skipped.push({
                type: "stack",
                name: stack.Name,
                reason: `Duplicate in ${instanceId}`,
              });
            }
          } else if (conflict.resolution === "rename" && conflict.newName) {
            // Rename if this is the conflicting instance
            if (conflict.instances.indexOf(instanceId) > 0) {
              result.stacks.push({
                ...stack,
                Name: conflict.newName,
                sourceInstance: instanceId,
              });
            } else {
              result.stacks.push({ ...stack, sourceInstance: instanceId });
            }
          } else {
            result.stacks.push({ ...stack, sourceInstance: instanceId });
          }
        } else {
          result.stacks.push({ ...stack, sourceInstance: instanceId });
        }
      }

      // Process registries
      for (const registry of discovery.registries) {
        const conflict = this.conflicts.find(
          (c) => c.type === "registry" && c.name === registry.Name
        );

        if (conflict && config.deduplicateResources) {
          if (!processedNames.registries.has(registry.Name)) {
            result.registries.push({ ...registry, sourceInstance: instanceId });
            processedNames.registries.add(registry.Name);
          } else {
            result.skipped.push({
              type: "registry",
              name: registry.Name,
              reason: `Duplicate in ${instanceId}`,
            });
          }
        } else {
          result.registries.push({ ...registry, sourceInstance: instanceId });
        }
      }

      // Process endpoints
      for (const endpoint of discovery.endpoints) {
        const conflict = this.conflicts.find(
          (c) => c.type === "endpoint" && c.name === endpoint.Name
        );

        if (conflict && config.deduplicateResources) {
          if (!processedNames.endpoints.has(endpoint.Name)) {
            result.endpoints.push({ ...endpoint, sourceInstance: instanceId });
            processedNames.endpoints.add(endpoint.Name);
          } else {
            result.skipped.push({
              type: "endpoint",
              name: endpoint.Name,
              reason: `Duplicate in ${instanceId}`,
            });
          }
        } else {
          result.endpoints.push({ ...endpoint, sourceInstance: instanceId });
        }
      }
    }

    return result;
  }

  /**
   * Get migration summary
   */
  getSummary(): {
    totalInstances: number;
    connectedInstances: number;
    totalStacks: number;
    totalRegistries: number;
    totalEndpoints: number;
    conflictsCount: number;
    unresolvedConflicts: number;
  } {
    let totalStacks = 0;
    let totalRegistries = 0;
    let totalEndpoints = 0;

    for (const discovery of this.discoveries.values()) {
      totalStacks += discovery.stacks.length;
      totalRegistries += discovery.registries.length;
      totalEndpoints += discovery.endpoints.length;
    }

    const unresolvedConflicts = this.conflicts.filter(
      (c) => !c.resolution
    ).length;

    return {
      totalInstances: this.instances.size,
      connectedInstances: Array.from(this.instances.values()).filter(
        (i) => i.isConnected
      ).length,
      totalStacks,
      totalRegistries,
      totalEndpoints,
      conflictsCount: this.conflicts.length,
      unresolvedConflicts,
    };
  }

  /**
   * Generate instance comparison report
   */
  compareInstances(): {
    comparison: Array<{
      resource: string;
      instances: Record<string, number>;
    }>;
    uniqueToInstance: Record<string, string[]>;
  } {
    const comparison: Array<{
      resource: string;
      instances: Record<string, number>;
    }> = [];

    const instanceCounts: Record<string, Record<string, number>> = {};

    for (const [instanceId, discovery] of this.discoveries.entries()) {
      instanceCounts[instanceId] = {
        stacks: discovery.stacks.length,
        registries: discovery.registries.length,
        endpoints: discovery.endpoints.length,
      };
    }

    for (const resource of ["stacks", "registries", "endpoints"]) {
      const instances: Record<string, number> = {};
      for (const instanceId of this.instances.keys()) {
        instances[instanceId] = instanceCounts[instanceId]?.[resource] || 0;
      }
      comparison.push({ resource, instances });
    }

    // Find resources unique to each instance
    const uniqueToInstance: Record<string, string[]> = {};

    for (const [instanceId, discovery] of this.discoveries.entries()) {
      const unique: string[] = [];

      for (const stack of discovery.stacks) {
        const inOthers = Array.from(this.discoveries.entries()).some(
          ([id, d]) => id !== instanceId && d.stacks.some((s) => s.Name === stack.Name)
        );
        if (!inOthers) {
          unique.push(`stack:${stack.Name}`);
        }
      }

      uniqueToInstance[instanceId] = unique;
    }

    return { comparison, uniqueToInstance };
  }

  /**
   * Export combined configuration
   */
  exportCombinedConfig(config: MultiInstanceConfig): string {
    const combined = this.getCombinedResources(config);

    const exportData = {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      instances: Array.from(this.instances.values()).map((i) => ({
        id: i.id,
        name: i.name,
        url: i.url,
      })),
      resources: {
        stacks: combined.stacks,
        registries: combined.registries,
        endpoints: combined.endpoints,
      },
      conflicts: this.conflicts,
      skipped: combined.skipped,
    };

    return JSON.stringify(exportData, null, 2);
  }
}

// Export singleton
export const multiInstanceService = new MultiInstanceService();
