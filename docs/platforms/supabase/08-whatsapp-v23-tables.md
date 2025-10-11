# WhatsApp v23.0 Tables

Database tables for WhatsApp Business Platform v23.0 features: Flows, Calling API, interactions, and locations.

## Overview

**WhatsApp API v23.0** introduces:
- **Flows** - Multi-step forms within WhatsApp
- **Business Calling API** - VOIP calls
- **Enhanced Interactions** - CTA buttons, quick replies
- **Location Sharing** - GPS coordinates

**migue.ai implementation**: 4 dedicated tables tracking all v23.0 features.

## flow_sessions

### Purpose
Track WhatsApp Flows (multi-step in-chat forms) with session data and responses.

### Schema

```sql
CREATE TABLE flow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  flow_id TEXT NOT NULL,
  flow_token TEXT NOT NULL UNIQUE,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('navigate', 'data_exchange')),
  session_data JSONB DEFAULT '{}'::JSONB,
  response_data JSONB,
  status flow_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
```

### Enum: flow_status
```sql
CREATE TYPE flow_status AS ENUM ('pending', 'in_progress', 'completed', 'expired', 'failed');
```

### Indexes

```sql
CREATE INDEX idx_flow_sessions_user ON flow_sessions(user_id);
CREATE INDEX idx_flow_sessions_token ON flow_sessions(flow_token);
CREATE INDEX idx_flow_sessions_status ON flow_sessions(status);
CREATE INDEX idx_flow_sessions_expires ON flow_sessions(expires_at)
  WHERE status IN ('pending', 'in_progress');
```

### Trigger: Auto-Complete Timestamp

```sql
CREATE OR REPLACE FUNCTION flow_sessions_set_completed_at() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER t_flow_sessions_set_completed BEFORE UPDATE ON flow_sessions
FOR EACH ROW EXECUTE FUNCTION flow_sessions_set_completed_at();
```

### TypeScript Types

```typescript
type FlowStatus = 'pending' | 'in_progress' | 'completed' | 'expired' | 'failed'
type FlowType = 'navigate' | 'data_exchange'

interface FlowSession {
  id: string
  user_id: string
  flow_id: string
  flow_token: string
  flow_type: FlowType
  session_data: Record<string, unknown>
  response_data?: Record<string, unknown>
  status: FlowStatus
  completed_at?: string
  expires_at: string
}
```

## call_logs

### Purpose
Track WhatsApp Business Calling API calls (VOIP).

### Schema

```sql
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  call_id TEXT NOT NULL UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL CHECK (status IN ('initiated', 'accepted', 'rejected', 'ended', 'failed')),
  duration_seconds INT,
  end_reason TEXT CHECK (end_reason IN ('user_declined', 'user_busy', 'timeout', 'completed')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_call_logs_user ON call_logs(user_id);
CREATE INDEX idx_call_logs_call_id ON call_logs(call_id);
CREATE INDEX idx_call_logs_timestamp ON call_logs(timestamp DESC);
CREATE UNIQUE INDEX uniq_call_logs_call_id ON call_logs(call_id);
```

### Call Status Flow

```
initiated → accepted → ended (completed)
         → rejected
         → failed
```

### TypeScript Types

```typescript
interface CallLog {
  id: string
  user_id: string
  call_id: string
  direction: 'inbound' | 'outbound'
  status: 'initiated' | 'accepted' | 'rejected' | 'ended' | 'failed'
  duration_seconds?: number
  end_reason?: 'user_declined' | 'user_busy' | 'timeout' | 'completed'
  timestamp: string
}
```

## user_interactions

### Purpose
Track CTA button taps, flow completions, and other user interactions.

### Schema

```sql
CREATE TABLE user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (
    interaction_type IN ('cta_button_tap', 'flow_completion', 'call_accepted', 'call_rejected')
  ),
  button_title TEXT,
  button_url TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_user_interactions_user ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX idx_user_interactions_timestamp ON user_interactions(timestamp DESC);
```

### Interaction Types

| Type | Description | Fields |
|------|-------------|--------|
| `cta_button_tap` | User tapped CTA button | button_title, button_url |
| `flow_completion` | User completed a flow | metadata (flow_id, response_data) |
| `call_accepted` | User accepted call | metadata (call_id) |
| `call_rejected` | User rejected call | metadata (call_id, reason) |

### TypeScript Types

