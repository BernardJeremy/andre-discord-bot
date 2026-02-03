# André Discord Bot

André is a Discord AI assistant built with Node.js and TypeScript. It uses LangChain with Mistral models to understand natural language, run tools, and respond in Discord. The bot supports per-user sandboxes, list management, web search (Brave API), scheduling (one-time and recurring, Paris time), and conversation memory.

## Features

- **Natural language commands** (no prefix required)
- **LLM-powered reasoning** with LangChain + Mistral
- **Tools**
  - Lists (create, add/remove items, complete items)
  - Web search (Brave Search API)
  - Conversation management (clear history, token usage stats)
  - Scheduling (cron + one-time reminders, Paris timezone)
- **Per-user sandbox storage** in the data directory
- **Persistent scheduler** (survives restarts)
- **Conversation memory** with configurable history length

## Project Structure

```
src/
  agent/           # LLM orchestration, prompts, memory, token usage
  handlers/        # Discord message handler
  tools/           # LangChain tools (lists, search, scheduling, etc.)
  scheduler/       # Scheduling engine and persistence
  config/          # Env configuration and validation
  utils/           # Logging utilities
  types/           # Shared types
```

## How It Works

1. **Message handling**: The bot listens for messages that mention it.
2. **Context building**: It loads conversation history for the current Discord channel.
3. **LLM call**: The message is sent to Mistral via LangChain, with tools available.
4. **Tool execution**: If needed, tools are invoked and results are fed back to the model.
5. **Reply**: The final response is sent back to Discord.
6. **Persistence**: History, lists, scheduler events, and token usage are stored under `data/`.

## Requirements

- Node.js (LTS recommended)
- Yarn
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
- (optional) `DATA_DIR`
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

## Configuration

All configuration is handled via environment variables.

| Variable | Description | Required | Default |
|---------|-------------|----------|---------|
| `DISCORD_TOKEN` | Discord bot token | ✅ | — |
| `MISTRAL_API_KEY` | Mistral API key | ✅ | — |
| `MISTRAL_MODEL_NAME` | Mistral model name | ✅ | — |
| `BRAVE_API_KEY` | Brave Search API key | ✅ | — |
| `DATA_DIR` | Storage directory | ❌ | `./data` |
| `MISTRAL_MAX_MESSAGES_IN_HISTORY` | Max stored history messages | ❌ | `10` |
| `NODE_ENV` | Environment (`development` enables logs) | ❌ | `production` |

## Scheduling (Paris Time)

- All scheduling is **forced to Europe/Paris** timezone.
- One-time reminders: `in 20 minutes`, `today at 14:00`, `tomorrow at 9:00`, `2026-02-15 at 10:00`
- Recurring events (cron): `every day at 9:00`, `every monday at 10:00`, `every weekday at 8:30`
- Events are stored in `data/scheduler.json` and are never deleted (audit-friendly).

## Token Usage

Token usage is tracked per user in `data/sandboxes/<userId>/token_usage.json`. The bot exposes a tool to retrieve or reset the stats.

## Conversation Memory

Conversation history is stored per Discord channel in `data/sandboxes/<userId>/conversations/<channelId>.json`. You can clear it via the conversation tool.

## Notes

- The bot only reacts when mentioned in a message.
- In development mode (`NODE_ENV=development`), detailed logs are enabled.
- `data/` is excluded from git by default.

## License

MIT
