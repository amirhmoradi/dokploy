# Monitoring & Alerting

Guide for monitoring Portainer Migrator in production.

## Health Monitoring

### Health Endpoint

```bash
# Basic health check
curl http://localhost:3001/api/health

# Response
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

### Docker Health Check

Built-in health check in docker-compose:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

Check health status:
```bash
docker inspect --format='{{.State.Health.Status}}' portainer-migrator
```

## Metrics Collection

### Application Metrics

Available at `/api/metrics` (if enabled):

```bash
curl http://localhost:3001/api/metrics

# Example metrics
{
  "migrations_total": 50,
  "migrations_active": 1,
  "migrations_completed": 45,
  "migrations_failed": 4,
  "items_migrated_total": 500,
  "uptime_seconds": 86400
}
```

### Prometheus Integration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'portainer-migrator'
    static_configs:
      - targets: ['portainer-migrator:3001']
    metrics_path: '/api/metrics'
```

## Log Monitoring

### Log Levels

| Level | Meaning |
|-------|---------|
| `error` | Critical failures requiring attention |
| `warning` | Non-critical issues |
| `info` | Normal operations |
| `debug` | Detailed debugging info |

### Log Aggregation

#### Loki/Grafana

```yaml
# docker-compose.yml
logging:
  driver: loki
  options:
    loki-url: "http://loki:3100/loki/api/v1/push"
    loki-batch-size: "400"
    labels: "app=portainer-migrator"
```

#### ELK Stack

```yaml
logging:
  driver: gelf
  options:
    gelf-address: "udp://logstash:12201"
    tag: "portainer-migrator"
```

#### Syslog

```yaml
logging:
  driver: syslog
  options:
    syslog-address: "udp://syslog:514"
    tag: "portainer-migrator"
```

## Alerting

### Critical Alerts

| Condition | Alert |
|-----------|-------|
| Health check fails 3x | Service down |
| Migration fails | Migration error |
| License expires in 7 days | License warning |
| Disk usage > 90% | Storage critical |

### Alertmanager Rules (Prometheus)

```yaml
groups:
- name: portainer-migrator
  rules:
  - alert: MigratorDown
    expr: up{job="portainer-migrator"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Portainer Migrator is down"

  - alert: MigrationFailed
    expr: increase(migrations_failed_total[5m]) > 0
    for: 0m
    labels:
      severity: warning
    annotations:
      summary: "Migration failed"
```

### Webhook Notifications

Configure webhook for alerts:

```bash
# Example webhook payload
{
  "event": "migration_failed",
  "migrationId": "mig_abc123",
  "error": "Connection refused",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Resource Monitoring

### Container Stats

```bash
# Real-time stats
docker stats portainer-migrator

# Memory usage
docker exec portainer-migrator cat /proc/meminfo

# CPU usage
docker exec portainer-migrator cat /proc/loadavg
```

### Disk Usage

```bash
# Check data volume
docker system df -v | grep migrator-data

# Database size
docker exec portainer-migrator ls -la /app/data/migrator.db
```

## Dashboard Examples

### Grafana Dashboard

Key panels:
1. Migration success rate (gauge)
2. Active migrations (stat)
3. Items migrated over time (graph)
4. Error rate (graph)
5. Response time (histogram)
6. Resource utilization (graphs)

### Status Page

Minimal status endpoint for external monitoring:

```bash
# Simple up/down check
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health
# Returns: 200 (healthy) or 5xx (unhealthy)
```

## Troubleshooting Monitoring

### Health Check Failing

```bash
# Check container logs
docker-compose logs --tail=50 portainer-migrator

# Check container is running
docker-compose ps

# Manual health check
docker exec portainer-migrator curl -f http://localhost:3001/api/health
```

### High Resource Usage

```bash
# Check what's consuming resources
docker exec portainer-migrator top

# Check for stuck migrations
curl http://localhost:3001/api/migrations?status=running
```
