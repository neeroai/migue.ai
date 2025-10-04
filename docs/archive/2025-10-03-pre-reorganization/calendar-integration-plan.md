# Google Calendar Integration Plan

## Context
The assistant already identifies `schedule_meeting` intent but only replies conversationally. Users expect migue.ai to capture the event, reserve a slot against their Google Calendar, and confirm back over WhatsApp while respecting the CSW latency target (≤2 s).

## Requirements
- Authenticate per-user access via stored OAuth refresh tokens.
- Summarise natural-language requests into structured events (title, start, end, attendees).
- Create events on the primary Google Calendar and acknowledge the booking.
- Handle failures gracefully (token expiry, slot conflicts) and capture audit logs in Supabase.

## Options Considered
1. **LLM-only confirmation (no API calls)**
   - *Pros:* No external dependencies; fastest to ship.
   - *Cons:* Does not actually book events, fails business objective.
   - *Risks:* User trust loss due to "ghost" confirmations.

2. **Direct Google Calendar calls from webhook handler**
   - *Pros:* Minimal indirection; straightforward data flow.
   - *Cons:* Webhook becomes heavier (>50 LOC), harder to test, token refresh duplicated.
   - *Risks:* Latency spikes risk WhatsApp timeouts; difficult to reuse for cron jobs.

3. **Dedicated scheduling service module with token management**
   - *Pros:* Encapsulates Google API logic, shareable for future features, keeps handler slim.
   - *Cons:* Requires new modules and tests; small upfront investment.
   - *Risks:* Must ensure module stays Edge-compatible (no Node-only libs).

**Chosen Approach:** Option 3 – add `lib/google-calendar.ts` for token refresh + API operations and `lib/scheduling.ts` for LLM parsing + orchestration. Webhook delegates scheduling intent to this module to maintain clean separation and keep latency predictable.

## Deliverables
- Supabase schema update for `calendar_credentials` and `calendar_events` audit.
- Modules: `lib/google-calendar.ts`, `lib/scheduling.ts`.
- Webhook update to execute scheduling flow before crafting WhatsApp response.
- Jest unit tests covering parsing, Google API client, and handler path.
- Documentation (`docs/calendar-integration.md`) with setup/testing instructions.

## Open Questions
- Do we need attendee support beyond the requesting user in Phase 2?
- Which timezone should default when parsing messages without explicit offset? (Current assumption: user locale stored in preferences.)
- Should cancellations trigger via WhatsApp keyword or separate endpoint?
