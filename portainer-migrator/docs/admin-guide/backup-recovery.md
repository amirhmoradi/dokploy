# Backup & Recovery

Guide for backing up and restoring Portainer Migrator data.

## What to Backup

| Component | Location | Priority |
|-----------|----------|----------|
| Database | `/app/data/migrator.db` | High |
| Database WAL | `/app/data/migrator.db-wal` | High |
| Database SHM | `/app/data/migrator.db-shm` | High |
| Uploads | `/app/data/uploads/` | Medium |
| Configuration | `.env`, `docker-compose.yml` | High |

## Backup Procedures

### Quick Backup (Hot)

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Copy database (SQLite WAL mode is safe for hot backup)
docker exec portainer-migrator sqlite3 /app/data/migrator.db ".backup '/tmp/backup.db'"
docker cp portainer-migrator:/tmp/backup.db backups/$(date +%Y%m%d)/migrator.db

# Copy uploads
docker cp portainer-migrator:/app/data/uploads backups/$(date +%Y%m%d)/uploads

# Copy configuration
cp .env docker-compose.yml backups/$(date +%Y%m%d)/
```

### Full Backup (Cold)

```bash
# Stop service
docker-compose stop

# Backup entire data volume
docker run --rm -v portainer-migrator_migrator-data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/migrator-backup-$(date +%Y%m%d).tar.gz -C /data .

# Backup configuration
tar czf backups/config-$(date +%Y%m%d).tar.gz .env docker-compose.yml

# Restart service
docker-compose start
```

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/var/backups/portainer-migrator"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
docker exec portainer-migrator sqlite3 /app/data/migrator.db ".backup '/tmp/backup.db'"
docker cp portainer-migrator:/tmp/backup.db "$BACKUP_DIR/migrator-$DATE.db"
docker exec portainer-migrator rm /tmp/backup.db

# Compress
gzip "$BACKUP_DIR/migrator-$DATE.db"

# Clean old backups
find "$BACKUP_DIR" -name "migrator-*.db.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_DIR/migrator-$DATE.db.gz"
```

Add to crontab:
```bash
# Daily at 2 AM
0 2 * * * /opt/scripts/backup.sh >> /var/log/migrator-backup.log 2>&1
```

## Restore Procedures

### Restore Database

```bash
# Stop service
docker-compose stop

# Restore database
docker run --rm -v portainer-migrator_migrator-data:/data -v $(pwd)/backups:/backup \
  alpine sh -c "gunzip -c /backup/migrator-20240115.db.gz > /data/migrator.db"

# Restart service
docker-compose start

# Verify
curl http://localhost:3001/api/health
```

### Restore Full Backup

```bash
# Stop and remove container
docker-compose down

# Remove old volume
docker volume rm portainer-migrator_migrator-data

# Create new volume and restore
docker volume create portainer-migrator_migrator-data
docker run --rm -v portainer-migrator_migrator-data:/data -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/migrator-backup-20240115.tar.gz -C /data

# Restore configuration
cp backups/20240115/.env backups/20240115/docker-compose.yml .

# Start service
docker-compose up -d
```

### Restore to New Server

```bash
# On new server
mkdir portainer-migrator && cd portainer-migrator

# Copy backup files
scp old-server:/backups/migrator-backup-latest.tar.gz .
scp old-server:/backups/config-latest.tar.gz .

# Extract configuration
tar xzf config-latest.tar.gz

# Create volume and restore data
docker-compose up -d  # Creates volume
docker-compose stop
docker run --rm -v portainer-migrator_migrator-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/migrator-backup-latest.tar.gz -C /data

# Update configuration if needed (URLs, etc.)
vim .env

# Start service
docker-compose start
```

## Disaster Recovery

### Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Database corruption | 30 min | Last backup |
| Container failure | 5 min | 0 (WAL mode) |
| Host failure | 1 hour | Last backup |
| Volume loss | 1 hour | Last backup |

### Recovery Checklist

1. [ ] Identify failure type
2. [ ] Locate latest backup
3. [ ] Prepare recovery environment
4. [ ] Restore data
5. [ ] Verify data integrity
6. [ ] Update configuration if needed
7. [ ] Test functionality
8. [ ] Document incident

## Verification

### Verify Backup Integrity

```bash
# Check SQLite database
sqlite3 backups/migrator.db "PRAGMA integrity_check;"
# Expected: ok

# Check tables exist
sqlite3 backups/migrator.db ".tables"
# Expected: licenses migrations migration_items migration_logs settings
```

### Test Restore

Periodically test your backup restoration:

```bash
# Create test environment
docker-compose -f docker-compose.test.yml up -d

# Restore to test environment
# ...

# Verify functionality
curl http://localhost:3002/api/health

# Clean up
docker-compose -f docker-compose.test.yml down -v
```
