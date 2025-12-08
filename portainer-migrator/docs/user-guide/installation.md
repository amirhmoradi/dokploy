# Installation Guide

This guide covers all methods for installing Portainer Migrator.

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| CPU | 1 core |
| Memory | 512 MB |
| Disk | 100 MB |
| Docker | 20.10+ |
| Docker Compose | 2.0+ |

### Recommended Requirements

| Component | Requirement |
|-----------|-------------|
| CPU | 2+ cores |
| Memory | 1 GB |
| Disk | 500 MB |
| Docker | 24.0+ |
| Docker Compose | 2.20+ |

## Installation Methods

### Method 1: Docker Compose (Recommended)

The easiest way to run Portainer Migrator.

#### Step 1: Create a directory

```bash
mkdir portainer-migrator && cd portainer-migrator
```

#### Step 2: Create docker-compose.yml

```yaml
version: '3.8'

services:
  portainer-migrator:
    image: ghcr.io/your-org/portainer-migrator:latest
    container_name: portainer-migrator
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOST=0.0.0.0
      - DATABASE_PATH=/app/data/migrator.db
      - LICENSE_KEY=${LICENSE_KEY}
      - DOKPLOY_URL=${DOKPLOY_URL}
      - DOKPLOY_API_KEY=${DOKPLOY_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - migrator-data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  migrator-data:
```

#### Step 3: Create environment file

```bash
cat > .env << 'EOF'
# License
LICENSE_KEY=PM-XXXX-XXXX-XXXX-XXXX

# Dokploy Configuration
DOKPLOY_URL=https://your-dokploy-instance.com
DOKPLOY_API_KEY=your-dokploy-api-key

# Security (generate a random secret)
JWT_SECRET=your-random-secret-at-least-32-characters

# Optional
LOG_LEVEL=info
CORS_ORIGINS=*
EOF
```

#### Step 4: Start the service

```bash
docker-compose up -d
```

#### Step 5: Verify installation

```bash
# Check if container is running
docker-compose ps

# Check logs
docker-compose logs -f

# Test health endpoint
curl http://localhost:3001/api/health
```

---

### Method 2: Docker Run

For quick testing or single-command deployment.

```bash
docker run -d \
  --name portainer-migrator \
  -p 3001:3001 \
  -e LICENSE_KEY=PM-XXXX-XXXX-XXXX-XXXX \
  -e DOKPLOY_URL=https://your-dokploy.com \
  -e DOKPLOY_API_KEY=your-api-key \
  -e JWT_SECRET=your-secret-key \
  -v migrator-data:/app/data \
  ghcr.io/your-org/portainer-migrator:latest
```

---

### Method 3: Building from Source

For development or customization.

#### Prerequisites

- Node.js 20+
- pnpm 8+

#### Steps

```bash
# Clone the repository
git clone https://github.com/your-org/portainer-migrator.git
cd portainer-migrator

# Install dependencies
pnpm install

# Build the application
pnpm build

# Start in production mode
NODE_ENV=production pnpm start
```

---

### Method 4: Kubernetes Deployment

For production Kubernetes environments.

```yaml
# portainer-migrator-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: portainer-migrator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: portainer-migrator
  template:
    metadata:
      labels:
        app: portainer-migrator
    spec:
      containers:
      - name: portainer-migrator
        image: ghcr.io/your-org/portainer-migrator:latest
        ports:
        - containerPort: 3001
        env:
        - name: LICENSE_KEY
          valueFrom:
            secretKeyRef:
              name: portainer-migrator-secrets
              key: license-key
        - name: DOKPLOY_URL
          valueFrom:
            configMapKeyRef:
              name: portainer-migrator-config
              key: dokploy-url
        - name: DOKPLOY_API_KEY
          valueFrom:
            secretKeyRef:
              name: portainer-migrator-secrets
              key: dokploy-api-key
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: portainer-migrator-secrets
              key: jwt-secret
        volumeMounts:
        - name: data
          mountPath: /app/data
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: portainer-migrator-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: portainer-migrator
spec:
  selector:
    app: portainer-migrator
  ports:
  - port: 3001
    targetPort: 3001
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LICENSE_KEY` | Yes | - | Your Portainer Migrator license key |
| `DOKPLOY_URL` | Yes | - | URL of your Dokploy instance |
| `DOKPLOY_API_KEY` | Yes | - | API key for Dokploy authentication |
| `JWT_SECRET` | Yes | - | Secret for JWT token signing (min 32 chars) |
| `PORT` | No | 3001 | Port to run the server on |
| `HOST` | No | 0.0.0.0 | Host to bind to |
| `DATABASE_PATH` | No | /app/data/migrator.db | SQLite database path |
| `LOG_LEVEL` | No | info | Log verbosity (debug, info, warning, error) |
| `CORS_ORIGINS` | No | * | Allowed CORS origins |
| `LICENSE_SERVER_URL` | No | - | Custom license server URL |
| `ENABLE_TELEMETRY` | No | false | Enable anonymous usage telemetry |

---

## Reverse Proxy Configuration

### Nginx

```nginx
server {
    listen 80;
    server_name migrate.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Traefik

```yaml
# docker-compose.yml addition
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.migrator.rule=Host(`migrate.yourdomain.com`)"
  - "traefik.http.routers.migrator.entrypoints=websecure"
  - "traefik.http.routers.migrator.tls.certresolver=letsencrypt"
  - "traefik.http.services.migrator.loadbalancer.server.port=3001"
```

### Caddy

```
migrate.yourdomain.com {
    reverse_proxy localhost:3001
}
```

---

## Verifying Installation

### Health Check

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### License Status

```bash
curl http://localhost:3001/api/license
# Expected: {"valid":true,"type":"...","holder":"..."}
```

### Web Interface

Open `http://localhost:3001` in your browser. You should see the license activation page (first run) or the dashboard.

---

## Troubleshooting Installation

### Container won't start

```bash
# Check logs
docker-compose logs portainer-migrator

# Common issues:
# - Invalid LICENSE_KEY
# - JWT_SECRET too short
# - Port already in use
```

### Can't connect to Dokploy

```bash
# Test from container
docker exec portainer-migrator curl -I $DOKPLOY_URL

# Check:
# - DOKPLOY_URL is correct
# - DOKPLOY_API_KEY is valid
# - Network connectivity
```

### Database errors

```bash
# Check volume permissions
docker exec portainer-migrator ls -la /app/data

# Reset database (WARNING: deletes all data)
docker-compose down
docker volume rm portainer-migrator_migrator-data
docker-compose up -d
```

---

## Next Steps

After installation:

1. [Activate your license](./license-activation.md)
2. [Create your first migration](./first-migration.md)
