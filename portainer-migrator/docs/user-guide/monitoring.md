# Monitoring Migration Progress

This guide explains how to monitor and track your migrations.

## Migration Status Overview

### Status Flow

```
┌─────────┐     ┌───────────┐     ┌─────────┐     ┌─────────┐
│ PENDING │────►│ ANALYZING │────►│  READY  │────►│ RUNNING │
└─────────┘     └───────────┘     └─────────┘     └─────────┘
                      │                                 │
                      │                                 ▼
                      │                          ┌───────────┐
                      └──────────────────────────│ COMPLETED │
                                                 └───────────┘
                                                       │
     ┌───────────┐     ┌─────────┐                    │
     │ CANCELLED │◄────│ FAILED  │◄───────────────────┘
     └───────────┘     └─────────┘
```

### Status Descriptions

| Status | Description | Actions Available |
|--------|-------------|-------------------|
| **Pending** | Migration created, not yet analyzed | Analyze, Delete |
| **Analyzing** | Discovery in progress | Cancel |
| **Ready** | Analysis complete, ready to execute | Execute, Dry Run, Delete |
| **Running** | Migration in progress | Cancel |
| **Completed** | Successfully finished | Export, Delete |
| **Failed** | Errors occurred | Retry, Delete |
| **Cancelled** | User cancelled | Delete |

## Dashboard Overview

The main dashboard provides at-a-glance statistics:

```
┌────────────────────────────────────────────────────┐
│                    Dashboard                        │
├────────────────────────────────────────────────────┤
│                                                    │
│   Total        Active       Completed    Failed   │
│  ┌──────┐    ┌──────┐     ┌──────┐    ┌──────┐  │
│  │  12  │    │   1  │     │   9  │    │   2  │  │
│  └──────┘    └──────┘     └──────┘    └──────┘  │
│                                                    │
│  Recent Migrations                                 │
│  ─────────────────                                │
│  • Production Migration    Completed   2h ago     │
│  • Staging Stacks          Running     5m ago     │
│  • Dev Environment         Failed      1d ago     │
│                                                    │
└────────────────────────────────────────────────────┘
```

## Migration Detail View

### Progress Tracking

Each migration shows real-time progress:

```
┌────────────────────────────────────────────────────┐
│  Production Migration                              │
│  Status: Running          Progress: 45%           │
├────────────────────────────────────────────────────┤
│                                                    │
│  ████████████████░░░░░░░░░░░░░░░░░░  45%         │
│                                                    │
│  Current Step: Migrating stack "webapp"           │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Statistics Panel

Detailed breakdown of migration items:

```
┌──────────────────────────────────────────────────┐
│                  Statistics                       │
├──────────────────────────────────────────────────┤
│  Total Items:     25                             │
│  ─────────────────────                           │
│  ✓ Completed:     11                             │
│  ⟳ In Progress:    1                             │
│  ○ Pending:       10                             │
│  ✗ Failed:         2                             │
│  ⊘ Skipped:        1                             │
└──────────────────────────────────────────────────┘
```

## Log Monitoring

### Log Levels

| Level | Icon | Description |
|-------|------|-------------|
| Debug | 🔍 | Detailed technical info |
| Info | ℹ️ | Normal operations |
| Warning | ⚠️ | Non-critical issues |
| Error | ❌ | Critical failures |

### Log Entry Format

```
2024-01-15 10:32:15 [INFO] Starting stack migration: webapp
2024-01-15 10:32:16 [INFO] Transforming compose file...
2024-01-15 10:32:17 [INFO] Creating stack in Dokploy...
2024-01-15 10:32:18 [INFO] Stack "webapp" migrated successfully
2024-01-15 10:32:19 [WARNING] Stack "legacy" uses deprecated syntax
2024-01-15 10:32:20 [ERROR] Failed to migrate "broken-stack": Invalid compose file
```

### Filtering Logs

In the UI:
1. Use the level dropdown to filter
2. Search by message text
3. Filter by item type/name

Via API:
```bash
# All logs
curl http://localhost:3001/api/migrations/mig_abc123/logs

# Errors only
curl "http://localhost:3001/api/migrations/mig_abc123/logs?level=error"

# Recent 50
curl "http://localhost:3001/api/migrations/mig_abc123/logs?limit=50"

