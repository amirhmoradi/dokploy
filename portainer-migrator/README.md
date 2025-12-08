# Portainer Migrator

A commercial tool for migrating from Portainer CE/BE to Dokploy.

## Overview

Portainer Migrator automates the migration of container management configurations from Portainer to Dokploy. It eliminates manual effort while ensuring data integrity and minimal downtime.

### Key Features

- **Dual Migration Methods**: API-based or BoltDB file-based migration
- **Comprehensive Migration**: Stacks, registries, endpoints, environment variables
- **Risk-Free Validation**: Dry-run mode to validate before executing
- **Complete Audit Trail**: Detailed logging and reporting
- **License-Based Access**: Tiered features for different needs

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Portainer access (API or database file)
- Dokploy instance with API access
- Valid license key

### Installation

```bash
# Clone/download the package
cd portainer-migrator

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start the service
docker-compose up -d

# Open in browser
open http://localhost:3001
```

### Environment Variables

```bash
# Required
LICENSE_KEY=PM-XXXX-XXXX-XXXX-XXXX
DOKPLOY_URL=https://your-dokploy-instance.com
DOKPLOY_API_KEY=your-dokploy-api-key
JWT_SECRET=your-secret-minimum-32-characters

# Optional
PORT=3001
LOG_LEVEL=info
```

## Project Structure

```
portainer-migrator/
├── src/                    # Backend source code
│   ├── api/               # API routes (Hono)
│   ├── db/                # Database (SQLite/Drizzle)
│   ├── license/           # License validation
│   ├── services/          # Core migration services
│   └── types/             # TypeScript types
├── frontend/              # React frontend
├── docs/                  # Documentation
│   ├── PRD.md            # Product requirements
│   ├── ROADMAP.md        # Feature roadmap
│   ├── user-guide/       # User documentation
│   ├── admin-guide/      # Admin documentation
│   ├── developer-guide/  # Developer documentation
│   └── sales/            # Sales materials
├── Dockerfile            # Container build
├── docker-compose.yml    # Deployment config
└── package.json          # Dependencies
```

## Documentation

| Guide | Description |
|-------|-------------|
| [PRD](./docs/PRD.md) | Product requirements document |
| [Roadmap](./docs/ROADMAP.md) | Feature roadmap |
| [User Guide](./docs/user-guide/README.md) | End-user documentation |
| [Admin Guide](./docs/admin-guide/README.md) | Administration guide |
| [Developer Guide](./docs/developer-guide/README.md) | Development documentation |
| [Sales](./docs/sales/README.md) | Sales and marketing materials |

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Technology Stack

### Backend
- Node.js 20+
- Hono (web framework)
- SQLite + Drizzle ORM
- TypeScript

### Frontend
- React 18
- TanStack Query
- Tailwind CSS
- Vite

## License Tiers

| Feature | Trial | Standard | Professional | Enterprise |
|---------|-------|----------|--------------|------------|
| Stacks | 5 | 50 | Unlimited | Unlimited |
| Registries | 2 | 10 | Unlimited | Unlimited |
| User Migration | ❌ | ❌ | ❌ | ✅ |
| Offline Validation | ❌ | ❌ | ✅ | ✅ |
| Support | Community | Email | Priority | Dedicated |
| Price | Free | $99/year | $299/year | Custom |

## Pricing

- **Trial**: Free for 14 days (5 stacks, 2 registries)
- **Standard**: $99/year (50 stacks, 10 registries)
- **Professional**: $299/year (unlimited, offline validation)
- **Enterprise**: Contact for pricing (full features, SLA)

## Support

- **Documentation**: See `/docs` directory
- **Email**: support@portainer-migrator.com
- **Enterprise**: enterprise@portainer-migrator.com

## Contributing

This is a commercial product. For development contributions, please contact the maintainer.

## License

Commercial software. See LICENSE file for terms.

---

© 2024 Portainer Migrator. All rights reserved.
