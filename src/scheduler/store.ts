import { schedulerRepository } from '../repositories/scheduler.repository.js';

const PARIS_TZ = 'Europe/Paris';

export type ScheduleType = 'cron' | 'once';
export type ScheduleStatus = 'active' | 'completed' | 'cancelled';

export interface ScheduledEvent {
  id: string;
  userId: string;
  guildId: string | null;
  channelId: string;
  type: ScheduleType;
  // For cron: cron expression, for once: ISO timestamp of when to fire
  schedule: string;
  // The action/message to send when triggered
  action: string;
  // Optional: mention a user or role
  mention?: string;
  // Metadata
  status: ScheduleStatus;
  createdAt: string;
  lastTriggeredAt?: string;
  triggerCount: number;
  // For once events, when it completed
  completedAt?: string;
  // Human-readable description of the schedule
  description: string;
}

export interface SchedulerStore {
  events: ScheduledEvent[];
}

export async function createScheduledEvent(
  event: Omit<ScheduledEvent, 'id' | 'status' | 'createdAt' | 'triggerCount'>
): Promise<ScheduledEvent> {
  return schedulerRepository.createScheduledEvent(event);
}

export async function getActiveEvents(): Promise<ScheduledEvent[]> {
  return schedulerRepository.getActiveEvents();
}

export async function getUserEvents(userId: string): Promise<ScheduledEvent[]> {
  return schedulerRepository.getUserEvents(userId);
}

export async function getUserActiveEvents(userId: string): Promise<ScheduledEvent[]> {
  return schedulerRepository.getUserActiveEvents(userId);
}

export async function markEventTriggered(eventId: string): Promise<void> {
  return schedulerRepository.markEventTriggered(eventId);
}

export async function cancelEvent(eventId: string): Promise<boolean> {
  return schedulerRepository.cancelEvent(eventId);
}

export async function cancelUserEvents(userId: string): Promise<number> {
  return schedulerRepository.cancelUserEvents(userId);
}

export { PARIS_TZ };
