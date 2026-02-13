import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { ConversationHistory } from '../db/models/ConversationHistory.js';
import type { StoredMessage, ConversationHistory as ConversationHistoryType } from '../agent/memory.js';
import { config } from '../config/index.js';

export class ConversationsRepository {
  private async ensureConversationExists(
    userId: string,
    channelId: string
  ): Promise<void> {
    const existing = await ConversationHistory.findOne({ userId, channelId });
    if (!existing) {
      await ConversationHistory.create({
        userId,
        channelId,
        messages: [],
      });
    }
  }

  private convertToStoredMessages(mongoMessages: any[]): StoredMessage[] {
    return mongoMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
    }));
  }

  async loadHistory(
    userId: string,
    channelId?: string | null
  ): Promise<ConversationHistoryType> {
    const actualChannelId = channelId || 'dm';

    const history = await ConversationHistory.findOne({
      userId,
      channelId: actualChannelId,
    });

    if (!history) {
      return { messages: [] };
    }

    return {
      messages: this.convertToStoredMessages(history.messages),
    };
  }

  async saveHistory(
    userId: string,
    history: ConversationHistoryType,
    channelId?: string | null
  ): Promise<void> {
    const actualChannelId = channelId || 'dm';

    await this.ensureConversationExists(userId, actualChannelId);

    // Keep only the last N messages
    let messages = history.messages;
    if (messages.length > config.mistral.maxMessagesInHistory) {
      messages = messages.slice(-config.mistral.maxMessagesInHistory);
    }

    const convertedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
    }));

    const historyDoc = await ConversationHistory.findOne({
      userId,
      channelId: actualChannelId,
    });

    if (historyDoc) {
      historyDoc.messages = convertedMessages;
      await historyDoc.save();
    }
  }

  async addToHistory(
    userId: string,
    role: 'human' | 'ai',
    content: string,
    channelId?: string | null
  ): Promise<void> {
    const actualChannelId = channelId || 'dm';

    await this.ensureConversationExists(userId, actualChannelId);

    const history = await ConversationHistory.findOne({
      userId,
      channelId: actualChannelId,
    });

    if (history) {
      history.messages.push({
        role,
        content,
        timestamp: new Date(),
      });

      // Keep only the last N messages
      if (history.messages.length > config.mistral.maxMessagesInHistory) {
        history.messages = history.messages.slice(-config.mistral.maxMessagesInHistory);
      }

      await history.save();
    }
  }

  async getHistoryAsMessages(
    userId: string,
    limit?: number,
    channelId?: string | null
  ): Promise<BaseMessage[]> {
    const history = await this.loadHistory(userId, channelId);
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

  async clearHistory(
    userId: string,
    channelId?: string | null
  ): Promise<void> {
    const actualChannelId = channelId || 'dm';

    await ConversationHistory.deleteOne({
      userId,
      channelId: actualChannelId,
    });
  }
}

export const conversationsRepository = new ConversationsRepository();
