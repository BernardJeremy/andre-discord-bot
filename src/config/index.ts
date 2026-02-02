import 'dotenv/config';

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN!,
  },
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY!,
    model: process.env.MISTRAL_MODEL_NAME!,
  },
} as const;

export function validateConfig(): void {
  const missing: string[] = [];

  if (!process.env.DISCORD_TOKEN) missing.push('DISCORD_TOKEN');
  if (!process.env.MISTRAL_API_KEY) missing.push('MISTRAL_API_KEY');
  if (!process.env.MISTRAL_MODEL_NAME) missing.push('MISTRAL_MODEL_NAME');
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}
