import { DynamicStructuredTool } from '@langchain/core/tools';
import type { ToolContext } from '../types/index.js';
import { createListTool } from './lists/index.js';
import { createSearchTool } from './search/index.js';
import { createConversationTool } from './conversation/index.js';
import { createSchedulerTool } from './scheduler/index.js';

export interface CreateToolsOptions {
  excludeScheduler?: boolean;
}

export function createAllTools(
  context: ToolContext,
  options: CreateToolsOptions = {}
): DynamicStructuredTool[] {
  const tools: DynamicStructuredTool[] = [
    createListTool(context),
    createSearchTool(),
    createConversationTool(context),
  ];

  // Only include scheduler tool if not excluded (prevents recursive scheduling)
  if (!options.excludeScheduler) {
    tools.push(createSchedulerTool(context));
  }

  return tools;
}
