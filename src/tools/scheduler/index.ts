import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../../types/index.js';
import {
  createScheduledEvent,
  getUserActiveEvents,
  getUserEvents,
  cancelEvent,
  cancelUserEvents,
  ScheduledEvent,
} from '../../scheduler/store.js';
import {
  parseTimeToISO,
  parseNaturalCron,
  isValidCron,
  formatParisTime,
  nowInParis,
} from '../../scheduler/timeParser.js';

function formatEventForDisplay(event: ScheduledEvent): string {
  const status = event.status === 'active' ? '🟢' : event.status === 'completed' ? '✅' : '❌';
  const type = event.type === 'cron' ? '🔁' : '⏰';

  let scheduleDisplay: string;
  if (event.type === 'once') {
    scheduleDisplay = formatParisTime(event.schedule);
  } else {
    scheduleDisplay = `Cron: ${event.schedule}`;
  }

  return `${status} ${type} **${event.description}**
   ID: \`${event.id}\`
   Schedule: ${scheduleDisplay}
   Action: ${event.action}
   Triggered: ${event.triggerCount} times
   Created: ${formatParisTime(event.createdAt)}`;
}

export function createSchedulerTool(context: ToolContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'manage_schedule',
    description: `Manage scheduled events and reminders. All times are in Paris timezone.

Use this tool to:
- Create one-time reminders (e.g., "in 20 minutes", "today at 14:00", "tomorrow at 9:00")
- Create recurring events (e.g., "every day at 9:00", "every monday at 10:00", "every weekday at 8:30")
- List user's scheduled events
- Cancel scheduled events

For one-time events, use scheduleTime with formats like:
- "in 20 minutes", "in 2 hours", "in 3 days"
- "today at 14:00", "tomorrow at 9:00"
- "2026-02-15 at 10:00"

For recurring events, use cronPattern with natural language like:
- "every day at 9:00"
- "every monday at 10:00"
- "every weekday at 8:30"
- "every weekend at 11:00"
- Or raw cron: "30 9 * * 1-5" (9:30 every weekday)`,
    schema: z.object({
      action: z.enum([
        'create_once',
        'create_recurring',
        'list_active',
        'list_all',
        'cancel',
        'cancel_all',
      ]).describe('The action to perform'),
      scheduleTime: z.string().optional().describe('For one-time events: when to fire (e.g., "in 20 minutes", "today at 14:00")'),
      cronPattern: z.string().optional().describe('For recurring events: natural language or cron (e.g., "every day at 9:00", "every monday at 10:00")'),
      eventAction: z.string().optional().describe('The message/action to perform when the event fires'),
      mention: z.string().optional().describe('Optional: User or role to mention (e.g., "@user" or a user ID like "<@123456789>")'),
      description: z.string().optional().describe('Human-readable description of the event'),
      eventId: z.string().optional().describe('Event ID for cancellation'),
    }),
    func: async ({ action, scheduleTime, cronPattern, eventAction, mention, description, eventId }) => {
      const { userId, guildId, channelId } = context;

      switch (action) {
        case 'create_once': {
          if (!scheduleTime) return 'Please specify when the event should fire (scheduleTime).';
          if (!eventAction) return 'Please specify what action/message to send (eventAction).';

          const isoTime = parseTimeToISO(scheduleTime);
          if (!isoTime) {
            return `Could not parse time "${scheduleTime}". Use formats like "in 20 minutes", "today at 14:00", "tomorrow at 9:00".`;
          }

          const event = await createScheduledEvent({
            userId,
            guildId,
            channelId,
            type: 'once',
            schedule: isoTime,
            action: eventAction,
            mention,
            description: description || `Reminder: ${eventAction.substring(0, 50)}`,
          });

          return `✅ Scheduled one-time event!
ID: \`${event.id}\`
Will fire at: ${formatParisTime(isoTime)} (Paris time)
Action: ${eventAction}`;
        }

        case 'create_recurring': {
          if (!cronPattern) return 'Please specify the recurring pattern (cronPattern).';
          if (!eventAction) return 'Please specify what action/message to send (eventAction).';

          const cron = parseNaturalCron(cronPattern);
          if (!cron) {
            return `Could not parse pattern "${cronPattern}". Use formats like "every day at 9:00", "every monday at 10:00", or raw cron "0 9 * * *".`;
          }

          if (!isValidCron(cron)) {
            return `Invalid cron expression: ${cron}`;
          }

          const event = await createScheduledEvent({
            userId,
            guildId,
            channelId,
            type: 'cron',
            schedule: cron,
            action: eventAction,
            mention,
            description: description || `Recurring: ${cronPattern}`,
          });

          return `✅ Scheduled recurring event!
ID: \`${event.id}\`
Pattern: ${cronPattern} (cron: ${cron})
Action: ${eventAction}`;
        }

        case 'list_active': {
          const events = await getUserActiveEvents(userId);

          if (events.length === 0) {
            return 'You have no active scheduled events.';
          }

          const formatted = events.map(formatEventForDisplay).join('\n\n');
          return `**Your active scheduled events:**\n\n${formatted}`;
        }

        case 'list_all': {
          const events = await getUserEvents(userId);

          if (events.length === 0) {
            return 'You have no scheduled events (active or completed).';
          }

          const formatted = events.map(formatEventForDisplay).join('\n\n');
          return `**All your scheduled events:**\n\n${formatted}`;
        }

        case 'cancel': {
          if (!eventId) return 'Please specify the event ID to cancel.';

          const success = await cancelEvent(eventId);
          if (success) {
            return `✅ Event \`${eventId}\` has been cancelled.`;
          } else {
            return `❌ Could not cancel event \`${eventId}\`. It may not exist or is already completed/cancelled.`;
          }
        }

        case 'cancel_all': {
          const count = await cancelUserEvents(userId);
          return `✅ Cancelled ${count} active event(s).`;
        }

        default:
          return 'Unknown action.';
      }
    },
  });
}
