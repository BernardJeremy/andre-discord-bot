import { AuditLog, AuditEventType, IAuditLog } from '../db/models/AuditLog.js';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  conversationId: string;
  userId: string;
  channelId: string;
  eventType: AuditEventType;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQuery {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  channelId?: string;
  conversationId?: string;
  eventType?: AuditEventType | AuditEventType[];
  toolName?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Generate a unique conversation ID for grouping related audit events
 */
export function generateConversationId(): string {
  return uuidv4();
}

/**
 * Insert a single audit log entry
 */
async function log(entry: AuditLogEntry): Promise<IAuditLog> {
  try {
    return await AuditLog.create({
      conversationId: entry.conversationId,
      userId: entry.userId,
      channelId: entry.channelId,
      eventType: entry.eventType,
      payload: entry.payload,
      metadata: entry.metadata || {},
      timestamp: new Date(),
    });
  } catch (error) {
    // Silently fail audit logging to not disrupt bot operations
    console.error('[AUDIT] Failed to write audit log:', error);
    return {} as IAuditLog;
  }
}

/**
 * Log an incoming user message
 */
async function logUserMessage(
  conversationId: string,
  userId: string,
  channelId: string,
  content: string,
  username?: string
): Promise<void> {
  await log({
    conversationId,
    userId,
    channelId,
    eventType: 'user_message',
    payload: { content, username },
  });
}

/**
 * Log an LLM API request with full context
 */
async function logLLMRequest(
  conversationId: string,
  userId: string,
  channelId: string,
  messages: Array<{ role: string; content: string }>,
  model: string,
  toolNames: string[],
  iteration: number
): Promise<void> {
  await log({
    conversationId,
    userId,
    channelId,
    eventType: 'llm_request',
    payload: {
      messages,
      model,
      availableTools: toolNames,
      iteration,
    },
    metadata: {
      messageCount: messages.length,
    },
  });
}

/**
 * Log an LLM API response
 */
async function logLLMResponse(
  conversationId: string,
  userId: string,
  channelId: string,
  content: string,
  toolCalls: Array<{ name: string; args: Record<string, unknown> }> | null,
  tokenUsage: { input: number; output: number } | null,
  iteration: number,
  durationMs: number
): Promise<void> {
  await log({
    conversationId,
    userId,
    channelId,
    eventType: 'llm_response',
    payload: {
      content: content.substring(0, 10000), // Cap stored content
      toolCalls,
      hasToolCalls: !!(toolCalls && toolCalls.length > 0),
      iteration,
    },
    metadata: {
      tokenUsage,
      durationMs,
    },
  });
}

/**
 * Log a tool invocation (before execution)
 */
async function logToolInvocation(
  conversationId: string,
  userId: string,
  channelId: string,
  toolName: string,
  args: Record<string, unknown>,
  iteration: number
): Promise<void> {
  await log({
    conversationId,
    userId,
    channelId,
    eventType: 'tool_invocation',
    payload: {
      toolName,
      args,
      iteration,
    },
  });
}

/**
 * Log a tool result (after execution)
 */
async function logToolResult(
  conversationId: string,
  userId: string,
  channelId: string,
  toolName: string,
  result: string,
  success: boolean,
  durationMs: number,
  iteration: number
): Promise<void> {
  await log({
    conversationId,
    userId,
    channelId,
    eventType: 'tool_result',
    payload: {
      toolName,
      result: result.substring(0, 10000), // Cap stored result
      success,
      iteration,
    },
    metadata: {
      durationMs,
    },
  });
}

/**
 * Log an agent error
 */
async function logAgentError(
  conversationId: string,
  userId: string,
  channelId: string,
  error: string,
  stack?: string
): Promise<void> {
  await log({
    conversationId,
    userId,
    channelId,
    eventType: 'agent_error',
    payload: {
      error,
      stack,
    },
  });
}

/**
 * Log the final agent response sent to the user
 */
async function logAgentResponse(
  conversationId: string,
  userId: string,
  channelId: string,
  response: string,
  totalTokens: { input: number; output: number },
  totalDurationMs: number,
  iterations: number
): Promise<void> {
  await log({
    conversationId,
    userId,
    channelId,
    eventType: 'agent_response',
    payload: {
      response: response.substring(0, 10000),
      iterations,
    },
    metadata: {
      totalTokens,
      totalDurationMs,
    },
  });
}

/**
 * Log a scheduler event
 */
async function logSchedulerEvent(
  conversationId: string,
  userId: string,
  channelId: string,
  eventName: string,
  details: Record<string, unknown>
): Promise<void> {
  await log({
    conversationId,
    userId,
    channelId,
    eventType: 'scheduler_event',
    payload: {
      eventName,
      ...details,
    },
  });
}

// ─── Query Methods ───────────────────────────────────────────────

/**
 * Query audit logs with filtering and pagination
 */
async function query(params: AuditLogQuery): Promise<PaginatedResult<IAuditLog>> {
  const page = params.page || 1;
  const limit = Math.min(params.limit || 50, 200);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (params.startDate || params.endDate) {
    filter.timestamp = {};
    if (params.startDate) (filter.timestamp as Record<string, unknown>).$gte = params.startDate;
    if (params.endDate) (filter.timestamp as Record<string, unknown>).$lte = params.endDate;
  }

  if (params.userId) filter.userId = params.userId;
  if (params.channelId) filter.channelId = params.channelId;
  if (params.conversationId) filter.conversationId = params.conversationId;

  if (params.eventType) {
    filter.eventType = Array.isArray(params.eventType)
      ? { $in: params.eventType }
      : params.eventType;
  }

  if (params.toolName) {
    filter['payload.toolName'] = params.toolName;
  }

  const [data, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    data: data as unknown as IAuditLog[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get full conversation audit trail by conversationId
 */
async function getConversationTrail(conversationId: string): Promise<IAuditLog[]> {
  const data = await AuditLog.find({ conversationId })
    .sort({ timestamp: 1 })
    .lean();
  return data as unknown as IAuditLog[];
}

/**
 * Get distinct user IDs that have audit logs
 */
async function getDistinctUsers(): Promise<string[]> {
  return AuditLog.distinct('userId');
}

/**
 * Get distinct tool names used
 */
async function getDistinctTools(): Promise<string[]> {
  const tools = await AuditLog.distinct('payload.toolName', { eventType: 'tool_invocation' });
  return tools as string[];
}

/**
 * Get aggregate stats
 */
async function getStats(): Promise<{
  totalLogs: number;
  totalConversations: number;
  totalUsers: number;
  eventTypeCounts: Record<string, number>;
}> {
  const [totalLogs, totalConversations, totalUsers, eventTypeCounts] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.distinct('conversationId').then(arr => arr.length),
    AuditLog.distinct('userId').then(arr => arr.length),
    AuditLog.aggregate([
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]).then(results =>
      results.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {} as Record<string, number>)
    ),
  ]);

  return { totalLogs, totalConversations, totalUsers, eventTypeCounts };
}

/**
 * Get recent conversations (grouped by conversationId)
 */
async function getRecentConversations(
  limit: number = 20,
  userId?: string
): Promise<Array<{
  conversationId: string;
  userId: string;
  channelId: string;
  startedAt: Date;
  eventCount: number;
  firstMessage: string;
}>> {
  const match: Record<string, unknown> = { eventType: 'user_message' };
  if (userId) match.userId = userId;

  return AuditLog.aggregate([
    { $match: match },
    { $sort: { timestamp: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'auditlogs',
        localField: 'conversationId',
        foreignField: 'conversationId',
        as: 'allEvents',
      },
    },
    {
      $project: {
        conversationId: 1,
        userId: 1,
        channelId: 1,
        startedAt: '$timestamp',
        eventCount: { $size: '$allEvents' },
        firstMessage: '$payload.content',
      },
    },
  ]);
}

export const auditRepository = {
  generateConversationId,
  logUserMessage,
  logLLMRequest,
  logLLMResponse,
  logToolInvocation,
  logToolResult,
  logAgentError,
  logAgentResponse,
  logSchedulerEvent,
  query,
  getConversationTrail,
  getDistinctUsers,
  getDistinctTools,
  getStats,
  getRecentConversations,
};
