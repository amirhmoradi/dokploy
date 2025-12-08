# Portainer to Dokploy Migration Guide

This guide walks you through migrating your Portainer stacks, registries, and configurations to Dokploy using the built-in migration tool.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Accessing the Migration Tool](#accessing-the-migration-tool)
3. [Migration Methods](#migration-methods)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Understanding the Analysis](#understanding-the-analysis)
6. [Dry Run vs. Actual Migration](#dry-run-vs-actual-migration)
7. [Post-Migration Steps](#post-migration-steps)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Prerequisites

Before starting the migration, ensure you have:

### For Dokploy
- Dokploy version 0.x.x or later installed
- Admin or Owner role in your organization
- At least one project and environment created (or the tool will create defaults)

### For Portainer (API Method)
- Portainer CE/BE version 2.x or later
- One of the following:
  - **API Key** (Recommended): Generate from User Settings > Access Tokens
  - **Username and Password**: Your Portainer admin credentials
- Network access from Dokploy server to Portainer instance

### For Portainer (BoltDB Method)
- Access to Portainer's data directory (typically `/data` or `/opt/portainer`)
- The `portainer.db` file (BoltDB database)
- Optionally: The `compose` folder containing stack files

---

## Accessing the Migration Tool

1. Log in to Dokploy as an Admin or Owner
2. Navigate to **Settings** from the sidebar
3. Click on **Portainer Migration**

---

## Migration Methods

### Method 1: API-Based Migration (Recommended)

Use this method when:
- Your Portainer instance is running and accessible
- You have network connectivity between Dokploy and Portainer
- You want to migrate a live environment

**Advantages:**
- Real-time data access
- Automatic retrieval of compose files
- Simpler setup

### Method 2: BoltDB-Based Migration

Use this method when:
- Portainer is no longer running
- You're migrating from a backup
- Network access is not available
- You need offline migration

**Advantages:**
- Works without running Portainer
- Useful for disaster recovery
- Can migrate from backups

---

## Step-by-Step Migration

### Step 1: Create New Migration

Click **"New Migration"** to start the migration wizard.

### Step 2: Configure Source

#### For API Method:

1. Select **"Portainer API"** as the source type
2. Enter your Portainer URL (e.g., `https://portainer.example.com`)
3. Choose authentication method:
   - **API Key** (Recommended): Enter your API key starting with `ptr_`
   - **Username/Password**: Enter your admin credentials
4. Click **"Test Connection"** to verify connectivity

#### For BoltDB Method:

1. Select **"BoltDB File"** as the source type
2. Upload your `portainer.db` file
3. Optionally upload your stack files (as a ZIP archive):
   - Typically found at `/data/compose/` in Portainer
   - Include all stack directories

### Step 3: Configure Options

Select what you want to migrate:

| Option | Description | Default |
|--------|-------------|---------|
| **Migrate Stacks** | Docker Compose stacks | Enabled |
| **Migrate Registries** | Container registries | Enabled |
| **Migrate Endpoints** | Docker endpoints as servers | Enabled |
| **Migrate Environment Variables** | Stack environment variables | Enabled |
| **Migrate Users** | User accounts | Disabled |
| **Auto Deploy After Migration** | Automatically deploy stacks | Disabled |
| **Dry Run** | Test migration without changes | Enabled |

### Step 4: Select Target

1. Choose or create a **Target Project**
2. Select or create a **Target Environment**
3. Optionally select a **Target Server** for deployment

### Step 5: Analyze

Click **"Analyze"** to scan your Portainer data:

- The tool will connect to your source
- Examine all stacks, registries, and configurations
- Generate a compatibility report
- Identify potential issues

### Step 6: Review Analysis

Review the analysis results:

- **Green items**: Ready to migrate
- **Yellow items**: Migrate with warnings
- **Red items**: Cannot be migrated

Common warnings:
- Kubernetes stacks (not supported)
- Azure ACI endpoints (not supported)
- External authentication users
- Git repositories requiring authentication

### Step 7: Execute Migration

1. Choose **Dry Run** first to test the migration
2. Review the dry run results
3. If satisfied, run the **Actual Migration**

---

## Understanding the Analysis

### Endpoints Analysis

| Portainer Type | Dokploy Equivalent | Notes |
|----------------|-------------------|-------|
| Docker (Local) | Server | Requires SSH configuration |
| Docker Agent | Server | May need agent setup |
| Edge Agent | Server | Manual reconfiguration needed |
| Kubernetes | Not Supported | Skip during migration |
| Azure ACI | Not Supported | Skip during migration |

### Stacks Analysis

| Portainer Type | Dokploy Equivalent | Notes |
|----------------|-------------------|-------|
| Docker Compose | Compose Service | Full support |
| Swarm Stack | Stack Service | Requires Swarm setup |
| Kubernetes | Not Supported | Cannot migrate |

### Registries Analysis

| Portainer Type | Dokploy Type | Notes |
|----------------|--------------|-------|
| Docker Hub | Cloud | Full support |
| GitHub Registry | Cloud | Full support |
| GitLab Registry | Cloud | Full support |
| AWS ECR | Cloud | May need IAM config |
| Azure ACR | Cloud | May need auth config |
| Custom/Private | Self-Hosted | Full support |

---

## Dry Run vs. Actual Migration

### Dry Run Mode

- **Does NOT create** any resources in Dokploy
- **Does** analyze all items and report compatibility
- **Does** create migration items with "skipped" status
- **Recommended** before actual migration

### Actual Migration

- **Creates** real resources in Dokploy
- **Copies** compose files, registries, and configurations
- **Creates** servers (requires SSH setup after migration)
- **Irreversible** - created resources must be manually deleted

---

## Post-Migration Steps

### 1. Configure SSH Access for Servers

Migrated endpoints become servers that need SSH configuration:

1. Go to **Servers** in Dokploy
2. Click on each migrated server
3. Add SSH key or configure SSH access
4. Test connection

### 2. Update Registry Credentials

Some registries may need credential re-entry:

1. Go to **Settings > Registries**
2. Find migrated registries
3. Update passwords if needed
4. Test connection

### 3. Configure Git Authentication

For git-based stacks:

1. Go to the migrated compose service
2. Update git credentials or deploy keys
3. Test repository access

### 4. Deploy Stacks (Optional)

If you didn't enable auto-deploy:

1. Navigate to your project
2. Find migrated compose services
3. Click **Deploy** to start containers

### 5. Verify Applications

After deployment:

1. Check container logs for errors
2. Verify network connectivity
3. Test application functionality

---

## Troubleshooting

### Connection Errors

**"Connection refused" or "Unable to connect"**
- Verify Portainer URL is correct
- Check firewall rules
- Ensure Portainer is running
- Try accessing the URL from your browser

**"Authentication failed"**
- Verify API key or credentials
- Check API key permissions
- Try generating a new API key

### BoltDB Errors

**"Invalid BoltDB file"**
- Ensure you uploaded the correct file (`portainer.db`)
- Check file is not corrupted
- Try extracting from a fresh backup

**"Stack files not found"**
- Upload the compose folder as a ZIP
- Ensure directory structure is preserved
- Check stack paths in Portainer settings

### Migration Errors

**"Stack migration failed"**
- Check compose file syntax
- Verify all images are accessible
- Review environment variables

**"Registry migration failed"**
- Check registry URL format
- Verify credentials
- Ensure registry is accessible

### Viewing Logs

To diagnose issues:

1. Click on your migration
2. Go to the **Logs** tab
3. Filter by level (error, warning, info)
4. Review error details

---

## FAQ

### Q: Can I migrate multiple times?

Yes, you can run the migration multiple times. Each run creates new resources in Dokploy. You may want to delete previous migration attempts first.

### Q: Will my Portainer data be modified?

No, the migration tool only reads from Portainer. Your existing Portainer installation remains unchanged.

### Q: Can I migrate specific stacks only?

Currently, the tool migrates all or none of each resource type. To migrate specific items, use dry run and then manually create the resources you want.

### Q: What happens to my environment variables?

Environment variables are migrated along with stacks. Sensitive values are copied as-is. Consider rotating secrets after migration.

### Q: Can I cancel a running migration?

Yes, click the **Cancel** button during migration. Already-created resources will remain.

### Q: How do I handle failed items?

1. Go to migration details
2. Review the **Items** tab
3. Check error messages
4. Fix the issue
5. Click **Retry** on failed items

### Q: What about Portainer's Edge features?

Edge Agents and Edge Groups are not directly supported. You'll need to set up remote servers manually using Dokploy's server management.

### Q: Can I migrate between different Portainer versions?

Yes, the migration tool supports Portainer CE/BE 2.x versions. Older versions may have limited compatibility.

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the [Dokploy Documentation](https://docs.dokploy.com)
2. Search existing [GitHub Issues](https://github.com/dokploy/dokploy/issues)
3. Create a new issue with:
   - Dokploy version
   - Portainer version
   - Migration method used
   - Error messages and logs
   - Steps to reproduce

---

## Version History

- **v1.0.0**: Initial release with API and BoltDB support
