# Security Hardening Guide

Best practices for securing your Portainer Migrator deployment.

## Security Checklist

- [ ] Use HTTPS with valid certificates
- [ ] Set strong JWT secret (64+ characters)
- [ ] Configure specific CORS origins
- [ ] Use secrets management for credentials
- [ ] Enable firewall rules
- [ ] Keep container images updated
- [ ] Implement network segmentation
- [ ] Enable audit logging
- [ ] Regular security reviews

## Authentication & Authorization

### JWT Token Security

```bash
# Generate strong secret
JWT_SECRET=$(openssl rand -hex 64)
```

Best practices:
- Minimum 32 characters (64+ recommended)
- Rotate periodically
- Don't reuse across environments

### API Key Management

1. **Dokploy API Key**
   - Use dedicated key for migrator
   - Apply minimal required permissions
   - Rotate after migration project completion

2. **Portainer API Key**
   - Create dedicated migration user
   - Limit to read-only access
   - Delete after migration

## Network Security

### HTTPS Configuration

Always use HTTPS in production:

```nginx
server {
    listen 443 ssl http2;

    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

### Firewall Rules

```bash
# Allow only necessary traffic
# Inbound: Only from trusted networks
# Outbound: Only to Portainer, Dokploy, license server

# Example iptables
iptables -A INPUT -p tcp --dport 3001 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 3001 -j DROP
```

### Network Isolation

```yaml
# docker-compose.yml
networks:
  migrator-internal:
    internal: true  # No external access
  migrator-external:
    # For accessing Portainer/Dokploy
```

## Credential Management

### Environment Variables

Never commit credentials to version control:

```bash
# .gitignore
.env
*.env
secrets/
```

### Docker Secrets (Swarm)

```yaml
secrets:
  license_key:
    external: true
  jwt_secret:
    external: true

services:
  portainer-migrator:
    secrets:
      - license_key
      - jwt_secret
    environment:
      - LICENSE_KEY_FILE=/run/secrets/license_key
```

### Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: portainer-migrator-secrets
type: Opaque
data:
  license-key: <base64-encoded>
  jwt-secret: <base64-encoded>
```

## Data Protection

### Database Security

```bash
# Restrict file permissions
chmod 600 /app/data/migrator.db

# Encrypt at rest (volume level)
# Use encrypted Docker volumes or host filesystem encryption
```

### Sensitive Data Handling

The database may contain:
- Portainer credentials (encrypted)
- API keys (encrypted)
- Compose file contents (may include secrets)

Recommendations:
- Encrypt volumes at rest
- Limit database file access
- Secure backups

### Data Retention

```bash
# Implement cleanup policy
# Delete old migrations and logs
# Example: Keep only 90 days

curl -X DELETE http://localhost:3001/api/admin/cleanup?olderThan=90d
```

## Container Security

### Non-Root User

The container runs as non-root by default:

```dockerfile
# In Dockerfile
USER node
```

### Read-Only Filesystem

```yaml
services:
  portainer-migrator:
    read_only: true
    tmpfs:
      - /tmp
    volumes:
      - migrator-data:/app/data
```

### Security Options

```yaml
services:
  portainer-migrator:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
```

## Audit Logging

### Enable Detailed Logging

```bash
LOG_LEVEL=info  # Logs all operations
```

### Log What's Captured

- Migration creation/execution
- License validation
- API requests
- Errors and warnings

### External Logging

```yaml
logging:
  driver: "syslog"
  options:
    syslog-address: "udp://logs.example.com:514"
    tag: "portainer-migrator"
```

## Security Headers

If using reverse proxy, add security headers:

```nginx
# nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

## Vulnerability Management

### Regular Updates

```bash
# Check for updates
docker pull ghcr.io/your-org/portainer-migrator:latest

# Update
docker-compose pull
docker-compose up -d
```

### Security Scanning

```bash
# Scan container image
trivy image ghcr.io/your-org/portainer-migrator:latest
```

## Incident Response

### If Credentials Compromised

1. Revoke Portainer API key
2. Revoke Dokploy API key
3. Rotate JWT secret
4. Review audit logs
5. Restart services with new credentials

### If Database Compromised

1. Stop the service
2. Rotate all credentials
3. Review what data was exposed
4. Recreate database if necessary
5. Restore from clean backup

## Compliance Considerations

### Data Processing

- No data sent to external servers (except license validation)
- Compose files may contain sensitive data
- Environment variables may include secrets

### Audit Requirements

- All operations are logged
- Logs can be exported for compliance
- Database contains full audit trail
