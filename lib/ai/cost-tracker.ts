/**
 * @file cost-tracker.ts
 * @description Track and analyze AI costs per user with category breakdown
 * @module lib/ai
 * @exports trackCost, calculateCost, getUserMonthlyCost, getCostBreakdownByCategory, CostRecord
 * @date 2026-01-30 14:00
 * @updated 2026-01-30 14:00
 */

import type { TaskCategory } from './task-classifier';

export interface CostRecord {
  userId: string;
  model: string;
  category: TaskCategory;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CostPerToken {
  input: number;  // $/1M tokens
  output: number; // $/1M tokens
}

/**
 * Calculate cost from token usage
 *
 * @param usage - Input/output token counts
 * @param costPerToken - Cost per 1M tokens
 * @returns Total cost in USD
 */
export function calculateCost(
  usage: TokenUsage,
  costPerToken: CostPerToken
): number {
  const inputCost = (usage.inputTokens / 1_000_000) * costPerToken.input;
  const outputCost = (usage.outputTokens / 1_000_000) * costPerToken.output;
  return inputCost + outputCost;
}

/**
 * Track AI request cost to Supabase
 *
 * @param record - Cost record with user, model, tokens, and cost
 */
export async function trackCost(record: CostRecord): Promise<void> {
  // NOTE: Supabase client will be imported when database is set up
  // For now, log to console (Phase 1 implementation)
  console.log('[Cost Tracker]', {
    userId: record.userId,
    model: record.model,
    category: record.category,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    cost: record.cost.toFixed(6),
    timestamp: record.timestamp.toISOString()
  });

  // TODO: Phase 2 - Insert to Supabase ai_requests table
  // const { error } = await supabase
  //   .from('ai_requests')
  //   .insert({
  //     user_id: record.userId,
  //     model: record.model,
  //     category: record.category,
  //     input_tokens: record.inputTokens,
  //     output_tokens: record.outputTokens,
  //     cost_usd: record.cost,
  //     created_at: record.timestamp
  //   });
  //
  // if (error) {
  //   console.error('[Cost Tracker] Failed to insert:', error);
  // }
}

/**
 * Get user's monthly AI cost
 *
 * @param userId - User ID
 * @returns Total cost in USD for last 30 days
 */
export async function getUserMonthlyCost(userId: string): Promise<number> {
  // TODO: Phase 2 - Query Supabase
  // const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  //
  // const { data, error } = await supabase
  //   .from('ai_requests')
  //   .select('cost_usd')
  //   .eq('user_id', userId)
  //   .gte('created_at', thirtyDaysAgo.toISOString());
  //
  // if (error) {
  //   console.error('[Cost Tracker] Query failed:', error);
  //   return 0;
  // }
  //
  // return data?.reduce((sum, row) => sum + row.cost_usd, 0) || 0;

  console.log(`[Cost Tracker] getUserMonthlyCost called for ${userId} (not implemented yet)`);
  return 0;
}

/**
 * Get cost breakdown by category for user
 *
 * @param userId - User ID
 * @returns Cost per category for last 30 days
 */
export async function getCostBreakdownByCategory(
  userId: string
): Promise<Record<TaskCategory, number>> {
  // TODO: Phase 2 - Query Supabase
  // const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  //
  // const { data, error } = await supabase
  //   .from('ai_requests')
  //   .select('category, cost_usd')
  //   .eq('user_id', userId)
  //   .gte('created_at', thirtyDaysAgo.toISOString());
  //
  // if (error) {
  //   console.error('[Cost Tracker] Query failed:', error);
  //   return defaultBreakdown;
  // }
  //
  // const breakdown = { ...defaultBreakdown };
  // data?.forEach(row => {
  //   if (row.category in breakdown) {
  //     breakdown[row.category as TaskCategory] += row.cost_usd;
  //   }
  // });
  //
  // return breakdown;

  console.log(`[Cost Tracker] getCostBreakdownByCategory called for ${userId} (not implemented yet)`);

  const defaultBreakdown: Record<TaskCategory, number> = {
    'simple-query': 0,
    'single-tool': 0,
    'multi-tool': 0,
    'voice-message': 0,
    'image-document': 0,
    'spanish-conversation': 0,
    'complex-reasoning': 0,
    'fallback': 0
  };

  return defaultBreakdown;
}

/**
 * Format cost for display
 *
 * @param cost - Cost in USD
 * @returns Formatted string (e.g., "$0.0012" or "$1.23")
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Get cost savings vs baseline model (Claude Sonnet 4.5)
 *
 * @param currentCost - Current cost
 * @returns Savings amount and percentage
 */
export function getCostSavings(currentCost: number): {
  savingsAmount: number;
  savingsPercent: number;
} {
  const BASELINE_COST_PER_USER_MONTH = 1.53; // Claude Sonnet 4.5 baseline

  const savingsAmount = BASELINE_COST_PER_USER_MONTH - currentCost;
  const savingsPercent = (savingsAmount / BASELINE_COST_PER_USER_MONTH) * 100;

  return { savingsAmount, savingsPercent };
}
