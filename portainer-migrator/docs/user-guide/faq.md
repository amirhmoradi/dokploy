# Frequently Asked Questions

## General Questions

### What is Portainer Migrator?

Portainer Migrator is a commercial tool that automates migration from Portainer CE/BE to Dokploy. It preserves your stacks, registries, environments, and configurations while handling the complex data transformation between platforms.

### Do I need both Portainer and Dokploy running?

- **API Migration**: Portainer must be running; Dokploy must be running
- **BoltDB Migration**: Only Dokploy must be running (Portainer can be offline)

### Which Portainer versions are supported?

- Full support: Portainer 2.15 - 2.19+
- Partial support: Portainer 2.14 and earlier
- Not supported: Portainer 1.x

### Which Dokploy versions are supported?

Dokploy 0.10.0 and newer are fully supported.

### Is my data safe during migration?

Yes. The migrator:
- Never modifies your Portainer instance
- Uses dry-run mode by default
- Creates resources in Dokploy without affecting existing resources
- Logs all actions for audit

---

## Migration Questions

### How long does migration take?

Typical times:
- 1-10 stacks: 5-10 minutes
- 10-50 stacks: 15-30 minutes
- 50-200 stacks: 30-60 minutes
- 200+ stacks: 1-2 hours

### Can I migrate specific stacks only?

Currently, migrations process all discovered stacks. Selective migration is planned for v1.1. Workaround:
- Use separate projects in Portainer
- Create multiple migrations with filters (coming soon)

### What happens to my running containers?

The migrator doesn't touch your running containers. It only:
- Reads configuration from Portainer
- Creates configurations in Dokploy
- Optionally triggers deployment in Dokploy

### Can I migrate to an existing Dokploy project?

Yes. Specify `targetProjectId` to migrate into an existing project.

### What if a stack already exists in Dokploy?

The migrator will skip existing resources and log a warning. Override behavior is planned for future versions.

### Can I undo a migration?

There's no automatic rollback, but since the migrator only creates new resources:
- Delete created resources in Dokploy
- Re-run migration with different settings

### Do environment variables transfer?

Yes, all environment variables associated with stacks are migrated.

### Are secrets/passwords migrated?

Some credentials can be extracted and migrated. Due to encryption:
- API keys and tokens: Usually migrated
- Registry passwords: May need manual re-entry
- Database passwords: Migrated as environment variables

---

## Technical Questions

### What data is sent to your servers?

**During license validation (online):**
- License key
- Machine identifier (hash)
- Timestamp

**NOT sent:**
- Migration data
- Stack contents
- Credentials
- Any Portainer/Dokploy data

### Can I use this in air-gapped environments?

Yes! Use:
1. BoltDB migration (no Portainer API needed)
2. Offline license activation
3. Local Docker images

### How do I backup before migrating?

**Portainer backup:**
```bash
docker stop portainer
cp -r /var/lib/docker/volumes/portainer_data/_data ./portainer-backup
docker start portainer
```

**Dokploy backup:**
```bash
# Refer to Dokploy documentation for backup procedures
```

### Does migration cause downtime?

No. The migrator:
- Reads from Portainer (no changes)
- Creates in Dokploy (new resources)
- Optional deployment is separate

Your existing Portainer stacks continue running throughout.

### Can I migrate multiple Portainer instances?

Yes. Create separate migrations for each Portainer instance. They can all target the same Dokploy installation.

### What about Portainer Edge agents?

Edge agents are not migrated in v1.0. They're noted during analysis but skipped. Edge agent migration is planned for v2.0.

---

## Licensing Questions

### Can I try before buying?

Yes! Request a free 14-day trial license that includes:
- Up to 5 stacks
- Up to 2 registries
- Full functionality otherwise

### What happens when my license expires?

1. 7-day grace period with full functionality
2. After grace period: read-only access
3. Existing migrations can be viewed but not started
4. Renew anytime to restore full access

### Can I use one license on multiple servers?

- Standard/Professional: 1 active installation
- Enterprise: Multi-instance licensing available

### How do I upgrade my license?

Contact support or visit the pricing page. Your current payment is credited toward the upgrade.

### What's included in updates?

All updates within your license period are included:
- Bug fixes
- New features
- Security patches

### Is there a perpetual license option?

Enterprise customers can discuss perpetual licensing. Contact sales@portainer-migrator.com.

---

## Troubleshooting Questions

### Why is my migration stuck on "analyzing"?

Possible causes:
1. Network connectivity issues
2. Large Portainer setup (be patient)
3. Portainer API rate limiting
4. Memory constraints

Solution: Check logs, increase resources, or cancel and retry.

### Why did some stacks fail to migrate?

Common reasons:
- Invalid compose syntax
- Missing dependencies
- Registry authentication issues
- Dokploy validation errors

Check the specific error message in logs.

### Why can't I connect to Portainer?

Verify:
1. URL is correct (including https://)
2. API key is valid
3. Network connectivity
4. No firewall blocking

### How do I see detailed error messages?

1. Check migration logs in the UI
2. Filter by "error" level
3. Check container logs: `docker-compose logs`

---

## Feature Questions

### Can I schedule migrations?

Not in v1.0. Scheduled migrations are planned for v1.2.

### Can I migrate users and teams?

Yes, with Enterprise license. User migration is disabled for other license types.

### Is there a CLI version?

Not yet. A CLI tool is planned for v1.2.

### Can I export migration reports?

Yes. Use the Export button in the UI or:
```bash
curl http://localhost:3001/api/migrations/{id}/export
```

### Is there an API?

Yes! All functionality is available via REST API. See the API Reference documentation.

### Can I migrate from Docker Swarm?

Swarm stacks are supported if managed through Portainer. Native Swarm configurations (not in Portainer) are not supported.

---

## Comparison Questions

### How is this different from manual migration?

| Aspect | Manual | Portainer Migrator |
|--------|--------|-------------------|
| Time | Hours/days | Minutes/hours |
| Errors | High risk | Automated validation |
| Consistency | Variable | Guaranteed |
| Audit trail | Manual | Automatic |
| Scalability | Poor | Excellent |

### Can I just use the Portainer export feature?

Portainer's export is limited:
- Only exports to Portainer format
- Doesn't transform to Dokploy format
- No compose file extraction
- No registry migration

### Why not use Docker Compose directly?

You could manually recreate stacks, but:
- Tedious for many stacks
- Easy to miss configurations
- No environment variable transfer
- No registry setup automation

---

## Support Questions

### How do I get support?

- **Trial/Standard**: Community support (GitHub issues)
- **Professional**: Email support (24-48h response)
- **Enterprise**: Dedicated support with SLA

### Where do I report bugs?

GitHub Issues: https://github.com/your-org/portainer-migrator/issues

Include:
- Migration ID
- Error message
- Steps to reproduce
- Log excerpts

### Where can I request features?

Email features@portainer-migrator.com or create a GitHub Discussion.

### Is there documentation for the API?

Yes, see [API Reference](/docs/api-reference/README.md).

---

## Still Have Questions?

- **Email**: support@portainer-migrator.com
- **Enterprise**: enterprise@portainer-migrator.com
- **GitHub**: [Issues](https://github.com/your-org/portainer-migrator/issues)
