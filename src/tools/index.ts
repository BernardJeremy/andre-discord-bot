import { DynamicStructuredTool } from '@langchain/core/tools';
import type { ToolContext } from '../types/index.js';
import { createListTool } from './lists/index.js';

export function createAllTools(context: ToolContext): DynamicStructuredTool[] {
  return [
    createListTool(context),
  ];
}
