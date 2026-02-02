import { DynamicStructuredTool } from '@langchain/core/tools';
import type { ToolContext } from '../types/index.js';

export function createAllTools(_context: ToolContext): DynamicStructuredTool[] {
  // Tools will be added here as we implement them
  // e.g., git tools, storage tools, search tools, scheduler tools
  return [];
}