```typescript
interface UserInteraction {
  id: string
  user_id: string
  interaction_type: 'cta_button_tap' | 'flow_completion' | 'call_accepted' | 'call_rejected'
  button_title?: string
  button_url?: string
  metadata?: Record<string, unknown>
  timestamp: string
}
```

## user_locations

### Purpose
Store GPS coordinates when users share location.

### Schema

```sql
CREATE TABLE user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  name TEXT,
  address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_user_locations_user ON user_locations(user_id);
CREATE INDEX idx_user_locations_timestamp ON user_locations(timestamp DESC);
CREATE INDEX idx_user_locations_coords ON user_locations(latitude, longitude);
```

### Coordinate Precision

**DECIMAL(10, 8)** for latitude:
- Range: -90.00000000 to +90.00000000
- Precision: ~1.1mm

**DECIMAL(11, 8)** for longitude:
- Range: -180.00000000 to +180.00000000
- Precision: ~1.1mm

### TypeScript Types

```typescript
interface UserLocation {
  id: string
  user_id: string
  latitude: number  // -90 to +90
  longitude: number  // -180 to +180
  name?: string  // "Home", "Office", etc.
  address?: string  // "Cra 7 #123-45, Bogotá"
  timestamp: string
}
```

## Usage Patterns

### Track Flow Completion

```typescript
async function trackFlowCompletion(
  userId: string,
  flowToken: string,
  responseData: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseServerClient()

  // Update flow session
  await supabase.from('flow_sessions')
    .update({
      status: 'completed',
      response_data: responseData,
      completed_at: new Date().toISOString()
    })
    .eq('flow_token', flowToken)

  // Track interaction
  await supabase.from('user_interactions').insert({
    user_id: userId,
    interaction_type: 'flow_completion',
    metadata: { flow_token: flowToken, response_data: responseData }
  })
}
```

### Log Call Event

```typescript
async function logCallEvent(params: {
  userId: string
  callId: string
  direction: 'inbound' | 'outbound'
  status: 'initiated' | 'accepted' | 'rejected' | 'ended'
  durationSeconds?: number
  endReason?: string
}): Promise<void> {
  const supabase = getSupabaseServerClient()

  await supabase.from('call_logs').upsert({
    user_id: params.userId,
    call_id: params.callId,
    direction: params.direction,
    status: params.status,
    duration_seconds: params.durationSeconds ?? null,
    end_reason: params.endReason ?? null,
  }, { onConflict: 'call_id' })

  // Track interaction
  if (params.status === 'accepted' || params.status === 'rejected') {
    await supabase.from('user_interactions').insert({
      user_id: params.userId,
      interaction_type: params.status === 'accepted' ? 'call_accepted' : 'call_rejected',
      metadata: { call_id: params.callId }
    })
  }
}
```

### Store User Location

```typescript
async function storeUserLocation(params: {
  userId: string
  conversationId: string
  latitude: number
  longitude: number
  name?: string
  address?: string
}): Promise<void> {
  const supabase = getSupabaseServerClient()

  await supabase.from('user_locations').insert({
    user_id: params.userId,
    conversation_id: params.conversationId,
    latitude: params.latitude,
    longitude: params.longitude,
    name: params.name ?? null,
    address: params.address ?? null,
  })
}
```

## Analytics Queries

### Flow Completion Rate

```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) AS completion_rate,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
FROM flow_sessions
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
```

### Call Duration Stats

```sql
SELECT
  AVG(duration_seconds) AS avg_duration,
  MAX(duration_seconds) AS max_duration,
  MIN(duration_seconds) AS min_duration,
  COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_calls,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_calls
FROM call_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
```

### Top CTA Buttons

```sql
SELECT
  button_title,
  button_url,
  COUNT(*) AS taps
FROM user_interactions
WHERE interaction_type = 'cta_button_tap'
  AND timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY button_title, button_url
ORDER BY taps DESC
LIMIT 10;
```

### User Location Heatmap

```sql
-- Get location clusters (simple grid)
SELECT
  FLOOR(latitude * 100) / 100 AS lat_grid,
  FLOOR(longitude * 100) / 100 AS lng_grid,
  COUNT(*) AS location_count
FROM user_locations
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY lat_grid, lng_grid
ORDER BY location_count DESC;
```

## Next Steps

- **[Database Schema](./02-database-schema.md)** - Full schema reference
- **[Custom Functions](./05-custom-functions-triggers.md)** - Flow completion triggers

**Last Updated**: 2025-10-11
