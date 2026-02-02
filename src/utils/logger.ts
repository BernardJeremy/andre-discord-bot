const isDev = process.env.NODE_ENV === 'development';

export function devLog(category: string, message: string, data?: unknown): void {
  if (!isDev) return;

  const timestamp = new Date().toISOString().slice(11, 23);
  const prefix = `[${timestamp}] [${category}]`;

  if (data !== undefined) {
    console.log(`${prefix} ${message}`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export function devLogSeparator(): void {
  if (!isDev) return;
  console.log('─'.repeat(60));
}
