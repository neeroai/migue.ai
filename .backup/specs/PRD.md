---
title: migue.ai Product Requirements Document
version: 1.0
date: 2026-01-28
updated: 2026-01-28
status: approved
scope: Product definition and technical specification
---

# migue.ai - Product Requirements Document

## 1. Executive Summary

### Vision
migue.ai is a WhatsApp-based business automation assistant designed for LATAM independent professionals. It provides appointment scheduling, task management, calendar integration, and document processing through natural conversations in Spanish.

### Key Differentiators
- **WhatsApp-native**: No app downloads, works where users already communicate
- **Spanish-first**: Natural language understanding optimized for LATAM Spanish
- **Multi-provider AI**: Automatic failover between OpenAI and Claude for reliability
- **Privacy-focused**: Data stored in user's region, transparent AI usage
- **Cost-optimized**: $0.15-$0.60 per 1M tokens vs competitors at $5-$10

### Compliance Statement
**WhatsApp Policy Compliant (Jan 2026)**: migue.ai is explicitly designed as a business automation tool, NOT a general-purpose AI chatbot. All features focus on appointment scheduling, task management, calendar integration, and document processing - in full compliance with WhatsApp's October 2025 policy update.

### Target Launch
Q2 2026 (12-week development cycle)

---

## 2. Problem Statement

### Market Context
**LATAM Reality**:
- 98% WhatsApp penetration among smartphone users
- 78% of independent professionals lack productivity tools
- $120B/year lost to scheduling inefficiencies in LATAM
- Average 12 hours/week spent on manual task coordination

### User Pain Points

| Pain Point | Impact | Current Solution | Gap |
|------------|--------|------------------|-----|
| Missed appointments | 30% revenue loss | Paper calendar, memory | No automated reminders |
| Calendar chaos | 8 hrs/week wasted | Multiple apps, spreadsheets | No unified system |
| Client communication | 15+ hrs/week | Manual WhatsApp messages | No automation |
| Expense tracking | Tax compliance issues | Receipts in shoebox | No digital record |
| Meeting scheduling | 3-5 message exchanges per meeting | Back-and-forth texts | No availability sharing |

### Why WhatsApp?
- **No friction**: Users already check WhatsApp 23 times/day (avg)
- **No training**: Natural conversation interface
- **Universal access**: Works on $50 smartphones
- **Trust**: More trusted than new apps (78% vs 34% adoption rate)

---

## 3. Target Users

### Primary Persona: Independent Professional

**Profile**:
- Age: 28-45
- Location: Colombia, Mexico, Argentina, Chile
- Role: Freelancer, consultant, service provider
- Income: $500-$3,000/month
- Tech: Smartphone-first, limited desktop use

**Behaviors**:
- Manages 10-50 clients simultaneously
- Schedules 5-15 appointments/week
- Uses WhatsApp for 80% of business communication
- Struggles with time management and follow-ups
- Prefers Spanish, informal communication

**Goals**:
- Never miss client appointments
- Reduce scheduling back-and-forth
- Track business expenses for taxes
- Appear professional despite being solo
- Spend more time on billable work

### Secondary Persona: Sales Professional

**Profile**:
- Age: 25-40
- Role: Real estate, insurance, B2B sales
- Income: Commission-based, $800-$5,000/month
- Team: Solo or small team (2-5 people)

**Behaviors**:
- 20-40 client meetings/week
- Needs quick expense logging (gas, meals, materials)
- Uses voice messages heavily (driving, between meetings)
- Relies on reminders for follow-ups
- Manages pipeline manually or in spreadsheets

---

## 4. Core Features

### P0 Features (Launch Critical)

#### 4.1 Natural Language Reminders

**User Story**: "As a freelancer, I want to say 'Recuérdame llamar a María mañana a las 3pm' and get a reminder, so I never miss follow-ups."

**Acceptance Criteria**:
- Parse Spanish natural language date/time
- Handle relative times ("en 2 horas", "mañana", "próximo lunes")
- Support recurring reminders ("cada lunes a las 9am")
- Send reminder message 5 min before scheduled time
- Allow snooze (5min, 15min, 1hr) via interactive buttons
- Confirm creation with summary message

