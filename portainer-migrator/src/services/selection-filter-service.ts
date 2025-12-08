/**
 * Selection Filter Service - v1.1.0
 * Handles selective migration with advanced filtering and criteria
 */

import type {
  SelectionFilter,
  SelectionCriteria,
  PortainerStack,
  PortainerRegistry,
  PortainerEndpoint,
} from "../types";

export interface FilterableResource {
  id: string | number;
  name: string;
  type: "stack" | "registry" | "endpoint" | "container" | "volume" | "network";
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SelectionResult {
  selected: FilterableResource[];
  excluded: FilterableResource[];
  matchDetails: Map<string | number, MatchDetail>;
}

export interface MatchDetail {
  resourceId: string | number;
  resourceName: string;
  matched: boolean;
  matchedCriteria: string[];
  excludedBy?: string;
}

export interface BatchSelectionConfig {
  filters: SelectionFilter[];
  operator: "AND" | "OR";
  previewOnly?: boolean;
}

export class SelectionFilterService {
  /**
   * Apply a single filter to resources
   */
  applyFilter<T extends FilterableResource>(
    resources: T[],
    filter: SelectionFilter
  ): SelectionResult {
    const selected: T[] = [];
    const excluded: T[] = [];
    const matchDetails = new Map<string | number, MatchDetail>();

    for (const resource of resources) {
      const detail = this.evaluateResource(resource, filter);
      matchDetails.set(resource.id, detail);

      if (detail.matched) {
        selected.push(resource);
      } else {
        excluded.push(resource);
      }
    }

    return { selected, excluded, matchDetails };
  }

  /**
   * Apply multiple filters with AND/OR logic
   */
  applyFilters<T extends FilterableResource>(
    resources: T[],
    config: BatchSelectionConfig
  ): SelectionResult {
    if (config.filters.length === 0) {
      return {
        selected: resources,
        excluded: [],
        matchDetails: new Map(
          resources.map((r) => [
            r.id,
            {
              resourceId: r.id,
              resourceName: r.name,
              matched: true,
              matchedCriteria: ["no-filter"],
            },
          ])
        ),
      };
    }

    const selected: T[] = [];
    const excluded: T[] = [];
    const matchDetails = new Map<string | number, MatchDetail>();

    for (const resource of resources) {
      const filterResults = config.filters.map((filter) =>
        this.evaluateResource(resource, filter)
      );

      let matched: boolean;
      let matchedCriteria: string[] = [];
      let excludedBy: string | undefined;

      if (config.operator === "AND") {
        matched = filterResults.every((r) => r.matched);
        if (matched) {
          matchedCriteria = filterResults.flatMap((r) => r.matchedCriteria);
        } else {
          const failedResult = filterResults.find((r) => !r.matched);
          excludedBy = failedResult?.excludedBy;
        }
      } else {
        // OR logic
        matched = filterResults.some((r) => r.matched);
        if (matched) {
          matchedCriteria = filterResults
            .filter((r) => r.matched)
            .flatMap((r) => r.matchedCriteria);
        } else {
          excludedBy = "No filters matched";
        }
      }

      const detail: MatchDetail = {
        resourceId: resource.id,
        resourceName: resource.name,
        matched,
        matchedCriteria,
        excludedBy,
      };

      matchDetails.set(resource.id, detail);

      if (matched) {
        selected.push(resource);
      } else {
        excluded.push(resource);
      }
    }

    return { selected, excluded, matchDetails };
  }

  /**
   * Evaluate a single resource against a filter
   */
  private evaluateResource(
    resource: FilterableResource,
    filter: SelectionFilter
  ): MatchDetail {
    const matchedCriteria: string[] = [];
    let excludedBy: string | undefined;

    // Check resource type filter
    if (filter.resourceTypes && filter.resourceTypes.length > 0) {
      if (!filter.resourceTypes.includes(resource.type)) {
        return {
          resourceId: resource.id,
          resourceName: resource.name,
          matched: false,
          matchedCriteria: [],
          excludedBy: `Resource type '${resource.type}' not in allowed types`,
        };
      }
      matchedCriteria.push(`type:${resource.type}`);
    }

    // Check inclusion criteria
    if (filter.criteria) {
      const criteriaMatch = this.evaluateCriteria(resource, filter.criteria);
      if (!criteriaMatch.matched) {
        return {
          resourceId: resource.id,
          resourceName: resource.name,
          matched: false,
          matchedCriteria: [],
          excludedBy: criteriaMatch.reason,
        };
      }
      matchedCriteria.push(...criteriaMatch.matchedCriteria);
    }

    // Check exclusion patterns
    if (filter.excludePatterns && filter.excludePatterns.length > 0) {
      for (const pattern of filter.excludePatterns) {
        if (this.matchesPattern(resource.name, pattern)) {
          return {
            resourceId: resource.id,
            resourceName: resource.name,
            matched: false,
            matchedCriteria: [],
            excludedBy: `Excluded by pattern: ${pattern}`,
          };
        }
      }
    }

    return {
      resourceId: resource.id,
      resourceName: resource.name,
      matched: true,
      matchedCriteria,
    };
  }

