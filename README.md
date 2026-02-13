# André Discord Bot

André is a Discord AI assistant built with Node.js and TypeScript. It uses LangChain with Mistral models to understand natural language, run tools, and respond in Discord. The bot supports per-user data isolation, list management, web search (Brave API), scheduling (one-time and recurring, Paris time), conversation memory, and a built-in audit dashboard. All data is stored in MongoDB for reliability and performance.

## Features

- **Natural language commands** (no prefix required)
- **LLM-powered reasoning** with LangChain + Mistral
- **Tools**
  - Lists (create, add/remove items, complete items)
  - Web search (Brave Search API)
  - Conversation management (clear history, token usage stats)
  - Scheduling (cron + one-time reminders, Paris timezone)
- **Per-user data isolation** with MongoDB
- **Persistent scheduler** (survives restarts)
- **Conversation memory** with configurable history length
- **Audit Dashboard** — web interface to inspect every conversation workflow end-to-end (Discord OAuth protected)

## Project Structure

```
src/
  agent/           # LLM orchestration, prompts, memory, token usage
  handlers/        # Discord message handler
  tools/           # LangChain tools (lists, search, scheduling, etc.)
  scheduler/       # Scheduling engine
  config/          # Env configuration and validation
  db/              # MongoDB connection and Mongoose models
  repositories/    # Data access layer for MongoDB operations
  server/          # Express web server, Discord OAuth, audit dashboard
    middleware/    # Authentication middleware
    routes/        # API and page routes
    views/         # EJS templates
    public/        # Static CSS and JS assets
  utils/           # Logging utilities
  types/           # Shared types
```

## How It Works

1. **Message handling**: The bot listens for messages that mention it.
2. **Context building**: It loads conversation history for the current Discord channel from MongoDB.
3. **LLM call**: The message is sent to Mistral via LangChain, with tools available.
4. **Tool execution**: If needed, tools are invoked and results are fed back to the model.
5. **Reply**: The final response is sent back to Discord.
6. **Persistence**: History, lists, scheduler events, and token usage are stored in MongoDB.

## Requirements

- Node.js (LTS recommended)
- Yarn
- MongoDB (local or MongoDB Atlas)
- Discord bot token
- Mistral API key
- Brave Search API key

## Setup

1. Install dependencies:

```
yarn install
```

2. Create a `.env` file from `.env.example`:

```
cp .env.example .env
```

3. Fill in your environment variables:

- `DISCORD_TOKEN`
- `MISTRAL_API_KEY`
- `MISTRAL_MODEL_NAME`
- `BRAVE_API_KEY`
- `MONGODB_URI`
- (optional) `DISCORD_CLIENT_ID` — Required for the audit dashboard
- (optional) `DISCORD_CLIENT_SECRET` — Required for the audit dashboard
- (optional) `DISCORD_ADMIN_USER_ID` — Discord user ID allowed to access the dashboard
- (optional) `WEB_PORT` — Port for the audit dashboard (default: `3000`)
- (optional) `SESSION_SECRET` — Secret for session signing
- (optional) `OAUTH_REDIRECT_URI` — OAuth callback URL (default: `http://localhost:3000/auth/discord/callback`)
- (optional) `MISTRAL_MAX_MESSAGES_IN_HISTORY`

## Run

### Development (hot reload)

```
yarn dev
```

### Build

```
yarn build
```

### Production

```
yarn start
```

## Migration from JSON to MongoDB

If you're upgrading from a previous version that used JSON files:

1. Ensure MongoDB is running and accessible
2. Update your `.env` file with `MONGODB_URI`
3. Run the migration script:

```bash
yarn build
node dist/scripts/migrate-to-mongodb.js
```

The migration script will:
- Read all existing JSON files from `data/sandboxes/`
- Import them into MongoDB
- Verify the migration succeeded
- Generate a detailed migration report

**Note**: Keep backups of your `data/` directory until you've verified the migration succeeded.

## Configuration

All configuration is handled via environment variables.

