import 'dotenv/config';

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN!,
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    adminUserId: process.env.DISCORD_ADMIN_USER_ID || '',
  },
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY!,
    model: process.env.MISTRAL_MODEL_NAME!,
    maxMessagesInHistory: process.env.MISTRAL_MAX_MESSAGES_IN_HISTORY
      ? parseInt(process.env.MISTRAL_MAX_MESSAGES_IN_HISTORY, 10)
      : 10,
  },
  brave: {
    apiKey: process.env.BRAVE_API_KEY!,
  },
  data: {
    dir: process.env.DATA_DIR || './data',
  },
  database: {
    uri: process.env.MONGODB_URI!,
  },
  node: {
    env: process.env.NODE_ENV || 'production',
  },
  logging: {
    logFile: process.env.LOGFILE || null,
  },
  web: {
    port: process.env.WEB_PORT ? parseInt(process.env.WEB_PORT, 10) : 3000,
    sessionSecret: process.env.SESSION_SECRET || 'andre-bot-session-secret-change-me',
    oauthRedirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback',
  },
} as const;

export function validateConfig(): void {
  const missing: string[] = [];

  if (!process.env.DISCORD_TOKEN) missing.push('DISCORD_TOKEN');
  if (!process.env.MISTRAL_API_KEY) missing.push('MISTRAL_API_KEY');
  if (!process.env.MISTRAL_MODEL_NAME) missing.push('MISTRAL_MODEL_NAME');
  if (!process.env.BRAVE_API_KEY) missing.push('BRAVE_API_KEY');
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Warn about optional web dashboard config
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_ADMIN_USER_ID) {
    console.warn('⚠️  Web dashboard disabled: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DISCORD_ADMIN_USER_ID are required for the audit dashboard.');
  }
}
