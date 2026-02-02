import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, addMinutes, addHours, addDays, addWeeks, isBefore, startOfMinute } from 'date-fns';
import { PARIS_TZ } from './store.js';

/**
 * Get current time in Paris timezone
 */
export function nowInParis(): Date {
  return toZonedTime(new Date(), PARIS_TZ);
}

/**
 * Parse a relative time like "in 20 minutes", "in 2 hours", "in 3 days"
 */
export function parseRelativeTime(input: string): Date | null {
  const now = nowInParis();

  // Match patterns like "in X minutes/hours/days/weeks"
  const match = input.match(/^in\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|wks?)$/i);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('min')) {
    return addMinutes(now, amount);
  } else if (unit.startsWith('hour') || unit.startsWith('hr')) {
    return addHours(now, amount);
  } else if (unit.startsWith('day')) {
    return addDays(now, amount);
  } else if (unit.startsWith('week') || unit.startsWith('wk')) {
    return addWeeks(now, amount);
  }

  return null;
}

/**
 * Parse absolute time like "today at 10:00", "tomorrow at 14:30", "2026-02-03 at 15:00"
 */
export function parseAbsoluteTime(input: string): Date | null {
  const now = nowInParis();

  // Match "today at HH:MM" or "today at HHhMM" or "today at HH"
  const todayMatch = input.match(/^today\s+at\s+(\d{1,2})(?:[h:](\d{2}))?$/i);
  if (todayMatch) {
    const hours = parseInt(todayMatch[1], 10);
    const minutes = parseInt(todayMatch[2] || '0', 10);
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    return fromZonedTime(dateStr, PARIS_TZ);
  }

  // Match "tomorrow at HH:MM"
  const tomorrowMatch = input.match(/^tomorrow\s+at\s+(\d{1,2})(?:[h:](\d{2}))?$/i);
  if (tomorrowMatch) {
    const hours = parseInt(tomorrowMatch[1], 10);
    const minutes = parseInt(tomorrowMatch[2] || '0', 10);
    const tomorrow = addDays(now, 1);
    const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    return fromZonedTime(dateStr, PARIS_TZ);
  }

  // Match ISO-like date "YYYY-MM-DD at HH:MM"
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})\s+at\s+(\d{1,2})(?:[h:](\d{2}))?$/i);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2];
    const day = isoMatch[3];
    const hours = String(parseInt(isoMatch[4], 10)).padStart(2, '0');
    const minutes = String(parseInt(isoMatch[5] || '0', 10)).padStart(2, '0');
    const dateStr = `${year}-${month}-${day} ${hours}:${minutes}:00`;
    return fromZonedTime(dateStr, PARIS_TZ);
  }

  return null;
}

/**
 * Parse time input (relative or absolute) and return ISO timestamp
 */
export function parseTimeToISO(input: string): string | null {
  const relative = parseRelativeTime(input);
  if (relative) return relative.toISOString();

  const absolute = parseAbsoluteTime(input);
  if (absolute) return absolute.toISOString();

  return null;
}

/**
 * Check if a scheduled time should fire now (within the current minute)
 */
export function shouldFireNow(scheduledISO: string): boolean {
  const now = startOfMinute(nowInParis());
  const scheduled = startOfMinute(new Date(scheduledISO));

  // Check if the scheduled time is within the current minute
  return now.getTime() === scheduled.getTime();
}

/**
 * Check if a scheduled time is in the past
 */
export function isInPast(scheduledISO: string): boolean {
  const now = nowInParis();
  const scheduled = new Date(scheduledISO);
  return isBefore(scheduled, now);
}

/**
 * Format a date for display in Paris timezone
 */
export function formatParisTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const parisDate = toZonedTime(d, PARIS_TZ);
  return format(parisDate, 'dd/MM/yyyy HH:mm');
}

/**
 * Parse common cron patterns from natural language
 * Returns a cron expression (minute hour dayOfMonth month dayOfWeek)
 */
