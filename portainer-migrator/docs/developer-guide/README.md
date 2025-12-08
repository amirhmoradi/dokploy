# Developer Guide

Technical documentation for developing and extending Portainer Migrator.

## Contents

1. [Architecture Overview](./architecture.md)
2. [Development Setup](./development-setup.md)
3. [API Reference](./api-reference.md)
4. [Extending the Migrator](./extending.md)
5. [Testing](./testing.md)
6. [Contributing](./contributing.md)

## Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/portainer-migrator.git
cd portainer-migrator

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Project Structure

```
portainer-migrator/
├── src/                    # Backend source code
│   ├── api/               # API routes
│   ├── db/                # Database schema and queries
│   ├── license/           # License validation
│   ├── services/          # Core services
│   │   ├── portainer-api-client.ts
│   │   ├── portainer-boltdb-reader.ts
│   │   ├── portainer-transformer.ts
│   │   └── migration-service.ts
│   ├── types/             # TypeScript types
│   ├── config.ts          # Configuration
│   └── index.ts           # Entry point
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── App.tsx
│   └── package.json
├── docs/                  # Documentation
├── tests/                 # Test files
├── Dockerfile             # Container build
├── docker-compose.yml     # Deployment config
└── package.json           # Backend dependencies
```

## Technology Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Hono
- **Database**: SQLite (better-sqlite3)
- **ORM**: Drizzle ORM
- **Language**: TypeScript

### Frontend
- **Framework**: React 18
- **State Management**: TanStack Query
- **Routing**: React Router
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

### Infrastructure
- **Container**: Docker
- **Process Manager**: tini
- **CI/CD**: GitHub Actions

## Key Concepts

### Migration Flow

```
1. User creates migration config
2. Analysis phase:
   - Connect to Portainer (API or BoltDB)
   - Discover resources
   - Check compatibility
3. Execution phase:
   - Transform data to Dokploy format
   - Create resources via Dokploy API
   - Track progress
4. Completion:
   - Report results
   - Export logs
```

### Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     API Routes                          │
│                    (routes.ts)                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────┐ │
│  │  Migration    │  │   License     │  │  Health    │ │
│  │   Service     │  │   Validator   │  │  Check     │ │
│  └───────┬───────┘  └───────────────┘  └────────────┘ │
│          │                                             │
│  ┌───────┴───────────────────────────────────┐        │
│  │                                           │        │
│  │  ┌─────────────┐       ┌─────────────┐   │        │
│  │  │ Portainer   │       │ Portainer   │   │        │
│  │  │ API Client  │       │ BoltDB      │   │        │
│  │  └─────────────┘       │ Reader      │   │        │
│  │                        └─────────────┘   │        │
│  │                                           │        │
│  │  ┌─────────────────────────────────────┐ │        │
│  │  │         Transformer                  │ │        │
│  │  └─────────────────────────────────────┘ │        │
│  │                                           │        │
│  │  ┌─────────────────────────────────────┐ │        │
│  │  │         Dokploy Client              │ │        │
│  │  └─────────────────────────────────────┘ │        │
│  │                                           │        │
│  └───────────────────────────────────────────┘        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                     Database                            │
│                   (SQLite/Drizzle)                      │
└─────────────────────────────────────────────────────────┘
```

## Environment Setup

### Required Tools
- Node.js 20+
- pnpm 8+
- Docker
- Git

### Environment Variables

```bash
# .env.development
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
DATABASE_PATH=./data/migrator.db
LICENSE_KEY=PM-DEV-KEY
DOKPLOY_URL=http://localhost:3000
DOKPLOY_API_KEY=dev-api-key
JWT_SECRET=development-secret-32-characters-min
```

## Common Tasks

### Add New API Endpoint

1. Add route in `src/api/routes.ts`
2. Add types in `src/types/index.ts`
3. Add tests in `tests/`
4. Update API documentation

### Add New Migration Resource Type

1. Update `PortainerData` type
2. Add extraction in API client
3. Add extraction in BoltDB reader
4. Add transformation logic
5. Update Dokploy client
6. Add tests

### Add New License Feature

1. Update feature flags in `src/license/license-validator.ts`
2. Add feature check where needed
3. Update documentation

## Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: dev@portainer-migrator.com