**Technical Approach**:
```
User message → OpenAI function call (parse_reminder) → Zod validation →
Supabase insert → Cron job checks every 1 min → Send reminder via WhatsApp
```

**Data Flow**:
- Table: `scheduled_messages`
- Fields: `user_phone`, `scheduled_for`, `message_text`, `status`, `recurring_pattern`
- Index: `idx_scheduled_messages_pending` on `(status, scheduled_for)`

#### 4.2 Text Message Processing

**User Story**: "As a user, I want to ask 'Qué reuniones tengo hoy?' and get immediate answers."

**Acceptance Criteria**:
- Respond to queries in <3 seconds
- Maintain conversation context (last 10 messages)
- Handle greetings, questions, commands
- Gracefully handle unsupported requests
- Return helpful error messages

**Technical Approach**:
```
Webhook receives message → Fire-and-forget 200 response →
Background: Validate signature → Load context → AI processing →
Send response via WhatsApp API
```

**Message Types Supported**:
- Text: Standard queries
- Interactive responses: Button clicks, list selections
- Unknown types: Graceful degradation

#### 4.3 Interactive Buttons

**User Story**: "As a user, I want to click 'Sí' or 'No' instead of typing, for faster interactions."

**Acceptance Criteria**:
- Max 3 buttons per message
- Button text max 20 characters
- Handle button click responses
- Maintain conversation flow

**Technical Approach**:
```typescript
// lib/message-builders/buttons.ts
buildButtonMessage({
  body: "¿Confirmas la reunión para mañana a las 3pm?",
  buttons: [
    { id: "confirm_yes", title: "Sí, confirmo" },
    { id: "confirm_no", title: "No, cancelar" },
    { id: "confirm_reschedule", title: "Cambiar hora" }
  ]
})
```

#### 4.4 Interactive Lists

**User Story**: "As a user, I want to select from options (expense categories, meeting times) without typing."

**Acceptance Criteria**:
- Max 10 list items per message
- Support sections (grouped options)
- Handle list selection responses
- Provide clear visual hierarchy

**Technical Approach**:
```typescript
// lib/message-builders/lists.ts
buildListMessage({
  body: "Selecciona la categoría del gasto:",
  buttonText: "Ver categorías",
  sections: [
    {
      title: "Comunes",
      rows: [
        { id: "transport", title: "Transporte", description: "Taxi, gasolina" },
        { id: "food", title: "Alimentación", description: "Comidas con clientes" }
      ]
    }
  ]
})
```

#### 4.5 24-Hour Messaging Window Management

**User Story**: "As the system, I must track WhatsApp's 24h window to ensure message delivery."

**Acceptance Criteria**:
- Track `window_opened_at` for each user
- Calculate `window_expires_at` (24h from last user message)
- Warn when window is about to expire (2h before)
- Provide template message for re-opening window
- Handle window expiry gracefully

**Technical Approach**:
```
User sends message → Update window_opened_at → Set window_expires_at (+24h) →
Cron job checks expiring windows → Send proactive template 2h before →
User responds → Window reopens
```

**Data Model**:
```sql
ALTER TABLE users ADD COLUMN window_opened_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN window_expires_at TIMESTAMPTZ;
CREATE INDEX idx_users_window_expiry ON users(window_expires_at);
```

---

### P1 Features (Core Value)

#### 4.6 Google Calendar Integration

**User Story**: "As a professional, I want migue.ai to add meetings to my Google Calendar automatically."

**Acceptance Criteria**:
- OAuth flow for Google Calendar access
- Create calendar events from natural language
- Read availability for scheduling
- Send calendar invites to participants
- Sync recurring appointments
- Handle token refresh automatically

**Technical Approach**:
```
User: "Agenda reunión con Juan el viernes a las 4pm"
→ AI extracts: name=Juan, date=Friday, time=4pm
→ Check calendar availability
→ Create event
→ Confirm with user
```

**Data Model**:
```sql
CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  provider TEXT, -- 'google'
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ
);
```

