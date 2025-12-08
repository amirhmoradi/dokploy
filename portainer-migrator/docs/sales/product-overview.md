# Product Overview

## What is Portainer Migrator?

Portainer Migrator is a commercial tool that automates the migration of container management configurations from Portainer CE/BE to Dokploy. It eliminates the manual effort of recreating stacks, registries, and environments while ensuring data integrity and minimal downtime.

## The Problem We Solve

### Manual Migration is Painful

Organizations using Portainer face significant challenges when migrating to Dokploy:

1. **Time-Consuming**: Each stack must be manually recreated
2. **Error-Prone**: Copy-paste mistakes lead to downtime
3. **Incomplete**: Environment variables and configurations get lost
4. **Risky**: No validation before going live
5. **Undocumented**: No audit trail of what was migrated

### The Cost of Manual Migration

| Stacks | Manual Hours | Error Rate | Potential Downtime |
|--------|--------------|------------|-------------------|
| 10 | 4-8 hours | 15% | 1-2 hours |
| 50 | 20-40 hours | 25% | 4-8 hours |
| 100+ | 50-100 hours | 35% | 8-24 hours |

## Our Solution

Portainer Migrator automates the entire migration process:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   Portainer                                    Dokploy     │
│   ┌──────────┐        Migrator              ┌──────────┐  │
│   │  Stacks  │ ─────────────────────────────► Composes │  │
│   ├──────────┤                              ├──────────┤  │
│   │Registries│ ─────────────────────────────►Registries│  │
│   ├──────────┤                              ├──────────┤  │
│   │Endpoints │ ─────────────────────────────► Servers  │  │
│   ├──────────┤                              ├──────────┤  │
│   │ Env Vars │ ─────────────────────────────► Env Vars │  │
│   └──────────┘                              └──────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Dual Migration Methods

**API-Based**: Connect to running Portainer instance
- Real-time data access
- Network-based migration
- Support for remote instances

**BoltDB-Based**: Read from Portainer database file
- Offline migration support
- Air-gapped environments
- Migration from backups

### 2. Comprehensive Migration

| Resource | API | BoltDB |
|----------|-----|--------|
| Stacks | ✅ | ✅ |
| Registries | ✅ | ✅ |
| Endpoints | ✅ | ✅ |
| Environment Variables | ✅ | ✅ |
| Users (Enterprise) | ✅ | ✅ |

### 3. Safe Migration Process

1. **Analyze**: Discover and validate before migrating
2. **Dry Run**: Simulate migration with no changes
3. **Execute**: Perform actual migration
4. **Verify**: Confirm everything migrated correctly

### 4. Enterprise-Ready

- License-based activation
- Offline validation support
- Detailed audit logging
- Export/reporting capabilities

## Use Cases

### Use Case 1: Platform Migration

**Scenario**: Company X is migrating from Portainer BE to Dokploy for cost savings.

**Challenge**: 75 stacks across 5 environments, must complete during 4-hour maintenance window.

**Solution**: Portainer Migrator analyzes setup, validates compatibility, and migrates all resources in under 2 hours.

### Use Case 2: Disaster Recovery

**Scenario**: Portainer instance crashed, only backup of BoltDB available.

**Challenge**: Need to restore operations quickly on new platform.

**Solution**: BoltDB migration method extracts all configurations from backup file, enabling recovery to Dokploy.

### Use Case 3: Multi-Tenant Provider

**Scenario**: Managed hosting provider migrating customers from Portainer to Dokploy.

**Challenge**: 20+ customers with varying configurations.

**Solution**: Repeatable migration process with documentation for each customer.

## Technical Specifications

### Requirements

| Component | Minimum |
|-----------|---------|
| Docker | 20.10+ |
| Memory | 512 MB |
| Disk | 100 MB |

### Compatibility

| Platform | Versions |
|----------|----------|
| Portainer CE | 2.15 - 2.19+ |
| Portainer BE | 2.15 - 2.19+ |
| Dokploy | 0.10+ |

### Security

- TLS for all communications
- Encrypted credential storage
- No data transmission to external servers (except license)
- Detailed audit logging

## Deployment Options

1. **Docker Compose**: Single container deployment
2. **Docker Swarm**: HA deployment
3. **Kubernetes**: Cloud-native deployment

## Support

| Tier | Support Level |
|------|--------------|
| Trial | Community |
| Standard | Email (48h) |
| Professional | Email (24h) |
| Enterprise | Dedicated |
