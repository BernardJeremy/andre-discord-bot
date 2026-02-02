import cron from 'node-cron';
import path from 'node:path';
import { Client, TextChannel } from 'discord.js';
import {
  getActiveEvents,
  markEventTriggered,
  ScheduledEvent,
  PARIS_TZ,
} from './store.js';
import { shouldFireNow, isInPast, nowInParis, formatParisTime } from './timeParser.js';
import { runAgent } from '../agent/index.js';
import { devLog } from '../utils/logger.js';
import type { ToolContext } from '../types/index.js';
import { config } from '../config/index.js';

let discordClient: Client | null = null;
let schedulerTask: cron.ScheduledTask | null = null;

/**
 * Initialize the scheduler with the Discord client
 */
export function initScheduler(client: Client): void {
  discordClient = client;

  // Run every minute, using Paris timezone
  schedulerTask = cron.schedule('* * * * *', async () => {
    await checkAndFireEvents();
  }, {
    timezone: PARIS_TZ,
  });

  console.log('Scheduler initialized - checking events every minute (Paris time)');
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }
}

/**
 * Check all active events and fire those that are due
 */
async function checkAndFireEvents(): Promise<void> {
  if (!discordClient) {
    devLog('SCHEDULER', '⚠️ Discord client not available');
    return;
  }

  const now = nowInParis();
  devLog('SCHEDULER', `⏰ Checking events at ${formatParisTime(now)}`);

  const activeEvents = await getActiveEvents();

  for (const event of activeEvents) {
    const shouldFire = await shouldEventFire(event, now);

    if (shouldFire) {
      devLog('SCHEDULER', `🔔 Firing event: ${event.id} - ${event.description}`);
      await fireEvent(event);
    }
  }
}

/**
 * Determine if an event should fire now
 */
async function shouldEventFire(event: ScheduledEvent, now: Date): Promise<boolean> {
  if (event.type === 'once') {
    // For one-time events, check if the scheduled time matches current minute
    if (shouldFireNow(event.schedule)) {
      return true;
    }
    // Also fire if it's in the past but hasn't been triggered yet
    if (isInPast(event.schedule) && event.triggerCount === 0) {
      return true;
    }
    return false;
  }

  if (event.type === 'cron') {
    // For cron events, check if the cron pattern matches current time
    const cronParts = event.schedule.split(' ');
    if (cronParts.length !== 5) return false;

    const [cronMin, cronHour, cronDayOfMonth, cronMonth, cronDayOfWeek] = cronParts;

    const minute = now.getMinutes();
    const hour = now.getHours();
    const dayOfMonth = now.getDate();
    const month = now.getMonth() + 1;
    const dayOfWeek = now.getDay();

    return (
      matchesCronPart(cronMin, minute) &&
      matchesCronPart(cronHour, hour) &&
      matchesCronPart(cronDayOfMonth, dayOfMonth) &&
      matchesCronPart(cronMonth, month) &&
      matchesCronPart(cronDayOfWeek, dayOfWeek)
    );
  }

  return false;
}

/**
 * Check if a value matches a cron part
 */
function matchesCronPart(cronPart: string, value: number): boolean {
  if (cronPart === '*') return true;

  // Handle */n (every n)
  if (cronPart.startsWith('*/')) {
    const interval = parseInt(cronPart.slice(2), 10);
    return value % interval === 0;
  }

  // Handle ranges like 1-5
  if (cronPart.includes('-')) {
    const [start, end] = cronPart.split('-').map(Number);
    return value >= start && value <= end;
  }

  // Handle lists like 0,6
  if (cronPart.includes(',')) {
    const values = cronPart.split(',').map(Number);
    return values.includes(value);
  }

  // Exact match
  return parseInt(cronPart, 10) === value;
}

/**
 * Fire an event - process through LangChain and send response to the channel
 */
async function fireEvent(event: ScheduledEvent): Promise<void> {
  if (!discordClient) return;

  try {
    const channel = await discordClient.channels.fetch(event.channelId);

    if (!channel || !(channel instanceof TextChannel)) {
      devLog('SCHEDULER', `❌ Channel ${event.channelId} not found or not a text channel`);
      return;
    }

    // Build the context for the agent
    const context: ToolContext = {
      userId: event.userId,
      guildId: event.guildId,
      channelId: event.channelId,
      sandboxPath: path.join(config.data.dir, 'sandboxes', event.userId),
    };

    // Build the prompt - clear instructions to execute, not re-schedule
    const scheduledPrompt = `This is a scheduled reminder that was set earlier. 
The user asked you to do the following at this specific time: "${event.action}"

IMPORTANT: Do NOT create a new schedule or reminder. Simply respond to or execute this request directly now. 
Respond as if the user just asked you this question.`;

    devLog('SCHEDULER', `🤖 Running agent for scheduled event: ${event.id}`);
    
    // Run through the LangChain agent with scheduler excluded to prevent recursive scheduling
    const response = await runAgent(context, scheduledPrompt, {
      excludeScheduler: true,
      skipHistory: true,  // Don't load conversation history for scheduled events
    });

    // Build the final message
    let message = response;

    // Add mention if specified
    if (event.mention) {
      message = `${event.mention} ${message}`;
    }

    // Discord has a 2000 character limit
    if (message.length > 2000) {
      const chunks = message.match(/.{1,1990}/gs) || [];
      for (const chunk of chunks) {
        await channel.send(chunk);
      }
    } else {
      await channel.send(message);
    }

    devLog('SCHEDULER', `✅ Sent AI response to channel ${event.channelId}`);

    // Mark as triggered
    await markEventTriggered(event.id);

  } catch (error) {
    devLog('SCHEDULER', `❌ Error firing event ${event.id}:`, error);
    
    // Try to notify the channel about the error
    try {
      const channel = await discordClient.channels.fetch(event.channelId);
      if (channel instanceof TextChannel) {
        const mention = event.mention ? `${event.mention} ` : '';
        await channel.send(`${mention}⚠️ Scheduled task failed: "${event.description}". Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } catch {
      // Ignore notification errors
    }
  }
}

export { checkAndFireEvents };