| Variable | Description | Required | Default |
|---------|-------------|----------|---------|
| `DISCORD_TOKEN` | Discord bot token | ✅ | — |
| `MISTRAL_API_KEY` | Mistral API key | ✅ | — |
| `MISTRAL_MODEL_NAME` | Mistral model name | ✅ | — |
| `BRAVE_API_KEY` | Brave Search API key | ✅ | — |
| `MONGODB_URI` | MongoDB connection string | ✅ | `mongodb://localhost:27017/andre-discord-bot` |
| `DISCORD_CLIENT_ID` | Discord OAuth2 Client ID (for dashboard) | ❌ | — |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 Client Secret (for dashboard) | ❌ | — |
| `DISCORD_ADMIN_USER_ID` | Discord user ID allowed to access the dashboard | ❌ | — |
| `WEB_PORT` | Port for the audit web dashboard | ❌ | `3000` |
| `SESSION_SECRET` | Secret for signing session cookies | ❌ | (default value) |
| `OAUTH_REDIRECT_URI` | Discord OAuth callback URL | ❌ | `http://localhost:3000/auth/discord/callback` |
| `MISTRAL_MAX_MESSAGES_IN_HISTORY` | Max stored history messages | ❌ | `10` |
| `NODE_ENV` | Environment (`development` enables console logs) | ❌ | `production` |

## Audit Dashboard

The bot includes a built-in web interface for auditing all bot activity. Every conversation is logged end-to-end, including:

- **User messages** — the original prompt
- **LLM requests** — full context sent to the Mistral API (system prompt, history, tools)
- **LLM responses** — model output, tool call decisions, token usage, latency
- **Tool invocations** — tool name and arguments
- **Tool results** — success/failure, result content, execution time
- **Final responses** — what the bot sent back to Discord
- **Errors** — any errors with stack traces

### Setting up the Dashboard

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications), select your bot application.
2. Under **OAuth2**, note the **Client ID** and **Client Secret**.
3. Under **OAuth2 → Redirects**, add your callback URL (e.g., `http://localhost:3000/auth/discord/callback`).
4. Set the following environment variables:
   - `DISCORD_CLIENT_ID` — your app's Client ID
   - `DISCORD_CLIENT_SECRET` — your app's Client Secret
   - `DISCORD_ADMIN_USER_ID` — your Discord user ID (only this user can access the dashboard)
   - `OAUTH_REDIRECT_URI` — must match the redirect URL added in the portal
5. Start the bot — the dashboard will be available at `http://localhost:3000` (or your configured `WEB_PORT`).

### Dashboard Features

- **Dashboard** — overview stats (total conversations, events, users, tool usage breakdown)
- **Logs** — searchable/filterable log viewer with pagination. Filter by date range, user, event type, tool name, or conversation ID
- **Conversation Trail** — click any conversation to see the full workflow timeline, from user message to final response, showing every LLM call, tool execution, and decision
- **Mobile responsive** — works on smartphones with touch-friendly controls

### Security

- Access is restricted to a single Discord user ID (`DISCORD_ADMIN_USER_ID`)
- Authentication uses Discord OAuth2 (the bot's own OAuth credentials)
- Sessions are stored in MongoDB with 24-hour TTL
- Unauthenticated requests are redirected to Discord login (pages) or receive 401 (API)

## Logging

- In development mode (`NODE_ENV=development`), logs are printed to the console.
- All bot activity is automatically logged to MongoDB via the audit system, regardless of environment.
- The audit dashboard (see above) provides a full web interface for viewing logs.

## Scheduling (Paris Time)

- All scheduling is **forced to Europe/Paris** timezone.
- One-time reminders: `in 20 minutes`, `today at 14:00`, `tomorrow at 9:00`, `2026-02-15 at 10:00`
- Recurring events (cron): `every day at 9:00`, `every monday at 10:00`, `every weekday at 8:30`
- Events are stored in MongoDB and are never deleted (audit-friendly).

## Token Usage

Token usage is tracked per user in MongoDB. The bot exposes a tool to retrieve or reset the stats.

## Conversation Memory

Conversation history is stored per Discord channel in MongoDB. You can clear it via the conversation tool.

## Notes

- The bot only reacts when mentioned in a message.
- All user data is stored in MongoDB.
- All bot activity is audited in MongoDB (viewable via the web dashboard).

## License

MIT