# With pagination
curl "http://localhost:3001/api/migrations/mig_abc123/logs?limit=50&offset=100"
```

## Item-Level Tracking

### Migration Items Table

```
┌───────────────────────────────────────────────────────────┐
│  Type       │ Name          │ Status      │ Time         │
├─────────────┼───────────────┼─────────────┼──────────────┤
│  Stack      │ webapp        │ ✓ Completed │ 2s           │
│  Stack      │ api-server    │ ✓ Completed │ 1s           │
│  Stack      │ database      │ ⟳ Running   │ -            │
│  Stack      │ legacy-app    │ ○ Pending   │ -            │
│  Registry   │ Docker Hub    │ ✓ Completed │ <1s          │
│  Registry   │ Private ECR   │ ✗ Failed    │ -            │
└─────────────┴───────────────┴─────────────┴──────────────┘
```

### Item Status Details

Click on an item to see:
- Original Portainer data
- Transformed Dokploy data
- Error message (if failed)
- Dokploy resource ID (if created)

## Real-Time Updates

The UI automatically refreshes:
- Migration status: Every 2 seconds (when running)
- Logs: Every 3 seconds (when running)
- Statistics: Every 5 seconds

Refresh stops when migration is complete/failed/cancelled.

## Monitoring via API

### Get Migration Status

```bash
curl http://localhost:3001/api/migrations/mig_abc123

# Response
{
  "id": "mig_abc123",
  "name": "Production Migration",
  "status": "running",
  "progress": 45,
  "currentStep": "Migrating stack: webapp",
  "createdAt": "2024-01-15T10:30:00Z",
  "startedAt": "2024-01-15T10:32:00Z"
}
```

### Get Statistics

```bash
curl http://localhost:3001/api/migrations/mig_abc123/statistics

# Response
{
  "total": 25,
  "pending": 10,
  "inProgress": 1,
  "completed": 11,
  "failed": 2,
  "skipped": 1
}
```

### Get Items

```bash
# All items
curl http://localhost:3001/api/migrations/mig_abc123/items

# Failed items only
curl "http://localhost:3001/api/migrations/mig_abc123/items?status=failed"

# Stacks only
curl "http://localhost:3001/api/migrations/mig_abc123/items?itemType=stack"
```

### Polling Pattern

For CLI/script monitoring:

```bash
#!/bin/bash
MIGRATION_ID="mig_abc123"

while true; do
  response=$(curl -s http://localhost:3001/api/migrations/$MIGRATION_ID)
  status=$(echo $response | jq -r '.status')
  progress=$(echo $response | jq -r '.progress')

  echo "Status: $status, Progress: $progress%"

  if [[ "$status" == "completed" || "$status" == "failed" || "$status" == "cancelled" ]]; then
    echo "Migration finished with status: $status"
    break
  fi

  sleep 5
done
```

## Notifications

### Current Implementation

Notifications appear in the UI:
- Toast messages for actions
- Status changes shown in real-time

### Planned Features (v1.1)

- Email notifications
- Webhook integrations
- Slack/Discord alerts

## Exporting Reports

### Export Full Report

```bash
curl http://localhost:3001/api/migrations/mig_abc123/export > migration-report.json
```

### Report Contents

```json
{
  "migration": {
    "id": "mig_abc123",
    "name": "Production Migration",
    "status": "completed",
    "startedAt": "...",
    "completedAt": "..."
  },
  "statistics": {
    "total": 25,
    "completed": 23,
    "failed": 2
  },
  "items": [...],
  "logs": [...]
}
```

## Troubleshooting Monitoring

### UI Not Updating

1. Check browser console for errors
2. Verify WebSocket connection (if used)
3. Try refreshing the page
4. Check server logs

### Logs Not Appearing

1. Verify migration ID is correct
2. Check log level filter
3. Migration may not have generated logs yet
4. Server may be rate-limiting

### Progress Stuck

1. Check server resources (CPU, memory)
2. Look for error logs
3. Migration may be waiting for Dokploy response
4. Network issues between services

## Best Practices

1. **Monitor First Few Items**: Watch the first few items migrate to catch configuration issues early

2. **Watch for Patterns**: Multiple failures on similar items often indicate a systematic issue

3. **Check Logs Proactively**: Don't wait for failure; monitor logs during execution

4. **Export Reports**: Save reports for documentation and troubleshooting

5. **Set Up Alerts**: Configure notifications for long-running migrations

## Next Steps

- [Troubleshooting](./troubleshooting.md) - Handle issues
- [FAQ](./faq.md) - Common questions