  /**
   * Evaluate selection criteria
   */
  private evaluateCriteria(
    resource: FilterableResource,
    criteria: SelectionCriteria
  ): { matched: boolean; reason?: string; matchedCriteria: string[] } {
    const matchedCriteria: string[] = [];

    // Check name patterns
    if (criteria.namePatterns && criteria.namePatterns.length > 0) {
      const nameMatched = criteria.namePatterns.some((pattern) =>
        this.matchesPattern(resource.name, pattern)
      );
      if (!nameMatched) {
        return {
          matched: false,
          reason: `Name '${resource.name}' doesn't match any pattern`,
          matchedCriteria: [],
        };
      }
      matchedCriteria.push(`name:pattern-match`);
    }

    // Check tags
    if (criteria.tags && criteria.tags.length > 0) {
      if (!resource.tags || resource.tags.length === 0) {
        return {
          matched: false,
          reason: "Resource has no tags",
          matchedCriteria: [],
        };
      }
      const tagsMatched = criteria.tags.some((tag) =>
        resource.tags!.includes(tag)
      );
      if (!tagsMatched) {
        return {
          matched: false,
          reason: `Tags ${JSON.stringify(resource.tags)} don't match criteria`,
          matchedCriteria: [],
        };
      }
      matchedCriteria.push(`tags:match`);
    }

    // Check created date range
    if (criteria.createdAfter || criteria.createdBefore) {
      if (!resource.createdAt) {
        return {
          matched: false,
          reason: "Resource has no creation date",
          matchedCriteria: [],
        };
      }

      const createdAt = new Date(resource.createdAt);

      if (criteria.createdAfter) {
        const after = new Date(criteria.createdAfter);
        if (createdAt < after) {
          return {
            matched: false,
            reason: `Created before ${criteria.createdAfter}`,
            matchedCriteria: [],
          };
        }
        matchedCriteria.push(`created:after:${criteria.createdAfter}`);
      }

      if (criteria.createdBefore) {
        const before = new Date(criteria.createdBefore);
        if (createdAt > before) {
          return {
            matched: false,
            reason: `Created after ${criteria.createdBefore}`,
            matchedCriteria: [],
          };
        }
        matchedCriteria.push(`created:before:${criteria.createdBefore}`);
      }
    }

    // Check environment IDs
    if (criteria.environmentIds && criteria.environmentIds.length > 0) {
      const metadata = resource.metadata as { endpointId?: number } | undefined;
      if (!metadata?.endpointId) {
        return {
          matched: false,
          reason: "Resource has no environment ID",
          matchedCriteria: [],
        };
      }
      if (!criteria.environmentIds.includes(metadata.endpointId)) {
        return {
          matched: false,
          reason: `Environment ${metadata.endpointId} not in selection`,
          matchedCriteria: [],
        };
      }
      matchedCriteria.push(`environment:${metadata.endpointId}`);
    }

    // Check custom metadata
    if (criteria.customMetadata) {
      for (const [key, value] of Object.entries(criteria.customMetadata)) {
        if (!resource.metadata || resource.metadata[key] !== value) {
          return {
            matched: false,
            reason: `Metadata ${key}=${value} not found`,
            matchedCriteria: [],
          };
        }
        matchedCriteria.push(`metadata:${key}=${value}`);
      }
    }

    return { matched: true, matchedCriteria };
  }

  /**
   * Match a string against a pattern (supports glob-like wildcards)
   */
  private matchesPattern(value: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
      .replace(/\*/g, ".*") // * matches anything
      .replace(/\?/g, "."); // ? matches single char

    const regex = new RegExp(`^${regexPattern}$`, "i");
    return regex.test(value);
  }

  /**
   * Convert Portainer stacks to filterable resources
   */
  stacksToFilterable(stacks: PortainerStack[]): FilterableResource[] {
    return stacks.map((stack) => ({
      id: stack.Id,
      name: stack.Name,
      type: "stack" as const,
      createdAt: stack.CreationDate,
      updatedAt: stack.UpdateDate,
      metadata: {
        endpointId: stack.EndpointId,
        status: stack.Status,
        type: stack.Type,
      },
    }));
  }

  /**
   * Convert Portainer registries to filterable resources
   */
  registriesToFilterable(registries: PortainerRegistry[]): FilterableResource[] {
    return registries.map((registry) => ({
      id: registry.Id,
      name: registry.Name,
      type: "registry" as const,
      metadata: {
        url: registry.URL,
        type: registry.Type,
        authentication: registry.Authentication,
      },
    }));
  }

  /**
   * Convert Portainer endpoints to filterable resources
   */
  endpointsToFilterable(endpoints: PortainerEndpoint[]): FilterableResource[] {
    return endpoints.map((endpoint) => ({
      id: endpoint.Id,
      name: endpoint.Name,
      type: "endpoint" as const,
      tags: endpoint.TagIds?.map(String),
      metadata: {
        url: endpoint.URL,
        type: endpoint.Type,
        status: endpoint.Status,
        groupId: endpoint.GroupId,
      },
    }));
  }

