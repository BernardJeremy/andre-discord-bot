import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

export interface StoredMessage {
  role: 'human' | 'ai';
  content: string;
  timestamp: string;
}

export interface ConversationHistory {
  messages: StoredMessage[];
}

const MAX_MESSAGES = 20; // Keep last N messages

function getHistoryPath(sandboxPath: string): string {
  return path.join(sandboxPath, 'conversation.json');
}

async function ensureSandbox(sandboxPath: string): Promise<void> {
  if (!existsSync(sandboxPath)) {
    await mkdir(sandboxPath, { recursive: true });
  }
}

export async function loadHistory(sandboxPath: string): Promise<ConversationHistory> {
  await ensureSandbox(sandboxPath);
  const filePath = getHistoryPath(sandboxPath);

  if (!existsSync(filePath)) {
    return { messages: [] };
  }

  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as ConversationHistory;
}

export async function saveHistory(
  sandboxPath: string,
  history: ConversationHistory
): Promise<void> {
  await ensureSandbox(sandboxPath);
  const filePath = getHistoryPath(sandboxPath);

  // Keep only the last N messages
  if (history.messages.length > MAX_MESSAGES) {
    history.messages = history.messages.slice(-MAX_MESSAGES);
  }

  await writeFile(filePath, JSON.stringify(history, null, 2), 'utf-8');
}

export async function addToHistory(
  sandboxPath: string,
  role: 'human' | 'ai',
  content: string
): Promise<void> {
  const history = await loadHistory(sandboxPath);

  history.messages.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });

  await saveHistory(sandboxPath, history);
}

export async function getHistoryAsMessages(
  sandboxPath: string,
  limit?: number
): Promise<BaseMessage[]> {
  const history = await loadHistory(sandboxPath);
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

export async function clearHistory(sandboxPath: string): Promise<void> {
  const filePath = getHistoryPath(sandboxPath);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}
