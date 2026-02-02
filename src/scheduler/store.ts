import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

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

function getSchedulerPath(): string {
  return path.join(config.data.dir, 'scheduler.json');
}

async function ensureDataDir(): Promise<void> {
  if (!existsSync(config.data.dir)) {
    await mkdir(config.data.dir, { recursive: true });
  }
}

export async function loadSchedulerStore(): Promise<SchedulerStore> {
  await ensureDataDir();
  const filePath = getSchedulerPath();

  if (!existsSync(filePath)) {
    return { events: [] };
  }

  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as SchedulerStore;
}

export async function saveSchedulerStore(store: SchedulerStore): Promise<void> {
  await ensureDataDir();
  const filePath = getSchedulerPath();
  await writeFile(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export async function createScheduledEvent(
  event: Omit<ScheduledEvent, 'id' | 'status' | 'createdAt' | 'triggerCount'>
): Promise<ScheduledEvent> {
  const store = await loadSchedulerStore();

  const newEvent: ScheduledEvent = {
    ...event,
    id: generateId(),
    status: 'active',
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  };

  store.events.push(newEvent);
  await saveSchedulerStore(store);

  return newEvent;
}

export async function getActiveEvents(): Promise<ScheduledEvent[]> {
  const store = await loadSchedulerStore();
  return store.events.filter(e => e.status === 'active');
}

export async function getUserEvents(userId: string): Promise<ScheduledEvent[]> {
  const store = await loadSchedulerStore();
  return store.events.filter(e => e.userId === userId);
}

export async function getUserActiveEvents(userId: string): Promise<ScheduledEvent[]> {
  const store = await loadSchedulerStore();
  return store.events.filter(e => e.userId === userId && e.status === 'active');
}

export async function markEventTriggered(eventId: string): Promise<void> {
  const store = await loadSchedulerStore();
  const event = store.events.find(e => e.id === eventId);

  if (event) {
    event.lastTriggeredAt = new Date().toISOString();
    event.triggerCount++;

    // For one-time events, mark as completed
    if (event.type === 'once') {
      event.status = 'completed';
      event.completedAt = new Date().toISOString();
    }

    await saveSchedulerStore(store);
  }
}

export async function cancelEvent(eventId: string): Promise<boolean> {
  const store = await loadSchedulerStore();
  const event = store.events.find(e => e.id === eventId);

  if (event && event.status === 'active') {
    event.status = 'cancelled';
    event.completedAt = new Date().toISOString();
    await saveSchedulerStore(store);
    return true;
  }

  return false;
}

export async function cancelUserEvents(userId: string): Promise<number> {
  const store = await loadSchedulerStore();
  let count = 0;

  for (const event of store.events) {
    if (event.userId === userId && event.status === 'active') {
      event.status = 'cancelled';
      event.completedAt = new Date().toISOString();
      count++;
    }
  }

  await saveSchedulerStore(store);
  return count;
}

export { PARIS_TZ };