export function parseNaturalCron(input: string): string | null {
  const lower = input.toLowerCase().trim();

  // "every minute"
  if (lower === 'every minute') {
    return '* * * * *';
  }

  // "every hour"
  if (lower === 'every hour') {
    return '0 * * * *';
  }

  // "every day at HH:MM" or "every day at HH"
  const everyDayMatch = lower.match(/^every\s+day\s+at\s+(\d{1,2})(?:[h:](\d{2}))?$/);
  if (everyDayMatch) {
    const hours = parseInt(everyDayMatch[1], 10);
    const minutes = parseInt(everyDayMatch[2] || '0', 10);
    return `${minutes} ${hours} * * *`;
  }

  // "every morning at HH:MM" (alias for every day)
  const everyMorningMatch = lower.match(/^every\s+morning\s+at\s+(\d{1,2})(?:[h:](\d{2}))?$/);
  if (everyMorningMatch) {
    const hours = parseInt(everyMorningMatch[1], 10);
    const minutes = parseInt(everyMorningMatch[2] || '0', 10);
    return `${minutes} ${hours} * * *`;
  }

  // "every evening at HH:MM" (alias for every day)
  const everyEveningMatch = lower.match(/^every\s+evening\s+at\s+(\d{1,2})(?:[h:](\d{2}))?$/);
  if (everyEveningMatch) {
    const hours = parseInt(everyEveningMatch[1], 10);
    const minutes = parseInt(everyEveningMatch[2] || '0', 10);
    return `${minutes} ${hours} * * *`;
  }

  // "every monday/tuesday/... at HH:MM"
  const dayNames: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  };

  const everyWeekdayMatch = lower.match(/^every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\s+at\s+(\d{1,2})(?:[h:](\d{2}))?$/);
  if (everyWeekdayMatch) {
    const dayOfWeek = dayNames[everyWeekdayMatch[1]];
    const hours = parseInt(everyWeekdayMatch[2], 10);
    const minutes = parseInt(everyWeekdayMatch[3] || '0', 10);
    return `${minutes} ${hours} * * ${dayOfWeek}`;
  }

  // "every weekday at HH:MM" (Monday to Friday)
  const everyWeekdayAtMatch = lower.match(/^every\s+weekday\s+at\s+(\d{1,2})(?:[h:](\d{2}))?$/);
  if (everyWeekdayAtMatch) {
    const hours = parseInt(everyWeekdayAtMatch[1], 10);
    const minutes = parseInt(everyWeekdayAtMatch[2] || '0', 10);
    return `${minutes} ${hours} * * 1-5`;
  }

  // "every weekend at HH:MM" (Saturday and Sunday)
  const everyWeekendMatch = lower.match(/^every\s+weekend\s+at\s+(\d{1,2})(?:[h:](\d{2}))?$/);
  if (everyWeekendMatch) {
    const hours = parseInt(everyWeekendMatch[1], 10);
    const minutes = parseInt(everyWeekendMatch[2] || '0', 10);
    return `${minutes} ${hours} * * 0,6`;
  }

  // "every X minutes"
  const everyXMinutesMatch = lower.match(/^every\s+(\d+)\s+minutes?$/);
  if (everyXMinutesMatch) {
    const interval = parseInt(everyXMinutesMatch[1], 10);
    return `*/${interval} * * * *`;
  }

  // "every X hours"
  const everyXHoursMatch = lower.match(/^every\s+(\d+)\s+hours?$/);
  if (everyXHoursMatch) {
    const interval = parseInt(everyXHoursMatch[1], 10);
    return `0 */${interval} * * *`;
  }

  // If it looks like a raw cron expression (5 space-separated parts), accept it
  const cronMatch = lower.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/);
  if (cronMatch) {
    return lower;
  }

  return null;
}

/**
 * Validate a cron expression
 */
export function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  // Basic validation - each part should be valid
  const patterns = [
    /^(\*|(\*\/\d+)|(\d+(-\d+)?(,\d+(-\d+)?)*))$/, // minute (0-59)
    /^(\*|(\*\/\d+)|(\d+(-\d+)?(,\d+(-\d+)?)*))$/, // hour (0-23)
    /^(\*|(\*\/\d+)|(\d+(-\d+)?(,\d+(-\d+)?)*))$/, // day of month (1-31)
    /^(\*|(\*\/\d+)|(\d+(-\d+)?(,\d+(-\d+)?)*))$/, // month (1-12)
    /^(\*|(\*\/\d+)|(\d+(-\d+)?(,\d+(-\d+)?)*))$/, // day of week (0-6)
  ];

  return parts.every((part, i) => patterns[i].test(part));
}
