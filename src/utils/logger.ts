import { config } from "../config/index.js";
import { appendFileSync } from 'node:fs';
import path from 'node:path';

const isDev = config.node.env === 'development';

function getLogFilePath(): string | null {
  if (!config.logging.logFile) return null;
  return path.join(config.data.dir, config.logging.logFile);
}

function writeToLogFile(line: string): void {
  const logPath = getLogFilePath();
  if (!logPath) return;
  try {
    appendFileSync(logPath, line + '\n', 'utf-8');
  } catch {
    // Silently fail if file write fails
  }
}

export function devLog(category: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString().slice(11, 23);
  const prefix = `[${timestamp}] [${category}]`;

  let logLine: string;
  if (data !== undefined) {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    logLine = `${prefix} ${message} ${dataStr}`;
  } else {
    logLine = `${prefix} ${message}`;
  }

  // Always write to log file if configured
  writeToLogFile(logLine);

  // Only print to console in dev mode
  if (isDev) {
    if (data !== undefined) {
      console.log(`${prefix} ${message}`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

export function devLogSeparator(): void {
  const separator = '─'.repeat(60);
  writeToLogFile(separator);
  if (isDev) {
    console.log(separator);
  }
}
