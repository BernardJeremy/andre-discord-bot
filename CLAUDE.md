# André Discord Bot - Project Context

## About This Project

André is a Discord AI assistant built with Node.js and TypeScript. It uses **LangChain.js with Mistral API** as the core intelligence to understand natural language commands and execute tools without requiring prefixes.

### Key Capabilities
- **Natural language commands** - No prefix required, just mention the bot
- **Dynamic tool execution** - Lists management, web search, scheduling, conversation memory
- **Per-user data isolation** - MongoDB-based data storage for security
- **Smart scheduling** - One-time reminders and recurring cron jobs (Paris timezone)
- **Web search integration** - Brave Search API for GDPR-compliant search (Staan.ai)
- **Persistent storage** - All data in MongoDB (conversation memory, token usage, scheduler state)
- **Audit dashboard** - Web interface to inspect every conversation workflow end-to-end

## Architecture Overview

The project uses a **tool-based agent architecture** where:
1. Discord messages trigger the bot when it's mentioned
2. LichainJS loads conversation history and available tools
3. Mistral model reasons about the user's intent and selects tools
4. Tools execute and results feed back to the model
5. Final response is sent to Discord

**Key Design Principle**: Everything is per-user with isolated data storage in MongoDB.

## Project Structure

```
src/
  agent/              # LLM orchestration, prompts, memory, token usage tracking
  handlers/           # Discord message event handler
  tools/              # LangChain tools (lists, search, scheduling, conversation)
  scheduler/          # Cron engine and persistence layer
  config/             # Environment validation and config
  db/                 # MongoDB connection and Mongoose models
  repositories/       # Data access layer for MongoDB operations
  server/             # Express web server, Discord OAuth, audit dashboard
    middleware/       # Authentication middleware
    routes/           # API and page routes
    views/            # EJS templates
    public/           # Static CSS and JS assets
  types/              # Shared TypeScript types
  utils/              # Dev console logging
```

## Environment Configuration

All configuration is via environment variables. Create a `.env` file:

```bash
# Required
DISCORD_TOKEN=          # Bot token from Discord Developer Portal
MISTRAL_API_KEY=        # Mistral API key
MISTRAL_MODEL_NAME=     # Model (e.g., mistral-large-latest)
BRAVE_API_KEY=          # Brave Search API key (for web search tool)
MONGODB_URI=            # MongoDB connection string

# Optional - Audit Dashboard
DISCORD_CLIENT_ID=      # Discord OAuth2 Client ID
DISCORD_CLIENT_SECRET=  # Discord OAuth2 Client Secret
DISCORD_ADMIN_USER_ID=  # Discord user ID for dashboard access
WEB_PORT=3000           # Port for audit web dashboard
SESSION_SECRET=         # Secret for session cookies
OAUTH_REDIRECT_URI=     # Discord OAuth callback URL

# Optional
MISTRAL_MAX_MESSAGES_IN_HISTORY=10           # Conversation history length
NODE_ENV=development                         # development | production
```

**Important**: All scheduling is **forced to Europe/Paris timezone** regardless of server timezone.

## Key Implementation Details

### Agent & Prompts
- Located in `src/agent/`
- Prompts tell Mistral what tools are available and how to use them
- Token usage tracking per user in MongoDB
- Conversation history stored per Discord channel in MongoDB
- Every agent interaction is audit-logged to MongoDB (user message, LLM requests/responses, tool calls, final response)

### Tools
- **Lists**: Create/manage todo lists with item completion tracking
- **Search**: Web search and News Search via Brave API
- **Scheduling**: Parse natural language like "every day at 9h" or "in 15 minutes"
- **Conversation**: Clear history, check token usage

### Storage
- All data in MongoDB (conversations, lists, scheduler events, token usage, audit logs)
- Audit logs capture the complete workflow for each conversation
- Sessions for the web dashboard stored in MongoDB

### Scheduling
- Parsed with natural language in `scheduler/timeParser.ts`
- Stored persistently in `data/scheduler.json` (never auto-deleted)
- Runs via node-cron and setTimeout
- Supports: cron expressions (recurring) and one-time delays

## Coding Standards

- **Language**: TypeScript (strict mode)
- **Type safety**: All functions require type hints
- **Format**: Prettier + ESLint (run before committing)
- **Async**: Use async/await consistently; avoid callback hell
- **Error handling**: Wrap tool calls in try-catch; log failures with context
- **Logging**: Console logging via `devLog()` in dev; all activity audit-logged to MongoDB

## Common Commands

```bash
# Install dependencies
yarn install

# Development (hot reload)
yarn dev

# Build TypeScript
yarn build

# Run production
yarn start

# Type checking
yarn tsc --noEmit

# Linting
yarn lint

# Format code
yarn format
```

## Development Workflows

### Adding a New Tool

Before implementing, consider:
1. What problem does this tool solve?
2. How will users invoke it in natural language?
3. Does it need persistent storage in `data/sandboxes/{userId}/`?
4. What error cases should be handled?

**Implementation checklist**:
1. Create tool module in `src/tools/{tool-name}/`
2. Implement tool logic (export as LangChain `DynamicTool` or `Tool`)
3. Add type definitions to `src/types/index.ts`
4. Register tool in `src/tools/index.ts`
5. Add description and examples to agent prompts
6. Test in Discord with sample commands

### Modifying Agent Behavior

- Prompts live in `src/agent/prompts.ts`
- Keep prompts concise but descriptive
- Include tool descriptions and usage examples
- Test with real Discord interactions (not just in code)

### Understanding Token Usage

- Tracked per user in MongoDB
- Updated on every agent call
- Users can check with "show my token usage" or similar
- Useful for budgeting Mistral API costs

### Scheduling Implementation Details

- Parser converts natural language to cron expressions or timestamps
- One-time: "in 15 minutes", "today at 14:00", "2026-02-15 at 10:00"
- Recurring: "every day at 9:00", "every monday at 10:00", "every weekday at 8:30"
- All timezone-aware (Paris/Europe)
- Scheduler persists state to survive restarts

## Testing Approach

- Manually test tool invocations in Discord
- Check MongoDB collections for expected data
- Use the audit dashboard to inspect conversation workflows
- Monitor console logs in development mode
- For token usage, verify calculations match Mistral API docs

## Important Warnings

- **User isolation**: Each user's data is isolated—don't mix user contexts
- **Timezone**: All scheduling assumes Europe/Paris, even if server is elsewhere
- **Sensitive data**: Never store API keys in MongoDB; use `.env`
- **Audit logs**: Always audit-logged to MongoDB for traceability

## Common Debugging Patterns

1. **Bot doesn't respond?**
   - Check `DISCORD_TOKEN` is valid
   - Verify bot is mentioned in message
   - Check logs for Mistral API errors

2. **Tool execution fails?**
   - Check audit logs in dashboard for error details
   - Ensure required .env variables for that tool are set

3. **Scheduling not working?**
   - Check scheduler events in MongoDB
   - Verify timezone is Europe/Paris
   - Check console logs for scheduler errors

4. **Token usage incorrect?**
   - Check token usage data in MongoDB
   - Check Mistral API response includes token counts
   - Monitor `MISTRAL_MAX_MESSAGES_IN_HISTORY` setting

5. **Audit dashboard not starting?**
   - Ensure `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_ADMIN_USER_ID` are set
   - Ensure `OAUTH_REDIRECT_URI` matches the redirect URL in Discord Developer Portal
   - Check MongoDB is accessible

## Git and Commits

- Include `.env` in `.gitignore` (never commit credentials)
- Use clear commit messages referencing which tool/feature changed
