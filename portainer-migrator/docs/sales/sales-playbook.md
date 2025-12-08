# Sales Playbook

## Sales Process Overview

```
Discovery → Demo → Proposal → Close → Onboarding
   ↓         ↓        ↓         ↓         ↓
  Week 1   Week 2   Week 3   Week 4    Week 5
```

## Ideal Customer Profile (ICP)

### Primary ICP: DevOps Teams

**Demographics**:
- Company size: 10-500 employees
- Tech teams: 2-20 people
- Industry: SaaS, Tech, E-commerce

**Behavior**:
- Currently using Portainer CE/BE
- Evaluating or already using Dokploy
- Values automation and tooling
- Time-constrained

**Pain Points**:
- Manual migration is time-consuming
- Risk of configuration errors
- Limited migration documentation
- Downtime concerns

### Secondary ICP: Managed Service Providers

**Demographics**:
- Hosting companies
- DevOps consultancies
- Cloud service providers

**Behavior**:
- Managing multiple customer environments
- Need repeatable processes
- Value efficiency and documentation

## Discovery Questions

### Situation Questions

1. "Tell me about your current Portainer setup - how many stacks and environments?"
2. "What prompted you to consider moving to Dokploy?"
3. "What's your timeline for the migration?"
4. "Who else is involved in this decision?"

### Problem Questions

1. "Have you started planning the migration? What concerns do you have?"
2. "How much time have you estimated for the migration?"
3. "What would happen if configurations were lost during migration?"
4. "Have you done a migration like this before?"

### Implication Questions

1. "If the migration takes 2-3 weeks instead of days, how does that impact your team?"
2. "What's the cost of downtime if something goes wrong?"
3. "How would delayed migration affect your other projects?"

### Need-Payoff Questions

1. "Would it help if you could validate the migration before going live?"
2. "If you could complete the migration in hours instead of weeks, what would you do with that time?"
3. "Would having detailed logs and audit trails be valuable for your documentation?"

## Demo Script {#demo}

### Pre-Demo Preparation

1. Understand customer's environment size
2. Prepare similar demo environment
3. Test connection to demo Portainer
4. Prepare talking points

### Demo Flow (30 minutes)

**Opening (5 min)**:
- Acknowledge their situation
- Set expectations for demo
- Confirm time available

**Problem Statement (3 min)**:
- "Manual migration of [X] stacks would take [Y] hours"
- "Risk of errors and configuration loss"
- "No validation before going live"

**Solution Demo (15 min)**:

1. **Show Dashboard**
   - Clean interface
   - Easy to understand

2. **Create Migration**
   - Enter Portainer credentials
   - Test connection
   - Show discovered resources

3. **Run Analysis**
   - Demonstrate discovery
   - Show compatibility checking
   - Highlight any issues found

4. **Dry Run**
   - Explain risk mitigation
   - Show what would be migrated
   - No changes made yet

5. **Show Logs**
   - Detailed audit trail
   - Error tracking
   - Export capability

**Close Demo (7 min)**:
- Summarize benefits
- Address questions
- Discuss next steps

## ROI Calculation {#roi}

### ROI Formula

```
ROI = (Time Saved × Hourly Rate) - License Cost
                    License Cost
```

### Example Calculations

**Small Team (10 stacks)**:
```
Manual time: 6 hours × $100/hour = $600
Migrator: 0.5 hours × $100 + $99 = $149
Savings: $451 (ROI: 303%)
```

**Medium Team (50 stacks)**:
```
Manual time: 30 hours × $100/hour = $3,000
Migrator: 2 hours × $100 + $299 = $499
Savings: $2,501 (ROI: 501%)
```

**Large Team (200 stacks)**:
```
Manual time: 100 hours × $100/hour = $10,000
Migrator: 4 hours × $100 + $299 = $699
Savings: $9,301 (ROI: 1331%)
```

## Objection Handling {#objections}

### Price Objections

**"It's too expensive"**
> "I understand budget is a concern. Let me ask - how many hours would manual migration take? At $100/hour, even 10 hours of saved time pays for Professional. What's your current estimate?"

**"We can't justify the cost"**
> "What's the cost of a failed migration? Downtime, lost productivity, rebuilding from scratch? Portainer Migrator includes dry-run mode and validation to prevent those scenarios."

### Timing Objections

**"We're not ready yet"**
> "When are you planning the migration? Our trial gives you 14 days to evaluate. You could run analysis now to understand the scope, then migrate when ready."

**"We have other priorities"**
> "I understand. The beauty of automated migration is it doesn't consume team bandwidth. What if you could migrate in 2 hours instead of 2 weeks?"

### Technical Objections

**"We'll write our own script"**
> "That's definitely possible. How much development time do you estimate? Will you include validation? What about supporting edge cases? Portainer Migrator handles all of that, tested against thousands of configurations."

**"It won't work with our setup"**
> "What makes your setup unique? We support Portainer 2.15+ and various configurations. Would a trial help verify compatibility?"

### Trust Objections

**"We've never heard of you"**
> "We're focused on doing one thing extremely well - Portainer to Dokploy migration. Would customer references help? We can also do a technical deep-dive if that builds confidence."

## Closing Techniques

### Trial Close

"Based on what we discussed, it sounds like Professional would be the right fit. Would you like to start with the free trial to validate it works for your environment?"

### Urgency Close

"You mentioned wanting to complete migration by [date]. Given that timeline, should we get you set up this week so you have time for a dry run?"

### Summary Close

"So to summarize - you have [X] stacks to migrate, you want it done in [timeframe], and avoiding errors is important. Portainer Migrator addresses all three. What questions do you have before we move forward?"

## Post-Sale Onboarding

### Week 1: Setup
- Send license and documentation
- Schedule kickoff call
- Help with installation

### Week 2: Analysis
- Review discovered resources
- Address any compatibility issues
- Plan migration timeline

### Week 3: Migration
- Execute dry run
- Review results
- Perform actual migration

### Week 4: Verification
- Verify all resources migrated
- Address any issues
- Collect feedback/testimonial

## Metrics & Goals

### Sales Metrics

| Metric | Target |
|--------|--------|
| Demo → Trial | 60% |
| Trial → Paid | 30% |
| Average Deal Size | $200 |
| Sales Cycle | 2-4 weeks |

### Customer Success Metrics

| Metric | Target |
|--------|--------|
| Time to First Migration | < 7 days |
| Migration Success Rate | > 95% |
| NPS Score | > 50 |
| Renewal Rate | > 85% |
