import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../../types/index.js';
import { devLog } from '../../utils/logger.js';
import { clearHistory } from '../../agent/memory.js';
import { getTokenUsageFormatted, resetTokenUsage } from '../../agent/tokenUsage.js';

export function createConversationTool(context: ToolContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'manage_conversation',
    description: `Manage conversation history and view token usage statistics.
Use this tool when the user wants to:
- Clear/reset conversation history (start fresh)
- View token usage/consumption statistics
- Reset token usage counter`,
    schema: z.object({
      action: z.enum([
        'clear_history',
        'get_token_usage',
        'reset_token_usage',
      ]).describe('The action to perform'),
    }),
    func: async ({ action }) => {
      devLog('TOOL:manage_conversation', 'Invoked', { action });
      const { sandboxPath, channelId } = context;

      switch (action) {
        case 'clear_history':
          await clearHistory(sandboxPath, channelId);
          return 'Conversation history has been cleared. Starting fresh!';

        case 'get_token_usage':
          return getTokenUsageFormatted(sandboxPath);

        case 'reset_token_usage':
          await resetTokenUsage(sandboxPath);
          return 'Token usage statistics have been reset to zero.';

        default:
          return 'Unknown action.';
      }
    },
  });
}
