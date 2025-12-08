# BoltDB-Based Migration Guide

This guide explains how to migrate from Portainer using the BoltDB database file directly.

## Overview

BoltDB migration reads directly from Portainer's embedded database file (`portainer.db`). This method is useful when:

- Portainer is no longer running
- You're in an air-gapped environment
- You want to migrate from a backup
- Network access to Portainer is restricted
- You're migrating from an older Portainer version

## Understanding Portainer's Data Storage

Portainer stores all configuration in two locations:

```
/data/
├── portainer.db          # BoltDB database (main config)
├── compose/              # Stack compose files
│   └── {stack_id}/
│       └── docker-compose.yml
├── tls/                  # TLS certificates
└── bin/                  # Binary files
```

## Locating Portainer Data

### Docker Installation

```bash
# Find Portainer container
docker ps | grep portainer

# Default volume location
/var/lib/docker/volumes/portainer_data/_data/

# Or check volume mount
docker inspect portainer | grep -A5 Mounts
```

### Docker Compose Installation

```yaml
# Common docker-compose.yml pattern
volumes:
  - portainer_data:/data
  # or
  - ./portainer-data:/data
```

### Host Installation

```bash
# Common locations
/opt/portainer/
/var/portainer/
/home/portainer/
```

## Preparing Files for Migration

### Step 1: Stop Portainer (Recommended)

To ensure data consistency:

```bash
# Docker
docker stop portainer

# Docker Compose
docker-compose stop portainer

# Systemd
sudo systemctl stop portainer
```

### Step 2: Copy Database File

```bash
# From Docker volume
docker cp portainer:/data/portainer.db ./portainer.db

# Or from volume path
cp /var/lib/docker/volumes/portainer_data/_data/portainer.db ./

# Verify file
file portainer.db
# Expected: "portainer.db: data"

ls -la portainer.db
# Expected: Size typically 100KB - 10MB
```

### Step 3: Copy Compose Files (Optional but Recommended)

Compose files contain the actual stack definitions:

```bash
# Create archive of compose directory
cd /var/lib/docker/volumes/portainer_data/_data/
zip -r compose-files.zip compose/

# Or tar
tar -czvf compose-files.tar.gz compose/
```

### Step 4: Restart Portainer (If Needed)

```bash
docker start portainer
```

## Uploading Files to Migrator

### Via Web Interface

1. Go to **New Migration**
2. Select **BoltDB** as source type
3. Click **Upload BoltDB File**
4. Select your `portainer.db` file
5. Optionally upload `compose-files.zip`
6. Click **Test Connection**

### Via API

```bash
# Upload BoltDB file
curl -X POST http://localhost:3001/api/upload-boltdb \
  -F "file=@/path/to/portainer.db" \
  -F "migrationId=mig_xyz789"

# Upload stack files (optional)
curl -X POST http://localhost:3001/api/upload-stack-files \
  -F "file=@/path/to/compose-files.zip" \
  -F "migrationId=mig_xyz789"
```

### Via File Mount (Alternative)

Mount files directly to the container:

```yaml
# docker-compose.yml
services:
  portainer-migrator:
    volumes:
      - ./portainer.db:/portainer-data/portainer.db:ro
      - ./compose:/portainer-data/compose:ro
```

Then specify paths in the migration:
- BoltDB Path: `/portainer-data/portainer.db`
- Stack Files Path: `/portainer-data/compose`

## BoltDB File Structure

For reference, here's what the BoltDB contains:

```
Buckets:
├── dockerhub               # Docker Hub settings
├── edge_group              # Edge groups
├── edge_job                # Edge jobs
├── edge_stack              # Edge stacks
├── endpoint                # Endpoints/Environments
├── endpoint_group          # Endpoint groups
├── endpoint_relation       # Endpoint relationships
├── extension               # Extensions
├── fd                      # File descriptors
├── helm_user_repository    # Helm repositories
├── registry                # Docker registries
├── resource_control        # Access controls
├── role                    # User roles
├── schedule                # Scheduled jobs
├── settings                # General settings
├── snapshot                # Snapshots
├── ssl                     # SSL certificates
├── stack                   # Stack definitions
├── tag                     # Tags
├── team                    # Teams
├── team_membership         # Team memberships
├── tunnel_server           # Tunnel server config
├── user                    # Users
├── version                 # Database version
└── webhook                 # Webhooks
```

## Data Extraction Process

When you provide a BoltDB file, the migrator:

1. **Validates File**: Checks it's a valid BoltDB file
2. **Reads Version**: Determines Portainer version
3. **Extracts Endpoints**: Reads endpoint bucket
4. **Extracts Stacks**: Reads stack bucket
5. **Extracts Registries**: Reads registry bucket
6. **Extracts Users** (if enabled): Reads user bucket
7. **Maps Relationships**: Links stacks to endpoints

