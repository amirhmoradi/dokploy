/**
 * Shared Types for Portainer Migrator
 */

// ============================================================================
// Portainer Types
// ============================================================================

export interface PortainerEndpoint {
  Id: number;
  Name: string;
  Type: number; // 1=Docker, 2=Agent, 3=Azure, 4=Edge, 5=K8s, 6=K8s Agent, 7=K8s Edge
  URL: string;
  PublicURL?: string;
  GroupId?: number;
  Status: number;
  TLSConfig?: {
    TLS?: boolean;
    TLSSkipVerify?: boolean;
    TLSCACert?: string;
    TLSCert?: string;
    TLSKey?: string;
  };
  AuthorizedUsers?: number[];
  AuthorizedTeams?: number[];
  TagIds?: number[];
  Snapshots?: Array<{
    DockerVersion?: string;
    TotalCPU?: number;
    TotalMemory?: number;
    RunningContainerCount?: number;
    StoppedContainerCount?: number;
    VolumeCount?: number;
    ImageCount?: number;
    StackCount?: number;
  }>;
}

export interface PortainerEndpointGroup {
  Id: number;
  Name: string;
  Description?: string;
  AuthorizedUsers?: number[];
  AuthorizedTeams?: number[];
  TagIds?: number[];
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
  GitConfig?: {
    URL?: string;
    ReferenceName?: string;
    ConfigFilePath?: string;
    Authentication?: {
      Username?: string;
      Password?: string;
      GitCredentialID?: number;
    };
  };
  AutoUpdate?: {
    Interval?: string;
    Webhook?: string;
  };
  AdditionalFiles?: string[];
  Option?: {
    Prune?: boolean;
  };
  FromAppTemplate?: boolean;
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
}

export interface PortainerUser {
  Id: number;
  Username: string;
  Role: number; // 1=Admin, 2=Standard, 3=ReadOnly
  AuthenticationMethod?: number;
  EndpointAuthorizations?: Record<string, { RoleId: number }>;
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

// ============================================================================
// Dokploy Types
// ============================================================================

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

// ============================================================================
// Migration Types
// ============================================================================

export type MigrationStatus =
  | "pending"
  | "analyzing"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type MigrationItemStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

export type MigrationItemType =
  | "endpoint"
  | "stack"
  | "registry"
  | "user"
  | "team"
  | "environment_variable"
  | "volume"
  | "network";

export type MigrationSourceType = "api" | "boltdb";

export interface Migration {
  id: string;
  name: string;
  description?: string;
  sourceType: MigrationSourceType;
  status: MigrationStatus;
  progress: number;
  currentStep?: string;

  // Source configuration
  portainerUrl?: string;
  portainerApiKey?: string;
  portainerUsername?: string;
  portainerPassword?: string;
  boltDbPath?: string;
  stackFilesPath?: string;

  // Options
  isDryRun: boolean;
  migrateStacks: boolean;
  migrateRegistries: boolean;
  migrateEndpoints: boolean;
  migrateEnvironmentVariables: boolean;
  migrateUsers: boolean;
  autoDeployAfterMigration: boolean;

  // Target
  targetProjectId?: string;
  targetEnvironmentId?: string;
  targetServerId?: string;

  // Results
  analysisResult?: MigrationAnalysis;
  migrationMapping?: MigrationMapping;
  errorMessage?: string;

  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface MigrationItem {
  id: string;
  migrationId: string;
  itemType: MigrationItemType;
  portainerId: string;
  portainerName: string;
  status: MigrationItemStatus;
  sourceData: Record<string, unknown>;
  transformedData?: Record<string, unknown>;
  dokployId?: string;
  dokployType?: string;
  errorMessage?: string;
  processedAt?: string;
  createdAt: string;
}

export interface MigrationLog {
  id: string;
  migrationId: string;
  level: "debug" | "info" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
  itemType?: MigrationItemType;
  itemId?: string;
  itemName?: string;
  itemStatus?: string;
  timestamp: string;
}

export interface MigrationAnalysis {
  endpoints: EndpointAnalysis[];
  stacks: StackAnalysis[];
  registries: RegistryAnalysis[];
  users: UserAnalysis[];
  teams: TeamAnalysis[];
  summary: AnalysisSummary;
}

export interface EndpointAnalysis {
  id: number;
  name: string;
  type: number;
  url: string;
  publicUrl?: string;
  status: number;
  tlsConfig?: { tls?: boolean; tlsSkipVerify?: boolean };
  canMigrate: boolean;
  migrationNotes: string[];
  warnings: string[];
}

export interface StackAnalysis {
  id: number;
  name: string;
  type: number;
  endpointId: number;
  status: number;
  composeFile?: string;
  env?: Array<{ name: string; value: string }>;
  gitConfig?: { url?: string; referenceName?: string; authentication?: boolean };
  canMigrate: boolean;
  migrationNotes: string[];
  warnings: string[];
}

export interface RegistryAnalysis {
  id: number;
  name: string;
  type: number;
  url: string;
  authentication: boolean;
  canMigrate: boolean;
  migrationNotes: string[];
  warnings: string[];
}

export interface UserAnalysis {
  id: number;
  username: string;
  role: number;
  canMigrate: boolean;
  migrationNotes: string[];
  warnings: string[];
}

export interface TeamAnalysis {
  id: number;
  name: string;
  memberCount: number;
  canMigrate: boolean;
  migrationNotes: string[];
  warnings: string[];
}

export interface AnalysisSummary {
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
}

export interface MigrationMapping {
  endpoints: Record<string, string>;
  stacks: Record<string, string>;
  registries: Record<string, string>;
  users: Record<string, string>;
  projects: Record<string, string>;
}

export interface MigrationStatistics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  skipped: number;
}

// ============================================================================
// API Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// License Types
// ============================================================================

export interface License {
  key: string;
  type: "trial" | "standard" | "professional" | "enterprise";
  holder: string;
  email: string;
  expiresAt: string;
  features: string[];
  maxMigrations?: number;
  maxStacks?: number;
  isValid: boolean;
}

export interface LicenseValidationResult {
  valid: boolean;
  license?: License;
  error?: string;
}
