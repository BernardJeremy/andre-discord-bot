import { Router, Request, Response } from 'express';
import { auditRepository } from '../../repositories/audit.repository.js';

export const pagesRouter = Router();

/**
 * GET / - Dashboard home page
 */
pagesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const stats = await auditRepository.getStats();
    const conversations = await auditRepository.getRecentConversations(10);
    res.render('dashboard', {
      title: 'André Audit Dashboard',
      user: req.session.user,
      stats,
      conversations,
    });
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load dashboard' });
  }
});

/**
 * GET /logs - Log viewer page
 */
pagesRouter.get('/logs', async (req: Request, res: Response) => {
  try {
    const users = await auditRepository.getDistinctUsers();
    const tools = await auditRepository.getDistinctTools();
    res.render('logs', {
      title: 'Audit Logs',
      user: req.session.user,
      users,
      tools,
      filters: req.query,
    });
  } catch (error) {
    console.error('Error rendering logs page:', error);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load logs page' });
  }
});

/**
 * GET /conversation/:id - Conversation detail page
 */
pagesRouter.get('/conversation/:id', async (req: Request, res: Response) => {
  try {
    const trail = await auditRepository.getConversationTrail(req.params.id as string);
    if (trail.length === 0) {
      res.status(404).render('error', { title: 'Not Found', message: 'Conversation not found' });
      return;
    }
    res.render('conversation', {
      title: 'Conversation Detail',
      user: req.session.user,
      conversationId: req.params.id,
      trail,
    });
  } catch (error) {
    console.error('Error rendering conversation:', error);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load conversation' });
  }
});
