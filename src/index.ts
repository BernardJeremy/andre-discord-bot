import 'dotenv/config';
import { Client, Events, GatewayIntentBits, Message } from 'discord.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN environment variable');
  process.exit(1);
}

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

client.on(Events.MessageCreate, async (message: Message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if the bot is mentioned in the message
  if (!client.user || !message.mentions.has(client.user)) return;

  // Remove the mention from the message to get the actual content
  const content = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
    .trim();

  console.log(`Received mention from ${message.author.tag}: "${content}"`);

  try {
    // TODO: Process the message with LangChain/Mistral AI
    await message.reply(`Hello! You said: "${content}"`);
  } catch (error) {
    console.error('Error processing message:', error);
    await message.reply('Sorry, something went wrong processing your request.');
  }
});

client.login(DISCORD_TOKEN);
