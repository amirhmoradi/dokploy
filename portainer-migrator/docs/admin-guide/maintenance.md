# Maintenance Guide

Routine maintenance procedures for Portainer Migrator.

## Regular Maintenance Tasks

### Daily
- [ ] Check health endpoint
- [ ] Review error logs
- [ ] Verify active migrations

### Weekly
- [ ] Check disk usage
- [ ] Review backup status
- [ ] Check for updates

### Monthly
- [ ] Rotate logs
- [ ] Clean old migrations
- [ ] Update container image
- [ ] Review security patches

## Database Maintenance

### Vacuum Database

SQLite benefits from periodic VACUUM:

```bash
docker exec portainer-migrator sqlite3 /app/data/migrator.db "VACUUM;"
```

### Check Integrity

```bash
docker exec portainer-migrator sqlite3 /app/data/migrator.db "PRAGMA integrity_check;"
# Expected: ok
```

### Optimize Indexes

```bash
docker exec portainer-migrator sqlite3 /app/data/migrator.db "REINDEX;"
```

## Cleanup Procedures

### Delete Old Migrations

```bash
# Via API - delete migrations older than 90 days
curl -X DELETE "http://localhost:3001/api/admin/cleanup?olderThan=90"

# Manual SQL
docker exec portainer-migrator sqlite3 /app/data/migrator.db \
  "DELETE FROM migrations WHERE created_at < datetime('now', '-90 days');"
```

### Clean Upload Directory

```bash
# Remove orphaned uploads
docker exec portainer-migrator find /app/data/uploads -type d -empty -delete
```

### Log Rotation

Docker handles log rotation if configured:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Updates

### Check Current Version

```bash
curl http://localhost:3001/api/health | jq .version
```

### Update Container

```bash
# Pull latest
docker-compose pull

# Recreate container
docker-compose up -d

# Verify
docker-compose ps
curl http://localhost:3001/api/health
```

### Rollback Update

```bash
# Specify previous version
docker-compose pull ghcr.io/your-org/portainer-migrator:1.0.0
docker-compose up -d
```

## Troubleshooting Maintenance

### Database Locked

```bash
# Check for stuck processes
docker exec portainer-migrator lsof /app/data/migrator.db

# Restart container
docker-compose restart
```

### High Disk Usage

```bash
# Check usage
docker exec portainer-migrator du -sh /app/data/*

# Clean up
# 1. Delete old migrations
# 2. Clean uploads
# 3. Vacuum database
```

### Container Restart Loop

```bash
# Check logs
docker-compose logs --tail=100

# Common causes:
# - Invalid configuration
# - Database corruption
# - Port conflict
```

## Maintenance Mode

For major maintenance, consider stopping new migrations:

```bash
# Stop the container
docker-compose stop

# Perform maintenance
# ...

# Start again
docker-compose start
```

## Maintenance Checklist

### Pre-Maintenance
- [ ] Notify users of maintenance window
- [ ] Check for running migrations
- [ ] Create backup

### During Maintenance
- [ ] Stop service if needed
- [ ] Perform maintenance tasks
- [ ] Verify data integrity

### Post-Maintenance
- [ ] Start service
- [ ] Verify health check
- [ ] Test functionality
- [ ] Notify users of completion
