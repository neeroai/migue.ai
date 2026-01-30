---
title: WhatsApp Compliance Research 2026
summary: Critical policy changes affecting AI chatbots on WhatsApp platform
description: Research findings on WhatsApp's October 2025 policy update banning general-purpose AI chatbots, with allowed use cases and compliance requirements
version: 1.0
date: 2026-01-28
updated: 2026-01-28
scope: compliance
---

# WhatsApp Compliance Research 2026

## Critical Finding

**Policy Change Effective**: January 15, 2026
**Source**: WhatsApp Terms of Service Update (October 2025)

## Banned Use Cases

| Use Case | Status | Impact |
|----------|--------|--------|
| General-purpose AI chatbots | BANNED | Cannot have open-ended conversations |
| Entertainment chatbots | BANNED | No games, trivia, jokes |
| News/weather bots | BANNED | Unless business-specific |
| Personal advice | BANNED | No health, legal, financial advice |

## Allowed Use Cases

| Use Case | Status | migue.ai Implementation |
|----------|--------|-------------------------|
| Appointment scheduling | ALLOWED | P0 feature - reminder system |
| Task management | ALLOWED | P1 feature - expense tracking |
| Calendar integration | ALLOWED | P1 feature - Google Calendar sync |
| Document processing | ALLOWED | P1 feature - receipt OCR |
| Business support workflows | ALLOWED | All features positioned as productivity |

## Compliance Strategy

### System Prompt Enforcement

```typescript
// Explicit rejection of general conversation
if (isGeneralChatbot(userMessage)) {
  return "Lo siento, solo puedo ayudarte con recordatorios, citas, tareas y gastos de tu negocio. ¿Necesitas algo de eso?";
}
```

### Product Positioning

**Positioning**: Business automation assistant (NOT general AI chatbot)
**Branding**: "Tu asistente de productividad para WhatsApp"
**Messaging**: Focus on appointment scheduling, reminders, expense tracking

### User Onboarding

First message must communicate scope:
```
Hola! Soy Migue, tu asistente de productividad.

Puedo ayudarte con:
• Recordatorios y citas
• Agenda de Google Calendar
• Seguimiento de gastos
• Reuniones con clientes

¿En qué te ayudo hoy?
```

## Rate Limits

| Tier | Daily Limit | Throughput | Qualification |
|------|-------------|------------|---------------|
| Tier 1 | 1,000 msg/day | 80/sec | New accounts |
| Tier 2 | 10,000 msg/day | 200/sec | Quality rating achieved |
| Tier 3 | 100,000 msg/day | 250/sec | Sustained usage |

## Quality Rating Metrics

| Metric | WhatsApp Requirement | migue.ai Target |
|--------|---------------------|-----------------|
| User blocks/reports | <0.5% | <0.1% |
| Message delivery rate | >95% | >98% |
| Template response rate | >10% | >25% |

## Template Messages

**Purpose**: Re-open 24h messaging window

**Approval Required**: Submit to WhatsApp Manager, 24-48h review

**Example Template**:
```
Name: window_reopen
Category: UTILITY
Language: Spanish (es)
Body: "Hola {{1}}! ¿Hay algo en lo que pueda ayudarte hoy?"
```

## 24-Hour Messaging Window

**Rule**: Can only send messages within 24h of user's last message
**Exception**: Pre-approved template messages

**Implementation**:
- Track `window_opened_at` on every user message
- Calculate `window_expires_at` (+24h)
- Send proactive template 2h before expiry
- Monitor window re-open success rate

## Risk Mitigation

| Risk | Probability | Mitigation |
|------|-------------|------------|
| Policy violation flagged | Low | Explicit use case focus, rejection of general queries |
| Quality rating drop | Medium | Monitor metrics daily, respond to user feedback quickly |
| Account suspension | Low | Multiple test accounts, gradual rollout |

## Sources

- **C1**: TechCrunch article (Oct 2025) - "WhatsApp changes its terms to bar general-purpose chatbots"
- **C2**: GMC Digital Guide (2026) - "Your simple guide to WhatsApp API compliance 2026"
- **C3**: Trengo Blog (2026) - "WhatsApp Business API Guide"
- **C4**: WhatsApp Developer Docs - Cloud API v23.0 specifications

## Verification Status

| Claim | Citation | Status |
|-------|----------|--------|
| General chatbots banned Jan 15, 2026 | C1 | VERIFIED |
| Appointment scheduling allowed | C2, C4 | VERIFIED |
| 24h messaging window rule | C4 | VERIFIED |
| Rate limits by tier | C4 | VERIFIED |
| Template approval required | C3, C4 | VERIFIED |

## Recommendations

1. **Position as business tool from day 1** - Never market as general AI assistant
2. **Monitor quality metrics weekly** - Set up automated dashboards
3. **Test template approval process early** - Submit templates during Phase 1
4. **Have backup channels ready** - Telegram, SMS fallback if WhatsApp account suspended
5. **Document all compliance measures** - For WhatsApp review if flagged

---

**Next Steps**: Implement compliance checks in system prompt (Phase 1)
