import { ChatMistralAI } from '@langchain/mistralai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { buildSystemPrompt } from './prompts.js';
import { config } from '../config/index.js';
import { createAllTools, CreateToolsOptions } from '../tools/index.js';
import { getHistoryAsMessages, addToHistory } from './memory.js';
import { addTokenUsage } from './tokenUsage.js';
import { devLog, devLogSeparator } from '../utils/logger.js';
import type { ToolContext } from '../types/index.js';

const llm = new ChatMistralAI({
  model: config.mistral.model,
  apiKey: config.mistral.apiKey,
});

export interface RunAgentOptions {
  excludeScheduler?: boolean;
  skipHistory?: boolean;
  customSystemPrompt?: string;
}

export async function runAgent(
  context: ToolContext,
  input: string,
  options: RunAgentOptions = {}
): Promise<string> {
  devLogSeparator();
  devLog('AGENT', '🚀 New request received');
  devLog('INPUT', 'User message:', input);
  devLog('CONTEXT', 'User ID:', context.userId);
  devLog('CONTEXT', 'Sandbox path:', context.sandboxPath);
  if (options.excludeScheduler) devLog('OPTIONS', 'Scheduler tool excluded');

  try {
    return await executeAgent(context, input, options);
  } catch (error) {
    devLog('AGENT', '❌ Error:', error);
    return formatAgentError(error);
  }
}

function formatAgentError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    // API/Network errors
    if (msg.includes('rate limit') || msg.includes('429')) {
      return '⚠️ Rate limit reached. Please wait a moment and try again.';
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return '⚠️ Request timed out. The service might be slow, please try again.';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnrefused')) {
      return '⚠️ Network error. Could not reach the AI service.';
    }
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('api key')) {
      return '⚠️ Authentication error with the AI service. Please contact the admin.';
    }
    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
      return '⚠️ The AI service is temporarily unavailable. Please try again later.';
    }
    
    // Tool errors
    if (msg.includes('tool') && msg.includes('not found')) {
      return `⚠️ Internal error: ${error.message}`;
    }
    
    // Generic with message
    return `⚠️ Something went wrong: ${error.message}`;
  }
  
  return '⚠️ An unexpected error occurred. Please try again.';
}

async function executeAgent(
  context: ToolContext,
  input: string,
  options: RunAgentOptions = {}
): Promise<string> {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const toolsOptions: CreateToolsOptions = {
    excludeScheduler: options.excludeScheduler,
  };
  const tools = createAllTools(context, toolsOptions);
  devLog('TOOLS', `Loaded ${tools.length} tools:`, tools.map(t => t.name));

  const llmWithTools = llm.bindTools(tools);

  // Get conversation history (unless skipped)
  const history = options.skipHistory 
    ? [] 
    : await getHistoryAsMessages(
        context.sandboxPath,
        config.mistral.maxMessagesInHistory,
        context.channelId
      );
  devLog('HISTORY', `Loaded ${history.length} messages from history`);

  const systemPromptWithContext = options.customSystemPrompt || buildSystemPrompt();

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
        toolResults.push(`[${toolCall.name}]: Error - Tool not found`);
        continue;
      }

      devLog('TOOLS', `⚙️ Executing tool: ${toolCall.name}`, toolCall.args);
      try {
        const toolResult = await tool.invoke(toolCall.args);
        devLog('TOOLS', `✅ Tool result:`, toolResult);
        toolResults.push(`[${toolCall.name}]: ${toolResult}`);
      } catch (toolError) {
        const errorMsg = toolError instanceof Error ? toolError.message : 'Unknown error';
        devLog('TOOLS', `❌ Tool error:`, errorMsg);
        toolResults.push(`[${toolCall.name}]: Error - ${errorMsg}`);
      }
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
  await addToHistory(context.sandboxPath, 'human', input, context.channelId);
  await addToHistory(context.sandboxPath, 'ai', output, context.channelId);
  devLog('HISTORY', '💾 Saved to conversation history');

  // Save token usage
  await addTokenUsage(context.sandboxPath, totalInputTokens, totalOutputTokens);
  devLog('TOKENS', `💰 Total for this request - Input: ${totalInputTokens}, Output: ${totalOutputTokens}`);

  devLogSeparator();

  return output;
}
