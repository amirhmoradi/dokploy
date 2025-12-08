# Configuration Reference

Complete reference for all configuration options in Portainer Migrator.

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `LICENSE_KEY` | Product license key | `PM-XXXX-XXXX-XXXX-XXXX` |
| `DOKPLOY_URL` | Dokploy instance URL | `https://dokploy.example.com` |
| `DOKPLOY_API_KEY` | Dokploy API authentication key | `dk_abc123...` |
| `JWT_SECRET` | Secret for signing JWT tokens (min 32 chars) | Random 64-char string |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3001` | HTTP server port |
| `HOST` | `0.0.0.0` | HTTP server bind address |
| `DATABASE_PATH` | `/app/data/migrator.db` | SQLite database file path |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |
| `LICENSE_SERVER_URL` | (production server) | Custom license server |
| `ENABLE_TELEMETRY` | `false` | Anonymous usage telemetry |

### Variable Details

#### NODE_ENV

Controls application behavior:
- `production`: Optimized for production use
- `development`: Enables debugging features

#### LOG_LEVEL

Available levels (from most to least verbose):
- `debug`: All messages including debug info
- `info`: Informational messages and above
- `warning`: Warnings and errors only
- `error`: Errors only

#### CORS_ORIGINS

Configure allowed origins:
```bash
# Allow all (default)
CORS_ORIGINS=*

# Specific origin
CORS_ORIGINS=https://admin.example.com

# Multiple origins (comma-separated)
CORS_ORIGINS=https://admin.example.com,https://app.example.com
```

#### DATABASE_PATH

Must be an absolute path with write permissions:
```bash
# Default (in container)
DATABASE_PATH=/app/data/migrator.db

# Custom location
DATABASE_PATH=/var/lib/migrator/database.db
```

## Docker Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  portainer-migrator:
    image: ghcr.io/your-org/portainer-migrator:latest
    container_name: portainer-migrator
    restart: unless-stopped

    # Port mapping
    ports:
      - "${PORT:-3001}:3001"

    # Environment variables
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - PORT=3001
      - HOST=0.0.0.0
      - DATABASE_PATH=/app/data/migrator.db
      - LICENSE_KEY=${LICENSE_KEY}
      - DOKPLOY_URL=${DOKPLOY_URL}
      - DOKPLOY_API_KEY=${DOKPLOY_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - LOG_LEVEL=${LOG_LEVEL:-info}
      - CORS_ORIGINS=${CORS_ORIGINS:-*}
      - LICENSE_SERVER_URL=${LICENSE_SERVER_URL:-}
      - ENABLE_TELEMETRY=${ENABLE_TELEMETRY:-false}

    # Data persistence
    volumes:
      - migrator-data:/app/data
      # Optional: Mount Portainer data for BoltDB migration
      # - /path/to/portainer/data:/portainer-data:ro

    # Health monitoring
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

    # Resource limits (optional)
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M

    # Networking
    networks:
      - migrator-network

    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  migrator-data:
    driver: local

networks:
  migrator-network:
    driver: bridge
```

### .env File

```bash
# ===================
# Required Settings
# ===================

# License key from purchase or trial
LICENSE_KEY=PM-XXXX-XXXX-XXXX-XXXX

# Dokploy connection
DOKPLOY_URL=https://dokploy.example.com
DOKPLOY_API_KEY=your-dokploy-api-key

# Security - generate with: openssl rand -hex 32
JWT_SECRET=your-random-secret-at-least-32-characters-long

# ===================
# Optional Settings
# ===================

# Server configuration
PORT=3001
NODE_ENV=production

# Logging
LOG_LEVEL=info

# CORS (use specific origin for production)
CORS_ORIGINS=https://admin.example.com

# Telemetry (opt-in)
ENABLE_TELEMETRY=false

# Custom license server (enterprise only)
# LICENSE_SERVER_URL=https://license.example.com
```

