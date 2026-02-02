import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../../types/index.js';
import {
  createList,
  deleteList,
  getAllLists,
  getList,
  addItem,
  removeItem,
  toggleItem,
  clearCompleted,
} from './store.js';

export function createListTool(context: ToolContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'manage_list',
    description: `Manage user's lists (todo lists, shopping lists, etc.). 
Use this tool to create lists, add/remove items, mark items as complete, and view list contents.
Lists are automatically created when adding items if they don't exist.`,
    schema: z.object({
      action: z.enum([
        'get_all_lists',
        'get_list',
        'create_list',
        'delete_list',
        'add_item',
        'remove_item',
        'toggle_item',
        'clear_completed',
      ]).describe('The action to perform on the list'),
      listName: z.string().optional().describe('Name of the list (e.g., "groceries", "todo", "movies to watch")'),
      itemText: z.string().optional().describe('Text of the item to add'),
      itemIndex: z.number().optional().describe('1-based index of the item to remove or toggle'),
    }),
    func: async ({ action, listName, itemText, itemIndex }) => {
      const { sandboxPath } = context;

      switch (action) {
        case 'get_all_lists':
          return getAllLists(sandboxPath);

        case 'get_list':
          if (!listName) return 'Please specify a list name.';
          return getList(sandboxPath, listName);

        case 'create_list':
          if (!listName) return 'Please specify a list name.';
          return createList(sandboxPath, listName);

        case 'delete_list':
          if (!listName) return 'Please specify a list name.';
          return deleteList(sandboxPath, listName);

        case 'add_item':
          if (!listName) return 'Please specify a list name.';
          if (!itemText) return 'Please specify the item text.';
          return addItem(sandboxPath, listName, itemText);

        case 'remove_item':
          if (!listName) return 'Please specify a list name.';
          if (itemIndex === undefined) return 'Please specify the item number.';
          return removeItem(sandboxPath, listName, itemIndex);

        case 'toggle_item':
          if (!listName) return 'Please specify a list name.';
          if (itemIndex === undefined) return 'Please specify the item number.';
          return toggleItem(sandboxPath, listName, itemIndex);

        case 'clear_completed':
          if (!listName) return 'Please specify a list name.';
          return clearCompleted(sandboxPath, listName);

        default:
          return 'Unknown action.';
      }
    },
  });
}
