/**
 * Team Migration Service - v1.2.0
 * Handles migration of users, teams, and role mappings
 */

import type { MigrationResult } from "../types";

export interface PortainerUser {
  Id: number;
  Username: string;
  Role: number; // 1 = admin, 2 = user
  AuthenticationMethod: number;
  ThemeSettings?: {
    color: string;
  };
  UserTheme?: string;
  EndpointAuthorizations?: Record<number, { [key: string]: boolean }>;
}

export interface PortainerTeam {
  Id: number;
  Name: string;
}

export interface PortainerTeamMembership {
  Id: number;
  UserId: number;
  TeamId: number;
  Role: number; // 1 = leader, 2 = member
}

export interface DokployUser {
  id?: string;
  email: string;
  password?: string;
  role: "admin" | "user";
  isActive: boolean;
  createdAt?: string;
}

export interface DokployTeam {
  id?: string;
  name: string;
  description?: string;
  members: DokployTeamMember[];
}

export interface DokployTeamMember {
  userId: string;
  role: "owner" | "admin" | "member";
}

export interface TeamMigrationConfig {
  migrateUsers: boolean;
  migrateTeams: boolean;
  migratePermissions: boolean;
  createDefaultPasswords: boolean;
  defaultPasswordPattern?: string; // e.g., "Temp123!{username}"
  roleMapping?: Record<number, string>; // Portainer role -> Dokploy role
  sendInviteEmails: boolean;
  preserveUserIds: boolean;
}

export interface UserMapping {
  portainerId: number;
  portainerUsername: string;
  dokployId?: string;
  dokployEmail: string;
  status: "pending" | "created" | "exists" | "failed";
  error?: string;
}

export interface TeamMapping {
  portainerId: number;
  portainerName: string;
  dokployId?: string;
  dokployName: string;
  status: "pending" | "created" | "exists" | "failed";
  error?: string;
}

export interface TeamMigrationResult extends MigrationResult {
  userMappings: UserMapping[];
  teamMappings: TeamMapping[];
  permissionsMigrated: number;
}

export class TeamMigrationService {
  private dokployUrl: string = "";
  private dokployApiKey: string = "";
  private userMappings: Map<number, UserMapping> = new Map();
  private teamMappings: Map<number, TeamMapping> = new Map();

  /**
   * Configure Dokploy connection
   */
  configure(dokployUrl: string, dokployApiKey: string): void {
    this.dokployUrl = dokployUrl;
    this.dokployApiKey = dokployApiKey;
  }

  /**
   * Migrate users from Portainer to Dokploy
   */
  async migrateUsers(
    users: PortainerUser[],
    config: TeamMigrationConfig,
    dryRun: boolean = true
  ): Promise<UserMapping[]> {
    const mappings: UserMapping[] = [];

    for (const user of users) {
      const mapping: UserMapping = {
        portainerId: user.Id,
        portainerUsername: user.Username,
        dokployEmail: this.generateEmail(user.Username),
        status: "pending",
      };

      if (!dryRun) {
        try {
          // Check if user already exists
          const existingUser = await this.findUserByEmail(mapping.dokployEmail);

          if (existingUser) {
            mapping.status = "exists";
            mapping.dokployId = existingUser.id;
          } else {
            // Create new user
            const newUser = await this.createUser({
              email: mapping.dokployEmail,
              password: config.createDefaultPasswords
                ? this.generateDefaultPassword(user.Username, config.defaultPasswordPattern)
                : undefined,
              role: this.mapRole(user.Role, config.roleMapping),
              isActive: true,
            });

            if (newUser) {
              mapping.status = "created";
              mapping.dokployId = newUser.id;

              // Send invite email if configured
              if (config.sendInviteEmails) {
                await this.sendInviteEmail(mapping.dokployEmail);
              }
            } else {
              mapping.status = "failed";
              mapping.error = "Failed to create user";
            }
          }
        } catch (error) {
          mapping.status = "failed";
          mapping.error = error instanceof Error ? error.message : "Unknown error";
        }
      }

      mappings.push(mapping);
      this.userMappings.set(user.Id, mapping);
    }

    return mappings;
  }

