# Portainer Migrator - User Guide

Welcome to the Portainer Migrator User Guide. This documentation will help you successfully migrate your Portainer setup to Dokploy.

## Table of Contents

1. [Getting Started](./getting-started.md)
2. [Installation](./installation.md)
3. [License Activation](./license-activation.md)
4. [Creating Your First Migration](./first-migration.md)
5. [API-Based Migration](./api-migration.md)
6. [BoltDB-Based Migration](./boltdb-migration.md)
7. [Migration Options](./migration-options.md)
8. [Monitoring Progress](./monitoring.md)
9. [Troubleshooting](./troubleshooting.md)
10. [FAQ](./faq.md)

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Access to your Portainer instance (API or database file)
- Dokploy instance running with API access
- Valid Portainer Migrator license

### 5-Minute Quick Start

```bash
# 1. Download and start Portainer Migrator
curl -o docker-compose.yml https://releases.portainer-migrator.com/docker-compose.yml

# 2. Configure environment variables
cat > .env << EOF
LICENSE_KEY=your-license-key
DOKPLOY_URL=https://your-dokploy-instance.com
DOKPLOY_API_KEY=your-dokploy-api-key
JWT_SECRET=$(openssl rand -hex 32)
EOF

# 3. Start the service
docker-compose up -d

# 4. Open the web UI
echo "Open http://localhost:3001 in your browser"
```

## Need Help?

- **Documentation Issues**: Submit a pull request on GitHub
- **Technical Support**: support@portainer-migrator.com
- **Enterprise Support**: enterprise@portainer-migrator.com
