/**
 * @file calendar.ts
 * @description Calendar tool definitions (Google Calendar integration)
 * @module lib/ai/tools
 * @exports calendarTools, CalendarToolNames
 * @date 2026-01-30 15:30
 * @updated 2026-01-30 15:30
 */

import { z } from 'zod';
import type { ToolMetadata } from './types';

export const CalendarToolNames = [
  'list_events',
  'create_event',
  'update_event',
  'delete_event',
] as const;

export type CalendarToolName = (typeof CalendarToolNames)[number];

const listEventsSchema = z.object({
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  userId: z.string(),
});

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  datetime: z.string().datetime(),
  duration: z.number().int().positive().max(1440),
  userId: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
});

const updateEventSchema = z.object({
  eventId: z.string(),
  changes: z.object({
    title: z.string().optional(),
    datetime: z.string().datetime().optional(),
    duration: z.number().int().positive().max(1440).optional(),
    description: z.string().optional(),
    location: z.string().optional(),
  }),
});

const deleteEventSchema = z.object({
  eventId: z.string(),
});

export const calendarToolsMetadata: Record<CalendarToolName, ToolMetadata> = {
  list_events: {
    category: 'calendar',
    latency: 200,
    cost: 'low',
    dependencies: ['Google Calendar API'],
    edgeCompatible: true,
  },
  create_event: {
    category: 'calendar',
    latency: 300,
    cost: 'low',
    dependencies: ['Google Calendar API'],
    edgeCompatible: true,
    requiresApproval: (input: unknown) => {
      const parsed = createEventSchema.safeParse(input);
      if (!parsed.success) return true;

      const eventDate = new Date(parsed.data.datetime);
      const isBusinessHours = eventDate.getHours() >= 9 && eventDate.getHours() < 17;

      return isBusinessHours;
    },
  },
  update_event: {
    category: 'calendar',
    latency: 250,
    cost: 'low',
    dependencies: ['Google Calendar API'],
    edgeCompatible: true,
    requiresApproval: (input: unknown) => {
      const parsed = updateEventSchema.safeParse(input);
      if (!parsed.success) return true;

      if (parsed.data.changes.datetime) {
        return true;
      }

      return false;
    },
  },
  delete_event: {
    category: 'calendar',
    latency: 200,
    cost: 'low',
    dependencies: ['Google Calendar API'],
    edgeCompatible: true,
    requiresApproval: true,
  },
};

/**
 * Calendar tools - Placeholder implementations for Phase 1
 * Will be converted to proper Vercel AI SDK tool() definitions during implementation
 */
export const calendarTools = {
  list_events: {
    name: 'list_events',
    description: 'List calendar events within a date range',
    parameters: listEventsSchema,
  },
  create_event: {
    name: 'create_event',
    description: 'Create a new calendar event',
    parameters: createEventSchema,
  },
  update_event: {
    name: 'update_event',
    description: 'Update an existing calendar event',
    parameters: updateEventSchema,
  },
  delete_event: {
    name: 'delete_event',
    description: 'Delete a calendar event',
    parameters: deleteEventSchema,
  },
} as const;
