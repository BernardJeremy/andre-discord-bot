import { ChatMistralAI } from '@langchain/mistralai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { buildSystemPrompt } from './prompts.js';
import { config } from '../config/index.js';
import { createAllTools, CreateToolsOptions } from '../tools/index.js';
import { getHistoryAsMessages, addToHistory } from './memory.js';
import { addTokenUsage } from './tokenUsage.js';
import { devLog, devLogSeparator } from '../utils/logger.js';
import { auditRepository } from '../repositories/audit.repository.js';
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
  options: RunAgentOptions = {},
  conversationId?: string
): Promise<string> {
  const convId = conversationId || auditRepository.generateConversationId();

  devLogSeparator();
  devLog('AGENT', '🚀 New request received');
  devLog('INPUT', 'User message:', input);
  devLog('CONTEXT', 'User ID:', context.userId);
  devLog('CONTEXT', 'Conversation ID:', convId);
  if (options.excludeScheduler) devLog('OPTIONS', 'Scheduler tool excluded');

  // Audit: log user message
  await auditRepository.logUserMessage(
    convId,
    context.userId,
    context.channelId,
    input
  );

  const startTime = Date.now();

  try {
    const result = await executeAgent(context, input, options, convId);

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Audit: log agent error
    await auditRepository.logAgentError(
      convId,
      context.userId,
      context.channelId,
      errorMsg,
      errorStack
    );

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
  options: RunAgentOptions = {},
  conversationId: string
): Promise<string> {
  const agentStartTime = Date.now();
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
        context.userId,
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

  // Serialize messages for audit
  const serializeMessages = (msgs: BaseMessage[]) =>
    msgs.map(m => ({
      role: m._getType(),
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

  // Audit: log initial LLM request
  await auditRepository.logLLMRequest(
    conversationId,
    context.userId,
    context.channelId,
    serializeMessages(messages),
    config.mistral.model,
    tools.map(t => t.name),
    0
  );

  devLog('LLM', '📤 Sending to Mistral...', { messageCount: messages.length });
  let llmStartTime = Date.now();
  let response = await llmWithTools.invoke(messages);
  let llmDuration = Date.now() - llmStartTime;
  devLog('LLM', '📥 Response received');

  // Track token usage from response metadata
  const getTokenUsage = () => {
    if (response.usage_metadata) {
      const input = response.usage_metadata.input_tokens || 0;
      const output = response.usage_metadata.output_tokens || 0;
      totalInputTokens += input;
      totalOutputTokens += output;
      devLog('TOKENS', `Input: ${input}, Output: ${output}`);
      return { input, output };
    }
    return null;
  };

  let tokenUsage = getTokenUsage();

  // Extract response content as string
  const getContentString = (content: unknown): string => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');
    }
    return String(content);
  };

  // Audit: log initial LLM response
  await auditRepository.logLLMResponse(
    conversationId,
    context.userId,
    context.channelId,
    getContentString(response.content),
    response.tool_calls?.map(tc => ({ name: tc.name, args: tc.args })) || null,
    tokenUsage,
    0,
    llmDuration
  );

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

      // Audit: log tool invocation
      await auditRepository.logToolInvocation(
        conversationId,
        context.userId,
        context.channelId,
        toolCall.name,
        toolCall.args,
        iteration
      );

      devLog('TOOLS', `⚙️ Executing tool: ${toolCall.name}`, toolCall.args);
      const toolStartTime = Date.now();
      try {
        const toolResult = await tool.invoke(toolCall.args);
        const toolDuration = Date.now() - toolStartTime;
        devLog('TOOLS', `✅ Tool result:`, toolResult);
        toolResults.push(`[${toolCall.name}]: ${toolResult}`);

        // Audit: log tool result (success)
        await auditRepository.logToolResult(
          conversationId,
          context.userId,
          context.channelId,
          toolCall.name,
          typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
          true,
          toolDuration,
          iteration
        );
      } catch (toolError) {
        const toolDuration = Date.now() - toolStartTime;
        const errorMsg = toolError instanceof Error ? toolError.message : 'Unknown error';
        devLog('TOOLS', `❌ Tool error:`, errorMsg);
        toolResults.push(`[${toolCall.name}]: Error - ${errorMsg}`);

        // Audit: log tool result (failure)
        await auditRepository.logToolResult(
          conversationId,
          context.userId,
          context.channelId,
          toolCall.name,
          errorMsg,
          false,
          toolDuration,
          iteration
        );
      }
    }

    // Add the tool results as context in a new human message
    const toolContext = toolResults.join('\n\n');
    messages.push(new AIMessage('I need to use some tools to help with this.'));
    messages.push(new HumanMessage(`Here are the tool results:\n\n${toolContext}\n\nPlease provide your response based on these results.`));

    // Audit: log follow-up LLM request
    await auditRepository.logLLMRequest(
      conversationId,
      context.userId,
      context.channelId,
      serializeMessages(messages),
      config.mistral.model,
      tools.map(t => t.name),
      iteration
    );

    // Get next response (without tools this time to get final answer)
    devLog('LLM', '📤 Sending tool results to Mistral...');
    llmStartTime = Date.now();
    response = await llm.invoke(messages);
    llmDuration = Date.now() - llmStartTime;
    devLog('LLM', '📥 Response received');

    tokenUsage = getTokenUsage();

    // Audit: log follow-up LLM response
    await auditRepository.logLLMResponse(
      conversationId,
      context.userId,
      context.channelId,
      getContentString(response.content),
      response.tool_calls?.map(tc => ({ name: tc.name, args: tc.args })) || null,
      tokenUsage,
      iteration,
      llmDuration
    );
  }

  // Ensure output is a string
  const output = getContentString(response.content);

  devLog('OUTPUT', '💬 Final response:', output.substring(0, 200) + (output.length > 200 ? '...' : ''));

  // Save to conversation history
  await addToHistory(context.userId, 'human', input, context.channelId);
  await addToHistory(context.userId, 'ai', output, context.channelId);
  devLog('HISTORY', '💾 Saved to conversation history');

  // Save token usage
  await addTokenUsage(context.userId, totalInputTokens, totalOutputTokens);
  devLog('TOKENS', `💰 Total for this request - Input: ${totalInputTokens}, Output: ${totalOutputTokens}`);

  const totalDuration = Date.now() - agentStartTime;

  // Audit: log final agent response
  await auditRepository.logAgentResponse(
    conversationId,
    context.userId,
    context.channelId,
    output,
    { input: totalInputTokens, output: totalOutputTokens },
    totalDuration,
    iteration
  );

  devLogSeparator();

  return output;
}
