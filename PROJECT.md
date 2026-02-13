Discord AI Agent Bot is a self-managing personal assistant built with Node.js/TypeScript that runs in Discord. It uses LangChain.js and the French Mistral API as the core intelligence.

The bot understands natural language commands without prefixes and handles dynamic data storage through MongoDB's flexible document model, automatically creating user-specific data structures like trackers or todo lists without requiring predefined schemas.

Key capabilities include Git repository management (clone, edit files, commit/push in sandboxed directories), intelligent web search via Staan.ai (France-based, GDPR-compliant), and smart scheduling that parses requests like "every day at 9h remind #dev channel" or "in 15 minutes ping @user" using node-cron and setTimeout with MongoDB persistence.

Everything runs with per-user data isolation stored in MongoDB for reliability, performance, and concurrent access safety.