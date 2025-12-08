# Competitive Analysis

## Market Overview

### The Problem Space

Organizations migrating from Portainer to Dokploy currently have limited options:

1. **Manual Migration**: Time-consuming and error-prone
2. **Custom Scripts**: Requires development effort
3. **Portainer Migrator**: Automated, validated, supported

### Why Customers Leave Portainer

| Reason | Percentage |
|--------|------------|
| Pricing (BE) | 35% |
| Feature limitations (CE) | 25% |
| UX/UI preferences | 20% |
| Integration needs | 15% |
| Support issues | 5% |

## Competitive Landscape {#comparison}

### Direct Competitors

**None** - Portainer Migrator is currently the only commercial solution for Portainer to Dokploy migration.

### Alternative Solutions

| Solution | Cost | Time | Risk | Support |
|----------|------|------|------|---------|
| **Portainer Migrator** | $99-299/yr | Hours | Low | Yes |
| **Manual Migration** | $0 | Days-Weeks | High | No |
| **Custom Scripts** | Dev Time | Days | Medium | Self |
| **Consultant** | $1000+ | Days | Medium | Limited |

### Detailed Comparison

#### Manual Migration

**Pros**:
- No upfront cost
- Full control

**Cons**:
- Very time-consuming (30+ min per stack)
- High error rate
- No validation
- No audit trail
- Requires deep knowledge of both platforms

**When to use**: Very small setups (< 5 stacks)

#### Custom Scripts

**Pros**:
- Customizable
- One-time development

**Cons**:
- Development time required
- Maintenance burden
- No support
- Testing/validation needed

**When to use**: Large organizations with unique requirements

#### Consultant/Contractor

**Pros**:
- Expert knowledge
- Hands-off migration

**Cons**:
- Expensive ($100-200/hour)
- Scheduling constraints
- Knowledge leaves with consultant
- No tooling for future migrations

**When to use**: Very complex environments, no internal expertise

#### Portainer Migrator

**Pros**:
- Automated and validated
- Fast (hours not days)
- Dry-run mode reduces risk
- Professional support
- Audit trail and reporting
- Reusable for future needs

**Cons**:
- License cost
- Requires internet (offline available)

**When to use**: Any migration > 5 stacks

## Portainer Migrator Advantages

### 1. Speed

| Method | 50 Stacks |
|--------|-----------|
| Manual | 20-40 hours |
| Scripts | 8-16 hours dev + 2 hours run |
| Consultant | 16-24 hours |
| **Migrator** | **1-2 hours** |

### 2. Reliability

| Method | Error Rate |
|--------|------------|
| Manual | 25-35% |
| Scripts | 10-20% |
| Consultant | 5-15% |
| **Migrator** | **< 5%** |

### 3. Total Cost of Ownership

**50-Stack Migration Example**:

| Method | Direct Cost | Time Cost | Total |
|--------|-------------|-----------|-------|
| Manual | $0 | $3,000 | $3,000 |
| Scripts | $0 | $1,500 | $1,500 |
| Consultant | $2,000 | $500 | $2,500 |
| **Migrator** | $299 | $200 | **$499** |

### 4. Risk Mitigation

- **Dry-run mode**: Validate before execution
- **Rollback capability**: Issues can be reversed
- **Detailed logging**: Full audit trail
- **Support**: Help when things go wrong

## Objection Handling

### "It's free to do manually"

*Response*: "Your time isn't free. At $100/hour, a 20-hour migration costs $2,000. Plus the risk of errors causing downtime. Portainer Migrator pays for itself in the first migration."

### "We can write a script"

*Response*: "Custom scripts require development, testing, and maintenance. They also lack validation and support. Portainer Migrator is ready now, tested, and supported."

### "It's just copying files"

*Response*: "Migration involves API format differences, data transformation, environment mapping, and validation. Portainer Migrator handles all of this automatically."

### "We'll hire someone"

*Response*: "Consultants charge $100-200/hour. A typical migration takes 16+ hours = $1,600-3,200. Plus they leave no tooling for future migrations."

## Win/Loss Analysis

### Common Win Scenarios

1. **Time-constrained migrations**: Customer has a deadline
2. **Large environments**: Manual isn't feasible
3. **Risk-averse organizations**: Need validation and support
4. **Repeat migrations**: Multiple Portainer instances

### Common Loss Scenarios

1. **Very small environments**: < 5 stacks, manual is acceptable
2. **Budget-constrained**: Can't justify any cost
3. **Unique requirements**: Need custom transformation

## Competitive Intelligence Sources

Monitor these for market changes:
- Portainer release notes
- Dokploy updates
- Docker ecosystem news
- DevOps forums (Reddit, HN)
