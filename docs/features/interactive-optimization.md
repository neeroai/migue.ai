---
title: "Interactive Message Optimization"
summary: "Buttons, lists, quick replies, reactions, typing indicators with smart fallbacks"
description: "Interactive type selection matrix, quick reply patterns, reaction mappings, typing indicator durations, and fallback hierarchy for graceful degradation"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Features"
---

# Interactive Message Optimization

## Interactive Type Selection

| Option Count | Type | Pros | Cons | Use Case | API Call Cost |
|--------------|------|------|------|----------|---------------|
| 1-3 | Buttons | Fast tap, visible | Limited options | Quick actions | 1 request |
| 4-10 | List (single) | Organized, searchable | Requires scroll | Categories | 1 request |
| 11-24 | List (multi-section) | Grouped, scannable | More complex | Multi-category | 1 request |
| 1-13 | Quick replies | Contextual, dynamic | Not persistent | Suggestions | 0 (same message) |
| Any | Text fallback | Universal support | Less engaging | Compatibility | 1 request |

**Selection algorithm**:
```typescript
function selectInteractiveType(options: string[]): MessageType {
  const count = options.length;

  if (count === 0) return 'text';
  if (count <= 3) return 'buttons';
  if (count <= 10) return 'list';
  if (count <= 24) return 'list_multi_section';
  return 'text_with_numbers'; // Fallback for >24
}
```

---

## Quick Reply Patterns

| Context | Suggestions | Frequency Rank | Template | Character Limit |
|---------|-------------|----------------|----------|-----------------|
| Greeting | ["Check schedule", "Add reminder", "Help"] | High | Common actions | 20 chars |
| After query | ["Yes", "No", "More info"] | High | Confirmation | 15 chars |
| Time selection | ["Morning", "Afternoon", "Evening"] | Medium | Time slots | 12 chars |
| Category | ["Food", "Transport", "Other"] | High | Expense types | 15 chars |
| Confirmation | ["Confirm", "Edit", "Cancel"] | High | Action flow | 10 chars |
| Feedback | ["👍 Good", "👎 Bad", "Skip"] | Low | Sentiment | 12 chars |

**Quick reply format**:
- Max 13 options (WhatsApp limit)
- Max 20 characters per option
- Emoji allowed (count as 2 chars)
- No custom payload (text only)

**Implementation**:
```typescript
function buildQuickReplies(context: string): string[] {
  const patterns = {
    greeting: ["📅 Schedule", "⏰ Reminder", "❓ Help"],
    confirmation: ["✅ Yes", "❌ No", "ℹ️ More info"],
    time_slot: ["🌅 Morning", "☀️ Afternoon", "🌙 Evening"],
    expense_category: ["🍔 Food", "🚗 Transport", "🎬 Fun", "📝 Other"]
  };

  return patterns[context] || ["Continue"];
}
```

---

## Reaction Mappings

| Emoji | Meaning | Action | Response Time | Storage |
|-------|---------|--------|---------------|---------|
| 👍 | Confirmation | Mark task complete | <200ms | Update DB |
| 👎 | Rejection | Cancel pending action | <200ms | Update DB |
| ❤️ | Favorite | Add to favorites | <200ms | Update DB |
| 😂 | Funny | Log sentiment | <100ms | Analytics only |
| 😮 | Surprise | Log sentiment | <100ms | Analytics only |
| 🔥 | Important | Flag message | <200ms | Update DB |
| ⏰ | Reminder | Create reminder | <300ms | Create DB entry |
| ✅ | Done | Mark complete | <200ms | Update DB |

**Reaction handler**:
```typescript
async function handleReaction(
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> {
  const actions = {
    '👍': async () => await completeTask(messageId, userId),
    '👎': async () => await cancelAction(messageId, userId),
    '❤️': async () => await addToFavorites(messageId, userId),
    '🔥': async () => await flagImportant(messageId, userId),
    '⏰': async () => await createReminderFromMessage(messageId, userId),
    '✅': async () => await markComplete(messageId, userId)
  };

  const action = actions[emoji];
  if (action) {
    await action();
  } else {
    // Log for analytics only
    await logSentiment(emoji, messageId, userId);
  }
}
```

---

## Typing Indicator Durations

| Response Type | Duration | Perception | Pattern | Max Duration |
|---------------|----------|------------|---------|--------------|
| Simple query | 1-2s | Natural | Short burst | 2s |
| Calendar lookup | 2-3s | Processing | Medium burst | 3s |
| AI thinking (fast) | 2-4s | Thinking | Continuous | 5s |
| AI thinking (extended) | 4-8s | Deep thinking | Pulsing | 10s |
| Tool execution | 3-5s | Working | Continuous | 8s |
| Multi-tool | 5-10s | Complex task | Pulsing | 15s |