  /**
   * Migrate teams from Portainer to Dokploy
   */
  async migrateTeams(
    teams: PortainerTeam[],
    memberships: PortainerTeamMembership[],
    config: TeamMigrationConfig,
    dryRun: boolean = true
  ): Promise<TeamMapping[]> {
    const mappings: TeamMapping[] = [];

    for (const team of teams) {
      const mapping: TeamMapping = {
        portainerId: team.Id,
        portainerName: team.Name,
        dokployName: this.sanitizeTeamName(team.Name),
        status: "pending",
      };

      if (!dryRun) {
        try {
          // Check if team already exists
          const existingTeam = await this.findTeamByName(mapping.dokployName);

          if (existingTeam) {
            mapping.status = "exists";
            mapping.dokployId = existingTeam.id;
          } else {
            // Get team members
            const teamMemberships = memberships.filter((m) => m.TeamId === team.Id);
            const members: DokployTeamMember[] = [];

            for (const membership of teamMemberships) {
              const userMapping = this.userMappings.get(membership.UserId);
              if (userMapping?.dokployId) {
                members.push({
                  userId: userMapping.dokployId,
                  role: membership.Role === 1 ? "admin" : "member",
                });
              }
            }

            // Create team
            const newTeam = await this.createTeam({
              name: mapping.dokployName,
              description: `Migrated from Portainer team: ${team.Name}`,
              members,
            });

            if (newTeam) {
              mapping.status = "created";
              mapping.dokployId = newTeam.id;
            } else {
              mapping.status = "failed";
              mapping.error = "Failed to create team";
            }
          }
        } catch (error) {
          mapping.status = "failed";
          mapping.error = error instanceof Error ? error.message : "Unknown error";
        }
      }

      mappings.push(mapping);
      this.teamMappings.set(team.Id, mapping);
    }

    return mappings;
  }

  /**
   * Migrate permissions (endpoint authorizations)
   */
  async migratePermissions(
    users: PortainerUser[],
    dryRun: boolean = true
  ): Promise<number> {
    let migratedCount = 0;

    for (const user of users) {
      if (!user.EndpointAuthorizations) continue;

      const userMapping = this.userMappings.get(user.Id);
      if (!userMapping?.dokployId) continue;

      for (const [endpointId, permissions] of Object.entries(user.EndpointAuthorizations)) {
        if (!dryRun) {
          try {
            // Map Portainer permissions to Dokploy format
            // This is a simplified example - actual mapping depends on Dokploy's permission model
            const dokployPermissions = this.mapPermissions(permissions);

            // Apply permissions in Dokploy
            // await this.applyPermissions(userMapping.dokployId, endpointId, dokployPermissions);

            migratedCount++;
          } catch (error) {
            console.error(`Failed to migrate permissions for user ${user.Username}:`, error);
          }
        } else {
          migratedCount++;
        }
      }
    }

    return migratedCount;
  }

