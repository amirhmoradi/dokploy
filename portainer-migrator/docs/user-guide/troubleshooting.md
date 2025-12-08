# Troubleshooting Guide

This guide helps you resolve common issues with Portainer Migrator.

## Quick Diagnostics

Before diving into specific issues, run these checks:

```bash
# 1. Check container status
docker-compose ps

# 2. View recent logs
docker-compose logs --tail=100 portainer-migrator

# 3. Test health endpoint
curl http://localhost:3001/api/health

# 4. Check license status
curl http://localhost:3001/api/license
```

---

## Connection Issues

### Cannot Connect to Portainer

**Symptoms:**
- "Connection refused"
- "ECONNREFUSED"
- "Network unreachable"

**Solutions:**

1. **Verify Portainer is running:**
   ```bash
   curl -I https://your-portainer-url/api/status
   ```

2. **Check URL format:**
   - Include protocol: `https://` not just the domain
   - Include port if non-standard: `https://portainer.example.com:9443`

3. **Test from migrator container:**
   ```bash
   docker exec portainer-migrator curl -I https://your-portainer-url
   ```

4. **Check firewall rules:**
   - Ensure outbound HTTPS (443) is allowed
   - Check Docker network configuration

5. **DNS resolution:**
   ```bash
   docker exec portainer-migrator nslookup your-portainer-url
   ```

### SSL/TLS Errors

**Symptoms:**
- "certificate verify failed"
- "self signed certificate"
- "unable to verify the first certificate"

**Solutions:**

1. **For self-signed certificates:**
   ```yaml
   # docker-compose.yml
   environment:
     - NODE_TLS_REJECT_UNAUTHORIZED=0  # Not recommended for production
   ```

2. **For custom CA:**
   ```yaml
   volumes:
     - ./custom-ca.crt:/etc/ssl/certs/custom-ca.crt:ro
   ```

3. **Verify certificate:**
   ```bash
   openssl s_client -connect portainer.example.com:443 -showcerts
   ```

### Authentication Failures

**Symptoms:**
- "401 Unauthorized"
- "Invalid credentials"
- "Access denied"

**Solutions:**

1. **Verify API key:**
   ```bash
   curl https://portainer.example.com/api/users \
     -H "X-API-Key: your_api_key"
   ```

2. **Generate new API key:**
   - Log into Portainer as admin
   - My Account → Access Tokens → Add

3. **Check key hasn't expired:**
   - Portainer may have key expiration settings
   - Generate a new key without expiration

4. **Verify admin permissions:**
   - API key must be from an admin user
   - Standard users have limited API access

---

## Cannot Connect to Dokploy

**Symptoms:**
- "Failed to connect to Dokploy"
- "DOKPLOY_URL not configured"
- "Invalid Dokploy API key"

**Solutions:**

1. **Verify environment variables:**
   ```bash
   docker exec portainer-migrator env | grep DOKPLOY
   ```

2. **Test Dokploy connectivity:**
   ```bash
   curl -H "Authorization: Bearer $DOKPLOY_API_KEY" \
     $DOKPLOY_URL/api/trpc/project.all
   ```

3. **Check API key format:**
   - Must be a valid Dokploy API key
   - Generate from Dokploy → Settings → API Keys

---

## Migration Issues

### Analysis Fails

**Symptoms:**
- "Analysis failed"
- Status stuck on "analyzing"
- Timeout during analysis

**Solutions:**

1. **Check source data:**
   - Verify Portainer has data to analyze
   - Test connection first

2. **Memory issues:**
   ```bash
   # Increase container memory
   docker-compose down
   # In docker-compose.yml:
   mem_limit: 1g
   docker-compose up -d
   ```

3. **Timeout issues:**
   - Large Portainer setups take longer
   - Check server logs for specific errors

4. **Cancel and retry:**
   ```bash
   curl -X POST http://localhost:3001/api/migrations/mig_xxx/cancel
   # Then retry
   curl -X POST http://localhost:3001/api/migrations/mig_xxx/analyze
   ```

### Stack Migration Fails

**Symptoms:**
- "Failed to migrate stack"
- "Invalid compose file"
- "Stack creation failed"

**Common Causes & Solutions:**

1. **Invalid compose syntax:**
   ```bash
   # Check the source compose file
   docker-compose -f stack.yml config
   ```

2. **Version compatibility:**
   - Compose v2 files may need updating
   - Migrator attempts automatic upgrade

3. **Missing dependencies:**
   - Stack references networks/volumes that don't exist
   - Check Dokploy has required resources

4. **Registry authentication:**
   - Private images need registry credentials
   - Migrate registries first

### Registry Migration Fails

**Symptoms:**
- "Registry creation failed"
- "Authentication failed"
- "Invalid registry URL"

