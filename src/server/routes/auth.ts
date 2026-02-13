import { Router, Request, Response } from 'express';
import { config } from '../../config/index.js';

export const authRouter = Router();

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_OAUTH_AUTHORIZE = 'https://discord.com/api/oauth2/authorize';
const DISCORD_OAUTH_TOKEN = 'https://discord.com/api/oauth2/token';

/**
 * Login page - redirects to Discord OAuth
 */
authRouter.get('/login', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: config.web.oauthRedirectUri,
    response_type: 'code',
    scope: 'identify',
  });

  res.redirect(`${DISCORD_OAUTH_AUTHORIZE}?${params.toString()}`);
});

/**
 * Discord OAuth callback
 */
authRouter.get('/discord/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    res.status(400).send('Missing authorization code');
    return;
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch(DISCORD_OAUTH_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.web.oauthRedirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Discord OAuth token exchange failed:', await tokenResponse.text());
      res.status(500).send('Authentication failed');
      return;
    }

    const tokenData = await tokenResponse.json() as { access_token: string; token_type: string };

    // Get user info
    const userResponse = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      console.error('Discord user fetch failed:', await userResponse.text());
      res.status(500).send('Failed to get user info');
      return;
    }

    const userData = await userResponse.json() as { id: string; username: string; avatar: string | null };

    // Check if user is the authorized admin
    if (userData.id !== config.discord.adminUserId) {
      res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You are not authorized to access this dashboard.',
      });
      return;
    }

    // Store user in session
    req.session.user = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar,
    };

    req.session.save(() => {
      res.redirect('/');
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

/**
 * Logout
 */
authRouter.get('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});
