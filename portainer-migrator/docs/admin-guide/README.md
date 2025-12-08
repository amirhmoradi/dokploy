# Administrator Guide

This guide covers administration and operational aspects of Portainer Migrator.

## Contents

1. [Deployment Options](./deployment.md)
2. [Configuration Reference](./configuration.md)
3. [Security Hardening](./security.md)
4. [Backup & Recovery](./backup-recovery.md)
5. [Monitoring & Alerting](./monitoring.md)
6. [Maintenance](./maintenance.md)

## Quick Admin Reference

### Starting/Stopping

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# View status
docker-compose ps
```

### Viewing Logs

```bash
# All logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100
```

### Health Check

```bash
curl http://localhost:3001/api/health
```

### License Status

```bash
curl http://localhost:3001/api/license
```

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Container configuration |
| `.env` | Environment variables |
| `/app/data/migrator.db` | SQLite database |
| `/app/data/uploads/` | Uploaded files |

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `LICENSE_KEY` | Yes | Product license |
| `DOKPLOY_URL` | Yes | Dokploy instance URL |
| `DOKPLOY_API_KEY` | Yes | Dokploy API key |
| `JWT_SECRET` | Yes | Session secret |
| `PORT` | No | Server port (default: 3001) |
| `LOG_LEVEL` | No | Logging verbosity |

## Support

- **Standard**: support@portainer-migrator.com
- **Enterprise**: enterprise@portainer-migrator.com
