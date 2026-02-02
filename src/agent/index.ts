import { ChatMistralAI } from '@langchain/mistralai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { systemPrompt } from './prompts.js';
import { config } from '../config/index.js';
import type { ToolContext } from '../types/index.js';

const llm = new ChatMistralAI({
  model: config.mistral.model,
  apiKey: config.mistral.apiKey,
});

export async function runAgent(
  _context: ToolContext,
  input: string
): Promise<string> {
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(input),
  ];

  const response = await llm.invoke(messages);
  console.log('LLM response:', response);
  return response.content as string;
}
