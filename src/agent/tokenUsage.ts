import { tokensRepository } from '../repositories/tokens.repository.js';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  lastUpdated: string;
}

export async function loadTokenUsage(userId: string): Promise<TokenUsage> {
  return tokensRepository.loadTokenUsage(userId);
}

export async function saveTokenUsage(
  userId: string,
  usage: TokenUsage
): Promise<void> {
  return tokensRepository.saveTokenUsage(userId, usage);
}

export async function addTokenUsage(
  userId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  return tokensRepository.addTokenUsage(userId, inputTokens, outputTokens);
}

export async function getTokenUsageFormatted(userId: string): Promise<string> {
  return tokensRepository.getTokenUsageFormatted(userId);
}

export async function resetTokenUsage(userId: string): Promise<void> {
  return tokensRepository.resetTokenUsage(userId);
}
