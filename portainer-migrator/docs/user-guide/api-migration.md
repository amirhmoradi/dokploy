# API-Based Migration Guide

This guide provides detailed information about migrating from Portainer using the REST API method.

## Overview

API-based migration connects to your running Portainer instance via its REST API. This is the recommended method as it provides:

- Real-time access to the latest data
- No need for file system access
- Support for remote Portainer instances
- Automatic handling of data formats

## Prerequisites

- Portainer CE/BE 2.15 or newer
- Network connectivity to Portainer
- Admin-level API key or credentials
- Portainer API must be enabled (default)

## Obtaining Credentials

### Method 1: API Key (Recommended)

API keys provide secure, revocable access:

1. **Log into Portainer** as an admin user
2. **Navigate to**: Username → My Account
3. **Scroll to**: Access Tokens section
4. **Click**: Add access token
5. **Configure**:
   - Description: "Portainer Migrator"
   - No expiration (or set appropriate date)
6. **Copy** the generated token immediately (shown only once)

The token looks like: `ptr_abc123xyz789...`

### Method 2: Username & Password

Use when API keys aren't available:

1. Use your Portainer admin username
2. Use your Portainer admin password
3. Note: This method generates a temporary JWT token

**Security Note**: API keys are preferred as they can be:
- Scoped to specific permissions
- Revoked without changing your password
- Logged for audit purposes

## Connection Settings

### Required Settings

| Setting | Description | Format |
|---------|-------------|--------|
| Portainer URL | Base URL of your Portainer instance | `https://portainer.example.com` |
| API Key | Access token from Portainer | `ptr_...` |

### URL Formats

```
# Standard HTTPS (recommended)
https://portainer.example.com

# With custom port
https://portainer.example.com:9443

# HTTP (not recommended for production)
http://portainer.local:9000

# IP address
https://192.168.1.100:9443
```

### Testing Connection

Before creating a migration, always test the connection:

```bash
# Via Web UI
Click "Test Connection" button

# Via API
curl -X POST http://localhost:3001/api/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "api",
    "portainerUrl": "https://portainer.example.com",
    "portainerApiKey": "ptr_..."
  }'
```

Expected response:
```json
{
  "success": true,
  "version": "2.19.4",
  "endpoints": 3,
  "stacks": 12
}
```

## What Gets Discovered

The API migration discovers:

### Endpoints (Environments)

```
Endpoint Discovery
├── Local Docker environments
├── Remote Docker environments
├── Docker Swarm clusters
└── Edge agents (noted but not migrated)
```

For each endpoint:
- Name and type
- URL/connection details
- TLS configuration
- Tags and metadata

### Stacks

```
Stack Discovery
├── Standalone stacks (all endpoints)
├── Swarm stacks (swarm endpoints)
└── Compose file contents
```

For each stack:
- Name and status
- Compose file content
- Environment variables
- Endpoint association
- Git repository (if applicable)

### Registries

```
Registry Discovery
├── Docker Hub
├── AWS ECR
├── Azure ACR
├── Google GCR
├── GitLab Registry
├── Quay.io
└── Custom registries
```

For each registry:
- Name and type
- URL
- Authentication method
- Associated endpoints

### Users & Teams (Enterprise License)

```
User Discovery
├── Admin users
├── Standard users
├── Teams
└── Team memberships
```

## Data Transformation

### Endpoint → Server Mapping

| Portainer | Dokploy |
|-----------|---------|
| Endpoint name | Server name |
| Endpoint URL | Server address |
| TLS settings | Server TLS config |
| Tags | Server labels |

### Stack → Compose Mapping

| Portainer | Dokploy |
|-----------|---------|
| Stack name | Compose name |
| Compose file | Compose content |
| Environment vars | Environment variables |
| Stack endpoint | Target server |

### Registry Mapping

| Portainer | Dokploy |
|-----------|---------|
| Registry name | Registry name |
| Registry URL | Registry URL |
| Authentication | Credentials |
| Type | Registry type |

## Handling Edge Cases

### Private Networks

If Portainer is on a private network:

1. **VPN/Tunnel**: Ensure Portainer Migrator can reach Portainer
2. **Port Forwarding**: Temporarily expose Portainer API
3. **Same Network**: Run Portainer Migrator on the same network

### Self-Signed Certificates

For Portainer instances with self-signed SSL:

```bash
# Option 1: Trust the certificate
# Mount CA certificate to the container

# Option 2: Disable verification (not recommended for production)
# Set environment variable
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Rate Limiting

If Portainer has rate limiting:

- The migrator automatically handles rate limits
- Progress may be slower
- No configuration needed

### Large Deployments

For deployments with many stacks (100+):

- Analysis takes longer
- Consider migrating in batches
- Monitor memory usage

## Troubleshooting API Connections

### "Connection refused"

```bash
# Check if Portainer is reachable
curl -I https://portainer.example.com/api/status

# Check DNS resolution
nslookup portainer.example.com

# Check from container
docker exec portainer-migrator curl -I https://portainer.example.com
```

### "401 Unauthorized"

```bash
# Verify API key works directly
curl https://portainer.example.com/api/users \
  -H "X-API-Key: ptr_your_key_here"

# Expected: List of users
# If error: Key is invalid or expired
```

### "403 Forbidden"

- API key lacks admin permissions
- Generate a new key with an admin account
- Check Portainer API is enabled

### "SSL Certificate Error"

```bash
# Check certificate
openssl s_client -connect portainer.example.com:443

# Common issues:
# - Self-signed certificate
# - Expired certificate
# - Wrong hostname
```

### "Timeout"

- Network latency too high
- Portainer server overloaded
- Firewall blocking connections

## Best Practices

### Before Migration

1. **Backup Portainer**: Create a backup before starting
2. **Document Current State**: Screenshot/export current setup
3. **Test Credentials**: Verify API key works
4. **Schedule Downtime**: For production environments

### During Migration

1. **Start with Dry Run**: Always test first
2. **Monitor Progress**: Watch the logs
3. **Don't Cancel Unnecessarily**: Let it complete

### After Migration

1. **Verify in Dokploy**: Check all resources
2. **Test Deployments**: Ensure stacks work
3. **Update Documentation**: Reflect new setup
4. **Revoke API Key**: Remove Portainer Migrator access

## Example: Complete API Migration

```bash
# 1. Create migration
curl -X POST http://localhost:3001/api/migrations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Migration",
    "sourceType": "api",
    "portainerUrl": "https://portainer.example.com",
    "portainerApiKey": "ptr_abc123",
    "migrateStacks": true,
    "migrateRegistries": true,
    "migrateEndpoints": true,
    "migrateEnvironmentVariables": true,
    "isDryRun": false
  }'

# Response: {"migrationId": "mig_xyz789"}

# 2. Start analysis
curl -X POST http://localhost:3001/api/migrations/mig_xyz789/analyze

# 3. Wait for analysis (poll status)
curl http://localhost:3001/api/migrations/mig_xyz789
# Wait until status is "ready"

# 4. Execute migration
curl -X POST http://localhost:3001/api/migrations/mig_xyz789/execute \
  -H "Content-Type: application/json" \
  -d '{"isDryRun": false}'

# 5. Monitor progress
curl http://localhost:3001/api/migrations/mig_xyz789
# Poll until status is "completed"

# 6. Review results
curl http://localhost:3001/api/migrations/mig_xyz789/statistics
curl http://localhost:3001/api/migrations/mig_xyz789/logs
```

## Next Steps

- [BoltDB Migration Guide](./boltdb-migration.md) - For offline migration
- [Migration Options](./migration-options.md) - Advanced configuration
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
