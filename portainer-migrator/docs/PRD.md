# Portainer Migrator - Product Requirements Document

## Executive Summary

Portainer Migrator is a commercial tool designed to facilitate seamless migration from Portainer CE/BE to Dokploy. It addresses a significant market need for organizations looking to transition their container management infrastructure while preserving their existing configurations, stacks, and operational data.

---

## Product Vision

**Mission**: Enable organizations to migrate from Portainer to Dokploy with zero downtime, complete data preservation, and minimal operational disruption.

**Target Market**: Organizations currently using Portainer CE/BE who are evaluating or transitioning to Dokploy for enhanced features, better pricing, or improved user experience.

---

## Problem Statement

### Current Pain Points

1. **Manual Migration Complexity**: Migrating from Portainer to Dokploy requires manually recreating every stack, environment, registry, and configuration - a time-consuming and error-prone process.

2. **No Official Migration Path**: Neither Portainer nor Dokploy provide official migration tools, leaving users to develop custom solutions or face significant manual work.

3. **Data Loss Risk**: Without proper tooling, critical configurations, environment variables, and deployment settings can be lost during migration.

4. **Downtime Concerns**: Manual migrations often require extended maintenance windows, impacting business operations.

5. **Technical Expertise Requirements**: Organizations may lack the technical expertise to safely migrate complex container orchestration setups.

### Market Opportunity

- Thousands of Portainer CE installations worldwide
- Growing dissatisfaction with Portainer BE pricing
- Dokploy's emergence as a competitive alternative
- No existing commercial or open-source migration tools

---

## Product Overview

### Core Capabilities

1. **Dual Migration Sources**
   - **API-Based Migration**: Connect to a running Portainer instance via REST API
   - **BoltDB-Based Migration**: Read directly from Portainer's database file for offline/air-gapped environments

2. **Comprehensive Data Migration**
   - Docker Compose stacks
   - Docker registries and credentials
   - Environment/endpoint configurations
   - Environment variables
   - User accounts and teams (optional)

3. **Safe Migration Process**
   - Pre-migration analysis and compatibility checking
   - Dry-run mode for validation
   - Rollback capabilities
   - Detailed logging and audit trail

4. **Enterprise Features**
   - License-based activation
   - Offline validation support
   - Multi-organization support
   - Export/import capabilities

---

## Feature Specifications

### 1. Connection Management

#### 1.1 Portainer API Connection
- **Input**: Portainer URL, API Key or Username/Password
- **Validation**: Connection test, version verification, permission check
- **Security**: Encrypted credential storage, TLS support

#### 1.2 BoltDB File Access
- **Input**: Path to portainer.db file, optional stack files directory
- **Validation**: File integrity check, schema version verification
- **Support**: Portainer versions 2.x and above

### 2. Discovery & Analysis

#### 2.1 Resource Discovery
- Enumerate all endpoints/environments
- List all stacks with compose configurations
- Identify registries and authentication methods
- Catalog users, teams, and permissions

#### 2.2 Compatibility Analysis
- Check stack compose syntax compatibility
- Identify unsupported features
- Flag potential migration issues
- Generate migration readiness report

### 3. Migration Execution

#### 3.1 Dry Run Mode
- Simulate entire migration process
- Report expected outcomes
- Identify potential failures
- No actual changes made to Dokploy

#### 3.2 Actual Migration
- Execute migration with progress tracking
- Real-time status updates
- Error handling and recovery
- Partial migration support

### 4. Post-Migration

#### 4.1 Verification
- Compare source and destination states
- Validate stack deployments
- Check registry connectivity
- Report discrepancies

#### 4.2 Reporting
- Detailed migration report
- Success/failure statistics
- Export to JSON/PDF formats
- Audit log generation

---

## User Stories

### As an Operations Engineer
- I want to analyze my Portainer setup before migration so I can understand the scope and risks
- I want to run a dry migration first so I can verify everything will work correctly
- I want to see detailed logs so I can troubleshoot any issues
- I want to migrate incrementally so I can minimize risk

### As a System Administrator
- I want to migrate without Portainer API access so I can work in air-gapped environments
- I want to preserve all my configurations so I don't have to manually recreate them
- I want to validate my license offline so I can use the tool in secure environments

### As a DevOps Manager
- I want migration statistics so I can report progress to stakeholders
- I want to export migration reports so I can document the transition
- I want to retry failed items so I can complete partial migrations

---

## Technical Requirements

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| Memory | 512 MB | 1 GB |
| Disk | 100 MB | 500 MB |
| Network | Outbound HTTPS | Outbound HTTPS |

### Compatibility Matrix

| Portainer Version | Support Level |
|-------------------|---------------|
| 2.19.x | Full |
| 2.18.x | Full |
| 2.17.x | Full |
| 2.16.x | Full |
| 2.15.x | Partial |
| < 2.15 | Not Supported |

| Dokploy Version | Support Level |
|-----------------|---------------|
| 0.10.x+ | Full |
| < 0.10 | Not Supported |

### Security Requirements

1. **Data Protection**
   - All credentials encrypted at rest
   - TLS 1.2+ for all network communications
   - No credentials transmitted in logs

2. **Access Control**
   - License-based access
   - No external telemetry (optional)

---

## Success Metrics

### Product Metrics
- Migration success rate > 95%
- Average migration time < 30 minutes (100 stacks)
- Customer satisfaction score > 4.5/5
- Support ticket rate < 10% of customers

### Business Metrics
- License conversion rate > 20%
- Trial to paid conversion > 30%
- Customer retention > 90% annually
- Net promoter score > 40

---

## Constraints and Limitations

### Known Limitations

1. **Portainer-Specific Features**: Some Portainer-specific features have no Dokploy equivalent:
   - Edge agents
   - Kubernetes management
   - ARM templates (Azure)

2. **Credential Migration**: Due to encryption, some credentials may require manual re-entry

3. **Custom Templates**: Portainer custom templates require manual recreation

4. **User Permissions**: Granular Portainer permissions may not map 1:1 to Dokploy roles

### Out of Scope (v1.0)

- Kubernetes workload migration
- Edge agent migration
- Custom template migration
- Real-time sync/continuous migration

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| Stack | A group of services defined in a Docker Compose file |
| Endpoint | A Docker environment in Portainer (maps to Server in Dokploy) |
| Registry | A Docker image registry configuration |
| BoltDB | The embedded database used by Portainer |

### References

- [Portainer API Documentation](https://docs.portainer.io/api)
- [Dokploy Documentation](https://docs.dokploy.com)
- [Docker Compose Specification](https://docs.docker.com/compose/compose-file/)
