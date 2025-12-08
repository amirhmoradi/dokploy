# Architecture Overview

Technical architecture of Portainer Migrator.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    React Frontend                          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │  │
│  │  │Dashboard│  │Migration│  │ Detail  │  │   License   │ │  │
│  │  │  Page   │  │  List   │  │  View   │  │  Activation │ │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │               TanStack Query                         │ │  │
│  │  │          (State & Cache Management)                  │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Hono Framework                          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │  │
│  │  │ License │  │Migration│  │  Health │  │   Upload    │ │  │
│  │  │  Routes │  │  Routes │  │  Check  │  │   Handler   │ │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Service Layer                              │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │  License Service  │  │ Migration Service │                  │
│  │  ┌─────────────┐  │  │  ┌─────────────┐  │                  │
│  │  │  Validator  │  │  │  │   Analyze   │  │                  │
│  │  └─────────────┘  │  │  ├─────────────┤  │                  │
│  │  ┌─────────────┐  │  │  │   Execute   │  │                  │
│  │  │   Online    │  │  │  ├─────────────┤  │                  │
│  │  │ Validation  │  │  │  │   Cancel    │  │                  │
│  │  └─────────────┘  │  │  └─────────────┘  │                  │
│  │  ┌─────────────┐  │  └───────────────────┘                  │
│  │  │   Offline   │  │                                          │
│  │  │ Validation  │  │  ┌───────────────────┐                  │
│  │  └─────────────┘  │  │    Transformer    │                  │
│  └───────────────────┘  │  ┌─────────────┐  │                  │
│                          │  │  Endpoint   │  │                  │
│  ┌───────────────────┐  │  │ → Server    │  │                  │
│  │ Portainer Client  │  │  ├─────────────┤  │                  │
│  │  ┌─────────────┐  │  │  │   Stack →   │  │                  │
│  │  │  API Client │  │  │  │  Compose    │  │                  │
│  │  └─────────────┘  │  │  ├─────────────┤  │                  │
│  │  ┌─────────────┐  │  │  │  Registry   │  │                  │
│  │  │BoltDB Reader│  │  │  │ → Registry  │  │                  │
│  │  └─────────────┘  │  │  └─────────────┘  │                  │
│  └───────────────────┘  └───────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌───────────────────┐  ┌───────────────────────────────────┐  │
│  │  SQLite Database  │  │       External Services           │  │
│  │  (Drizzle ORM)    │  │  ┌─────────────┐  ┌────────────┐ │  │
│  │  ┌─────────────┐  │  │  │  Portainer  │  │  Dokploy   │ │  │
│  │  │ migrations  │  │  │  │    API      │  │    API     │ │  │
│  │  ├─────────────┤  │  │  └─────────────┘  └────────────┘ │  │
│  │  │migration_   │  │  │  ┌─────────────┐  ┌────────────┐ │  │
│  │  │  items      │  │  │  │  BoltDB     │  │  License   │ │  │
│  │  ├─────────────┤  │  │  │    File     │  │   Server   │ │  │
│  │  │migration_   │  │  │  └─────────────┘  └────────────┘ │  │
│  │  │  logs       │  │  └───────────────────────────────────┘  │
│  │  ├─────────────┤  │                                          │
│  │  │  licenses   │  │                                          │
│  │  ├─────────────┤  │                                          │
│  │  │  settings   │  │                                          │
│  │  └─────────────┘  │                                          │
│  └───────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Portainer API Client

Communicates with running Portainer instances:

```typescript
class PortainerApiClient {
  // Authentication
  authenticate(): Promise<string>

  // Resource Discovery
  getEndpoints(): Promise<Endpoint[]>
  getStacks(endpointId: number): Promise<Stack[]>
  getRegistries(): Promise<Registry[]>
  getUsers(): Promise<User[]>

  // Compose Files
  getStackFile(stackId: number): Promise<string>
}
```

### BoltDB Reader

Reads directly from Portainer's BoltDB database:

```typescript
class PortainerBoltDbReader {
  // Validation
  testFile(path: string): Promise<boolean>
  getVersion(): Promise<string>

  // Extraction
  extractEndpoints(): Promise<Endpoint[]>
  extractStacks(): Promise<Stack[]>
  extractRegistries(): Promise<Registry[]>
  extractUsers(): Promise<User[]>
}
```

### Transformer

Converts Portainer data to Dokploy format:

```typescript
class PortainerTransformer {
  // Analysis
  analyze(data: PortainerData): AnalysisResult

  // Transformation
  transformEndpoint(endpoint: Endpoint): DokployServer
  transformStack(stack: Stack): DokployCompose
  transformRegistry(registry: Registry): DokployRegistry
}
```

### Migration Service

Orchestrates the migration process:

```typescript
class MigrationService {
  // Lifecycle
  analyze(migrationId: string): Promise<void>
  execute(migrationId: string, isDryRun: boolean): Promise<void>
  cancel(migrationId: string): void

  // Progress
  getStatus(migrationId: string): MigrationStatus
  getLogs(migrationId: string): MigrationLog[]
}
```

## Data Flow

### Analysis Phase

```
1. User triggers analysis
2. Load migration config from database
3. Connect to Portainer:
   a. API: Call REST endpoints
   b. BoltDB: Read database buckets
4. Discover resources
5. Check compatibility
6. Store analysis result
7. Update status to "ready"
```

### Execution Phase

```
1. User triggers execution
2. Load migration and analysis
3. For each resource type:
   a. Transform to Dokploy format
   b. Create via Dokploy API
   c. Log result
   d. Update progress
4. Handle errors (log and continue)
5. Update final status
```

## Database Schema

```sql
-- migrations: Core migration records
CREATE TABLE migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- 'api' or 'boltdb'
  status TEXT NOT NULL,       -- workflow status
  progress INTEGER DEFAULT 0,
  -- source configuration
  portainer_url TEXT,
  portainer_api_key TEXT,
  boltdb_path TEXT,
  -- options
  is_dry_run INTEGER DEFAULT 1,
  migrate_stacks INTEGER DEFAULT 1,
  -- timestamps
  created_at TEXT,
  started_at TEXT,
  completed_at TEXT
);

-- migration_items: Individual items within migration
CREATE TABLE migration_items (
  id TEXT PRIMARY KEY,
  migration_id TEXT REFERENCES migrations(id),
  item_type TEXT NOT NULL,    -- 'stack', 'registry', etc.
  portainer_id TEXT,
  portainer_name TEXT,
  status TEXT DEFAULT 'pending',
  source_data TEXT,           -- JSON
  transformed_data TEXT,      -- JSON
  dokploy_id TEXT,
  error_message TEXT
);

-- migration_logs: Audit trail
CREATE TABLE migration_logs (
  id TEXT PRIMARY KEY,
  migration_id TEXT REFERENCES migrations(id),
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## API Design

### RESTful Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/license/activate | Activate license |
| GET | /api/license | Get license status |
| POST | /api/test-connection | Test Portainer connection |
| GET | /api/migrations | List migrations |
| POST | /api/migrations | Create migration |
| GET | /api/migrations/:id | Get migration details |
| POST | /api/migrations/:id/analyze | Start analysis |
| POST | /api/migrations/:id/execute | Execute migration |
| POST | /api/migrations/:id/cancel | Cancel migration |
| DELETE | /api/migrations/:id | Delete migration |

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

## Error Handling

### Error Types

```typescript
enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  LICENSE_ERROR = 'LICENSE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
```

### Error Response

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONNECTION_ERROR",
    "message": "Failed to connect to Portainer",
    "details": "Connection refused"
  }
}
```

## Security Model

### Authentication
- License-based access control
- JWT tokens for sessions
- API key storage (encrypted)

### Data Protection
- Credentials encrypted at rest
- TLS for all external communications
- No sensitive data in logs

### Authorization
- License tier determines features
- No multi-user access (single instance)
