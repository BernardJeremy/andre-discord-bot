import { listsRepository } from '../../repositories/lists.repository.js';

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

export async function createList(userId: string, listName: string): Promise<string> {
  return listsRepository.createList(userId, listName);
}

export async function deleteList(userId: string, listName: string): Promise<string> {
  return listsRepository.deleteList(userId, listName);
}

export async function getAllLists(userId: string): Promise<string> {
  return listsRepository.getAllLists(userId);
}

export async function getList(userId: string, listName: string): Promise<string> {
  return listsRepository.getList(userId, listName);
}

export async function addItem(
  userId: string,
  listName: string,
  itemText: string
): Promise<string> {
  return listsRepository.addItem(userId, listName, itemText);
}

export async function removeItem(
  userId: string,
  listName: string,
  itemIndex: number
): Promise<string> {
  return listsRepository.removeItem(userId, listName, itemIndex);
}

export async function toggleItem(
  userId: string,
  listName: string,
  itemIndex: number
): Promise<string> {
  return listsRepository.toggleItem(userId, listName, itemIndex);
}

export async function clearCompleted(
  userId: string,
  listName: string
): Promise<string> {
  return listsRepository.clearCompleted(userId, listName);
}
