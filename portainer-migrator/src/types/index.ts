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

// ============================================================================
// v1.1.0 - Selective Migration Types
// ============================================================================

export interface SelectionFilter {
  type: "include" | "exclude";
  field: "name" | "id" | "endpoint" | "type" | "tag" | "status";
  operator: "equals" | "contains" | "startsWith" | "endsWith" | "regex" | "in";
  value: string | string[] | number | number[];
}

export interface SelectionCriteria {
  stacks?: {
    selectedIds?: number[];
    filters?: SelectionFilter[];
    priority?: number[];  // Stack IDs in priority order
  };
  registries?: {
    selectedIds?: number[];
    filters?: SelectionFilter[];
  };
  endpoints?: {
    selectedIds?: number[];
    filters?: SelectionFilter[];
  };
  users?: {
    selectedIds?: number[];
    filters?: SelectionFilter[];
  };
}

// ============================================================================
// v1.1.0 - Advanced Mapping Types
// ============================================================================

export interface EnvironmentVariableMapping {
  sourcePattern: string;  // Regex or exact match
  targetName?: string;    // Rename variable
  targetValue?: string;   // Transform value (supports ${value} placeholder)
  action: "keep" | "rename" | "transform" | "delete";
}

export interface RegistryUrlMapping {
  sourceUrl: string;
  targetUrl: string;
  transformCredentials?: boolean;
}

export interface ServerAssignmentRule {
  condition: {
    field: "endpointName" | "endpointType" | "endpointTag" | "stackName";
    operator: "equals" | "contains" | "regex";
    value: string;
  };
  targetServerId: string;
}

export interface ProjectMappingRule {
  condition: {
    field: "endpointName" | "endpointType" | "stackName";
    operator: "equals" | "contains" | "regex";
    value: string;
  };
  projectName: string;
  createIfNotExists: boolean;
}

export interface AdvancedMappingConfig {
  environmentVariables?: EnvironmentVariableMapping[];
  registryUrls?: RegistryUrlMapping[];
  serverAssignment?: ServerAssignmentRule[];
  projectMapping?: ProjectMappingRule[];
  autoCreateProjects?: boolean;
  defaultProjectTemplate?: string;
}

// ============================================================================
// v1.1.0 - Notification Types
// ============================================================================

export type NotificationChannel = "email" | "webhook" | "slack" | "discord" | "teams";

export type NotificationEvent =
  | "migration.started"
  | "migration.completed"
  | "migration.failed"
  | "migration.cancelled"
  | "analysis.completed"
  | "item.failed"
  | "license.expiring";

export interface NotificationConfig {
  id: string;
  name: string;
  channel: NotificationChannel;
  enabled: boolean;
  events: NotificationEvent[];
  config: EmailConfig | WebhookConfig | SlackConfig | DiscordConfig | TeamsConfig;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromAddress: string;
  fromName: string;
  toAddresses: string[];
  ccAddresses?: string[];
}

