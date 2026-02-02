import { ChatMistralAI } from '@langchain/mistralai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { systemPrompt } from './prompts.js';
import { config } from '../config/index.js';
import { createAllTools } from '../tools/index.js';
import type { ToolContext } from '../types/index.js';

const llm = new ChatMistralAI({
  model: config.mistral.model,
  apiKey: config.mistral.apiKey,
});

export async function runAgent(
  context: ToolContext,
  input: string
): Promise<string> {
  const tools = createAllTools(context);
  const llmWithTools = llm.bindTools(tools);

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(input),
  ];

  let response = await llmWithTools.invoke(messages);

  console.log('Initial response:', response);

  // Handle tool calls in a loop
  while (response.tool_calls && response.tool_calls.length > 0) {
    // Add assistant message with tool calls
    messages.push(response);

    // Execute each tool call
    for (const toolCall of response.tool_calls) {
      const tool = tools.find(t => t.name === toolCall.name);
      if (!tool) {
        throw new Error(`Tool ${toolCall.name} not found`);
      }

      const toolResult = await tool.invoke(toolCall.args);

      // Add tool result message
      messages.push({
        role: 'tool',
        content: toolResult,
        tool_call_id: toolCall.id,
      } as any);
    }

    // Get next response
    response = await llmWithTools.invoke(messages);
  }

  return response.content as string;
}