#### 4.7 Meeting Scheduling

**User Story**: "As a consultant, I want to share my availability and let clients book slots."

**Acceptance Criteria**:
- Define availability windows (e.g., "Lunes-Viernes 9am-6pm")
- Generate shareable booking links
- Allow clients to self-book via interactive list
- Send confirmations to both parties
- Handle time zones (LATAM focus: COT, CST, ART, CLT)

**Technical Approach**:
```
schedule_meeting tool:
- Input: duration, available_slots, client_name
- Output: Interactive list with time options
- On selection: Create calendar event + Send confirmations
```

#### 4.8 Voice Message Transcription

**User Story**: "As a sales rep on the road, I want to send voice messages and have them transcribed for processing."

**Acceptance Criteria**:
- Accept WhatsApp audio messages
- Transcribe using OpenAI Whisper
- Process transcription as text input
- Respond in text format
- Handle poor audio quality gracefully

**Technical Approach**:
```
WhatsApp audio webhook → Download audio file →
OpenAI Whisper API → Transcribed text →
Process as normal text message
```

**Cost**: ~$0.006 per minute of audio

#### 4.9 Expense Tracking

**User Story**: "As a freelancer, I want to log expenses by saying 'Gasté $50 en taxi' and have them saved for tax time."

**Acceptance Criteria**:
- Parse amount, category, description from natural language
- Support multiple currencies (COP, MXN, ARS, CLP, USD)
- Allow attaching receipt photos
- Generate monthly expense reports
- Export to CSV/PDF

**Technical Approach**:
```
track_expense tool:
- Input: amount, currency, category, description, date
- Validation: Zod schema
- Storage: expenses table
- Output: Confirmation message with running total
```

**Data Model**:
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  amount DECIMAL(10,2),
  currency TEXT,
  category TEXT,
  description TEXT,
  receipt_url TEXT,
  expense_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.10 Window Maintenance Automation

**User Story**: "As the system, I must proactively keep messaging windows open for active users."

**Acceptance Criteria**:
- Identify users with windows expiring in <2 hours
- Send template message to re-open window
- Track window re-open success rate
- Avoid spam (max 1 proactive message/day)

**Technical Approach**:
```
Cron job (every 30 min):
- Query users WHERE window_expires_at < NOW() + INTERVAL '2 hours'
- Send template: "Hola! ¿Hay algo en lo que pueda ayudarte?"
- Update window_opened_at on user response
```

---

### P2 Features (Future)

| Feature | Description | Timeline |
|---------|-------------|----------|
| Multi-user workspaces | Share calendar/tasks with team | Q3 2026 |
| CRM integration | Sync with HubSpot, Pipedrive | Q3 2026 |
| Payment links | Generate payment requests via WhatsApp | Q4 2026 |
| Analytics dashboard | Usage stats, productivity insights | Q4 2026 |
| Custom workflows | User-defined automation rules | 2027 |

---

## 5. Technical Architecture

### 5.1 Runtime Environment

**Choice**: Vercel Edge Functions
**Rationale**:
- Global CDN: <100ms latency for LATAM users
- Auto-scaling: Handle 0-10K req/sec
- Cost: $0.65/million requests (cheaper than AWS Lambda)
- Built-in observability

**Constraints**:
- No Node.js APIs (use Web APIs)
- Max 1MB response size
- Max 30s execution time (use background tasks for longer operations)

### 5.2 Database

**Choice**: Supabase PostgreSQL 15.8
**Rationale**:
- Row-Level Security (RLS) built-in
- pgvector for semantic search (future: conversational memory)
- Realtime subscriptions for live updates
- Auto-generated REST API
- LATAM region available (São Paulo)

**Schema Overview**: 17 tables (see Section 6)

### 5.3 AI Provider Strategy

**Primary**: OpenAI GPT-4o-mini
- Cost: $0.15 input / $0.60 output per 1M tokens
- Speed: ~500ms average response
- Quality: Sufficient for Spanish NLP

