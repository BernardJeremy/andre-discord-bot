import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  lastUpdated: string;
}

function getTokenUsagePath(sandboxPath: string): string {
  return path.join(sandboxPath, 'token_usage.json');
}

async function ensureSandbox(sandboxPath: string): Promise<void> {
  if (!existsSync(sandboxPath)) {
    await mkdir(sandboxPath, { recursive: true });
  }
}

export async function loadTokenUsage(sandboxPath: string): Promise<TokenUsage> {
  await ensureSandbox(sandboxPath);
  const filePath = getTokenUsagePath(sandboxPath);

  if (!existsSync(filePath)) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as TokenUsage;
}

export async function saveTokenUsage(
  sandboxPath: string,
  usage: TokenUsage
): Promise<void> {
  await ensureSandbox(sandboxPath);
  const filePath = getTokenUsagePath(sandboxPath);
  await writeFile(filePath, JSON.stringify(usage, null, 2), 'utf-8');
}

export async function addTokenUsage(
  sandboxPath: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const usage = await loadTokenUsage(sandboxPath);

  usage.inputTokens += inputTokens;
  usage.outputTokens += outputTokens;
  usage.totalTokens = usage.inputTokens + usage.outputTokens;
  usage.lastUpdated = new Date().toISOString();

  await saveTokenUsage(sandboxPath, usage);
}

export async function getTokenUsageFormatted(sandboxPath: string): Promise<string> {
  const usage = await loadTokenUsage(sandboxPath);

  return `Token usage statistics:
- Input tokens: ${usage.inputTokens.toLocaleString()}
- Output tokens: ${usage.outputTokens.toLocaleString()}
- Total tokens: ${usage.totalTokens.toLocaleString()}
- Last updated: ${usage.lastUpdated}`;
}

export async function resetTokenUsage(sandboxPath: string): Promise<void> {
  const filePath = getTokenUsagePath(sandboxPath);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}
