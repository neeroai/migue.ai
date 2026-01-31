/**
 * @file types.ts
 * @description Shared types for tool definitions and orchestration
 * @module lib/ai/tools
 * @exports ToolCategory, ToolExecutionContext, ToolMetadata, ToolApprovalDecision
 * @date 2026-01-30 15:30
 * @updated 2026-01-30 15:30
 */

import { z } from 'zod';

export type ToolCategory =
  | 'calendar'
  | 'reminders'
  | 'expenses'
  | 'memory'
  | 'language'
  | 'location'
  | 'media'
  | 'whatsapp'
  | 'context';

export interface ToolMetadata {
  category: ToolCategory;
  latency: number;
  cost: 'low' | 'medium' | 'high';
  dependencies: string[];
  edgeCompatible: boolean;
  requiresApproval?: boolean | ((input: unknown) => boolean);
}

export interface ToolExecutionContext {
  userId: string;
  conversationId: string;
  messageId: string;
  timestamp: Date;
  userTimezone: string;
  userLanguage: string;
}

export interface ToolApprovalDecision {
  approved: boolean;
  reason?: string;
  timeout: number;
}

export const ToolExecutionContextSchema = z.object({
  userId: z.string(),
  conversationId: z.string(),
  messageId: z.string(),
  timestamp: z.date(),
  userTimezone: z.string(),
  userLanguage: z.string(),
});
