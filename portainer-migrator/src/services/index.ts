/**
 * Services Index - Portainer Migrator v2.0.0
 * Exports all services for migration operations
 */

// Core Migration Services
export * from "./portainer-api-client.js";
export * from "./portainer-boltdb-reader.js";
export * from "./portainer-transformer.js";
export * from "./portainer-connector.js";
export * from "./migration-engine.js";
export * from "./dokploy-api-client.js";

// v1.1.0 - Selection & Mapping
export * from "./selection-filter-service.js";

// v1.1.0 - Notifications
export * from "./notification-service.js";

// v1.2.0 - Scheduling
export * from "./scheduler-service.js";

// v1.2.0 - Backup & Restore
export * from "./backup-service.js";

// v1.2.0 - Reporting
export * from "./report-service.js";

// v2.0.0 - Kubernetes
export * from "./kubernetes-adapter.js";

// v2.0.0 - Edge Agent
export * from "./edge-agent-adapter.js";

// v2.0.0 - Plugin System
export * from "./plugin-service.js";

// v2.0.0 - Multi-Platform
export * from "./coolify-adapter.js";
export * from "./caprover-adapter.js";
