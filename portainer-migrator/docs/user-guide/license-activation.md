# License Activation

Portainer Migrator requires a valid license to operate. This guide explains the license system and activation process.

## License Types

| License Type | Stacks | Registries | Users | Support | Price |
|--------------|--------|------------|-------|---------|-------|
| Trial | 5 | 2 | ❌ | Community | Free |
| Standard | 50 | 10 | ❌ | Email | $99/year |
| Professional | Unlimited | Unlimited | ❌ | Priority | $299/year |
| Enterprise | Unlimited | Unlimited | ✅ | Dedicated | Contact us |

## Obtaining a License

### Trial License

Get a free 14-day trial license:

1. Visit [portainer-migrator.com/trial](https://portainer-migrator.com/trial)
2. Enter your email address
3. Receive license key instantly via email
4. Trial includes 5 stacks, 2 registries

### Paid License

Purchase a license:

1. Visit [portainer-migrator.com/pricing](https://portainer-migrator.com/pricing)
2. Select your plan
3. Complete checkout
4. Receive license key via email

### Enterprise License

For enterprise needs:

1. Contact sales@portainer-migrator.com
2. Discuss requirements
3. Receive custom quote
4. Get dedicated support

## License Key Format

License keys follow this format:

```
PM-XXXX-XXXX-XXXX-XXXX
```

Example: `PM-A1B2-C3D4-E5F6-G7H8`

- `PM` - Product prefix
- 4 groups of 4 alphanumeric characters
- Case-insensitive

## Activation Methods

### Method 1: Web Interface (Recommended)

1. Open Portainer Migrator in your browser
2. On first launch, you'll see the License Activation page
3. Enter your license key
4. Click "Activate License"
5. Success! You'll be redirected to the dashboard

### Method 2: Environment Variable

Set the license key before starting:

```bash
# In .env file
LICENSE_KEY=PM-XXXX-XXXX-XXXX-XXXX

# Or in docker-compose.yml
environment:
  - LICENSE_KEY=PM-XXXX-XXXX-XXXX-XXXX
```

### Method 3: API Activation

```bash
curl -X POST http://localhost:3001/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{"licenseKey": "PM-XXXX-XXXX-XXXX-XXXX"}'
```

## Online vs Offline Activation

### Online Activation (Default)

- License validated against license server
- Provides real-time validity checking
- Automatic feature updates
- Requires internet connectivity

### Offline Activation

For air-gapped environments:

1. **Generate Machine ID**
   ```bash
   curl http://localhost:3001/api/license/machine-id
   ```

2. **Request Offline License**
   - Visit [portainer-migrator.com/offline](https://portainer-migrator.com/offline)
   - Enter your license key and machine ID
   - Download offline activation file

3. **Apply Offline License**
   ```bash
   curl -X POST http://localhost:3001/api/license/activate-offline \
     -H "Content-Type: application/json" \
     -d '{"offlineData": "<base64-encoded-data>"}'
   ```

## Checking License Status

### Via Web Interface

1. Look at the sidebar - license info is displayed at the bottom
2. Click on license info for full details

### Via API

```bash
curl http://localhost:3001/api/license
```

Response:
```json
{
  "valid": true,
  "type": "professional",
  "holder": "Your Company",
  "email": "you@company.com",
  "expiresAt": "2025-12-31T23:59:59Z",
  "features": {
    "maxStacks": -1,
    "maxRegistries": -1,
    "offlineValidation": true,
    "prioritySupport": true,
    "customBranding": false,
    "userMigration": false
  }
}
```

## License Expiration

### What happens when a license expires?

1. **Grace Period (7 days)**
   - Full functionality continues
   - Warning displayed in UI
   - Email notification sent

2. **After Grace Period**
   - Cannot start new migrations
   - Existing migrations can complete
   - Read-only access to logs/reports

3. **Renewal**
   - Purchase renewal from portal
   - Enter new license key
   - Full access restored immediately

### Renewal Process

1. Purchase renewal before expiration
2. You'll receive a new license key
3. Activate the new key (old key deactivated)
4. Your data and settings are preserved

## License Transfer

### Transferring to New Server

1. **Deactivate on Old Server**
   ```bash
   curl -X POST http://old-server:3001/api/license/deactivate
   ```

2. **Activate on New Server**
   ```bash
   curl -X POST http://new-server:3001/api/license/activate \
     -H "Content-Type: application/json" \
     -d '{"licenseKey": "PM-XXXX-XXXX-XXXX-XXXX"}'
   ```

### Multiple Installations

- Standard/Professional: 1 active installation
- Enterprise: Contact support for multi-instance licensing

## Troubleshooting License Issues

### "Invalid License Key"

- Check for typos
- Ensure correct format (PM-XXXX-XXXX-XXXX-XXXX)
- Try with/without dashes

### "License Already Activated"

- Deactivate on the other server first
- Contact support if you don't have access

### "License Expired"

- Check expiration date
- Purchase renewal
- Apply new license key

### "Cannot Connect to License Server"

For online validation issues:

1. Check internet connectivity
2. Verify firewall rules (outbound HTTPS)
3. Try offline activation method

### "Feature Not Available"

- Check your license type
- Verify the feature is included
- Consider upgrading your license

## License FAQ

**Q: Can I use the same license on dev and prod?**
A: Standard licenses allow 1 installation. Use trial for dev, or get Enterprise for multiple instances.

**Q: What data is sent during validation?**
A: Only license key and machine ID. No migration data is transmitted.

**Q: Can I get a refund?**
A: Yes, within 30 days if you haven't completed a migration.

**Q: How do I upgrade my license?**
A: Contact support or visit the pricing page. Existing payment is credited.

**Q: Does the license include updates?**
A: Yes, all updates within the license period are included.

---

## Next Steps

After activating your license:

1. [Create your first migration](./first-migration.md)
