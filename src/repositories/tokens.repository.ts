import { TokenUsage as TokenUsageModel } from '../db/models/TokenUsage.js';
import type { TokenUsage } from '../agent/tokenUsage.js';

export class TokensRepository {
  private async ensureTokenUsageExists(userId: string): Promise<void> {
    const existing = await TokenUsageModel.findOne({ userId });
    if (!existing) {
      await TokenUsageModel.create({
        userId,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        lastUpdated: new Date(),
      });
    }
  }

  async loadTokenUsage(userId: string): Promise<TokenUsage> {
    await this.ensureTokenUsageExists(userId);

    const usage = await TokenUsageModel.findOne({ userId });

    if (!usage) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    return {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      lastUpdated: usage.lastUpdated.toISOString(),
    };
  }

  async saveTokenUsage(userId: string, usage: TokenUsage): Promise<void> {
    await this.ensureTokenUsageExists(userId);

    await TokenUsageModel.updateOne(
      { userId },
      {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        lastUpdated: new Date(usage.lastUpdated),
      }
    );
  }

  async addTokenUsage(
    userId: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    await this.ensureTokenUsageExists(userId);

    const usage = await TokenUsageModel.findOne({ userId });

    if (usage) {
      usage.inputTokens += inputTokens;
      usage.outputTokens += outputTokens;
      usage.totalTokens = usage.inputTokens + usage.outputTokens;
      usage.lastUpdated = new Date();
      await usage.save();
    }
  }

  async getTokenUsageFormatted(userId: string): Promise<string> {
    const usage = await this.loadTokenUsage(userId);

    return `Token usage statistics:
- Input tokens: ${usage.inputTokens.toLocaleString()}
- Output tokens: ${usage.outputTokens.toLocaleString()}
- Total tokens: ${usage.totalTokens.toLocaleString()}
- Last updated: ${usage.lastUpdated}`;
  }

  async resetTokenUsage(userId: string): Promise<void> {
    await TokenUsageModel.deleteOne({ userId });
  }
}

export const tokensRepository = new TokensRepository();
