/**
 * @file reminders.ts
 * @description Reminder tool definitions (Supabase integration)
 * @module lib/ai/tools
 * @exports reminderTools, ReminderToolNames
 * @date 2026-01-30 15:30
 * @updated 2026-01-30 15:30
 */

import { z } from 'zod';
import type { ToolMetadata } from './types';

export const ReminderToolNames = [
  'create_reminder',
  'list_reminders',
  'update_reminder',
  'delete_reminder',
] as const;

export type ReminderToolName = (typeof ReminderToolNames)[number];

const createReminderSchema = z.object({
  message: z.string().min(1).max(500),
  datetime: z.string().datetime(),
  userId: z.string(),
  recurring: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
});

const listRemindersSchema = z.object({
  userId: z.string(),
  status: z.enum(['pending', 'completed', 'all']).optional(),
});

const updateReminderSchema = z.object({
  reminderId: z.string(),
  changes: z.object({
    message: z.string().min(1).max(500).optional(),
    datetime: z.string().datetime().optional(),
    status: z.enum(['pending', 'completed']).optional(),
    recurring: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
  }),
});

const deleteReminderSchema = z.object({
  reminderId: z.string(),
});

export const reminderToolsMetadata: Record<ReminderToolName, ToolMetadata> = {
  create_reminder: {
    category: 'reminders',
    latency: 150,
    cost: 'low',
    dependencies: ['Supabase'],
    edgeCompatible: true,
    requiresApproval: false,
  },
  list_reminders: {
    category: 'reminders',
    latency: 100,
    cost: 'low',
    dependencies: ['Supabase'],
    edgeCompatible: true,
  },
  update_reminder: {
    category: 'reminders',
    latency: 150,
    cost: 'low',
    dependencies: ['Supabase'],
    edgeCompatible: true,
  },
  delete_reminder: {
    category: 'reminders',
    latency: 100,
    cost: 'low',
    dependencies: ['Supabase'],
    edgeCompatible: true,
    requiresApproval: true,
  },
};

/**
 * Reminder tools - Placeholder implementations for Phase 1
 * Will be converted to proper Vercel AI SDK tool() definitions during implementation
 */
export const reminderTools = {
  create_reminder: {
    name: 'create_reminder',
    description: 'Create a new reminder for the user',
    parameters: createReminderSchema,
  },
  list_reminders: {
    name: 'list_reminders',
    description: 'List user reminders with optional status filter',
    parameters: listRemindersSchema,
  },
  update_reminder: {
    name: 'update_reminder',
    description: 'Update an existing reminder',
    parameters: updateReminderSchema,
  },
  delete_reminder: {
    name: 'delete_reminder',
    description: 'Delete a reminder',
    parameters: deleteReminderSchema,
  },
} as const;
