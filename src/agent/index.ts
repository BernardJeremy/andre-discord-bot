import { ChatMistralAI } from '@langchain/mistralai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { buildSystemPrompt } from './prompts.js';
import { config } from '../config/index.js';
import { createAllTools } from '../tools/index.js';
import { getHistoryAsMessages, addToHistory } from './memory.js';
import { getAllLists } from '../tools/lists/store.js';
import type { ToolContext } from '../types/index.js';

const HISTORY_LIMIT = 10; // Number of previous exchanges to include

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

  // Get conversation history
  const history = await getHistoryAsMessages(context.sandboxPath, HISTORY_LIMIT);

  // Get lists context for system prompt
  const listsContext = await getAllLists(context.sandboxPath);
  const systemPromptWithContext = buildSystemPrompt(listsContext);

  // Build messages array: system + history + new input
  const messages: BaseMessage[] = [
    new SystemMessage(systemPromptWithContext),
    ...history,
    new HumanMessage(input),
  ];

  let response = await llmWithTools.invoke(messages);

  // Handle tool calls in a loop
  while (response.tool_calls && response.tool_calls.length > 0) {
    // Execute each tool call and collect results
    const toolResults: string[] = [];

    for (const toolCall of response.tool_calls) {
      const tool = tools.find(t => t.name === toolCall.name);
      if (!tool) {
        throw new Error(`Tool ${toolCall.name} not found`);
      }

      const toolResult = await tool.invoke(toolCall.args);
      toolResults.push(`[${toolCall.name}]: ${toolResult}`);
    }

    // Add the tool results as context in a new human message
    // This avoids ToolMessage which Mistral doesn't handle well
    const toolContext = toolResults.join('\n\n');
    messages.push(new AIMessage('I need to use some tools to help with this.'));
    messages.push(new HumanMessage(`Here are the tool results:\n\n${toolContext}\n\nPlease provide your response based on these results.`));

    // Get next response (without tools this time to get final answer)
    response = await llm.invoke(messages);
  }

  // Ensure output is a string
  let output: string;
  if (typeof response.content === 'string') {
    output = response.content;
  } else if (Array.isArray(response.content)) {
    output = response.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');
  } else {
    output = String(response.content);
  }

  // Save to conversation history
  await addToHistory(context.sandboxPath, 'human', input);
  await addToHistory(context.sandboxPath, 'ai', output);

  return output;
}