  /**
   * Create a filter from simple criteria
   */
  createSimpleFilter(options: {
    nameContains?: string;
    nameStartsWith?: string;
    nameEndsWith?: string;
    resourceTypes?: FilterableResource["type"][];
    excludeNames?: string[];
  }): SelectionFilter {
    const namePatterns: string[] = [];

    if (options.nameContains) {
      namePatterns.push(`*${options.nameContains}*`);
    }
    if (options.nameStartsWith) {
      namePatterns.push(`${options.nameStartsWith}*`);
    }
    if (options.nameEndsWith) {
      namePatterns.push(`*${options.nameEndsWith}`);
    }

    return {
      id: crypto.randomUUID(),
      name: "Simple Filter",
      resourceTypes: options.resourceTypes || [],
      criteria: namePatterns.length > 0 ? { namePatterns } : undefined,
      excludePatterns: options.excludeNames,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Create a preset filter for common use cases
   */
  createPresetFilter(
    preset: "production" | "development" | "testing" | "all-stacks" | "all-registries"
  ): SelectionFilter {
    switch (preset) {
      case "production":
        return {
          id: crypto.randomUUID(),
          name: "Production Resources",
          resourceTypes: ["stack", "registry", "endpoint"],
          criteria: {
            namePatterns: ["*prod*", "*production*", "*prd*"],
          },
          excludePatterns: ["*test*", "*dev*", "*staging*"],
          enabled: true,
          createdAt: new Date().toISOString(),
        };

      case "development":
        return {
          id: crypto.randomUUID(),
          name: "Development Resources",
          resourceTypes: ["stack", "registry", "endpoint"],
          criteria: {
            namePatterns: ["*dev*", "*development*", "*local*"],
          },
          enabled: true,
          createdAt: new Date().toISOString(),
        };

      case "testing":
        return {
          id: crypto.randomUUID(),
          name: "Testing Resources",
          resourceTypes: ["stack", "registry", "endpoint"],
          criteria: {
            namePatterns: ["*test*", "*qa*", "*staging*"],
          },
          enabled: true,
          createdAt: new Date().toISOString(),
        };

      case "all-stacks":
        return {
          id: crypto.randomUUID(),
          name: "All Stacks",
          resourceTypes: ["stack"],
          enabled: true,
          createdAt: new Date().toISOString(),
        };

      case "all-registries":
        return {
          id: crypto.randomUUID(),
          name: "All Registries",
          resourceTypes: ["registry"],
          enabled: true,
          createdAt: new Date().toISOString(),
        };
    }
  }

  /**
   * Validate a filter configuration
   */
  validateFilter(filter: SelectionFilter): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!filter.id) {
      errors.push("Filter ID is required");
    }

    if (!filter.name || filter.name.trim() === "") {
      errors.push("Filter name is required");
    }

    if (filter.criteria?.namePatterns) {
      for (const pattern of filter.criteria.namePatterns) {
        try {
          // Test if pattern can be converted to valid regex
          this.matchesPattern("test", pattern);
        } catch {
          errors.push(`Invalid name pattern: ${pattern}`);
        }
      }
    }

    if (filter.excludePatterns) {
      for (const pattern of filter.excludePatterns) {
        try {
          this.matchesPattern("test", pattern);
        } catch {
          errors.push(`Invalid exclude pattern: ${pattern}`);
        }
      }
    }

    if (filter.criteria?.createdAfter) {
      const date = new Date(filter.criteria.createdAfter);
      if (isNaN(date.getTime())) {
        errors.push(`Invalid createdAfter date: ${filter.criteria.createdAfter}`);
      }
    }

    if (filter.criteria?.createdBefore) {
      const date = new Date(filter.criteria.createdBefore);
      if (isNaN(date.getTime())) {
        errors.push(`Invalid createdBefore date: ${filter.criteria.createdBefore}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get selection summary
   */
  getSummary(result: SelectionResult): {
    totalResources: number;
    selectedCount: number;
    excludedCount: number;
    byType: Record<string, { selected: number; excluded: number }>;
  } {
    const byType: Record<string, { selected: number; excluded: number }> = {};

    for (const resource of result.selected) {
      if (!byType[resource.type]) {
        byType[resource.type] = { selected: 0, excluded: 0 };
      }
      byType[resource.type].selected++;
    }

    for (const resource of result.excluded) {
      if (!byType[resource.type]) {
        byType[resource.type] = { selected: 0, excluded: 0 };
      }
      byType[resource.type].excluded++;
    }

    return {
      totalResources: result.selected.length + result.excluded.length,
      selectedCount: result.selected.length,
      excludedCount: result.excluded.length,
      byType,
    };
  }
}

// Export singleton
export const selectionFilterService = new SelectionFilterService();
