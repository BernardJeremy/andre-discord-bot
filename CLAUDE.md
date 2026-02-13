# André Discord Bot - Project Context

## About This Project

André is a Discord AI assistant built with Node.js and TypeScript. It uses **LangChain.js with Mistral API** as the core intelligence to understand natural language commands and execute tools without requiring prefixes.

### Key Capabilities
- **Natural language commands** - No prefix required, just mention the bot
- **Dynamic tool execution** - Lists management, web search, scheduling, conversation memory
- **Per-user sandboxes** - Isolated JSON-based data storage for security
- **Smart scheduling** - One-time reminders and recurring cron jobs (Paris timezone)
- **Web search integration** - Brave Search API for GDPR-compliant search (Staan.ai)
- **Persistent storage** - Conversation memory, token usage tracking, scheduler state

## Architecture Overview

The project uses a **tool-based agent architecture** where:
1. Discord messages trigger the bot when it's mentioned
2. LichainJS loads conversation history and available tools
3. Mistral model reasons about the user's intent and selects tools
4. Tools execute and results feed back to the model
5. Final response is sent to Discord

**Key Design Principle**: Everything is per-user with sandboxed data storage. No external databases required—JSON files in `data/` handle all persistence.

## Project Structure

```
src/
  agent/              # LLM orchestration, prompts, memory, token usage tracking
  handlers/           # Discord message event handler
  tools/              # LangChain tools (lists, search, scheduling, conversation)
  scheduler/          # Cron engine and persistence layer
  config/             # Environment validation and config
  types/              # Shared TypeScript types
  utils/              # Logging utilities
data/
  sandboxes/          # Per-user data (conversation history, lists, token usage)
  scheduler.json      # Persistent scheduler state (never deleted, audit-friendly)
```

## Environment Configuration

All configuration is via environment variables. Create a `.env` file:

```bash
# Required
DISCORD_TOKEN=          # Bot token from Discord Developer Portal
MISTRAL_API_KEY=        # Mistral API key
MISTRAL_MODEL_NAME=     # Model (e.g., mistral-large-latest)
BRAVE_API_KEY=          # Brave Search API key (for web search tool)

# Optional
DATA_DIR=./data                              # Storage directory
MISTRAL_MAX_MESSAGES_IN_HISTORY=10           # Conversation history length
NODE_ENV=development                         # development | production
LOGFILE=andre.log                            # Append tool logs to DATA_DIR/LOGFILE
```

**Important**: All scheduling is **forced to Europe/Paris timezone** regardless of server timezone.

## Key Implementation Details

### Agent & Prompts
- Located in `src/agent/`
- Prompts tell Mistral what tools are available and how to use them
- Token usage tracking per user in `token_usage.json`
- Conversation history stored per Discord channel in `conversations/`

### Tools
- **Lists**: Create/manage todo lists with item completion tracking
- **Search**: Web search and News Search via Brave API
- **Scheduling**: Parse natural language like "every day at 9h" or "in 15 minutes"
- **Conversation**: Clear history, check token usage

### Storage Structure
```
data/
  sandboxes/
    {userId}/
      conversation.json              # Main metadata (created, lastUpdated)
      token_usage.json               # Token usage stats
      lists.json                     # User's lists and items
      conversations/
        {channelId}.json             # Per-channel message history
```

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
- **Logging**: Use `logger.ts` utilities (respects NODE_ENV and LOGFILE)

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

- Tracked in `data/sandboxes/{userId}/token_usage.json`
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
- Check `data/` for expected files/updates
- Monitor logs if `LOGFILE` is set
- For token usage, verify calculations match Mistral API docs

## Important Warnings

- **Sandbox isolation**: Each user's data is isolated—don't mix user contexts
- **No SQL**: Everything is JSON—be careful with race conditions in file writes
- **Timezone**: All scheduling assumes Europe/Paris, even if server is elsewhere
- **Sensitive data**: Never store API keys in `data/`; use `.env`
- **Logging in production**: Set `LOGFILE` for audit trail of tool usage

## Common Debugging Patterns

1. **Bot doesn't respond?**
   - Check `DISCORD_TOKEN` is valid
   - Verify bot is mentioned in message
   - Check logs for Mistral API errors

2. **Tool execution fails?**
   - Check error logs (`LOGFILE` if set)
   - Verify user's sandbox directory exists in `data/sandboxes/{userId}/`
   - Ensure required .env variables for that tool are set

3. **Scheduling not working?**
   - Check `data/scheduler.json` exists and has correct events
   - Verify timezone is Europe/Paris
   - Check node-cron syntax in logs

4. **Token usage incorrect?**
   - Verify `token_usage.json` structure matches schema
   - Check Mistral API response includes token counts
   - Monitor `MISTRAL_MAX_MESSAGES_IN_HISTORY` setting

## Git and Commits

- `data/` is excluded from git (user sandboxes shouldn't be committed)
- Include `.env` in `.gitignore` (never commit credentials)
- Use clear commit messages referencing which tool/feature changed