export interface WebhookConfig {
  url: string;
  method: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  bodyTemplate?: string;
  secretKey?: string;
  retryCount?: number;
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface DiscordConfig {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
}

export interface TeamsConfig {
  webhookUrl: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  event: NotificationEvent;
  subject?: string;
  bodyTemplate: string;
  isDefault: boolean;
}

// ============================================================================
// v1.2.0 - Team/User Migration Types
// ============================================================================

export interface RoleMapping {
  portainerRole: number;
  dokployRole: string;
  permissions?: string[];
}

export interface TeamMigrationConfig {
  enabled: boolean;
  preserveStructure: boolean;
  roleMapping: RoleMapping[];
  defaultRole: string;
  sendInviteEmails: boolean;
  requirePasswordReset: boolean;
}

export interface DokployUser {
  email: string;
  password?: string;
  role: "admin" | "user";
  organizationId?: string;
}

export interface DokployTeam {
  name: string;
  description?: string;
  members: string[];  // User IDs
}

// ============================================================================
// v1.2.0 - Multi-Instance Support Types
// ============================================================================

export interface PortainerInstance {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  username?: string;
  password?: string;
  boltDbPath?: string;
  enabled: boolean;
  lastSyncAt?: string;
}

export interface ConflictResolution {
  strategy: "skip" | "overwrite" | "rename" | "merge";
  renamePattern?: string;  // e.g., "{name}-{source}"
  mergeStrategy?: "sourceWins" | "targetWins" | "manual";
}

export interface MultiInstanceConfig {
  instances: PortainerInstance[];
  conflictResolution: ConflictResolution;
  mergeProjects: boolean;
  deduplicateRegistries: boolean;
}

// ============================================================================
// v1.2.0 - Scheduled Migration Types
// ============================================================================

export type ScheduleFrequency = "once" | "hourly" | "daily" | "weekly" | "monthly" | "cron";

export interface ScheduledMigration {
  id: string;
  name: string;
  migrationConfigId: string;  // Template migration config
  frequency: ScheduleFrequency;
  cronExpression?: string;
  scheduledAt?: string;  // For "once"
  timezone: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
  maxRuns?: number;
  retryOnFailure: boolean;
  maxRetries: number;
  maintenanceWindow?: {
    startTime: string;  // HH:MM format
    endTime: string;
    daysOfWeek: number[];  // 0-6, Sunday = 0
  };
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledMigrationRun {
  id: string;
  scheduleId: string;
  migrationId?: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  retryCount: number;
}

// ============================================================================
// v1.2.0 - Backup & Restore Types
// ============================================================================

export type BackupType = "full" | "migration" | "config";

export interface Backup {
  id: string;
  name: string;
  type: BackupType;
  description?: string;
  migrationId?: string;  // If type is "migration"
  filePath: string;
  fileSize: number;
  checksum: string;
  encrypted: boolean;
  compressionType: "none" | "gzip" | "zip";
  metadata: BackupMetadata;
  createdAt: string;
  expiresAt?: string;
}

export interface BackupMetadata {
  version: string;
  sourceType: string;
  itemCounts: {
    migrations: number;
    items: number;
    logs: number;
    configs: number;
  };
  portainerVersion?: string;
  dokployState?: {
    projectCount: number;
    composeCount: number;
    registryCount: number;
  };
}

export interface RestoreOptions {
  backupId: string;
  restoreType: "full" | "selective";
  selectedItems?: string[];
  overwriteExisting: boolean;
  restoreConfigs: boolean;
  restoreMigrations: boolean;
  validateBeforeRestore: boolean;
}

export interface RestoreResult {
  success: boolean;
  restoredItems: number;
  skippedItems: number;
  errors: string[];
  warnings: string[];
}

export interface Snapshot {
  id: string;
  name: string;
  description?: string;
  migrationId: string;
  phase: "pre-migration" | "post-migration";
  portainerState: Record<string, unknown>;
  dokployState: Record<string, unknown>;
  createdAt: string;
}

// ============================================================================
// v1.2.0 - Advanced Reporting Types
// ============================================================================

export type ReportFormat = "json" | "pdf" | "csv" | "html";

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  type: "migration" | "comparison" | "audit" | "compliance" | "trend";
  format: ReportFormat;
  template: string;  // Handlebars/Mustache template
  styles?: string;   // CSS for PDF/HTML
  isDefault: boolean;
  createdAt: string;
}

export interface ReportConfig {
  templateId: string;
  migrationIds?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  includeDetails: boolean;
  includeLogs: boolean;
  includeCharts: boolean;
  groupBy?: "migration" | "date" | "status" | "type";
  customFields?: Record<string, unknown>;
}

export interface GeneratedReport {
  id: string;
  name: string;
  templateId: string;
  config: ReportConfig;
  format: ReportFormat;
  filePath: string;
  fileSize: number;
  generatedAt: string;
  expiresAt?: string;
}

export interface TrendData {
  period: string;
  migrations: number;
  successRate: number;
  avgDuration: number;
  itemsMigrated: number;
  errorCount: number;
}

export interface ComparisonReport {
  source: {
    platform: string;
    version: string;
    itemCounts: Record<string, number>;
  };
  target: {
    platform: string;
    version: string;
    itemCounts: Record<string, number>;
  };
  differences: {
    type: string;
    sourceValue: unknown;
    targetValue: unknown;
    status: "matched" | "different" | "missing";
  }[];
}

// ============================================================================
// v1.2.0 - Audit & Compliance Types
// ============================================================================

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  result: "success" | "failure";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface DataRetentionPolicy {
  id: string;
  name: string;
  resourceType: "migrations" | "logs" | "backups" | "reports" | "audits";
  retentionDays: number;
  action: "delete" | "archive" | "anonymize";
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface ComplianceReport {
  id: string;
  type: "gdpr" | "sox" | "hipaa" | "pci" | "custom";
  generatedAt: string;
  period: { start: string; end: string };
  findings: ComplianceFinding[];
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export interface ComplianceFinding {
  checkId: string;
  category: string;
  description: string;
  status: "pass" | "fail" | "warning" | "not-applicable";
  details?: string;
  recommendation?: string;
}

// ============================================================================
// v1.2.0 - CLI Types
// ============================================================================

export interface CLIConfig {
  apiUrl: string;
  apiKey?: string;
  outputFormat: "json" | "table" | "yaml";
  verbose: boolean;
  color: boolean;
}

export interface CLICommand {
  name: string;
  description: string;
  arguments: CLIArgument[];
  options: CLIOption[];
}

export interface CLIArgument {
  name: string;
  description: string;
  required: boolean;
  type: "string" | "number" | "boolean";
}

export interface CLIOption {
  name: string;
  alias?: string;
  description: string;
  type: "string" | "number" | "boolean";
  default?: unknown;
}

// ============================================================================
// v2.0.0 - Kubernetes Support Types
// ============================================================================

export interface KubernetesEndpoint {
  Id: number;
  Name: string;
  URL: string;
  Type: 5 | 6 | 7;  // K8s types
  Namespace?: string;
  Configuration?: {
    InCluster?: boolean;
    KubeConfig?: string;
  };
}

export interface KubernetesResource {
  kind: string;
  apiVersion: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: Record<string, unknown>;
}

export interface ConfigMapMigration {
  sourceConfigMap: KubernetesResource;
  targetFormat: "env" | "file" | "dokploy-secret";
  mapping?: Record<string, string>;
}

export interface SecretMigration {
  sourceSecret: KubernetesResource;
  targetFormat: "env" | "dokploy-secret";
  decrypted: boolean;
  mapping?: Record<string, string>;
}

export interface HelmRelease {
  name: string;
  namespace: string;
  chart: string;
  version: string;
  values: Record<string, unknown>;
  status: string;
}

export interface HelmMigrationConfig {
  preserveValues: boolean;
  convertToCompose: boolean;
  extractSecrets: boolean;
}

export interface NamespaceMapping {
  sourceNamespace: string;
  targetProject?: string;
  targetEnvironment?: string;
}

export interface KubernetesMigrationConfig {
  migrateDeployments: boolean;
  migrateServices: boolean;
  migrateConfigMaps: boolean;
  migrateSecrets: boolean;
  migrateIngresses: boolean;
  migrateHelmReleases: boolean;
  namespaceMapping: NamespaceMapping[];
  helmConfig?: HelmMigrationConfig;
}

// ============================================================================
// v2.0.0 - Edge Agent Migration Types
// ============================================================================

export interface EdgeGroup {
  Id: number;
  Name: string;
  Dynamic: boolean;
  TagIds?: number[];
  Endpoints?: number[];
  PartialMatch?: boolean;
}

export interface EdgeStack {
  Id: number;
  Name: string;
  Status: Record<string, number>;
  CreationDate: number;
  EdgeGroups: number[];
  ProjectPath: string;
  EntryPoint: string;
  Version: number;
  NumDeployments: number;
  ManifestPath?: string;
  DeploymentType: number;
}

export interface EdgeJob {
  Id: number;
  Name: string;
  Image: string;
  CronExpression: string;
  Endpoints: number[];
  EdgeGroups: number[];
  ScriptPath: string;
  Recurring: boolean;
  Created: number;
  Version: number;
}

export interface TunnelConfig {
  ServerAddress: string;
  ServerFingerprint: string;
  Credentials?: {
    Username?: string;
    Password?: string;
  };
}

export interface EdgeAgentMigrationConfig {
  migrateEdgeGroups: boolean;
  migrateEdgeStacks: boolean;
  migrateEdgeJobs: boolean;
  migrateTunnelConfig: boolean;
  convertToStandardStacks: boolean;
  edgeGroupMapping?: Record<number, string>;
}

// ============================================================================
// v2.0.0 - Multi-Platform Support Types
// ============================================================================

export type SourcePlatform = "portainer" | "coolify" | "caprover" | "docker-compose" | "kubernetes";
export type TargetPlatform = "dokploy" | "coolify" | "caprover" | "docker-compose" | "kubernetes";

export interface PlatformAdapter {
  id: string;
  name: string;
  sourcePlatform: SourcePlatform;
  targetPlatform: TargetPlatform;
  version: string;
  capabilities: string[];
}

export interface CoolifyProject {
  id: string;
  name: string;
  description?: string;
  environments: CoolifyEnvironment[];
}

export interface CoolifyEnvironment {
  id: string;
  name: string;
  projectId: string;
}

export interface CoolifyService {
  id: string;
  name: string;
  type: "docker-compose" | "dockerfile" | "pack" | "static";
  environmentId: string;
  repository?: string;
  branch?: string;
  buildCommand?: string;
  startCommand?: string;
  envVars: Record<string, string>;
}

export interface CapRoverApp {
  appName: string;
  instanceCount: number;
  captainDefinitionRelativeFilePath: string;
  hasPersistentData: boolean;
  notExposeAsWebApp: boolean;
  envVars: Array<{ key: string; value: string }>;
  ports: Array<{ containerPort: number; hostPort: number }>;
  volumes: Array<{ containerPath: string; hostPath: string }>;
  appPushWebhook?: { repoInfo: { repo: string; branch: string } };
}

export interface GenericDockerConfig {
  services: Record<string, {
    image?: string;
    build?: string | { context: string; dockerfile?: string };
    ports?: string[];
    volumes?: string[];
    environment?: Record<string, string> | string[];
    depends_on?: string[];
    networks?: string[];
  }>;
  volumes?: Record<string, unknown>;
  networks?: Record<string, unknown>;
}

export interface PlatformMigrationConfig {
  sourcePlatform: SourcePlatform;
  targetPlatform: TargetPlatform;
  sourceConfig: Record<string, unknown>;
  targetConfig: Record<string, unknown>;
  transformations?: TransformationRule[];
}

export interface TransformationRule {
  sourceField: string;
  targetField: string;
  transform: "copy" | "rename" | "map" | "template" | "custom";
  options?: Record<string, unknown>;
}

// ============================================================================
// v2.0.0 - Plugin System Types
// ============================================================================

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  hooks: PluginHook[];
  installedAt: string;
  updatedAt: string;
}

export interface PluginHook {
  event: PluginEvent;
  handler: string;  // Function name or file path
  priority: number;
  async: boolean;
}

export type PluginEvent =
  | "migration.beforeAnalyze"
  | "migration.afterAnalyze"
  | "migration.beforeExecute"
  | "migration.afterExecute"
  | "item.beforeMigrate"
  | "item.afterMigrate"
  | "transform.beforeTransform"
  | "transform.afterTransform"
  | "notification.beforeSend"
  | "report.beforeGenerate"
  | "backup.beforeCreate"
  | "backup.afterRestore";

export interface PluginContext {
  migration?: Migration;
  item?: MigrationItem;
  sourceData?: Record<string, unknown>;
  transformedData?: Record<string, unknown>;
  config: Record<string, unknown>;
  logger: PluginLogger;
  storage: PluginStorage;
}

export interface PluginLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

export interface PluginStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  engines: { migrator: string };
  dependencies?: Record<string, string>;
  hooks: Array<{
    event: PluginEvent;
    handler: string;
    priority?: number;
  }>;
  config?: {
    schema: Record<string, unknown>;
    defaults: Record<string, unknown>;
  };
}

// ============================================================================
// v2.0.0 - Integration Hub Types
// ============================================================================

export interface CICDIntegration {
  id: string;
  name: string;
  type: "github-actions" | "gitlab-ci" | "jenkins" | "circleci" | "azure-devops" | "custom";
  enabled: boolean;
  config: Record<string, unknown>;
  webhookUrl?: string;
  webhookSecret?: string;
}

export interface TerraformResource {
  type: string;
  name: string;
  provider: string;
  attributes: Record<string, unknown>;
  dependencies?: string[];
}

export interface TerraformExport {
  resources: TerraformResource[];
  variables: Record<string, { type: string; default?: unknown; description?: string }>;
  outputs: Record<string, { value: string; description?: string }>;
}

export interface GraphQLSchema {
  types: GraphQLType[];
  queries: GraphQLQuery[];
  mutations: GraphQLMutation[];
  subscriptions: GraphQLSubscription[];
}

export interface GraphQLType {
  name: string;
  kind: "object" | "input" | "enum" | "interface" | "union";
  fields: GraphQLField[];
}

export interface GraphQLField {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  args?: GraphQLArgument[];
}

export interface GraphQLArgument {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
}

export interface GraphQLQuery {
  name: string;
  returnType: string;
  args: GraphQLArgument[];
  description?: string;
}

export interface GraphQLMutation {
  name: string;
  returnType: string;
  args: GraphQLArgument[];
  description?: string;
}

export interface GraphQLSubscription {
  name: string;
  returnType: string;
  args: GraphQLArgument[];
  description?: string;
}

// ============================================================================
// Extended Migration Types (with all features)
// ============================================================================

export interface ExtendedMigration extends Migration {
  // v1.1.0 - Selective Migration
  selectionCriteria?: SelectionCriteria;

