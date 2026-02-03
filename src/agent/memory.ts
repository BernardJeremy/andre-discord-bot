import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { config } from '../config/index.js';

export interface StoredMessage {
  role: 'human' | 'ai';
  content: string;
  timestamp: string;
}

export interface ConversationHistory {
  messages: StoredMessage[];
}

function getHistoryPath(sandboxPath: string, channelId?: string | null): string {
  if (channelId) {
    return path.join(sandboxPath, 'conversations', `${channelId}.json`);
  }

  return path.join(sandboxPath, 'conversation.json');
}

async function ensureSandbox(sandboxPath: string): Promise<void> {
  if (!existsSync(sandboxPath)) {
    await mkdir(sandboxPath, { recursive: true });
  }
}

export async function loadHistory(
  sandboxPath: string,
  channelId?: string | null
): Promise<ConversationHistory> {
  await ensureSandbox(sandboxPath);
  const filePath = getHistoryPath(sandboxPath, channelId);

  if (channelId) {
    await mkdir(path.dirname(filePath), { recursive: true });
  }

  if (!existsSync(filePath)) {
    return { messages: [] };
  }

  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as ConversationHistory;
}

export async function saveHistory(
  sandboxPath: string,
  history: ConversationHistory,
  channelId?: string | null
): Promise<void> {
  await ensureSandbox(sandboxPath);
  const filePath = getHistoryPath(sandboxPath, channelId);

  if (channelId) {
    await mkdir(path.dirname(filePath), { recursive: true });
  }

  // Keep only the last N messages
  if (history.messages.length > config.mistral.maxMessagesInHistory) {
    history.messages = history.messages.slice(-config.mistral.maxMessagesInHistory);
  }

  await writeFile(filePath, JSON.stringify(history, null, 2), 'utf-8');
}

export async function addToHistory(
  sandboxPath: string,
  role: 'human' | 'ai',
  content: string,
  channelId?: string | null
): Promise<void> {
  const history = await loadHistory(sandboxPath, channelId);

  history.messages.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });

  await saveHistory(sandboxPath, history, channelId);
}

export async function getHistoryAsMessages(
  sandboxPath: string,
  limit?: number,
  channelId?: string | null
): Promise<BaseMessage[]> {
  const history = await loadHistory(sandboxPath, channelId);
  const messages = limit ? history.messages.slice(-limit) : history.messages;

  return messages.map((msg) => {
    // Ensure content is always a string
    let content = msg.content;
    if (typeof content !== 'string') {
      // Handle complex content (arrays with text/reference objects)
      if (Array.isArray(content)) {
        content = (content as any[])
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('');
      } else {
        content = String(content);
      }
    }

    return msg.role === 'human'
      ? new HumanMessage(content)
      : new AIMessage(content);
  });
}

export async function clearHistory(
  sandboxPath: string,
  channelId?: string | null
): Promise<void> {
  const filePath = getHistoryPath(sandboxPath, channelId);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}
