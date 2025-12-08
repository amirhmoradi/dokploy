# Migration Options Reference

This guide covers all available options when creating and executing migrations.

## Resource Selection Options

### Stacks

**Option**: `migrateStacks`
**Default**: `true`

Migrates Docker Compose stacks from Portainer to Dokploy.

What's included:
- Stack name and configuration
- Docker Compose file content
- Associated environment variables
- Endpoint/server association

What's NOT included:
- Running container state
- Volumes data
- Networks (created on deployment)

### Registries

**Option**: `migrateRegistries`
**Default**: `true`

Migrates Docker registry configurations.

What's included:
- Registry name and URL
- Registry type (Docker Hub, ECR, ACR, etc.)
- Authentication configuration
- Endpoint associations

**Note**: Due to security, some credentials may need manual re-entry.

### Endpoints

**Option**: `migrateEndpoints`
**Default**: `true`

Migrates Portainer endpoints (environments) to Dokploy servers.

What's included:
- Endpoint name
- Connection URL
- TLS configuration
- Tags/labels

What's NOT included:
- Edge agent configurations
- Kubernetes endpoints

### Environment Variables

**Option**: `migrateEnvironmentVariables`
**Default**: `true`

Migrates environment variables associated with stacks.

What's included:
- Variable names
- Variable values
- Stack associations

**Security Note**: Sensitive values are included. Ensure secure handling.

### Users (Enterprise)

**Option**: `migrateUsers`
**Default**: `false`

**Requires**: Enterprise license

Migrates Portainer users to Dokploy.

What's included:
- Username
- Email
- Role (mapped to Dokploy roles)
- Team memberships

What's NOT included:
- Passwords (users must reset)
- Session tokens
- API keys

## Migration Mode Options

### Dry Run

**Option**: `isDryRun`
**Default**: `true`

When enabled:
- Simulates the entire migration
- Logs what would happen
- Makes NO changes to Dokploy
- Useful for validation

When disabled:
- Actually creates resources in Dokploy
- Changes are permanent
- Use after validating with dry run

**Best Practice**: Always run a dry run first!

### Auto Deploy After Migration

**Option**: `autoDeployAfterMigration`
**Default**: `false`

When enabled:
- Automatically deploys stacks after creation
- Triggers Dokploy to pull images and start containers
- Useful for quick go-live

When disabled:
- Stacks are created but not deployed
- Manual deployment required in Dokploy
- Safer for validation

## Target Configuration

### Target Project

**Option**: `targetProjectId`
**Default**: `null` (creates new project)

Specifies which Dokploy project to migrate into.

If not specified:
- A new project is created per Portainer endpoint
- Project name matches endpoint name

If specified:
- All stacks go into the specified project
- Useful for consolidation

### Target Environment

**Option**: `targetEnvironmentId`
**Default**: `null` (uses default)

Specifies the Dokploy environment for deployments.

### Target Server

**Option**: `targetServerId`
**Default**: `null` (auto-mapped)

Specifies which Dokploy server receives deployments.

If not specified:
- Attempts to match by endpoint name
- Falls back to default server

If specified:
- All stacks deploy to specified server
- Useful when consolidating multiple endpoints

## Option Combinations

### Scenario: Test Migration

```json
{
  "migrateStacks": true,
  "migrateRegistries": true,
  "migrateEndpoints": true,
  "migrateEnvironmentVariables": true,
  "isDryRun": true,
  "autoDeployAfterMigration": false
}
```

### Scenario: Full Production Migration

```json
{
  "migrateStacks": true,
  "migrateRegistries": true,
  "migrateEndpoints": true,
  "migrateEnvironmentVariables": true,
  "isDryRun": false,
  "autoDeployAfterMigration": true,
  "targetServerId": "server_production"
}
```

### Scenario: Stacks Only

```json
{
  "migrateStacks": true,
  "migrateRegistries": false,
  "migrateEndpoints": false,
  "migrateEnvironmentVariables": true,
  "isDryRun": false
}
```

### Scenario: Registry Setup

```json
{
  "migrateStacks": false,
  "migrateRegistries": true,
  "migrateEndpoints": false,
  "migrateEnvironmentVariables": false,
  "isDryRun": false
}
```

## Advanced Options

### Conflict Resolution

When a resource already exists in Dokploy:

| Behavior | Description |
|----------|-------------|
| Skip | Don't migrate, log warning |
| Update | Update existing resource |
| Rename | Create with modified name |

Current default: **Skip**

### Error Handling

| Behavior | Description |
|----------|-------------|
| Stop on Error | Halt migration at first error |
| Continue | Log error, continue with next item |
| Retry | Attempt retry before continuing |

Current default: **Continue**

### Batch Size

For large migrations, items are processed in batches:

- Default: 10 items per batch
- Configurable via API
- Helps with rate limiting

## Setting Options via UI

1. Navigate to **New Migration**
2. Fill in source configuration
3. On **Options** step:
   - Toggle resources to migrate
   - Set migration mode
   - Configure targets (optional)
4. Review on **Summary** step
5. Create migration

## Setting Options via API

```bash
curl -X POST http://localhost:3001/api/migrations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Migration",
    "description": "Migrating production stacks",
    "sourceType": "api",
    "portainerUrl": "https://portainer.example.com",
    "portainerApiKey": "ptr_abc123",

    "migrateStacks": true,
    "migrateRegistries": true,
    "migrateEndpoints": true,
    "migrateEnvironmentVariables": true,
    "migrateUsers": false,

    "isDryRun": true,
    "autoDeployAfterMigration": false,

    "targetProjectId": "proj_xyz",
    "targetEnvironmentId": null,
    "targetServerId": "srv_123"
  }'
```

## Modifying Options After Creation

Options can be modified until the migration is executed:

```bash
curl -X PATCH http://localhost:3001/api/migrations/mig_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "migrateUsers": true,
    "isDryRun": false
  }'
```

Cannot modify:
- Source type
- Source connection details (create new migration instead)

## Option Dependencies

Some options depend on others:

| Option | Requires |
|--------|----------|
| `autoDeployAfterMigration` | `isDryRun: false` |
| `migrateUsers` | Enterprise license |
| `targetEnvironmentId` | `targetProjectId` |
| `migrateEnvironmentVariables` | `migrateStacks` (for context) |

## Validation

Invalid option combinations result in errors:

```json
{
  "error": "Cannot auto-deploy during dry run",
  "code": "INVALID_OPTIONS"
}
```

Common validation errors:
- Dry run with auto-deploy enabled
- User migration without enterprise license
- Target project that doesn't exist
- Target server that's offline

## Next Steps

- [Monitoring Progress](./monitoring.md) - Track your migration
- [Troubleshooting](./troubleshooting.md) - Handle issues
