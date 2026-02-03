import { Message, Client } from 'discord.js';
import { runAgent } from '../agent/index.js';
import type { ToolContext } from '../types/index.js';
import path from 'node:path';
import { config } from '../config/index.js';

const DISCORD_LIMIT = 2000;
const DISCORD_SAFE_LIMIT = 1900;
const URL_REGEX = /https?:\/\/[^\s]+/g;

function chunkResponse(response: string): string[] {
  if (response.length <= DISCORD_LIMIT) return [response];

  const chunks: string[] = [];
  let remaining = response;

  while (remaining.length > DISCORD_SAFE_LIMIT) {
    let sliceEnd = DISCORD_SAFE_LIMIT;

    const slice = remaining.slice(0, sliceEnd);

    // Prefer paragraph break, then sentence end, then space
    const paragraphIndex = slice.lastIndexOf('\n\n');
    const sentenceIndex = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? ')
    );
    const spaceIndex = slice.lastIndexOf(' ');

    const preferredIndex = Math.max(paragraphIndex, sentenceIndex, spaceIndex);
    if (preferredIndex > 50) {
      sliceEnd = preferredIndex + (preferredIndex === paragraphIndex ? 2 : 1);
    }

    // Avoid splitting inside a URL
    for (const match of slice.matchAll(URL_REGEX)) {
      const urlStart = match.index ?? -1;
      const urlEnd = urlStart + match[0].length;
      if (urlStart < sliceEnd && sliceEnd < urlEnd) {
        sliceEnd = urlStart;
        break;
      }
    }

    if (sliceEnd <= 0) {
      sliceEnd = DISCORD_SAFE_LIMIT;
    }

    const chunk = remaining.slice(0, sliceEnd).trimEnd();
    if (chunk.length > 0) chunks.push(chunk);
    remaining = remaining.slice(sliceEnd).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

function getToolContext(message: Message): ToolContext {
  return {
    userId: message.author.id,
    guildId: message.guild?.id ?? null,
    channelId: message.channel.id,
    sandboxPath: path.join(config.data.dir, 'sandboxes', message.author.id),
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

    console.log(`[Response to ${message.author.tag}] ${response}`);

    const chunks = chunkResponse(response);
    for (const chunk of chunks) {
      await message.reply(chunk);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    await message.reply('Sorry, something went wrong processing your request.');
  }
}
