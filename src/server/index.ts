import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';
import { authRouter } from './routes/auth.js';
import { logsRouter } from './routes/logs.js';
import { pagesRouter } from './routes/pages.js';
import { requireAuth } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createWebServer(): express.Express | null {
  // Only start web server if Discord OAuth credentials are configured
  if (!config.discord.clientId || !config.discord.clientSecret || !config.discord.adminUserId) {
    console.log('ℹ️  Web dashboard not started (missing DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, or DISCORD_ADMIN_USER_ID)');
    return null;
  }

  const app = express();

  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Static assets
  app.use('/static', express.static(path.join(__dirname, 'public')));

  // Session middleware with MongoDB store
  app.use(
    session({
      secret: config.web.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: config.database.uri,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60, // 24 hours
      }),
      cookie: {
        secure: false, // Set to true behind HTTPS reverse proxy
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
      },
    })
  );

  // JSON body parser for API routes
  app.use(express.json());

  // Auth routes (no auth required)
  app.use('/auth', authRouter);

  // Protected routes
  app.use('/api', requireAuth, logsRouter);
  app.use('/', requireAuth, pagesRouter);

  return app;
}

export function startWebServer(app: express.Express): void {
  const port = config.web.port;
  app.listen(port, () => {
    console.log(`🌐 Audit dashboard running at http://localhost:${port}`);
  });
}
