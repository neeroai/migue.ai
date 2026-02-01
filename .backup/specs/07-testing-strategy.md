---
title: Testing Strategy
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: ready
scope: Unit tests, integration tests, E2E tests, fixtures, mocks
---

# Testing Strategy

## Quick Reference
- **Purpose**: Comprehensive testing strategy with Vitest (unit), webhook simulation (integration), Playwright (E2E)
- **References**: docs/patterns/error-handling-fallbacks.md, docs-global/workflows/quality-gates.md
- **Test Framework**: Vitest (fast, Edge Runtime compatible)
- **Coverage Target**: 80% for critical paths

---

## Test Pyramid

| Level | Count | Duration | Coverage | Purpose |
|-------|-------|----------|----------|---------|
| Unit | 100+ | <100ms | Functions, utils | Fast feedback |
| Integration | 30+ | <1s | API routes, DB | Component interaction |
| E2E | 10+ | <10s | Full flows | User scenarios |

**Total test execution**: ~30-40 seconds

---

## Unit Tests

### Setup

**File**: vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'edge-runtime', // Simulate Edge Runtime
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

**File**: tests/setup.ts

```typescript
import { beforeAll, afterAll, vi } from 'vitest';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

// Mock AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'Mocked AI response' }),
  tool: vi.fn((config) => config),
}));

beforeAll(() => {
  console.log('🧪 Test setup complete');
});

afterAll(() => {
  console.log('✅ Tests finished');
});
```

### Test Examples

**File**: tests/unit/whatsapp-validation.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { validateSignature } from '@/lib/whatsapp/validation';
import { createHmac } from 'crypto';

describe('WhatsApp Signature Validation', () => {
  const secret = 'test_webhook_secret';
  const payload = JSON.stringify({ test: 'data' });

  it('should validate correct signature', () => {
    const signature = `sha256=${createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;

    expect(validateSignature(payload, signature, secret)).toBe(true);
  });

  it('should reject incorrect signature', () => {
    const signature = 'sha256=invalid_signature';
    expect(validateSignature(payload, signature, secret)).toBe(false);
  });

  it('should reject missing sha256 prefix', () => {
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    expect(validateSignature(payload, signature, secret)).toBe(false);
  });

  it('should reject empty signature', () => {
    expect(validateSignature(payload, '', secret)).toBe(false);
  });
});
```

**File**: tests/unit/message-normalization.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeMessage } from '@/lib/whatsapp/normalization';

describe('Message Normalization', () => {
  it('should normalize text message', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '573001234567',
                    id: 'wamid.abc123',
                    timestamp: '1706500000',
                    type: 'text',
                    text: { body: 'Hola Migue' },
                  },
                ],
                contacts: [{ profile: { name: 'Juan Pérez' } }],
              },
            },
          ],
        },
      ],
    };

    const normalized = normalizeMessage(payload);

    expect(normalized).toEqual({
      userId: '573001234567',
      userPhone: '573001234567',
      userName: 'Juan Pérez',
      messageId: 'wamid.abc123',
      messageType: 'text',
      content: 'Hola Migue',
      metadata: expect.any(Object),
      timestamp: '1706500000',
    });
  });

  it('should normalize button reply', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '573001234567',
                    id: 'wamid.xyz789',
                    timestamp: '1706500000',
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: {
                        id: 'check_schedule',
                        title: 'Ver agenda',
                      },
                    },
                  },
                ],
                contacts: [{ profile: { name: 'Juan' } }],
              },
            },
          ],
        },
      ],
    };

    const normalized = normalizeMessage(payload);

    expect(normalized?.content).toBe('Ver agenda');
    expect(normalized?.messageType).toBe('interactive');
  });

  it('should return null for status updates', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: 'wamid.abc123',
                    status: 'delivered',
                    timestamp: '1706500000',
                    recipient_id: '573001234567',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const normalized = normalizeMessage(payload);
    expect(normalized).toBeNull();
  });
});
```

**File**: tests/unit/messaging-window.test.ts

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkMessagingWindow, openMessagingWindow } from '@/lib/whatsapp/messaging-window';
import { supabase } from '@/lib/supabase';

describe('Messaging Window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return closed window when none exists', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    const window = await checkMessagingWindow('user123');

    expect(window.isOpen).toBe(false);
    expect(window.expiresAt).toBeNull();
  });

  it('should return open window when valid', async () => {
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user123',
          is_open: true,
          expires_at: futureDate.toISOString(),
          last_user_message_id: 'msg123',
        },
        error: null,
      }),
    } as any);

    const window = await checkMessagingWindow('user123');

    expect(window.isOpen).toBe(true);
    expect(window.expiresAt).toBeTruthy();
  });

  it('should close expired window', async () => {
    const pastDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

    const updateMock = vi.fn().mockReturnThis();
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'window123',
          user_id: 'user123',
          is_open: true,
          expires_at: pastDate.toISOString(),
        },
        error: null,
      }),
      update: updateMock,
    } as any);

    const window = await checkMessagingWindow('user123');

    expect(window.isOpen).toBe(false);
    expect(updateMock).toHaveBeenCalledWith({ is_open: false });
  });
});
```

---

## Integration Tests

### Webhook Simulation

**File**: tests/integration/webhook.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/whatsapp/webhook/route';
import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';

