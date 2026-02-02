import { Message, Client } from 'discord.js';
import { runAgent } from '../agent/index.js';
import type { ToolContext } from '../types/index.js';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';

function getToolContext(message: Message): ToolContext {
  return {
    userId: message.author.id,
    guildId: message.guild?.id ?? null,
    channelId: message.channel.id,
    sandboxPath: path.join(DATA_DIR, 'sandboxes', message.author.id),
  };
}

function extractContent(message: Message, client: Client): string {
  if (!client.user) return message.content;

  return message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
    .trim();
}

export async function handleMessage(
  message: Message,
  client: Client
): Promise<void> {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if the bot is mentioned in the message
  if (!client.user || !message.mentions.has(client.user)) return;

  const content = extractContent(message, client);

  if (!content) {
    await message.reply("Hello! How can I help you?");
    return;
  }

  console.log(`[${message.author.tag}] ${content}`);

  try {
    // Show typing indicator while processing
    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }

    const context = getToolContext(message);
    const response = await runAgent(context, content);

    // Discord has a 2000 character limit
    if (response.length > 2000) {
      const chunks = response.match(/.{1,1990}/gs) || [];
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(response);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    await message.reply('Sorry, something went wrong processing your request.');
  }
}