## Database Configuration

### SQLite Settings

The application uses SQLite with WAL mode for better concurrency:

```javascript
// Automatic configuration applied:
sqlite.pragma("journal_mode = WAL");
```

### Database Location

Default: `/app/data/migrator.db`

To use a custom location:

```yaml
environment:
  - DATABASE_PATH=/custom/path/migrator.db
volumes:
  - /host/path:/custom/path
```

### Database Initialization

Tables are created automatically on first start:
- `migrations` - Migration records
- `migration_items` - Individual items within migrations
- `migration_logs` - Log entries
- `licenses` - License activation records
- `settings` - Application settings

## Security Configuration

### JWT Configuration

```bash
# Generate a secure secret
openssl rand -hex 32

# Set in environment
JWT_SECRET=<generated-value>
```

Token properties:
- Algorithm: HS256
- Default expiration: 24 hours

### HTTPS/TLS

The application serves HTTP. Use a reverse proxy for HTTPS:

```nginx
# nginx configuration
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
    }
}
```

## Performance Tuning

### Memory Settings

For large migrations, increase container memory:

```yaml
deploy:
  resources:
    limits:
      memory: 2G
```

### Connection Timeouts

For slow networks, adjust proxy timeouts:

```nginx
# nginx
proxy_connect_timeout 300;
proxy_send_timeout 300;
proxy_read_timeout 300;
```

### File Upload Limits

For large BoltDB files:

```nginx
# nginx
client_max_body_size 100M;
```

## Logging Configuration

### Log Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `debug` | Verbose output | Troubleshooting |
| `info` | Normal operations | Production |
| `warning` | Potential issues | Monitoring |
| `error` | Critical failures | Alerting |

### Log Output

Logs are written to stdout/stderr:

```bash
# View logs
docker-compose logs -f

# Filter by level
docker-compose logs | grep ERROR
```

### Log Rotation

Configure Docker logging:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Network Configuration

### Port Configuration

```yaml
# Expose on specific port
ports:
  - "8080:3001"

# Expose on specific interface
ports:
  - "127.0.0.1:3001:3001"
```

### Firewall Requirements

| Direction | Port | Protocol | Purpose |
|-----------|------|----------|---------|
| Inbound | 3001 | TCP | Web UI and API |
| Outbound | 443 | TCP | Portainer API |
| Outbound | 443 | TCP | Dokploy API |
| Outbound | 443 | TCP | License server |

## Configuration Validation

### Validate on Startup

The application validates configuration on startup:

```bash
docker-compose up
# Watch logs for validation messages
```

### Required Variable Check

```bash
# Check required variables are set
docker exec portainer-migrator env | grep -E "(LICENSE_KEY|DOKPLOY_URL|DOKPLOY_API_KEY|JWT_SECRET)"
```

### Connection Test

```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Test license
curl http://localhost:3001/api/license
```

## Configuration Examples

### Minimal Production

```bash
LICENSE_KEY=PM-XXXX-XXXX-XXXX-XXXX
DOKPLOY_URL=https://dokploy.example.com
DOKPLOY_API_KEY=dk_abc123
JWT_SECRET=$(openssl rand -hex 32)
```

### Full Production

```bash
# Core
LICENSE_KEY=PM-XXXX-XXXX-XXXX-XXXX
DOKPLOY_URL=https://dokploy.example.com
DOKPLOY_API_KEY=dk_abc123
JWT_SECRET=<secure-random-string>

# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Storage
DATABASE_PATH=/app/data/migrator.db

# Logging
LOG_LEVEL=info

# Security
CORS_ORIGINS=https://admin.example.com

# Telemetry
ENABLE_TELEMETRY=false
```

### Development

```bash
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
LICENSE_KEY=PM-DEV-KEY
DOKPLOY_URL=http://localhost:3000
DOKPLOY_API_KEY=dev-key
JWT_SECRET=development-secret-not-for-production
```