### Compose File Resolution

The migrator locates compose files in this order:

1. **Embedded in BoltDB**: Some versions store compose in DB
2. **Uploaded ZIP**: From your compose-files.zip
3. **Git Repository**: If stack was from Git (URL recorded)

## Version Compatibility

| Portainer Version | Support | Notes |
|-------------------|---------|-------|
| 2.19.x | Full | Recommended |
| 2.18.x | Full | |
| 2.17.x | Full | |
| 2.16.x | Full | |
| 2.15.x | Partial | Some features may be missing |
| 2.14.x | Partial | Limited testing |
| < 2.14 | Not Supported | Schema too different |

### Checking Portainer Version from BoltDB

```bash
# The migrator reports this during analysis
# Or use bbolt CLI:
bbolt get portainer.db version version
```

## Troubleshooting BoltDB Migration

### "Invalid BoltDB file"

```bash
# Verify file is BoltDB
file portainer.db
# Should show: "data"

# Check file isn't corrupted
ls -la portainer.db
# Should show non-zero size

# Try copying again
docker cp portainer:/data/portainer.db ./portainer.db
```

### "Unsupported version"

- Portainer version is too old
- Try upgrading Portainer first, then export
- Or contact support for assistance

### "Missing compose files"

- Upload the compose files ZIP
- Or mount the compose directory
- Stack migration will skip affected stacks

### "File too large"

For very large databases (>50MB):
- Use file mount instead of upload
- Increase container memory
- Split migration into smaller batches

### "Permission denied"

```bash
# Check file permissions
ls -la portainer.db
# Ensure readable

# If using mount, check container user
docker exec portainer-migrator ls -la /portainer-data/
```

## Advanced: Reading BoltDB Manually

For debugging or manual inspection:

```bash
# Install bbolt CLI
go install go.etcd.io/bbolt/cmd/bbolt@latest

# List buckets
bbolt buckets portainer.db

# View bucket contents
bbolt keys portainer.db stack

# Get specific key
bbolt get portainer.db stack 1

# Dump entire bucket (careful with large buckets)
bbolt pages portainer.db
```

## Security Considerations

### Credential Handling

- Credentials in BoltDB are often encrypted
- Some passwords may need manual re-entry after migration
- API keys are typically hashed (cannot be recovered)

### Data Sensitivity

The portainer.db file contains:
- User credentials (hashed)
- Registry credentials (may be encrypted)
- TLS certificates
- Endpoint configurations

**Best Practices:**
- Don't commit portainer.db to version control
- Delete file after migration
- Transfer securely (encrypted channel)

## Example: Complete BoltDB Migration

```bash
# 1. Prepare files
docker stop portainer
docker cp portainer:/data/portainer.db ./
cd /var/lib/docker/volumes/portainer_data/_data/
zip -r ~/compose-files.zip compose/
docker start portainer

# 2. Create migration via API
curl -X POST http://localhost:3001/api/migrations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BoltDB Migration",
    "sourceType": "boltdb"
  }'
# Response: {"migrationId": "mig_abc123"}

# 3. Upload files
curl -X POST http://localhost:3001/api/upload-boltdb \
  -F "file=@./portainer.db" \
  -F "migrationId=mig_abc123"

curl -X POST http://localhost:3001/api/upload-stack-files \
  -F "file=@./compose-files.zip" \
  -F "migrationId=mig_abc123"

# 4. Test file access
curl -X POST http://localhost:3001/api/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "boltdb",
    "boltDbPath": "/app/data/uploads/mig_abc123/portainer.db",
    "stackFilesPath": "/app/data/uploads/mig_abc123/compose"
  }'

# 5. Run analysis
curl -X POST http://localhost:3001/api/migrations/mig_abc123/analyze

# 6. Execute migration
curl -X POST http://localhost:3001/api/migrations/mig_abc123/execute \
  -d '{"isDryRun": false}'

# 7. Cleanup sensitive files
rm ./portainer.db ./compose-files.zip
```

## When to Use BoltDB vs API

| Scenario | Recommended Method |
|----------|-------------------|
| Portainer still running | API |
| Portainer decommissioned | BoltDB |
| Air-gapped environment | BoltDB |
| Remote Portainer (accessible) | API |
| Migrating from backup | BoltDB |
| Multiple Portainer instances | API (per instance) |
| Version < 2.15 | BoltDB (may work better) |

## Next Steps

- [Migration Options](./migration-options.md) - Configure your migration
- [Monitoring Progress](./monitoring.md) - Track migration status
- [Troubleshooting](./troubleshooting.md) - Resolve issues
