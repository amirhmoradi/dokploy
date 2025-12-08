# Deployment Guide

This guide covers various deployment scenarios for Portainer Migrator.

## Deployment Options

### Option 1: Docker Compose (Recommended)

Best for: Single-server deployments, quick setup

```yaml
# docker-compose.yml
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
      - LOG_LEVEL=${LOG_LEVEL:-info}
    volumes:
      - migrator-data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  migrator-data:
```

### Option 2: Docker Swarm

Best for: High availability, multi-node clusters

```yaml
# docker-stack.yml
version: '3.8'

services:
  portainer-migrator:
    image: ghcr.io/your-org/portainer-migrator:latest
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      update_config:
        parallelism: 1
        delay: 10s
      placement:
        constraints:
          - node.role == manager
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - LICENSE_KEY=${LICENSE_KEY}
      - DOKPLOY_URL=${DOKPLOY_URL}
      - DOKPLOY_API_KEY=${DOKPLOY_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - migrator-data:/app/data
    networks:
      - migrator-network

volumes:
  migrator-data:

networks:
  migrator-network:
    driver: overlay
```

Deploy with:
```bash
docker stack deploy -c docker-stack.yml portainer-migrator
```

### Option 3: Kubernetes

Best for: Enterprise environments, cloud-native deployments

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: portainer-migrator
---
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: portainer-migrator-secrets
  namespace: portainer-migrator
type: Opaque
stringData:
  license-key: "PM-XXXX-XXXX-XXXX-XXXX"
  dokploy-api-key: "your-dokploy-api-key"
  jwt-secret: "your-jwt-secret-minimum-32-characters"
---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: portainer-migrator-config
  namespace: portainer-migrator
data:
  dokploy-url: "https://dokploy.example.com"
  log-level: "info"
---
# pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: portainer-migrator-pvc
  namespace: portainer-migrator
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: portainer-migrator
  namespace: portainer-migrator
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
        - name: NODE_ENV
          value: "production"
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
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: portainer-migrator-config
              key: log-level
        volumeMounts:
        - name: data
          mountPath: /app/data
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
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
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: portainer-migrator
  namespace: portainer-migrator
spec:
  selector:
    app: portainer-migrator
  ports:
  - port: 3001
    targetPort: 3001
  type: ClusterIP
---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: portainer-migrator
  namespace: portainer-migrator
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - migrate.example.com
    secretName: portainer-migrator-tls
  rules:
  - host: migrate.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: portainer-migrator
            port:
              number: 3001
```

Deploy with:
```bash
kubectl apply -f namespace.yaml
kubectl apply -f secret.yaml
kubectl apply -f configmap.yaml
kubectl apply -f pvc.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
```

## Reverse Proxy Configuration

### Nginx

```nginx
# /etc/nginx/sites-available/portainer-migrator
server {
    listen 80;
    server_name migrate.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name migrate.example.com;

    ssl_certificate /etc/letsencrypt/live/migrate.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/migrate.example.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

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

        # Increase timeouts for long migrations
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    # Increase upload size for BoltDB files
    client_max_body_size 100M;
}
```

### Traefik (Docker Labels)

```yaml
services:
  portainer-migrator:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.migrator.rule=Host(`migrate.example.com`)"
      - "traefik.http.routers.migrator.entrypoints=websecure"
      - "traefik.http.routers.migrator.tls.certresolver=letsencrypt"
      - "traefik.http.services.migrator.loadbalancer.server.port=3001"
      # Increase request body size
      - "traefik.http.middlewares.migrator-body.buffering.maxRequestBodyBytes=104857600"
      - "traefik.http.routers.migrator.middlewares=migrator-body"
```

### Caddy

```
migrate.example.com {
    reverse_proxy localhost:3001

    # Increase request body size
    request_body {
        max_size 100MB
    }
}
```

## Resource Requirements

### Minimum (Small deployments)

- CPU: 1 core
- Memory: 512 MB
- Disk: 100 MB

### Recommended (Medium deployments)

- CPU: 2 cores
- Memory: 1 GB
- Disk: 500 MB

### Enterprise (Large deployments)

- CPU: 4 cores
- Memory: 2 GB
- Disk: 1 GB

## High Availability Considerations

### Database

SQLite is used by default (single instance). For HA:

1. **NFS/Shared Storage**: Mount database on shared storage
2. **Regular Backups**: Implement backup strategy
3. **Single-Writer**: Ensure only one instance writes at a time

### Session State

Sessions are stored in-memory. For HA:

1. **Sticky Sessions**: Configure load balancer for session affinity
2. **JWT Duration**: Set appropriate token expiration

### File Uploads

Uploaded files are stored locally. For HA:

1. **Shared Storage**: Use NFS or S3-compatible storage
2. **File Sync**: Implement file synchronization

## Air-Gapped Deployment

For environments without internet access:

### 1. Pre-pull Images

```bash
# On internet-connected machine
docker pull ghcr.io/your-org/portainer-migrator:latest
docker save ghcr.io/your-org/portainer-migrator:latest > migrator.tar

# Transfer to air-gapped environment
# ...

# On air-gapped machine
docker load < migrator.tar
```

### 2. Offline License Activation

See [License Activation Guide](../user-guide/license-activation.md#offline-activation)

### 3. Local Configuration

```yaml
environment:
  - LICENSE_SERVER_URL=  # Empty for offline
  - ENABLE_TELEMETRY=false
```

## Post-Deployment Verification

```bash
# 1. Check container health
docker-compose ps

# 2. Verify API endpoint
curl http://localhost:3001/api/health

# 3. Check license status
curl http://localhost:3001/api/license

# 4. Test UI access
# Open http://localhost:3001 in browser

# 5. View logs for errors
docker-compose logs --tail=50
```

## Upgrading

### Docker Compose

```bash
# Pull new image
docker-compose pull

# Recreate container
docker-compose up -d

# Verify
docker-compose ps
docker-compose logs --tail=20
```

### Kubernetes

```bash
# Update image in deployment
kubectl set image deployment/portainer-migrator \
  portainer-migrator=ghcr.io/your-org/portainer-migrator:new-version \
  -n portainer-migrator

# Or update manifests and apply
kubectl apply -f deployment.yaml
```

### Rollback

```bash
# Docker Compose
docker-compose pull ghcr.io/your-org/portainer-migrator:previous-version
docker-compose up -d

# Kubernetes
kubectl rollout undo deployment/portainer-migrator -n portainer-migrator
```
