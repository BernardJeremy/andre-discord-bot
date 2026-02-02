import { ChatMistralAI } from '@langchain/mistralai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { buildSystemPrompt } from './prompts.js';
import { config } from '../config/index.js';
import { createAllTools } from '../tools/index.js';
import { getHistoryAsMessages, addToHistory } from './memory.js';
import { addTokenUsage } from './tokenUsage.js';
import { getAllLists } from '../tools/lists/store.js';
import { devLog, devLogSeparator } from '../utils/logger.js';
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
  devLogSeparator();
  devLog('AGENT', '🚀 New request received');
  devLog('INPUT', 'User message:', input);
  devLog('CONTEXT', 'User ID:', context.userId);
  devLog('CONTEXT', 'Sandbox path:', context.sandboxPath);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const tools = createAllTools(context);
  devLog('TOOLS', `Loaded ${tools.length} tools:`, tools.map(t => t.name));

  const llmWithTools = llm.bindTools(tools);

  // Get conversation history
  const history = await getHistoryAsMessages(context.sandboxPath, HISTORY_LIMIT);
  devLog('HISTORY', `Loaded ${history.length} messages from history`);

  // Get lists context for system prompt
  const listsContext = await getAllLists(context.sandboxPath);
  devLog('LISTS', 'Lists context:', listsContext);

  const systemPromptWithContext = buildSystemPrompt(listsContext);

  // Build messages array: system + history + new input
  const messages: BaseMessage[] = [
    new SystemMessage(systemPromptWithContext),
    ...history,
    new HumanMessage(input),
  ];

  devLog('LLM', '📤 Sending to Mistral...', { messageCount: messages.length });
  let response = await llmWithTools.invoke(messages);
  devLog('LLM', '📥 Response received');

  // Track token usage from response metadata
  if (response.usage_metadata) {
    totalInputTokens += response.usage_metadata.input_tokens || 0;
    totalOutputTokens += response.usage_metadata.output_tokens || 0;
    devLog('TOKENS', `Input: ${response.usage_metadata.input_tokens}, Output: ${response.usage_metadata.output_tokens}`);
  }

  // Handle tool calls in a loop
  let iteration = 0;
  while (response.tool_calls && response.tool_calls.length > 0) {
    iteration++;
    devLog('TOOLS', `🔧 Tool calls detected (iteration ${iteration}):`, response.tool_calls.map(tc => ({
      name: tc.name,
      args: tc.args,
    })));

    // Execute each tool call and collect results
    const toolResults: string[] = [];

    for (const toolCall of response.tool_calls) {
      const tool = tools.find(t => t.name === toolCall.name);
      if (!tool) {
        throw new Error(`Tool ${toolCall.name} not found`);
      }

      devLog('TOOLS', `⚙️ Executing tool: ${toolCall.name}`, toolCall.args);
      const toolResult = await tool.invoke(toolCall.args);
      devLog('TOOLS', `✅ Tool result:`, toolResult);
      toolResults.push(`[${toolCall.name}]: ${toolResult}`);
    }

    // Add the tool results as context in a new human message
    // This avoids ToolMessage which Mistral doesn't handle well
    const toolContext = toolResults.join('\n\n');
    messages.push(new AIMessage('I need to use some tools to help with this.'));
    messages.push(new HumanMessage(`Here are the tool results:\n\n${toolContext}\n\nPlease provide your response based on these results.`));

    // Get next response (without tools this time to get final answer)
    devLog('LLM', '📤 Sending tool results to Mistral...');
    response = await llm.invoke(messages);
    devLog('LLM', '📥 Response received');

    // Track token usage from response metadata
    if (response.usage_metadata) {
      totalInputTokens += response.usage_metadata.input_tokens || 0;
      totalOutputTokens += response.usage_metadata.output_tokens || 0;
      devLog('TOKENS', `Input: ${response.usage_metadata.input_tokens}, Output: ${response.usage_metadata.output_tokens}`);
    }
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

  devLog('OUTPUT', '💬 Final response:', output.substring(0, 200) + (output.length > 200 ? '...' : ''));

  // Save to conversation history
  await addToHistory(context.sandboxPath, 'human', input);
  await addToHistory(context.sandboxPath, 'ai', output);
  devLog('HISTORY', '💾 Saved to conversation history');

  // Save token usage
  await addTokenUsage(context.sandboxPath, totalInputTokens, totalOutputTokens);
  devLog('TOKENS', `💰 Total for this request - Input: ${totalInputTokens}, Output: ${totalOutputTokens}`);

  devLogSeparator();

  return output;
}
