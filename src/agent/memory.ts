import { BaseMessage } from '@langchain/core/messages';
import { conversationsRepository } from '../repositories/conversations.repository.js';

export interface StoredMessage {
  role: 'human' | 'ai';
  content: string;
  timestamp: string;
}

export interface ConversationHistory {
  messages: StoredMessage[];
}

export async function loadHistory(
  userId: string,
  channelId?: string | null
): Promise<ConversationHistory> {
  return conversationsRepository.loadHistory(userId, channelId);
}

export async function saveHistory(
  userId: string,
  history: ConversationHistory,
  channelId?: string | null
): Promise<void> {
  return conversationsRepository.saveHistory(userId, history, channelId);
}

export async function addToHistory(
  userId: string,
  role: 'human' | 'ai',
  content: string,
  channelId?: string | null
): Promise<void> {
  return conversationsRepository.addToHistory(userId, role, content, channelId);
}

export async function getHistoryAsMessages(
  userId: string,
  limit?: number,
  channelId?: string | null
): Promise<BaseMessage[]> {
  return conversationsRepository.getHistoryAsMessages(userId, limit, channelId);
}

export async function clearHistory(
  userId: string,
  channelId?: string | null
): Promise<void> {
  return conversationsRepository.clearHistory(userId, channelId);
}
