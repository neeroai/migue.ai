---
title: "ADR-001: Target Market - Consumer vs B2B Focus"
summary: "Decision to target individual consumers and solo entrepreneurs (LATAM) for personal productivity, not B2B customer service automation"
description: "Strategic decision record outlining rationale for focusing on consumer personal assistant market (underserved, 77% AI adoption, >90% WhatsApp penetration) versus B2B customer service automation (saturated, 60% of competitors). Includes market analysis, competitive landscape, risks, and success criteria."
version: "1.0"
date: "2026-01-28"
updated: "2026-01-28"
scope: "strategic"
status: "Accepted"
---

# ADR-001: Target Market - Consumer vs B2B Focus

## Status

**Accepted** (2026-01-28)

## Context

The WhatsApp AI assistant market is divided into two primary segments:

1. **B2B Customer Service Automation** (60% of market)
   - Focus: Businesses automating customer support
   - Pricing: $50-500/mo per business
   - Competition: WATI, Respond.io, Chatfuel, ManyChat, Tidio
   - Features: Multi-user teams, CRM integration, ticketing

2. **Consumer Personal Productivity** (<10% of market)
   - Focus: Individuals managing personal tasks (calendar, reminders, notes)
   - Pricing: $0-30/mo per individual
   - Competition: Meta AI (generic, no productivity features)
   - Features: Voice transcription, calendar integration, smart reminders

**Market Research Findings**:
- LATAM AI market: $5.79B → $34.62B (2034) at 22% CAGR
- WhatsApp penetration: >90% in Brazil, Mexico, Argentina
- Consumer AI adoption: 77% already use AI, 52% expect mass adoption 2026
- Personal productivity segment: Severely underserved (<10% of implementations)
- B2B customer service: Saturated (15+ major competitors)

**Key Question**: Should migue.ai target B2B customer service (established market) or consumer personal productivity (underserved market)?

## Decision

**Target consumer personal productivity market** (individual consumers + solo entrepreneurs in LATAM).

**Primary Segment**:
- Individual consumers (personal assistant for daily tasks)
- Solo entrepreneurs / freelancers (productivity + light business use)
- Geographic focus: LATAM (Brazil, Mexico, Argentina, Colombia, Chile, Peru)

**NOT targeting** (Phase 1):
- SMB customer service automation
- Enterprise contact centers
- Marketing automation (lead generation)
- E-commerce chatbots

## Rationale

### 1. Market Opportunity (Consumer > B2B)

| Factor | Consumer | B2B |
|--------|----------|-----|
| **Market Saturation** | LOW (<10% focus) | HIGH (60%+ competitors) |
| **Addressable Market** | 200M potential users (LATAM WhatsApp × AI adoption) | 10-20M SMBs |
| **Growth Rate** | 33.9% CAGR (personal AI assistants) | 23.4% CAGR (conversational AI) |
| **Competition** | Meta AI only (generic, no features) | 15+ major players (WATI, Respond.io, etc.) |
| **Pricing Power** | $0-30/mo (freemium) | $50-500/mo (competitive pressure) |

**Verdict**: Consumer market less saturated, higher growth rate, larger addressable market.

### 2. Competitive Advantage (Consumer Focus)

**migue.ai Strengths**:
- ✅ Voice-first UX (underutilized in B2B tools, <20% adoption)
- ✅ LATAM Spanish excellence (B2B tools weak or English-first)
- ✅ Personal productivity features (calendar, reminders - not B2B focus)
- ✅ Consumer pricing ($0-30/mo vs B2B $50-500/mo)
- ✅ Simple onboarding (conversational vs complex B2B setup)

**B2B Requirements We Lack**:
- ❌ Multi-user team features (not needed for individuals)
- ❌ CRM integrations (Salesforce, HubSpot - not relevant)
- ❌ Advanced ticketing (customer service focus)
- ❌ Enterprise security (SSO, compliance)

**Verdict**: Our strengths align with consumer needs, not B2B requirements.

### 3. Team Capabilities (ClaudeCode&OnlyMe)

**2-Person Team Strengths**:
- ✅ AI/LLM expertise (OpenAI, Claude APIs)
- ✅ WhatsApp Business API integration
- ✅ Consumer product design (simple, intuitive)
- ✅ LATAM market knowledge (Spanish/Portuguese)

**2-Person Team Limitations**:
- ❌ Enterprise sales (requires sales team)
- ❌ Complex integrations (CRM, ticketing, ERP)
- ❌ Multi-tenant architecture (B2B requires isolation)
- ❌ 24/7 support (enterprise SLA expectations)

**Verdict**: Consumer market better fit for 2-person team (self-service, simple product, viral growth).

### 4. Business Model Viability

**Consumer Model**:
- Freemium ($0/$5/$12/$29)
- Viral growth (referrals, WhatsApp status)
- Low CAC ($15-25 blended via organic + paid)
- LTV: $150 (18-month avg lifespan)
- LTV/CAC: 6:1 (healthy)
- Unit economics: 75-95% gross margins

**B2B Model** (Hypothetical):
- Subscription ($50-500/mo)
- Sales-driven growth (high-touch)
- High CAC ($500-2,000 per business)
- LTV: $3,000-18,000 (3-year contract)
- LTV/CAC: 6:1 (similar)
- Unit economics: 70-85% gross margins

**Verdict**: Consumer model achievable with 2-person team (no sales team), similar unit economics, faster product iteration.

### 5. WhatsApp 2026 Compliance

**Meta's AI Policy** (January 2026):
- Open-ended chatbots (like ChatGPT integration) **BANNED**
- Only "business automation flows with clear, predictable results" allowed

