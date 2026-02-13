import { Router, Request, Response } from 'express';
import { auditRepository, AuditLogQuery } from '../../repositories/audit.repository.js';
import { AuditEventType } from '../../db/models/AuditLog.js';

export const logsRouter = Router();

/**
 * GET /api/logs - Query audit logs with filters
 */
logsRouter.get('/logs', async (req: Request, res: Response) => {
  try {
    const query: AuditLogQuery = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    };

    if (req.query.startDate) query.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) query.endDate = new Date(req.query.endDate as string);
    if (req.query.userId) query.userId = req.query.userId as string;
    if (req.query.channelId) query.channelId = req.query.channelId as string;
    if (req.query.conversationId) query.conversationId = req.query.conversationId as string;
    if (req.query.eventType) {
      const types = (req.query.eventType as string).split(',') as AuditEventType[];
      query.eventType = types.length === 1 ? types[0] : types;
    }
    if (req.query.toolName) query.toolName = req.query.toolName as string;

    const result = await auditRepository.query(query);
    res.json(result);
  } catch (error) {
    console.error('Error querying audit logs:', error);
    res.status(500).json({ error: 'Failed to query logs' });
  }
});

/**
 * GET /api/logs/:id - Get a specific log entry
 */
logsRouter.get('/logs/:id', async (req: Request, res: Response) => {
  try {
    const { AuditLog } = await import('../../db/models/AuditLog.js');
    const log = await AuditLog.findById(req.params.id).lean();
    if (!log) {
      res.status(404).json({ error: 'Log not found' });
      return;
    }
    res.json(log);
  } catch (error) {
    console.error('Error fetching log:', error);
    res.status(500).json({ error: 'Failed to fetch log' });
  }
});

/**
 * GET /api/conversations/:conversationId - Get full conversation audit trail
 */
logsRouter.get('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const trail = await auditRepository.getConversationTrail(req.params.conversationId as string);
    res.json(trail);
  } catch (error) {
    console.error('Error fetching conversation trail:', error);
    res.status(500).json({ error: 'Failed to fetch conversation trail' });
  }
});

/**
 * GET /api/conversations - Get recent conversations
 */
logsRouter.get('/conversations', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const userId = req.query.userId as string | undefined;
    const conversations = await auditRepository.getRecentConversations(limit, userId);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/stats - Get aggregate statistics
 */
logsRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await auditRepository.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/users - Get distinct users
 */
logsRouter.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await auditRepository.getDistinctUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/tools - Get distinct tool names
 */
logsRouter.get('/tools', async (_req: Request, res: Response) => {
  try {
    const tools = await auditRepository.getDistinctTools();
    res.json(tools);
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});
