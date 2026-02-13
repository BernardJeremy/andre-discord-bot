import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config, validateConfig } from './config/index.js';
import { handleMessage } from './handlers/message.js';
import { initScheduler } from './scheduler/runner.js';
import { connectToDatabase, disconnectFromDatabase } from './db/connection.js';

validateConfig();

async function main() {
  try {
    // Connect to MongoDB before starting the bot
    await connectToDatabase();

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    client.once(Events.ClientReady, (readyClient) => {
      console.log(`Bot started - Logged in as ${readyClient.user.tag}`);
      initScheduler(client);
    });

    client.on(Events.MessageCreate, (message) => handleMessage(message, client));

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      client.destroy();
      await disconnectFromDatabase();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    await client.login(config.discord.token);
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();