**Fallback**: Claude 3.5 Sonnet
- Cost: $3.00 input / $15.00 output per 1M tokens
- Speed: ~800ms average response
- Trigger: OpenAI rate limit or downtime

**Auto-Failover Logic**:
```typescript
async function callAI(messages) {
  try {
    return await openai.chat(messages);
  } catch (error) {
    if (error.code === 'rate_limit_exceeded') {
      console.warn('OpenAI rate limit, falling back to Claude');
      return await claude.chat(messages);
    }
    throw error;
  }
}
```

**Cost Tracking**: Log every AI call to `ai_usage_logs` table with provider, tokens, cost.

### 5.4 Message Queue

**Choice**: Supabase + Vercel Cron
**Rationale**:
- Simple: No Redis/RabbitMQ infrastructure
- Reliable: PostgreSQL ACID guarantees
- Cheap: No additional service cost

**Pattern**:
```sql
CREATE TABLE message_queue (
  id UUID PRIMARY KEY,
  user_phone TEXT,
  message_type TEXT,
  payload JSONB,
  status TEXT, -- 'pending', 'processing', 'completed', 'failed'
  retry_count INT DEFAULT 0,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Cron Job** (every 1 min):
- Query `message_queue WHERE status='pending' AND scheduled_for <= NOW()`
- Process messages
- Update status
- Retry failed messages (max 3 attempts)

### 5.5 Webhook Architecture

**Pattern**: Fire-and-Forget
**Rationale**:
- WhatsApp retries if no 200 response within 5 seconds
- Prevents duplicate processing
- Allows async AI processing (>5s)

**Flow**:
```
1. Webhook receives POST
2. Validate signature (HMAC SHA-256)
3. Return 200 OK immediately
4. Background: Process message asynchronously
5. Send response via WhatsApp Cloud API
```

**Implementation**:
```typescript
// app/api/whatsapp/webhook/route.ts
export async function POST(req: Request) {
  const signature = req.headers.get('x-hub-signature-256');
  const body = await req.text();

  // Validate signature
  if (!validateSignature(body, signature)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Fire and forget - process in background
  processWebhookAsync(JSON.parse(body));

  return new Response('OK', { status: 200 });
}
```

### 5.6 Package Manager

**Choice**: Bun 1.3.5
**Rationale**:
- 3-4x faster than npm/pnpm
- Native TypeScript support
- Compatible with existing Node.js ecosystem
- Already configured in project

---

## 6. Data Model

### 6.1 Core Tables

#### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL, -- E.164 format: +57312345678
  name TEXT,
  language TEXT DEFAULT 'es',
  timezone TEXT DEFAULT 'America/Bogota',
  window_opened_at TIMESTAMPTZ,
  window_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_window_expiry ON users(window_expires_at);
```

#### messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT, -- 'text', 'audio', 'button', 'list', 'interactive'
  content JSONB, -- Flexible schema for different message types
  whatsapp_message_id TEXT,
  status TEXT, -- 'sent', 'delivered', 'read', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

#### scheduled_messages
```sql
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  message_text TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  recurring_pattern TEXT, -- 'daily', 'weekly', 'monthly', cron format
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'cancelled'
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_messages_pending
  ON scheduled_messages(status, scheduled_for)
  WHERE status = 'pending';
```

#### expenses
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL, -- 'COP', 'MXN', 'ARS', 'CLP', 'USD'
  category TEXT, -- 'transport', 'food', 'materials', 'other'
  description TEXT,
  receipt_url TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
```

#### calendar_connections
```sql
CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  provider TEXT NOT NULL, -- 'google'
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT, -- OAuth scopes granted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_connections_user_id ON calendar_connections(user_id);
```

### 6.2 AI & Cost Tracking

#### ai_usage_logs
```sql
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  provider TEXT NOT NULL, -- 'openai', 'claude'
  model TEXT NOT NULL, -- 'gpt-4o-mini', 'claude-3-5-sonnet'
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  cost_usd DECIMAL(10,6), -- Calculated based on provider pricing
  request_type TEXT, -- 'chat', 'transcription', 'embedding'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
```

### 6.3 Message Queue

#### message_queue
```sql
CREATE TABLE message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL,
  message_type TEXT NOT NULL, -- 'text', 'button', 'list', 'template'
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_queue_pending
  ON message_queue(status, scheduled_for)
  WHERE status = 'pending';
```

### 6.4 Row-Level Security (RLS)

**Policy**: Users can only access their own data

```sql
-- Enable RLS on all user-specific tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Example policy for messages table
CREATE POLICY "Users can view their own messages"
  ON messages FOR SELECT
  USING (user_id = auth.uid());

-- Service role bypass (for backend operations)
CREATE POLICY "Service role has full access"
  ON messages FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

---

## 7. API Design

### 7.1 WhatsApp Webhook Endpoint

**Endpoint**: `POST /api/whatsapp/webhook`

**Headers**:
```
x-hub-signature-256: sha256=<HMAC>
Content-Type: application/json
```

**Request Body** (WhatsApp v23.0 format):
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "573001234567",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": {
            "name": "Juan Pérez"
          },
          "wa_id": "573001234567"
        }],
        "messages": [{
          "from": "573001234567",
          "id": "wamid.ABC123",
          "timestamp": "1706400000",
          "type": "text",
          "text": {
            "body": "Recuérdame llamar a María mañana a las 3pm"
          }
        }]
      }
    }]
  }]
}
```

**Response**: `200 OK` (immediately, before processing)

**Processing Flow**:
1. Validate HMAC signature
2. Extract message type and content
3. Load user context (last 10 messages)
4. Call AI provider with function calling
5. Execute tool if requested (schedule_reminder, track_expense, etc.)
6. Send response via WhatsApp Cloud API

### 7.2 WhatsApp Verification Endpoint

**Endpoint**: `GET /api/whatsapp/webhook`

**Query Parameters**:
```
hub.mode=subscribe
hub.challenge=CHALLENGE_STRING
hub.verify_token=YOUR_VERIFY_TOKEN
```

**Response**: `200 OK` with `hub.challenge` in body

### 7.3 Outbound Message API

**Internal**: `/api/whatsapp/send`

**Request**:
```typescript
{
  to: string; // E.164 format
  type: 'text' | 'button' | 'list' | 'template';
  content: {
    // Type-specific content
  };
}
```

**Example - Text Message**:
```json
{
  "to": "+573001234567",
  "type": "text",
  "content": {
    "body": "Tu recordatorio para llamar a María es en 5 minutos."
  }
}
```

**Example - Button Message**:
```json
{
  "to": "+573001234567",
  "type": "button",
  "content": {
    "body": "¿Confirmas la reunión?",
    "buttons": [
      { "id": "confirm_yes", "title": "Sí" },
      { "id": "confirm_no", "title": "No" }
    ]
  }
}
```

---

## 8. AI Strategy

### 8.1 Model Selection

| Provider | Model | Cost (per 1M tokens) | Use Case |
|----------|-------|----------------------|----------|
| OpenAI | GPT-4o-mini | $0.15 / $0.60 | Primary for all tasks |
| Claude | 3.5 Sonnet | $3.00 / $15.00 | Fallback on rate limits |
| OpenAI | Whisper | $0.006 / min | Voice transcription |

### 8.2 Function Calling Tools

**Available Functions**:

```typescript
const tools = [
  {
    name: "schedule_reminder",
    description: "Schedule a reminder for the user",
    parameters: {
      type: "object",
      properties: {
        reminder_text: { type: "string" },
        scheduled_for: { type: "string", format: "date-time" },
        recurring_pattern: { type: "string", enum: ["once", "daily", "weekly"] }
      },
      required: ["reminder_text", "scheduled_for"]
    }
  },
  {
    name: "track_expense",
    description: "Log a business expense",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number" },
        currency: { type: "string" },
        category: { type: "string" },
        description: { type: "string" }
      },
      required: ["amount", "currency"]
    }
  },
  {
    name: "schedule_meeting",
    description: "Schedule a meeting and create calendar event",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        start_time: { type: "string", format: "date-time" },
        duration_minutes: { type: "number" },
        participants: { type: "array", items: { type: "string" } }
      },
      required: ["title", "start_time"]
    }
  },
  {
    name: "get_calendar_events",
    description: "Retrieve upcoming calendar events",
    parameters: {
      type: "object",
      properties: {
        start_date: { type: "string", format: "date" },
        end_date: { type: "string", format: "date" }
      }
    }
  }
];
```

### 8.3 System Prompt

```
Eres Migue, un asistente de productividad para WhatsApp especializado en ayudar a profesionales independientes en América Latina.

