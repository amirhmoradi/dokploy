# Getting Started with Portainer Migrator

This guide will help you understand what Portainer Migrator does and how to prepare for your migration.

## What is Portainer Migrator?

Portainer Migrator is a tool that automates the migration of your container management setup from Portainer to Dokploy. It preserves your:

- **Docker Compose Stacks**: All your stack definitions with their configurations
- **Docker Registries**: Registry connections and authentication
- **Environments**: Server/endpoint configurations
- **Environment Variables**: All environment-specific variables
- **Users & Teams** (optional): User accounts and team structures

## Migration Methods

### Method 1: API-Based Migration (Recommended)

Connect directly to your running Portainer instance via its REST API. This is the recommended method as it:

- Provides real-time access to your data
- Includes the latest configuration changes
- Supports both API key and username/password authentication
- Works with Portainer CE and BE

**Requirements:**
- Portainer instance accessible via network
- API key or admin credentials
- Portainer 2.15 or newer

### Method 2: BoltDB-Based Migration

Read directly from Portainer's database file. Use this method when:

- Portainer is no longer running
- Network access is restricted
- You're in an air-gapped environment
- You want to migrate from a backup

**Requirements:**
- Access to Portainer's `portainer.db` file
- Optional: Access to compose stack files directory

## Pre-Migration Checklist

Before starting your migration, ensure you have:

### Portainer Side

- [ ] Admin access to Portainer (for API method)
- [ ] Portainer API key generated (or admin password)
- [ ] List of stacks to migrate identified
- [ ] Note of any custom configurations

### Dokploy Side

- [ ] Dokploy instance running and accessible
- [ ] Admin API key generated in Dokploy
- [ ] Target project created (optional)
- [ ] Sufficient resources for migrated stacks

### Migration Tool

- [ ] Valid license key obtained
- [ ] Docker and Docker Compose installed
- [ ] Network access to both Portainer and Dokploy
- [ ] Sufficient disk space for logs and temporary data

## Understanding the Migration Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    Migration Workflow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CONNECT          2. ANALYZE           3. MIGRATE           │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐          │
│  │Portainer│ ──────► │ Review  │ ──────► │ Create  │          │
│  │  Data   │         │ Items   │         │in Dokploy│          │
│  └─────────┘         └─────────┘         └─────────┘          │
│       │                   │                   │                │
│       ▼                   ▼                   ▼                │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐          │
│  │Validate │         │ Check   │         │ Verify  │          │
│  │ Access  │         │ Compat. │         │ Success │          │
│  └─────────┘         └─────────┘         └─────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 1: Connection
- Validate credentials
- Test connectivity
- Verify permissions

### Phase 2: Analysis
- Discover all resources
- Check compatibility
- Identify potential issues
- Generate migration plan

### Phase 3: Migration
- Transform data formats
- Create resources in Dokploy
- Track progress
- Handle errors

## What Gets Migrated

| Resource | Migrated | Notes |
|----------|----------|-------|
| Stacks (Compose) | ✅ Yes | Full compose file migration |
| Registries | ✅ Yes | Credentials may need re-entry |
| Endpoints | ✅ Yes | Mapped to Dokploy servers |
| Environment Variables | ✅ Yes | Per-stack variables |
| Users | ⚠️ Optional | Requires enterprise license |
| Teams | ⚠️ Optional | Requires enterprise license |
| Edge Agents | ❌ No | Not supported in v1.0 |
| Kubernetes | ❌ No | Not supported in v1.0 |

## What Doesn't Get Migrated

Some Portainer features don't have Dokploy equivalents:

1. **Edge Agents**: Dokploy uses a different architecture
2. **Kubernetes Workloads**: K8s support planned for v2.0
3. **Custom Templates**: Must be manually recreated
4. **Webhooks**: Different implementation in Dokploy
5. **Access Control Lists**: Permission models differ

## Time Estimates

Migration time depends on your setup complexity:

| Setup Size | Stacks | Estimated Time |
|------------|--------|----------------|
| Small | 1-10 | 5-10 minutes |
| Medium | 10-50 | 15-30 minutes |
| Large | 50-200 | 30-60 minutes |
| Enterprise | 200+ | 1-2 hours |

*Note: Actual times may vary based on network speed and stack complexity.*

## Next Steps

1. [Install Portainer Migrator](./installation.md)
2. [Activate your license](./license-activation.md)
3. [Create your first migration](./first-migration.md)