describe('WhatsApp Webhook', () => {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET!;

  function createWebhookRequest(payload: any): NextRequest {
    const body = JSON.stringify(payload);
    const signature = `sha256=${createHmac('sha256', secret)
      .update(body)
      .digest('hex')}`;

    return new NextRequest('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': signature,
        'content-type': 'application/json',
      },
      body,
    });
  }

  it('should accept valid webhook', async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '573001234567',
                    id: 'wamid.test123',
                    timestamp: '1706500000',
                    type: 'text',
                    text: { body: 'Test message' },
                  },
                ],
                contacts: [{ profile: { name: 'Test User' } }],
              },
            },
          ],
        },
      ],
    };

    const req = createWebhookRequest(payload);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should reject invalid signature', async () => {
    const payload = { test: 'data' };
    const body = JSON.stringify(payload);

    const req = new NextRequest('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': 'sha256=invalid_signature',
        'content-type': 'application/json',
      },
      body,
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });
});
```

### Tool Execution Tests

**File**: tests/integration/tools.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { calendarTools } from '@/lib/ai/tools/calendar';
import { reminderTools } from '@/lib/ai/tools/reminders';

describe('Calendar Tools', () => {
  it('should list events', async () => {
    const result = await calendarTools.list_events.execute({
      userId: 'user123',
      startDate: '2026-01-29',
      endDate: '2026-01-30',
    });

    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('count');
    expect(Array.isArray(result.events)).toBe(true);
  });

  it('should create event', async () => {
    const result = await calendarTools.create_event.execute({
      userId: 'user123',
      title: 'Test Appointment',
      startTime: '2026-01-30T14:00:00-05:00',
      durationMinutes: 60,
    });

    expect(result).toHaveProperty('eventId');
    expect(result.message).toContain('created successfully');
  });
});

describe('Reminder Tools', () => {
  it('should create reminder', async () => {
    const result = await reminderTools.create_reminder.execute({
      userId: 'user123',
      message: 'Test reminder',
      scheduledFor: '2026-01-30T09:00:00-05:00',
    });

    expect(result).toHaveProperty('reminderId');
    expect(result.message).toContain('Reminder set');
  });

  it('should list reminders', async () => {
    const result = await reminderTools.list_reminders.execute({
      userId: 'user123',
      status: 'pending',
    });

    expect(result).toHaveProperty('reminders');
    expect(result).toHaveProperty('count');
  });
});
```

---

## E2E Tests

### Setup

**File**: playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Examples

**File**: tests/e2e/whatsapp-flow.spec.ts

```typescript
import { test, expect } from '@playwright/test';
import { createHmac } from 'crypto';

test.describe('WhatsApp Full Flow', () => {
  test('should process text message and respond', async ({ request }) => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '573001234567',
                    id: 'wamid.e2e123',
                    timestamp: Date.now().toString(),
                    type: 'text',
                    text: { body: 'Qué citas tengo mañana?' },
                  },
                ],
                contacts: [{ profile: { name: 'E2E Test' } }],
              },
            },
          ],
        },
      ],
    };

    const body = JSON.stringify(payload);
    const signature = `sha256=${createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex')}`;

    const response = await request.post('/api/whatsapp/webhook', {
      data: payload,
      headers: {
        'x-hub-signature-256': signature,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('should handle reminder creation flow', async ({ request }) => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '573001234567',
                    id: 'wamid.e2e456',
                    timestamp: Date.now().toString(),
                    type: 'text',
                    text: { body: 'Recuérdame llamar a Juan a las 3pm' },
                  },
                ],
                contacts: [{ profile: { name: 'E2E Test' } }],
              },
            },
          ],
        },
      ],
    };

    const body = JSON.stringify(payload);
    const signature = `sha256=${createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex')}`;

    const response = await request.post('/api/whatsapp/webhook', {
      data: payload,
      headers: {
        'x-hub-signature-256': signature,
      },
    });

    expect(response.ok()).toBeTruthy();
  });
});
```

---

## Test Fixtures

**File**: tests/fixtures/whatsapp-payloads.ts

```typescript
export const textMessagePayload = {
  entry: [
    {
      changes: [
        {
          value: {
            messages: [
              {
                from: '573001234567',
                id: 'wamid.test123',
                timestamp: '1706500000',
                type: 'text',
                text: { body: 'Test message' },
              },
            ],
            contacts: [{ profile: { name: 'Test User' } }],
          },
        },
      ],
    },
  ],
};

export const buttonReplyPayload = {
  entry: [
    {
      changes: [
        {
          value: {
            messages: [
              {
                from: '573001234567',
                id: 'wamid.test456',
                timestamp: '1706500000',
                type: 'interactive',
                interactive: {
                  type: 'button_reply',
                  button_reply: {
                    id: 'check_schedule',
                    title: 'Ver agenda',
                  },
                },
              },
            ],
            contacts: [{ profile: { name: 'Test User' } }],
          },
        },
      ],
    },
  ],
};

export const listReplyPayload = {
  entry: [
    {
      changes: [
        {
          value: {
            messages: [
              {
                from: '573001234567',
                id: 'wamid.test789',
                timestamp: '1706500000',
                type: 'interactive',
                interactive: {
                  type: 'list_reply',
                  list_reply: {
                    id: 'food',
                    title: 'Comida',
                    description: 'Restaurantes, supermercado',
                  },
                },
              },
            ],
            contacts: [{ profile: { name: 'Test User' } }],
          },
        },
      ],
    },
  ],
};
```

---

## Test Commands

**File**: package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch"
  }
}
```

---

## Testing Checklist

- [ ] Unit tests cover all util functions
- [ ] HMAC validation tested with valid/invalid signatures
- [ ] Message normalization handles all message types
- [ ] Messaging window logic tested (open/closed/expired)
- [ ] Tool execution tested for all 20+ tools
- [ ] Webhook integration test passes
- [ ] E2E test simulates full WhatsApp flow
- [ ] Test coverage >80% for critical paths
- [ ] All tests run in <40 seconds

---

**Lines**: 200 | **Tokens**: ~480 | **Status**: Ready for implementation