TU ROL:
- Ayudar con recordatorios, citas, tareas y gastos
- Comunicarte de manera amigable e informal en español
- Ser conciso (máximo 2-3 oraciones por respuesta)
- Usar las herramientas disponibles cuando sea apropiado

REGLAS:
1. Solo puedes ayudar con: recordatorios, calendario, gastos, reuniones
2. NO eres un chatbot general - rechaza amablemente temas fuera de tu alcance
3. Confirma siempre las acciones antes de ejecutarlas
4. Usa formato de 12 horas (3pm, no 15:00) para horarios
5. Asume zona horaria del usuario si no se especifica

EJEMPLOS:
Usuario: "Recuérdame llamar a Juan mañana a las 3"
Tú: "Perfecto! Te recuerdo llamar a Juan mañana a las 3pm. ✅"
[Ejecutas: schedule_reminder]

Usuario: "Gasté $50 en taxi"
Tú: "Registrado: $50 COP en Transporte. Llevas $X en gastos este mes."
[Ejecutas: track_expense]

Usuario: "Cuéntame un chiste"
Tú: "Lo siento, solo puedo ayudarte con recordatorios, citas y gastos. ¿Necesitas agendar algo?"
```

### 8.4 Cost Optimization

**Target**: <$0.05 per user/month average

**Strategies**:
1. **Smart caching**: Cache common queries (calendar, recent expenses)
2. **Truncate context**: Keep only last 10 messages (not full conversation history)
3. **Lazy loading**: Only fetch calendar/expenses when explicitly requested
4. **Batch processing**: Group multiple tool calls in single AI request
5. **Template responses**: Use pre-written responses for common actions (greetings, confirmations)

**Monitoring**:
- Track cost per user in `ai_usage_logs`
- Alert if user exceeds $1/month (potential abuse)
- Monthly report on cost breakdown by provider/model

---

## 9. WhatsApp Compliance

### 9.1 Policy Adherence (Jan 2026)

**Allowed Use Cases** (explicitly compliant):
- ✅ Appointment scheduling and reminders
- ✅ Task management
- ✅ Calendar integration
- ✅ Document processing (receipts)
- ✅ Business support workflows

**Prohibited Use Cases** (must reject):
- ❌ General conversation ("Cuéntame un chiste")
- ❌ News/weather (unless business-related)
- ❌ Entertainment (games, trivia)
- ❌ Personal advice (health, legal, financial speculation)

**Enforcement**:
```typescript
// System prompt includes explicit rejection
if (isGeneralChatbot(userMessage)) {
  return "Lo siento, solo puedo ayudarte con recordatorios, citas, tareas y gastos de tu negocio. ¿Necesitas algo de eso?";
}
```

### 9.2 Rate Limits

**WhatsApp Cloud API Limits**:
- 1,000 messages/day (Tier 1, new accounts)
- 10,000 messages/day (Tier 2, after quality rating)
- 100,000 messages/day (Tier 3, after sustained usage)
- 250 messages/second (max throughput)

**Implementation**:
```typescript
// lib/rate-limiter.ts
const LIMITS = {
  tier1: { daily: 1000, perSecond: 80 },
  tier2: { daily: 10000, perSecond: 200 },
  tier3: { daily: 100000, perSecond: 250 }
};

