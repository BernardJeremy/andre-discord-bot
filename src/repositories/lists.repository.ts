import { Lists } from '../db/models/Lists.js';
import type { ListItem, UserList, UserLists } from '../tools/lists/store.js';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function convertToUserLists(rawLists: any): UserLists {
  const result: UserLists = {};
  for (const [key, value] of Object.entries(rawLists)) {
    const list = value as any;
    result[key] = {
      name: list.name,
      items: (list.items || []).map((item: any) => ({
        id: item.id,
        text: item.text,
        completed: item.completed,
        createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
      })),
      createdAt: list.createdAt instanceof Date ? list.createdAt.toISOString() : list.createdAt,
      updatedAt: list.updatedAt instanceof Date ? list.updatedAt.toISOString() : list.updatedAt,
    };
  }
  return result;
}

export class ListsRepository {
  private async ensureUserExists(userId: string): Promise<void> {
    const existing = await Lists.findOne({ userId });
    if (!existing) {
      await Lists.create({
        userId,
        lists: {},
      });
    }
  }

  async createList(userId: string, listName: string): Promise<string> {
    await this.ensureUserExists(userId);

    const lists = await Lists.findOne({ userId });
    if (!lists) {
      throw new Error(`Failed to get lists document for user ${userId}`);
    }

    const normalizedName = listName.toLowerCase().trim();
    const userLists = convertToUserLists(lists.lists);

    if (userLists[normalizedName]) {
      return `List "${listName}" already exists.`;
    }

    userLists[normalizedName] = {
      name: listName,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    lists.lists = userLists as any;
    await lists.save();

    return `Created list "${listName}".`;
  }

  async deleteList(userId: string, listName: string): Promise<string> {

    const lists = await Lists.findOne({ userId });
    if (!lists) {
      return `List "${listName}" does not exist.`;
    }

    const normalizedName = listName.toLowerCase().trim();
    const userLists = convertToUserLists(lists.lists);

    if (!userLists[normalizedName]) {
      return `List "${listName}" does not exist.`;
    }

    delete userLists[normalizedName];
    lists.lists = userLists as any;
    await lists.save();

    return `Deleted list "${listName}".`;
  }

  async getAllLists(userId: string): Promise<string> {

    const lists = await Lists.findOne({ userId });
    if (!lists) {
      return 'No lists found. Create one with the "create list" action.';
    }

    const userLists = convertToUserLists(lists.lists);
    const listNames = Object.keys(userLists);

    if (listNames.length === 0) {
      return 'No lists found. Create one with the "create list" action.';
    }

    const summary = listNames.map(name => {
      const list = userLists[name];
      const total = list.items.length;
      const completed = list.items.filter(i => i.completed).length;
      return `- ${list.name} (${completed}/${total} completed)`;
    });

    return `Your lists:\n${summary.join('\n')}`;
  }

  async getList(userId: string, listName: string): Promise<string> {

    const lists = await Lists.findOne({ userId });
    if (!lists) {
      return `List "${listName}" does not exist.`;
    }

    const normalizedName = listName.toLowerCase().trim();
    const userLists = convertToUserLists(lists.lists);
    const list = userLists[normalizedName];

    if (!list) {
      return `List "${listName}" does not exist.`;
    }

    if (list.items.length === 0) {
      return `List "${list.name}" is empty.`;
    }

    const items = list.items.map((item, index) => {
      const status = item.completed ? '✅' : '⬜';
      return `${index + 1}. ${status} ${item.text}`;
    });

    return `**${list.name}**\n${items.join('\n')}`;
  }

  async addItem(
    userId: string,
    listName: string,
    itemText: string
  ): Promise<string> {
    await this.ensureUserExists(userId);

    const lists = await Lists.findOne({ userId });
    if (!lists) {
      throw new Error(`Failed to get lists document for user ${userId}`);
    }

    const normalizedName = listName.toLowerCase().trim();
    const userLists = convertToUserLists(lists.lists);

    if (!userLists[normalizedName]) {
      // Auto-create the list if it doesn't exist
      userLists[normalizedName] = {
        name: listName,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const newItem: ListItem = {
      id: generateId(),
      text: itemText,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    userLists[normalizedName].items.push(newItem);
    userLists[normalizedName].updatedAt = new Date().toISOString();

    lists.lists = userLists as any;
    await lists.save();

    return `Added "${itemText}" to ${userLists[normalizedName].name}.`;
  }

  async removeItem(
    userId: string,
    listName: string,
    itemIndex: number
  ): Promise<string> {

    const lists = await Lists.findOne({ userId });
    if (!lists) {
      return `List "${listName}" does not exist.`;
    }

    const normalizedName = listName.toLowerCase().trim();
    const userLists = convertToUserLists(lists.lists);
    const list = userLists[normalizedName];

    if (!list) {
      return `List "${listName}" does not exist.`;
    }

    const index = itemIndex - 1; // Convert to 0-based
    if (index < 0 || index >= list.items.length) {
      return `Invalid item number. List has ${list.items.length} items.`;
    }

    const removed = list.items.splice(index, 1)[0];
    list.updatedAt = new Date().toISOString();

    lists.lists = userLists as any;
    await lists.save();

    return `Removed "${removed.text}" from ${list.name}.`;
  }

  async toggleItem(
    userId: string,
    listName: string,
    itemIndex: number
  ): Promise<string> {

    const lists = await Lists.findOne({ userId });
    if (!lists) {
      return `List "${listName}" does not exist.`;
    }

    const normalizedName = listName.toLowerCase().trim();
    const userLists = convertToUserLists(lists.lists);
    const list = userLists[normalizedName];

    if (!list) {
      return `List "${listName}" does not exist.`;
    }

    const index = itemIndex - 1; // Convert to 0-based
    if (index < 0 || index >= list.items.length) {
      return `Invalid item number. List has ${list.items.length} items.`;
    }

    list.items[index].completed = !list.items[index].completed;
    list.updatedAt = new Date().toISOString();

    lists.lists = userLists as any;
    await lists.save();

    const status = list.items[index].completed ? 'completed' : 'uncompleted';
    return `Marked "${list.items[index].text}" as ${status}.`;
  }

  async clearCompleted(
    userId: string,
    listName: string
  ): Promise<string> {

    const lists = await Lists.findOne({ userId });
    if (!lists) {
      return `List "${listName}" does not exist.`;
    }

    const normalizedName = listName.toLowerCase().trim();
    const userLists = convertToUserLists(lists.lists);
    const list = userLists[normalizedName];

    if (!list) {
      return `List "${listName}" does not exist.`;
    }

    const before = list.items.length;
    list.items = list.items.filter(item => !item.completed);
    const removed = before - list.items.length;
    list.updatedAt = new Date().toISOString();

    lists.lists = userLists as any;
    await lists.save();

    return `Removed ${removed} completed items from ${list.name}.`;
  }
}

export const listsRepository = new ListsRepository();