**Consumer Productivity Compliance**:
- ✅ Structured intents (create_reminder, add_event, save_note)
- ✅ Task-specific automation (predictable results)
- ✅ WhatsApp Flows (predefined workflows)
- ✅ Compliant with 2026 policy

**B2B Customer Service Compliance**:
- ⚠️ Often requires open-ended chat (customer questions vary)
- ⚠️ Higher risk of policy violations (generic chatbot behavior)

**Verdict**: Consumer productivity easier to comply with WhatsApp 2026 policy (structured automation).

## Consequences

### Positive

1. **Market Opportunity**: Target underserved market (<10% focus) vs saturated B2B (60%+)
2. **Competitive Positioning**: Differentiate on consumer features (voice, calendar, LATAM Spanish) vs B2B (customer service)
3. **Team Fit**: Align with 2-person team capabilities (no enterprise sales, self-service growth)
4. **Compliance**: Easier WhatsApp 2026 policy compliance (structured intents vs open chat)
5. **Unit Economics**: Excellent margins (75-95%), low CAC ($15-25), strong LTV/CAC (6:1)
6. **Viral Growth**: Referral potential (personal recommendations, WhatsApp status)

### Negative

1. **Lower ARPU**: Consumer pricing ($5-29/mo) vs B2B ($50-500/mo)
2. **Higher Churn**: Consumers churn faster than businesses (5%/mo vs 2%/mo)
3. **Conversion Risk**: Freemium requires strong conversion (10-15% target vs 2-5% typical)
4. **Meta AI Competition**: Free built-in assistant (distribution advantage)
5. **Market Education**: Consumers may not understand "AI assistant" value yet
6. **Payment Challenges**: LATAM credit card penetration lower (45-60% vs 80%+ in US/EU)

### Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Low consumer adoption** | MEDIUM | HIGH | Strong onboarding, clear value prop, 7-day trial |
| **Meta AI adds features** | HIGH | CRITICAL | Move fast, build moats (voice quality, memory, LATAM Spanish) |
| **Low paid conversion** | MEDIUM | HIGH | Free tier limits designed to convert, compelling premium features |
| **High churn** | MEDIUM | MEDIUM | Engagement loop (weekly summaries, reminders), retention focus |
| **Payment friction** | MEDIUM | MEDIUM | Pix (Brazil), OXXO (Mexico), local payment methods |

## Success Criteria

**Phase 1 (Q1 2026) - 100 Beta Users**:
- ✅ 100 users signed up (Brazil)
- ✅ 50%+ Day 7 retention
- ✅ 10-15% free → paid conversion (trial)
- ✅ NPS >40

**Phase 2 (Q2 2026) - 10,000 Users**:
- ✅ 10,000 total users (Brazil + Mexico/Argentina)
- ✅ 1,000-1,500 paid users (10-15% conversion)
- ✅ $10-15K MRR
- ✅ <$25 blended CAC
- ✅ NPS >40

**Year 1 (EOY 2026) - 100,000 Users**:
- ✅ 100,000 total users (5 countries)
- ✅ 30,000 paid users (30% conversion)
- ✅ $254K MRR (~$3M ARR)
- ✅ <$25 CAC, 6:1 LTV/CAC
- ✅ NPS >50

**Failure Criteria** (Trigger Re-Evaluation):
- ❌ <20% Day 7 retention (low engagement)
- ❌ <5% free → paid conversion (weak value prop)
- ❌ >$50 CAC (unsustainable unit economics)
- ❌ NPS <20 (poor product-market fit)

## Alternatives Considered

### Alternative 1: B2B Customer Service Focus

**Pros**:
- Higher ARPU ($50-500/mo)
- Lower churn (2-3%/mo)
- Proven market (15+ competitors validate demand)
- Easier payment collection (invoicing, annual contracts)

**Cons**:
- Saturated market (60%+ of competitors)
- Requires enterprise features (multi-user, CRM, ticketing)
- High-touch sales (2-person team limitation)
- WhatsApp 2026 compliance risk (open chat requirements)

**Decision**: Rejected (saturated market, not aligned with 2-person team)

### Alternative 2: Multi-Segment (Consumer + B2B)

**Pros**:
- Diversified revenue (consumer + business)
- Cross-sell opportunities (individual → team upgrade)

**Cons**:
- Split focus (two different product experiences)
- Resource constraints (2-person team can't serve both well)
- Confused positioning (personal assistant OR business tool?)
- Higher complexity (multi-tenant, permissions, billing)

**Decision**: Rejected (focus critical for 2-person team, avoid split attention)

### Alternative 3: Solo Entrepreneurs ONLY

**Pros**:
- Higher willingness to pay ($10-30/mo vs $5-15/mo consumers)
- Business use cases (light CRM, client follow-ups)
- Lower churn (income-generating tool)

**Cons**:
- Smaller market (10-20M LATAM vs 200M consumers)
- Requires business features (invoicing, client management)
- Still competes with B2B tools (WATI, Respond.io)

**Decision**: Rejected as PRIMARY focus (included as secondary segment within consumer target)

## References

- Market Analysis: `docs/research/market-analysis-latam.md`
- Competitive Landscape: `docs/research/competitive-landscape.md`
- Strategic Plan: `.claude/plan.md` (Part 1-2)

## Authors

- ClaudeCode&OnlyMe

## Decision Log

| Date | Action | Rationale |
|------|--------|-----------|
| 2026-01-28 | Accepted | Market research validates underserved consumer segment, aligns with 2-person team capabilities, superior competitive positioning |

---

**Document Version**: 1.0
**Last Updated**: 2026-01-28
**Status**: Accepted
**Next Review**: 2026-04-28 (3 months post-launch, validate with user data)