**Typing indicator strategy**:
- Send immediately on message receive
- Show during AI processing
- Hide before sending response
- Pulse for long operations (stop/restart every 3s)
- Max 15s total (WhatsApp best practice)

**Implementation**:
```typescript
async function withTypingIndicator<T>(
  phoneNumber: string,
  operation: () => Promise<T>,
  estimatedTime: number
): Promise<T> {
  // Start typing
  await sendTypingIndicator(phoneNumber, true);

  // Pulse for long operations
  let pulseInterval: NodeJS.Timeout | null = null;
  if (estimatedTime > 5000) {
    pulseInterval = setInterval(async () => {
      await sendTypingIndicator(phoneNumber, false);
      await new Promise(resolve => setTimeout(resolve, 500));
      await sendTypingIndicator(phoneNumber, true);
    }, 3000);
  }

  try {
    return await operation();
  } finally {
    if (pulseInterval) clearInterval(pulseInterval);
    await sendTypingIndicator(phoneNumber, false);
  }
}
```

---

## Fallback Hierarchy

| Feature | Degradation | Alternative | UX Impact | Example |
|---------|-------------|-------------|-----------|---------|
| Buttons | → Quick replies | Text with suggestions | Minor | "Reply 1 for Yes, 2 for No" |
| List | → Numbered text | Text with numbers | Medium | "1. Food\n2. Transport\n3. Other" |
| Quick replies | → Plain text | Text prompt | Minor | "Please type your choice" |
| Reactions | → Text response | Type feedback | Medium | "Reply 'done' to complete" |
| Typing indicator | → None | Immediate response | Minimal | No indicator shown |
| Interactive flow | → Multi-message | Step-by-step text | High | Each screen = 1 message |

**Fallback detection**:
```typescript
function shouldFallback(
  feature: InteractiveFeature,
  recipient: User
): boolean {
  // Check device capabilities
  if (!recipient.supportsInteractive) return true;

  // Check WhatsApp version (interactive requires v2.21.0+)
  if (recipient.whatsappVersion < '2.21.0') return true;

  // Check feature-specific requirements
  if (feature === 'flows' && recipient.whatsappVersion < '2.23.20') {
    return true;
  }

  return false;
}
```

**Fallback builder**:
```typescript
class MessageBuilder {
  buildWithFallback(
    type: 'buttons' | 'list',
    options: string[],
    recipient: User
  ): Message {
    if (shouldFallback(type, recipient)) {
      return this.buildTextFallback(options);
    }

    switch (type) {
      case 'buttons':
        return this.buildButtons(options);
      case 'list':
        return this.buildList(options);
    }
  }

  private buildTextFallback(options: string[]): Message {
    const text = options
      .map((opt, i) => `${i + 1}. ${opt}`)
      .join('\n');

    return {
      type: 'text',
      text: `${text}\n\nReply with the number of your choice.`
    };
  }
}
```

---

## Button Builder

```typescript
function buildButtons(
  body: string,
  buttons: Array<{ id: string; title: string }>,
  footer?: string
): WhatsAppMessage {
  if (buttons.length > 3) {
    throw new Error('Buttons limited to 3 options');
  }

  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      footer: footer ? { text: footer } : undefined,
      action: {
        buttons: buttons.map(btn => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title.slice(0, 20) // Max 20 chars
          }
        }))
      }
    }
  };
}
```

---

## List Builder

```typescript
function buildList(
  body: string,
  buttonText: string,
  sections: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  footer?: string
): WhatsAppMessage {
  // Validate limits
  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);
  if (totalRows > 24) {
    throw new Error('List limited to 24 total rows');
  }
  if (sections.length > 10) {
    throw new Error('List limited to 10 sections');
  }

  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      footer: footer ? { text: footer } : undefined,
      action: {
        button: buttonText.slice(0, 20),
        sections: sections.map(section => ({
          title: section.title?.slice(0, 24),
          rows: section.rows.map(row => ({
            id: row.id,
            title: row.title.slice(0, 24),
            description: row.description?.slice(0, 72)
          }))
        }))
      }
    }
  };
}
```

---

## Citations

- **WhatsApp expert output**: Interactive message specifications
- **Archived lib/message-builders/**: Button and list builders
- **PRD Section 4.3-4.4**: Interactive messages and quick replies
- **docs-global/guides/interactive-messages.md**: Implementation patterns

---

**Lines**: 198 | **Tokens**: ~594
