import { ScheduledEvent as ScheduledEventModel } from '../db/models/ScheduledEvent.js';
import type {
  ScheduledEvent,
  ScheduleType,
  ScheduleStatus,
} from '../scheduler/store.js';
import type { IScheduledEvent } from '../db/models/ScheduledEvent.js';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export class SchedulerRepository {
  async createScheduledEvent(
    event: Omit<ScheduledEvent, 'id' | 'status' | 'createdAt' | 'triggerCount'>
  ): Promise<ScheduledEvent> {
    const newEvent = await ScheduledEventModel.create({
      legacyId: generateId(),
      userId: event.userId,
      guildId: event.guildId,
      channelId: event.channelId,
      type: event.type,
      schedule: event.schedule,
      action: event.action,
      mention: event.mention,
      status: 'active',
      description: event.description,
      triggerCount: 0,
    });

    return this.mongoToScheduledEvent(newEvent);
  }

  async getActiveEvents(): Promise<ScheduledEvent[]> {
    const events = await ScheduledEventModel.find({ status: 'active' });
    return events.map((e: IScheduledEvent) => this.mongoToScheduledEvent(e));
  }

  async getUserEvents(userId: string): Promise<ScheduledEvent[]> {
    const events = await ScheduledEventModel.find({ userId });
    return events.map((e: IScheduledEvent) => this.mongoToScheduledEvent(e));
  }

  async getUserActiveEvents(userId: string): Promise<ScheduledEvent[]> {
    const events = await ScheduledEventModel.find({
      userId,
      status: 'active',
    });
    return events.map((e: IScheduledEvent) => this.mongoToScheduledEvent(e));
  }

  async markEventTriggered(eventId: string): Promise<void> {
    const event = await ScheduledEventModel.findOne({ legacyId: eventId });

    if (event) {
      event.lastTriggeredAt = new Date();
      event.triggerCount++;

      // For one-time events, mark as completed
      if (event.type === 'once') {
        event.status = 'completed';
        event.completedAt = new Date();
      }

      await event.save();
    }
  }

  async cancelEvent(eventId: string): Promise<boolean> {
    const event = await ScheduledEventModel.findOne({ legacyId: eventId });

    if (event && event.status === 'active') {
      event.status = 'cancelled';
      event.completedAt = new Date();
      await event.save();
      return true;
    }

    return false;
  }

  async cancelUserEvents(userId: string): Promise<number> {
    const result = await ScheduledEventModel.updateMany(
      { userId, status: 'active' },
      {
        $set: {
          status: 'cancelled',
          completedAt: new Date(),
        },
      }
    );

    return result.modifiedCount;
  }

  private mongoToScheduledEvent(mongoEvent: IScheduledEvent): ScheduledEvent {
    return {
      id: mongoEvent.legacyId,
      userId: mongoEvent.userId,
      guildId: mongoEvent.guildId,
      channelId: mongoEvent.channelId,
      type: mongoEvent.type,
      schedule: mongoEvent.schedule,
      action: mongoEvent.action,
      mention: mongoEvent.mention,
      status: mongoEvent.status,
      createdAt: mongoEvent.createdAt.toISOString(),
      lastTriggeredAt: mongoEvent.lastTriggeredAt?.toISOString(),
      triggerCount: mongoEvent.triggerCount,
      completedAt: mongoEvent.completedAt?.toISOString(),
      description: mongoEvent.description,
    };
  }
}

export const schedulerRepository = new SchedulerRepository();