async function checkRateLimit(userPhone: string) {
  const dailyCount = await getDailyMessageCount(userPhone);
  const currentTier = await getUserTier(userPhone);

  if (dailyCount >= LIMITS[currentTier].daily) {
    throw new Error('Daily rate limit exceeded');
  }
}
```

### 9.3 Template Messages

**Use Case**: Re-open 24h window when expired

**Template** (requires WhatsApp approval):
```
Name: window_reopen
Category: UTILITY
Language: Spanish (es)

Body: "Hola {{1}}! ¿Hay algo en lo que pueda ayudarte hoy?"

Variables:
- {{1}}: User's first name
```

**Approval Process**:
1. Submit template via WhatsApp Manager
2. Wait 24-48h for review
3. Use only after "APPROVED" status

### 9.4 Quality Rating

**Metrics Monitored by WhatsApp**:
- User blocks/reports (must be <0.5%)
- Message delivery rate (must be >95%)
- Template message response rate (must be >10%)

**Our Targets**:
- Block rate: <0.1%
- Delivery rate: >98%
- Template response rate: >25%

**Monitoring**:
```sql
-- Track quality metrics
CREATE TABLE quality_metrics (
  date DATE PRIMARY KEY,
  messages_sent INT,
  messages_delivered INT,
  user_blocks INT,
  user_reports INT,
  template_responses INT
);
```

---

## 10. Success Metrics

### 10.1 Business Metrics

| Metric | Target (Month 3) | Target (Month 6) |
|--------|------------------|------------------|
| Active users | 500 | 2,000 |
| Weekly active users (WAU) | 300 | 1,200 |
| Retention (30-day) | 40% | 60% |
| NPS | 50+ | 70+ |
| Revenue (if monetized) | $500 | $3,000 |

### 10.2 Technical Metrics

| Metric | Target |
|--------|--------|
| Webhook response time | <500ms (p95) |
| AI response time | <3s (p95) |
| Message delivery rate | >98% |
| Uptime | >99.5% |
| Error rate | <1% |

### 10.3 UX Metrics

| Metric | Target |
|--------|--------|
| Reminder accuracy | >95% correct time/date parsing |
| Voice transcription accuracy | >90% WER (Word Error Rate) |
| User satisfaction (post-interaction) | >4.5/5 |
| Messages per session | 3-5 (conversational, not one-shot) |

### 10.4 Cost Metrics

| Metric | Target |
|--------|--------|
| AI cost per user/month | <$0.05 |
| Infrastructure cost per user/month | <$0.10 |
| Total cost per user/month | <$0.15 |

---

## 11. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)

**Deliverables**:
- Vercel Edge Functions setup
- Supabase database with core tables
- WhatsApp webhook endpoint (text messages only)
- Basic AI processing (OpenAI GPT-4o-mini)
- Fire-and-forget webhook pattern

**User Stories**:
- [P0] As a user, I can send a text message and get a response

**Success Criteria**:
- Webhook responds in <500ms
- AI processes message in <3s
- Message delivery rate >95%

### Phase 2: Core Features (Weeks 4-6)

**Deliverables**:
- Natural language reminder parsing
- Scheduled message system with cron
- Interactive buttons and lists
- 24h window tracking
- Expense tracking

**User Stories**:
- [P0] As a user, I can schedule reminders in natural language
- [P0] As a user, I can track expenses by text
- [P0] As a user, I can use buttons for quick actions

**Success Criteria**:
- Reminder accuracy >90%
- Window maintenance keeps >80% users active
- Users send avg 5+ messages/week

### Phase 3: Calendar Integration (Weeks 7-9)

**Deliverables**:
- Google Calendar OAuth flow
- Calendar event creation
- Meeting scheduling tool
- Availability checking

**User Stories**:
- [P1] As a user, I can add meetings to Google Calendar via WhatsApp
- [P1] As a user, I can check my daily schedule

**Success Criteria**:
- OAuth completion rate >70%
- Calendar sync success rate >95%
- Users create avg 3+ events/week

### Phase 4: Voice & Polish (Weeks 10-12)

**Deliverables**:
- Voice message transcription (Whisper)
- Multi-provider AI failover
- Cost tracking dashboard
- User onboarding flow
- Beta launch

**User Stories**:
- [P1] As a user, I can send voice messages
- [P1] As a user, I receive onboarding messages

**Success Criteria**:
- Voice transcription accuracy >90%
- AI failover works within <1s
- Onboarding completion rate >60%
- 100 beta users acquired

### Phase 5: Scale & Optimize (Post-Launch)

**Focus**:
- Performance optimization
- Cost reduction (caching, batching)
- User feedback implementation
- WhatsApp quality rating improvement
- Marketing & growth

---

## 12. Risk Mitigation

### 12.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WhatsApp API downtime | Medium | High | Multi-provider AI, queue retries, user notifications |
| OpenAI rate limits | High | Medium | Claude fallback, request throttling, user quotas |
| Supabase outages | Low | High | Daily backups, read replicas, incident SLA |
| Webhook signature validation bypass | Low | Critical | HMAC validation, IP whitelist, rate limiting |
| Spam/abuse | Medium | Medium | User quotas, anomaly detection, block list |

### 12.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WhatsApp policy change | Medium | Critical | Stay in allowed use cases, diversify channels (Telegram, SMS) |
| Low user adoption | Medium | High | Beta testing, referral program, user interviews |
| High churn rate | Medium | High | Onboarding flow, retention campaigns, user feedback |
| Competitor clone | High | Medium | Fast iteration, brand loyalty, network effects |

### 12.3 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Solo founder bottleneck | High | High | Automation, documentation, outsource non-core tasks |
| Costs exceed revenue | Medium | High | Cost monitoring, usage caps, tiered pricing |
| Customer support overload | Medium | Medium | Self-service docs, FAQ automation, community |
| Data breach | Low | Critical | RLS, encryption at rest, audit logs, SOC 2 compliance (future) |

---

## 13. References

### 13.1 Implementation Guidance

**Archived Code** (reference patterns):
- `/Users/mercadeo/neero/migue.ai/.backup/2026-01-28-full-archive/lib/whatsapp.ts` - WhatsApp API client
- `/Users/mercadeo/neero/migue.ai/.backup/2026-01-28-full-archive/lib/message-builders/` - Interactive messages
- `/Users/mercadeo/neero/migue.ai/.backup/2026-01-28-full-archive/lib/messaging-windows.ts` - Window management
- `/Users/mercadeo/neero/migue.ai/.backup/2026-01-28-full-archive/app/api/whatsapp/webhook/route.ts` - Webhook handler

**Related Projects**:
- `molbot` (/Users/mercadeo/neero/molbot) - Multi-channel architecture, AI failover patterns

### 13.2 External Documentation

- [WhatsApp Business API v23.0](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [WhatsApp Policy Update (Oct 2025)](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/)
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Supabase Row-Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)

### 13.3 Competitor Analysis

| Competitor | Pricing | Key Differentiator | Weakness |
|------------|---------|-------------------|----------|
| Zapia | $29/mo | Multi-platform (WhatsApp + Telegram) | English-only, no LATAM focus |
| Waply | $19/mo | CRM integration | Complex setup, enterprise-focused |
| TheLibrarian | Free beta | Document management | No reminders, limited AI |

**migue.ai Position**: Spanish-first, WhatsApp-native, simple pricing (<$10/mo target), business automation focus.

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| E.164 | International phone number format (+country code + number) |
| Fire-and-forget | Pattern where webhook returns 200 immediately, processes async |
| HMAC | Hash-based Message Authentication Code (for signature validation) |
| RLS | Row-Level Security (Postgres feature for data isolation) |
| WAU | Weekly Active Users |
| 24h window | WhatsApp policy: can send messages for 24h after user's last message |
| Template message | Pre-approved message format for re-opening 24h window |

---

## Appendix B: Contact & Support

- **Project Lead**: Javier Polo (CEO, Neero SAS)
- **Development**: ClaudeCode&OnlyMe
- **Region**: LATAM (Colombia primary market)
- **Timeline**: Q2 2026 launch (12-week dev cycle)

---

**Document Status**: Approved for implementation
**Next Step**: Begin Phase 1 (Foundation) development
**Review Cadence**: Weekly during development, monthly post-launch