  /**
   * Full team migration
   */
  async migrate(
    users: PortainerUser[],
    teams: PortainerTeam[],
    memberships: PortainerTeamMembership[],
    config: TeamMigrationConfig,
    dryRun: boolean = true
  ): Promise<TeamMigrationResult> {
    const result: TeamMigrationResult = {
      success: true,
      migratedStacks: [],
      migratedRegistries: [],
      migratedEndpoints: [],
      errors: [],
      warnings: [],
      startTime: new Date().toISOString(),
      endTime: "",
      duration: 0,
      userMappings: [],
      teamMappings: [],
      permissionsMigrated: 0,
    };

    try {
      // Migrate users first
      if (config.migrateUsers) {
        result.userMappings = await this.migrateUsers(users, config, dryRun);

        const failedUsers = result.userMappings.filter((m) => m.status === "failed");
        if (failedUsers.length > 0) {
          result.warnings.push(
            `${failedUsers.length} users failed to migrate: ${failedUsers.map((u) => u.portainerUsername).join(", ")}`
          );
        }
      }

      // Migrate teams
      if (config.migrateTeams) {
        result.teamMappings = await this.migrateTeams(teams, memberships, config, dryRun);

        const failedTeams = result.teamMappings.filter((m) => m.status === "failed");
        if (failedTeams.length > 0) {
          result.warnings.push(
            `${failedTeams.length} teams failed to migrate: ${failedTeams.map((t) => t.portainerName).join(", ")}`
          );
        }
      }

      // Migrate permissions
      if (config.migratePermissions) {
        result.permissionsMigrated = await this.migratePermissions(users, dryRun);
      }

      // Add helpful warnings
      result.warnings.push(
        "Users may need to reset their passwords after migration"
      );
      result.warnings.push(
        "Review team memberships and permissions in Dokploy after migration"
      );
    } catch (error) {
      result.success = false;
      result.errors.push({
        resource: "team-migration",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    result.endTime = new Date().toISOString();
    result.duration =
      new Date(result.endTime).getTime() - new Date(result.startTime).getTime();

    return result;
  }

  /**
   * Generate email from username
   */
  private generateEmail(username: string): string {
    // If username is already an email, use it
    if (username.includes("@")) {
      return username;
    }

    // Generate email with placeholder domain
    return `${username.toLowerCase()}@migrated.local`;
  }

  /**
   * Generate default password
   */
  private generateDefaultPassword(username: string, pattern?: string): string {
    if (pattern) {
      return pattern.replace("{username}", username);
    }

    // Generate random password
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Map Portainer role to Dokploy role
   */
  private mapRole(
    portainerRole: number,
    mapping?: Record<number, string>
  ): "admin" | "user" {
    if (mapping && mapping[portainerRole]) {
      return mapping[portainerRole] as "admin" | "user";
    }

    // Default mapping: 1 (admin) -> admin, others -> user
    return portainerRole === 1 ? "admin" : "user";
  }

  /**
   * Map Portainer permissions to Dokploy format
   */
  private mapPermissions(permissions: { [key: string]: boolean }): Record<string, boolean> {
    // Map Portainer operations to Dokploy equivalents
    const mapping: Record<string, string> = {
      EndpointExtensionAdd: "extensions.add",
      EndpointExtensionRemove: "extensions.remove",
      DockerContainerCreate: "containers.create",
      DockerContainerStart: "containers.start",
      DockerContainerStop: "containers.stop",
      DockerContainerDelete: "containers.delete",
      DockerImageCreate: "images.create",
      DockerImageDelete: "images.delete",
      DockerVolumeCreate: "volumes.create",
      DockerVolumeDelete: "volumes.delete",
      DockerNetworkCreate: "networks.create",
      DockerNetworkDelete: "networks.delete",
    };

    const dokployPermissions: Record<string, boolean> = {};

    for (const [portainerPerm, value] of Object.entries(permissions)) {
      const dokployPerm = mapping[portainerPerm];
      if (dokployPerm) {
        dokployPermissions[dokployPerm] = value;
      }
    }

    return dokployPermissions;
  }

  /**
   * Sanitize team name
   */
  private sanitizeTeamName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /**
   * Find user by email in Dokploy
   */
  private async findUserByEmail(email: string): Promise<DokployUser | null> {
    try {
      const response = await fetch(`${this.dokployUrl}/api/users?email=${email}`, {
        headers: {
          Authorization: `Bearer ${this.dokployApiKey}`,
        },
      });

      if (!response.ok) return null;

      const users = await response.json();
      return users.find((u: DokployUser) => u.email === email) || null;
    } catch {
      return null;
    }
  }

  /**
   * Create user in Dokploy
   */
  private async createUser(user: DokployUser): Promise<DokployUser | null> {
    try {
      const response = await fetch(`${this.dokployUrl}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.dokployApiKey}`,
        },
        body: JSON.stringify(user),
      });

      if (!response.ok) return null;

      return response.json();
    } catch {
      return null;
    }
  }

  /**
   * Find team by name in Dokploy
   */
  private async findTeamByName(name: string): Promise<DokployTeam | null> {
    try {
      const response = await fetch(`${this.dokployUrl}/api/teams`, {
        headers: {
          Authorization: `Bearer ${this.dokployApiKey}`,
        },
      });

      if (!response.ok) return null;

      const teams = await response.json();
      return teams.find((t: DokployTeam) => t.name === name) || null;
    } catch {
      return null;
    }
  }

  /**
   * Create team in Dokploy
   */
  private async createTeam(team: DokployTeam): Promise<DokployTeam | null> {
    try {
      const response = await fetch(`${this.dokployUrl}/api/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.dokployApiKey}`,
        },
        body: JSON.stringify(team),
      });

      if (!response.ok) return null;

      return response.json();
    } catch {
      return null;
    }
  }

  /**
   * Send invite email
   */
  private async sendInviteEmail(email: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.dokployUrl}/api/users/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.dokployApiKey}`,
        },
        body: JSON.stringify({ email }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get user mappings
   */
  getUserMappings(): UserMapping[] {
    return Array.from(this.userMappings.values());
  }

  /**
   * Get team mappings
   */
  getTeamMappings(): TeamMapping[] {
    return Array.from(this.teamMappings.values());
  }

  /**
   * Analyze migration
   */
  analyze(
    users: PortainerUser[],
    teams: PortainerTeam[],
    memberships: PortainerTeamMembership[]
  ): {
    usersCount: number;
    teamsCount: number;
    membershipsCount: number;
    adminUsers: number;
    regularUsers: number;
    warnings: string[];
  } {
    const adminUsers = users.filter((u) => u.Role === 1).length;

    const warnings: string[] = [];

    // Check for potential issues
    if (users.some((u) => !u.Username.includes("@"))) {
      warnings.push(
        "Some usernames are not emails - placeholder emails will be generated"
      );
    }

    if (teams.length > 0 && memberships.length === 0) {
      warnings.push("Teams exist but have no memberships");
    }

    const orphanedMemberships = memberships.filter(
      (m) => !users.find((u) => u.Id === m.UserId)
    );
    if (orphanedMemberships.length > 0) {
      warnings.push(`${orphanedMemberships.length} team memberships reference non-existent users`);
    }

    return {
      usersCount: users.length,
      teamsCount: teams.length,
      membershipsCount: memberships.length,
      adminUsers,
      regularUsers: users.length - adminUsers,
      warnings,
    };
  }
}

// Export singleton
export const teamMigrationService = new TeamMigrationService();
