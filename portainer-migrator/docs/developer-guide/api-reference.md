# API Reference

Complete REST API documentation for Portainer Migrator.

## Base URL

```
http://localhost:3001/api
```

## Authentication

Most endpoints require an active license. The license is validated per-request.

## Endpoints

### Health Check

#### GET /health

Check service health.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

---

### License Management

#### POST /license/activate

Activate a license key.

**Request:**
```json
{
  "licenseKey": "PM-XXXX-XXXX-XXXX-XXXX"
}
```

**Response:**
```json
{
  "valid": true,
  "type": "professional",
  "holder": "Company Name",
  "email": "user@company.com",
  "expiresAt": "2025-12-31T23:59:59Z",
  "features": {
    "maxStacks": -1,
    "maxRegistries": -1,
    "offlineValidation": true,
    "prioritySupport": true,
    "userMigration": false
  }
}
```

#### GET /license

Get current license status.

**Response:**
```json
{
  "valid": true,
  "type": "professional",
  "holder": "Company Name",
  "expiresAt": "2025-12-31T23:59:59Z",
  "features": { ... }
}
```

---

### Connection Testing

#### POST /test-connection

Test connection to Portainer.

**Request (API):**
```json
{
  "sourceType": "api",
  "portainerUrl": "https://portainer.example.com",
  "portainerApiKey": "ptr_xxx",
  "portainerUsername": null,
  "portainerPassword": null
}
```

**Request (BoltDB):**
```json
{
  "sourceType": "boltdb",
  "boltDbPath": "/path/to/portainer.db",
  "stackFilesPath": "/path/to/compose"
}
```

**Response:**
```json
{
  "success": true,
  "version": "2.19.4",
  "endpoints": 3,
  "stacks": 12
}
```

---

### Migrations

#### GET /migrations

List all migrations.

**Response:**
```json
[
  {
    "id": "mig_abc123",
    "name": "Production Migration",
    "sourceType": "api",
    "status": "completed",
    "progress": 100,
    "createdAt": "2024-01-15T10:00:00Z",
    "completedAt": "2024-01-15T10:30:00Z"
  }
]
```

#### POST /migrations

Create a new migration.

**Request:**
```json
{
  "name": "Production Migration",
  "description": "Migrate production stacks",
  "sourceType": "api",
  "portainerUrl": "https://portainer.example.com",
  "portainerApiKey": "ptr_xxx",
  "migrateStacks": true,
  "migrateRegistries": true,
  "migrateEndpoints": true,
  "migrateEnvironmentVariables": true,
  "migrateUsers": false,
  "isDryRun": true,
  "autoDeployAfterMigration": false,
  "targetProjectId": null,
  "targetServerId": null
}
```

**Response:**
```json
{
  "id": "mig_xyz789",
  "name": "Production Migration",
  "status": "pending",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

#### GET /migrations/:id

Get migration details.

**Response:**
```json
{
  "id": "mig_abc123",
  "name": "Production Migration",
  "description": "Migrate production stacks",
  "sourceType": "api",
  "status": "running",
  "progress": 45,
  "currentStep": "Migrating stack: webapp",
  "portainerUrl": "https://portainer.example.com",
  "migrateStacks": true,
  "migrateRegistries": true,
  "isDryRun": false,
  "analysisResult": {
    "endpoints": [...],
    "stacks": [...],
    "summary": {
      "totalStacks": 12,
      "migratable": { "stacks": 11 }
    }
  },
  "errorMessage": null,
  "createdAt": "2024-01-15T10:00:00Z",
  "startedAt": "2024-01-15T10:05:00Z",
  "completedAt": null
}
```

#### PATCH /migrations/:id

Update migration settings.

**Request:**
```json
{
  "name": "Updated Name",
  "migrateStacks": false
}
```

**Response:**
```json
{
  "id": "mig_abc123",
  "name": "Updated Name",
  "migrateStacks": false,
  ...
}
```

#### DELETE /migrations/:id

Delete a migration.

**Response:**
```json
{
  "success": true
}
```

---

### Migration Actions

#### POST /migrations/:id/analyze

Start analysis phase.

**Response:**
```json
{
  "status": "analyzing",
  "message": "Analysis started"
}
```

#### POST /migrations/:id/execute

Execute migration.

**Request:**
```json
{
  "isDryRun": false
}
```

**Response:**
```json
{
  "status": "running",
  "message": "Migration started"
}
```

#### POST /migrations/:id/cancel

Cancel running migration.

**Response:**
```json
{
  "status": "cancelled",
  "message": "Migration cancelled"
}
```

---

### Migration Items

#### GET /migrations/:id/items

Get migration items.

**Query Parameters:**
- `itemType` - Filter by type (stack, registry, endpoint)
- `status` - Filter by status (pending, completed, failed)

**Response:**
```json
[
  {
    "id": "item_123",
    "migrationId": "mig_abc123",
    "itemType": "stack",
    "portainerId": "5",
    "portainerName": "webapp",
    "status": "completed",
    "dokployId": "compose_xyz",
    "errorMessage": null,
    "createdAt": "2024-01-15T10:00:00Z",
    "processedAt": "2024-01-15T10:05:00Z"
  }
]
```

---

### Migration Logs

#### GET /migrations/:id/logs

Get migration logs.

**Query Parameters:**
- `level` - Filter by level (debug, info, warning, error)
- `limit` - Number of entries (default: 100)
- `offset` - Pagination offset

**Response:**
```json
[
  {
    "id": "log_123",
    "migrationId": "mig_abc123",
    "level": "info",
    "message": "Starting stack migration: webapp",
    "timestamp": "2024-01-15T10:05:00Z"
  }
]
```

---

### Migration Statistics

#### GET /migrations/:id/statistics

Get migration statistics.

**Response:**
```json
{
  "total": 25,
  "pending": 5,
  "inProgress": 1,
  "completed": 17,
  "failed": 1,
  "skipped": 1
}
```

---

### Export

#### GET /migrations/:id/export

Export full migration report.

**Response:**
```json
{
  "migration": { ... },
  "statistics": { ... },
  "items": [ ... ],
  "logs": [ ... ],
  "exportedAt": "2024-01-15T12:00:00Z"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": "Additional details"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `AUTH_ERROR` | 401 | Authentication failed |
| `LICENSE_INVALID` | 403 | Invalid or expired license |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

- 100 requests per minute per IP
- 429 Too Many Requests when exceeded

---

## Webhooks (Future)

```json
{
  "event": "migration.completed",
  "migrationId": "mig_abc123",
  "status": "completed",
  "timestamp": "2024-01-15T10:30:00Z"
}
```
