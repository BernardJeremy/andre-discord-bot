import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/index.js';

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      avatar: string | null;
    };
  }
}

/**
 * Middleware that checks if the user is authenticated via Discord OAuth
 * and is the authorized admin user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.user && req.session.user.id === config.discord.adminUserId) {
    next();
    return;
  }

  // For API routes, return 401 JSON
  if (req.path.startsWith('/api') || req.originalUrl.startsWith('/api')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // For page routes, redirect to login
  res.redirect('/auth/login');
}