  // v1.1.0 - Advanced Mapping
  mappingConfig?: AdvancedMappingConfig;

  // v1.2.0 - Multi-Instance
  sourceInstances?: PortainerInstance[];
  multiInstanceConfig?: MultiInstanceConfig;

  // v1.2.0 - Scheduling
  scheduleId?: string;

  // v1.2.0 - Backup
  preBackupId?: string;
  postSnapshotId?: string;

  // v2.0.0 - Kubernetes
  kubernetesConfig?: KubernetesMigrationConfig;

  // v2.0.0 - Edge
  edgeConfig?: EdgeAgentMigrationConfig;

  // v2.0.0 - Multi-Platform
  platformConfig?: PlatformMigrationConfig;

  // Performance
  parallelism?: number;
  batchSize?: number;
}

// ============================================================================
// Settings Types (Extended)
// ============================================================================

export interface AppSettings {
  // General
  instanceName: string;
  instanceUrl: string;
  timezone: string;

  // UI
  theme: "light" | "dark" | "system";
  language: string;
  dateFormat: string;

  // Notifications
  notifications: NotificationConfig[];
  defaultNotificationTemplate?: string;

  // Performance
  parallelMigrations: number;
  batchSize: number;
  connectionPoolSize: number;
  cacheEnabled: boolean;
  cacheTTL: number;

  // Security
  sessionTimeout: number;
  auditLogRetention: number;
  encryptBackups: boolean;

  // Data Retention
  retentionPolicies: DataRetentionPolicy[];

  // Integrations
  cicdIntegrations: CICDIntegration[];

  // Plugins
  enabledPlugins: string[];
  pluginConfig: Record<string, Record<string, unknown>>;
}
