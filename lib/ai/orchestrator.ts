/**
 * @file orchestrator.ts
 * @description Tool orchestration with multi-step execution, parallel execution, and approval workflows
 * @module lib/ai
 * @exports ToolOrchestrator, createMultiStepAgent, createSingleStepAgent, buildDependencyGraph, topologicalSort
 * @date 2026-01-30 15:30
 * @updated 2026-01-30 15:30
 */

import type { ToolExecutionContext } from './tools/types';

// NOTE: ToolLoopAgent, stepCountIs, hasToolCall imports commented out
// Will be implemented in Phase 1 when converting placeholder tools to actual tool() definitions
// import {
//   ToolLoopAgent,
//   stepCountIs,
//   hasToolCall,
//   type StepResult,
//   type ToolSet,
// } from 'ai';
// import { allTools, toolsMetadata } from './tools';

export interface OrchestratorConfig {
  maxSteps?: number;
  stopOnTools?: string[];
  enableParallelExecution?: boolean;
  enableApprovalWorkflow?: boolean;
  context: ToolExecutionContext;
}

export interface StepMetrics {
  stepNumber: number;
  toolsCalled: string[];
  tokensUsed: number;
  latencyMs: number;
  errors: string[];
}

/**
 * ToolOrchestrator - Placeholder for Phase 1 implementation
 *
 * Will be fully implemented when converting placeholder tools to actual tool() definitions
 * Current status: Type definitions and dependency graph functions only
 */
export class ToolOrchestrator {
  private config: Required<OrchestratorConfig>;
  private metrics: StepMetrics[] = [];

  constructor(config: OrchestratorConfig) {
    this.config = {
      maxSteps: config.maxSteps ?? 5,
      stopOnTools: config.stopOnTools ?? ['send_interactive', 'send_reaction'],
      enableParallelExecution: config.enableParallelExecution ?? true,
      enableApprovalWorkflow: config.enableApprovalWorkflow ?? true,
      context: config.context,
    };
  }

  // NOTE: Commented out until Phase 1 implementation
  // getStopConditions() {
  //   const conditions = [stepCountIs(this.config.maxSteps)];
  //   for (const toolName of this.config.stopOnTools) {
  //     conditions.push(hasToolCall(toolName));
  //   }
  //   return conditions;
  // }

  getMetrics() {
    return {
      totalSteps: this.metrics.length,
      totalTokens: this.metrics.reduce((sum, m) => sum + m.tokensUsed, 0),
      toolsUsed: [...new Set(this.metrics.flatMap((m) => m.toolsCalled))],
      errors: this.metrics.flatMap((m) => m.errors),
    };
  }
}

// NOTE: Commented out until Phase 1 implementation
// export function createMultiStepAgent(model: any, config: OrchestratorConfig) {
//   const orchestrator = new ToolOrchestrator(config);
//   return new ToolLoopAgent({
//     model,
//     tools: allTools,
//     stopWhen: orchestrator.getStopConditions(),
//     onStepFinish: async (step) => {
//       await orchestrator.onStepFinish(step);
//     },
//   });
// }
//
// export function createSingleStepAgent(
//   model: any,
//   config: Omit<OrchestratorConfig, 'maxSteps'>
// ) {
//   return createMultiStepAgent(model, { ...config, maxSteps: 1 });
// }

export interface DependencyGraph {
  nodes: string[];
  edges: Map<string, string[]>;
}

export function buildDependencyGraph(toolCalls: string[]): DependencyGraph {
  const graph: DependencyGraph = {
    nodes: toolCalls,
    edges: new Map(),
  };

  const dependencyRules: Record<string, string[]> = {
    get_expense_summary: ['list_expenses'],
    update_event: ['create_event'],
    get_timezone: ['extract_location'],
    detect_language: ['transcribe_audio'],
  };

  for (const tool of toolCalls) {
    const deps = dependencyRules[tool]?.filter((dep) => toolCalls.includes(dep)) ?? [];
    if (deps.length > 0) {
      graph.edges.set(tool, deps);
    }
  }

  return graph;
}

export function topologicalSort(graph: DependencyGraph): string[][] {
  const waves: string[][] = [];
  const visited = new Set<string>();
  const inDegree = new Map<string, number>();

  for (const node of graph.nodes) {
    inDegree.set(node, 0);
  }

  for (const [node, deps] of graph.edges) {
    inDegree.set(node, deps.length);
  }

  while (visited.size < graph.nodes.length) {
    const wave = graph.nodes.filter(
      (node) => !visited.has(node) && (inDegree.get(node) ?? 0) === 0
    );

    if (wave.length === 0) break;

    waves.push(wave);

    for (const node of wave) {
      visited.add(node);

      for (const [dependent, deps] of graph.edges) {
        if (deps.includes(node)) {
          const newDegree = (inDegree.get(dependent) ?? 1) - 1;
          inDegree.set(dependent, newDegree);
        }
      }
    }
  }

  return waves;
}
