# Creating Your First Migration

This guide walks you through creating and executing your first migration from Portainer to Dokploy.

## Prerequisites

Before starting, ensure you have:

- [x] Portainer Migrator installed and running
- [x] License activated
- [x] Access to Portainer (API key or database file)
- [x] Dokploy instance configured in environment

## Step 1: Access the Dashboard

1. Open your browser and navigate to Portainer Migrator (e.g., `http://localhost:3001`)
2. You should see the main dashboard with statistics and recent migrations
3. Click **"New Migration"** button in the top-right

## Step 2: Basic Information

Fill in the migration details:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | Descriptive name for this migration | "Production to Dokploy" |
| **Description** | Optional notes about the migration | "Migrating all production stacks" |

Click **"Next"** to continue.

## Step 3: Choose Source Type

Select how you'll connect to Portainer:

### Option A: API Connection (Recommended)

Best for when Portainer is still running.

| Field | Description | Example |
|-------|-------------|---------|
| **Portainer URL** | Full URL to Portainer | `https://portainer.example.com` |
| **Authentication** | API Key or Username/Password | - |
| **API Key** | Your Portainer API key | `ptr_abc123...` |

**To get an API Key from Portainer:**
1. Log into Portainer as admin
2. Click your username → My account
3. Add new Access Token
4. Copy the token

### Option B: BoltDB File

Best for offline migration or when Portainer is no longer running.

| Field | Description | Example |
|-------|-------------|---------|
| **BoltDB File** | Upload your portainer.db | Select file |
| **Stack Files** | Optional: ZIP of compose files | Select file |

**To find your Portainer database:**
- Docker: `/var/lib/docker/volumes/portainer_data/_data/portainer.db`
- Host install: `/opt/portainer/portainer.db`

Click **"Test Connection"** to verify, then **"Next"**.

## Step 4: Migration Options

Configure what to migrate:

### Resources to Migrate

| Option | Default | Description |
|--------|---------|-------------|
| **Stacks** | ✅ On | Docker Compose stacks |
| **Registries** | ✅ On | Docker registry configurations |
| **Endpoints** | ✅ On | Server/environment configurations |
| **Environment Variables** | ✅ On | Stack environment variables |
| **Users** | ❌ Off | User accounts (Enterprise only) |

### Migration Mode

| Option | Description |
|--------|-------------|
| **Dry Run** | Simulate migration without making changes |
| **Auto Deploy** | Automatically deploy stacks after migration |

### Target Configuration (Optional)

| Option | Description |
|--------|-------------|
| **Project** | Target Dokploy project |
| **Environment** | Target environment |
| **Server** | Target server for deployments |

Click **"Next"** to continue.

## Step 5: Review & Create

Review your migration settings:

```
Migration Summary
─────────────────
Name: Production to Dokploy
Source: API (https://portainer.example.com)

Resources:
 ✓ Stacks
 ✓ Registries
 ✓ Endpoints
 ✓ Environment Variables

Mode: Dry Run
Auto Deploy: No
```

If everything looks correct, click **"Create Migration"**.

## Step 6: Run Analysis

Before migrating, analyze your Portainer setup:

1. On the migration detail page, click **"Analyze"**
2. Wait for the analysis to complete
3. Review the analysis report

### Analysis Report Contents

The analysis shows:

- **Discovery Summary**: Number of stacks, registries, endpoints found
- **Compatibility Check**: Any issues or warnings
- **Recommendations**: Suggestions for successful migration

#### Example Analysis Output

```
Analysis Complete
─────────────────
Discovered Resources:
 • Endpoints: 3
 • Stacks: 12
 • Registries: 2
 • Environment Variables: 45

Migratable:
 • Endpoints: 3 / 3 (100%)
 • Stacks: 11 / 12 (91.6%)
 • Registries: 2 / 2 (100%)

Warnings:
 ⚠ Stack "legacy-app" uses version 2.x compose format - will be upgraded to 3.x

Errors:
 ✗ Stack "kubernetes-app" uses Kubernetes manifest - cannot migrate
```

## Step 7: Execute Migration

### Dry Run First (Recommended)

1. Click **"Dry Run"** button
2. Watch progress in real-time
3. Review what would be migrated
4. Check for any errors

### Actual Migration

When ready for the actual migration:

1. Click **"Execute"** button
2. Confirm the action
3. Monitor progress
4. Review results

## Step 8: Verify Migration

After migration completes:

### Check Dokploy

1. Open your Dokploy dashboard
2. Navigate to the target project
3. Verify all stacks appear
4. Check registry connections

### Review Logs

In Portainer Migrator:
1. Go to the migration detail page
2. Scroll to the Logs section
3. Filter by level if needed
4. Look for any errors or warnings

### Test Deployments

If auto-deploy was enabled:
1. Check stack status in Dokploy
2. Verify services are running
3. Test application functionality

## Common First Migration Issues

### Issue: "Connection refused"

**Cause**: Portainer URL not reachable

**Solution**:
- Verify Portainer is running
- Check network connectivity
- Ensure correct URL (including https://)

### Issue: "Authentication failed"

**Cause**: Invalid credentials

**Solution**:
- Generate a new API key in Portainer
- Verify the key is for an admin user
- Check key hasn't expired

### Issue: "Stack migration failed"

**Cause**: Various compose compatibility issues

**Solution**:
- Check the specific error message
- Review compose file syntax
- Manually adjust if needed

### Issue: "Registry connection failed"

**Cause**: Registry credentials may not transfer

**Solution**:
- Re-enter registry credentials in Dokploy
- Verify registry is accessible

## Quick Reference: Migration Status

| Status | Meaning |
|--------|---------|
| **Pending** | Migration created, not started |
| **Analyzing** | Discovery and compatibility check in progress |
| **Ready** | Analysis complete, ready to execute |
| **Running** | Migration in progress |
| **Completed** | Successfully finished |
| **Failed** | Errors occurred (check logs) |
| **Cancelled** | User cancelled the migration |

## Next Steps

After your first successful migration:

1. [Learn about API migration in detail](./api-migration.md)
2. [Explore all migration options](./migration-options.md)
3. [Understand monitoring features](./monitoring.md)
