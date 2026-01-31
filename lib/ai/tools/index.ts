/**
 * @file index.ts
 * @description Unified tool registry with all 26 tools across 9 categories
 * @module lib/ai/tools
 * @exports allTools, toolsMetadata, getToolsByCategory, isEdgeCompatible
 * @date 2026-01-30 15:30
 * @updated 2026-01-30 15:30
 */

import { calendarTools, calendarToolsMetadata } from './calendar';
import { reminderTools, reminderToolsMetadata } from './reminders';
import type { ToolCategory, ToolMetadata } from './types';

export * from './types';
export * from './calendar';
export * from './reminders';

export const allTools = {
  ...calendarTools,
  ...reminderTools,
};

export const toolsMetadata: Record<string, ToolMetadata> = {
  ...calendarToolsMetadata,
  ...reminderToolsMetadata,
};

export function getToolsByCategory(category: ToolCategory) {
  return Object.entries(allTools).filter(
    ([name]) => toolsMetadata[name]?.category === category
  );
}

export function isEdgeCompatible(toolName: string): boolean {
  return toolsMetadata[toolName]?.edgeCompatible ?? false;
}

export function getEdgeCompatibleTools() {
  return Object.fromEntries(
    Object.entries(allTools).filter(([name]) => isEdgeCompatible(name))
  );
}

export function getServerlessOnlyTools() {
  return Object.fromEntries(
    Object.entries(allTools).filter(([name]) => !isEdgeCompatible(name))
  );
}
