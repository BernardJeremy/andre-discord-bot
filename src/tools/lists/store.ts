import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface ListItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface UserList {
  name: string;
  items: ListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface UserLists {
  [listName: string]: UserList;
}

function getListsPath(sandboxPath: string): string {
  return path.join(sandboxPath, 'lists.json');
}

async function ensureSandbox(sandboxPath: string): Promise<void> {
  if (!existsSync(sandboxPath)) {
    await mkdir(sandboxPath, { recursive: true });
  }
}

async function loadLists(sandboxPath: string): Promise<UserLists> {
  await ensureSandbox(sandboxPath);
  const filePath = getListsPath(sandboxPath);
  
  if (!existsSync(filePath)) {
    return {};
  }
  
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as UserLists;
}

async function saveLists(sandboxPath: string, lists: UserLists): Promise<void> {
  await ensureSandbox(sandboxPath);
  const filePath = getListsPath(sandboxPath);
  await writeFile(filePath, JSON.stringify(lists, null, 2), 'utf-8');
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export async function createList(sandboxPath: string, listName: string): Promise<string> {
  const lists = await loadLists(sandboxPath);
  const normalizedName = listName.toLowerCase().trim();
  
  if (lists[normalizedName]) {
    return `List "${listName}" already exists.`;
  }
  
  lists[normalizedName] = {
    name: listName,
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await saveLists(sandboxPath, lists);
  return `Created list "${listName}".`;
}

export async function deleteList(sandboxPath: string, listName: string): Promise<string> {
  const lists = await loadLists(sandboxPath);
  const normalizedName = listName.toLowerCase().trim();
  
  if (!lists[normalizedName]) {
    return `List "${listName}" does not exist.`;
  }
  
  delete lists[normalizedName];
  await saveLists(sandboxPath, lists);
  return `Deleted list "${listName}".`;
}

export async function getAllLists(sandboxPath: string): Promise<string> {
  const lists = await loadLists(sandboxPath);
  const listNames = Object.keys(lists);
  
  if (listNames.length === 0) {
    return 'No lists found. Create one with the "create list" action.';
  }
  
  const summary = listNames.map(name => {
    const list = lists[name];
    const total = list.items.length;
    const completed = list.items.filter(i => i.completed).length;
    return `- ${list.name} (${completed}/${total} completed)`;
  });
  
  return `Your lists:\n${summary.join('\n')}`;
}

export async function getList(sandboxPath: string, listName: string): Promise<string> {
  const lists = await loadLists(sandboxPath);
  const normalizedName = listName.toLowerCase().trim();
  const list = lists[normalizedName];
  
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

export async function addItem(
  sandboxPath: string,
  listName: string,
  itemText: string
): Promise<string> {
  const lists = await loadLists(sandboxPath);
  const normalizedName = listName.toLowerCase().trim();
  
  if (!lists[normalizedName]) {
    // Auto-create the list if it doesn't exist
    lists[normalizedName] = {
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
  
  lists[normalizedName].items.push(newItem);
  lists[normalizedName].updatedAt = new Date().toISOString();
  
  await saveLists(sandboxPath, lists);
  return `Added "${itemText}" to ${lists[normalizedName].name}.`;
}

export async function removeItem(
  sandboxPath: string,
  listName: string,
  itemIndex: number
): Promise<string> {
  const lists = await loadLists(sandboxPath);
  const normalizedName = listName.toLowerCase().trim();
  const list = lists[normalizedName];
  
  if (!list) {
    return `List "${listName}" does not exist.`;
  }
  
  const index = itemIndex - 1; // Convert to 0-based
  if (index < 0 || index >= list.items.length) {
    return `Invalid item number. List has ${list.items.length} items.`;
  }
  
  const removed = list.items.splice(index, 1)[0];
  list.updatedAt = new Date().toISOString();
  
  await saveLists(sandboxPath, lists);
  return `Removed "${removed.text}" from ${list.name}.`;
}

export async function toggleItem(
  sandboxPath: string,
  listName: string,
  itemIndex: number
): Promise<string> {
  const lists = await loadLists(sandboxPath);
  const normalizedName = listName.toLowerCase().trim();
  const list = lists[normalizedName];
  
  if (!list) {
    return `List "${listName}" does not exist.`;
  }
  
  const index = itemIndex - 1; // Convert to 0-based
  if (index < 0 || index >= list.items.length) {
    return `Invalid item number. List has ${list.items.length} items.`;
  }
  
  list.items[index].completed = !list.items[index].completed;
  list.updatedAt = new Date().toISOString();
  
  await saveLists(sandboxPath, lists);
  
  const status = list.items[index].completed ? 'completed' : 'uncompleted';
  return `Marked "${list.items[index].text}" as ${status}.`;
}

export async function clearCompleted(
  sandboxPath: string,
  listName: string
): Promise<string> {
  const lists = await loadLists(sandboxPath);
  const normalizedName = listName.toLowerCase().trim();
  const list = lists[normalizedName];
  
  if (!list) {
    return `List "${listName}" does not exist.`;
  }
  
  const before = list.items.length;
  list.items = list.items.filter(item => !item.completed);
  const removed = before - list.items.length;
  list.updatedAt = new Date().toISOString();
  
  await saveLists(sandboxPath, lists);
  return `Removed ${removed} completed items from ${list.name}.`;
}
