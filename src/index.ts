import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config, validateConfig } from './config/index.js';
import { handleMessage } from './handlers/message.js';

validateConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot started - Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, (message) => handleMessage(message, client));

client.login(config.discord.token);