**Solutions:**

1. **Credentials issue:**
   - Some credentials can't be extracted
   - Manually create registry in Dokploy

2. **Unsupported registry type:**
   - Check registry type is supported
   - Manual configuration may be needed

3. **Network access:**
   - Dokploy must reach the registry
   - Check firewall/network rules

### Partial Migration

**Symptoms:**
- Some items succeed, others fail
- Mixed success/failure

**Solutions:**

1. **Check individual item logs:**
   ```bash
   curl "http://localhost:3001/api/migrations/mig_xxx/items?status=failed"
   ```

2. **Retry failed items:**
   ```bash
   curl -X POST http://localhost:3001/api/migrations/mig_xxx/retry-failed
   ```

3. **Manual intervention:**
   - Some items may need manual migration
   - Use Dokploy UI for complex cases

---

## License Issues

### "Invalid License Key"

**Solutions:**
1. Check for typos
2. Ensure format: `PM-XXXX-XXXX-XXXX-XXXX`
3. Case doesn't matter

### "License Expired"

**Solutions:**
1. Check expiration date
2. Purchase renewal
3. Enter new license key

### "License Already Activated"

**Solutions:**
1. Deactivate on other server first
2. Contact support if no access
3. Enterprise: Request multi-instance license

### "Cannot Validate License"

**Solutions:**
1. Check internet connectivity
2. Verify firewall allows outbound HTTPS
3. Use offline activation method

---

## Performance Issues

### Slow Migration

**Possible Causes:**
- Network latency
- Large compose files
- Many stacks

**Solutions:**

1. **Optimize network:**
   - Run migrator closer to Portainer
   - Check for network bottlenecks

2. **Increase resources:**
   ```yaml
   services:
     portainer-migrator:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 2G
   ```

3. **Batch processing:**
   - Create multiple migrations
   - Migrate in smaller groups

### High Memory Usage

**Solutions:**

1. **Monitor memory:**
   ```bash
   docker stats portainer-migrator
   ```

2. **Restart container:**
   ```bash
   docker-compose restart portainer-migrator
   ```

3. **Process smaller batches:**
   - Reduce items per migration

### UI Unresponsive

**Solutions:**
1. Clear browser cache
2. Try different browser
3. Disable browser extensions
4. Check for JavaScript errors

---

## Database Issues

### "Database locked"

**Solutions:**
```bash
# Restart the container
docker-compose restart portainer-migrator

# If persistent, recreate (WARNING: loses data)
docker-compose down
docker volume rm <project>_migrator-data
docker-compose up -d
```

### "Database corrupted"

**Solutions:**
1. Restore from backup if available
2. Export any accessible data
3. Recreate database (loses history)

---

## Docker Issues

### Container Won't Start

**Check logs:**
```bash
docker logs portainer-migrator
```

**Common issues:**
1. Port already in use:
   ```bash
   lsof -i :3001
   # Change port in docker-compose.yml
   ```

2. Volume permissions:
   ```bash
   docker exec portainer-migrator ls -la /app/data
   ```

3. Environment variables:
   ```bash
   docker exec portainer-migrator env
   ```

### Container Keeps Restarting

**Solutions:**
1. Check logs for errors
2. Verify environment variables
3. Increase health check timeouts

---

## Error Reference

### Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `CONN_REFUSED` | Cannot reach server | Check URL and network |
| `AUTH_FAILED` | Invalid credentials | Verify API key/password |
| `NOT_FOUND` | Resource doesn't exist | Check resource ID |
| `FORBIDDEN` | No permission | Check user permissions |
| `TIMEOUT` | Operation timed out | Retry or check network |
| `INVALID_INPUT` | Bad request data | Check input format |
| `LICENSE_INVALID` | License issue | Check license status |
| `INTERNAL_ERROR` | Server error | Check server logs |

### Common Error Messages

**"Migration not found"**
- Migration ID doesn't exist
- Migration was deleted

**"Invalid source type"**
- Must be "api" or "boltdb"

**"Portainer URL is required"**
- API migration needs URL

**"Cannot update running migration"**
- Wait for completion or cancel first

---

## Getting Help

### Before Contacting Support

Gather this information:
1. Migration ID
2. Error message (exact text)
3. Server logs
4. Portainer and Dokploy versions
5. Steps to reproduce

### Contact Methods

- **Community**: GitHub Issues
- **Email**: support@portainer-migrator.com
- **Enterprise**: Dedicated support channel

### Log Collection

```bash
# Collect diagnostic info
docker-compose logs portainer-migrator > migrator-logs.txt
docker inspect portainer-migrator > container-info.txt
curl http://localhost:3001/api/health > health-status.txt

# Create archive
zip diagnostic-bundle.zip *.txt
```
