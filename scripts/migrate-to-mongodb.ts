import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Lists } from '../src/db/models/Lists.js';
import { ConversationHistory } from '../src/db/models/ConversationHistory.js';
import { TokenUsage } from '../src/db/models/TokenUsage.js';
import { ScheduledEvent } from '../src/db/models/ScheduledEvent.js';
import { User } from '../src/db/models/User.js';

interface ListItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

interface UserList {
  name: string;
  items: ListItem[];
  createdAt: string;
  updatedAt: string;
}

interface UserLists {
  [listName: string]: UserList;
}

interface StoredMessage {
  role: 'human' | 'ai';
  content: string;
  timestamp: string;
}

interface ConversationHistoryFile {
  messages: StoredMessage[];
}

interface TokenUsageFile {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  lastUpdated: string;
}

interface ScheduledEventFile {
  id: string;
  userId: string;
  guildId: string | null;
  channelId: string;
  type: 'cron' | 'once';
  schedule: string;
  action: string;
  mention?: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  lastTriggeredAt?: string;
  triggerCount: number;
  completedAt?: string;
  description: string;
}

interface SchedulerStoreFile {
  events: ScheduledEventFile[];
}

async function connectToDatabase(): Promise<void> {
  console.log('Connecting to MongoDB...');
  try {
    await mongoose.connect(config.database.uri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
}

async function migrateUser(userId: string): Promise<void> {
  const sandboxPath = path.join(config.data.dir, 'sandboxes', userId);

  // Ensure user exists
  await User.findOneAndUpdate(
    { discordId: userId },
    { discordId: userId },
    { upsert: true }
  );

  // Migrate lists
  const listsPath = path.join(sandboxPath, 'lists.json');
  if (existsSync(listsPath)) {
    const listsContent = await readFile(listsPath, 'utf-8');
    const listsData = JSON.parse(listsContent) as UserLists;

    await Lists.findOneAndUpdate(
      { userId },
      {
        userId,
        lists: listsData,
      },
      { upsert: true }
    );
    console.log(`  ✓ Migrated lists for user ${userId}`);
  }

  // Migrate conversations
  const conversationsDir = path.join(sandboxPath, 'conversations');
  if (existsSync(conversationsDir)) {
    const convFiles = await readdir(conversationsDir);

    for (const file of convFiles) {
      if (file.endsWith('.json')) {
        const channelId = file.replace('.json', '');
        const convPath = path.join(conversationsDir, file);
        const convContent = await readFile(convPath, 'utf-8');
        const convData = JSON.parse(convContent) as ConversationHistoryFile;

        // Convert ISO strings to Date objects
        const messages = convData.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }));

        await ConversationHistory.findOneAndUpdate(
          { userId, channelId },
          {
            userId,
            channelId,
            messages,
          },
          { upsert: true }
        );
      }
    }
    console.log(`  ✓ Migrated conversation history for user ${userId}`);
  }

  // Migrate DM conversation history
  const conversationPath = path.join(sandboxPath, 'conversation.json');
  if (existsSync(conversationPath)) {
    const convContent = await readFile(conversationPath, 'utf-8');
    const convData = JSON.parse(convContent) as ConversationHistoryFile;

    const messages = convData.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
    }));

    await ConversationHistory.findOneAndUpdate(
      { userId, channelId: 'dm' },
      {
        userId,
        channelId: 'dm',
        messages,
      },
      { upsert: true }
    );
  }

  // Migrate token usage
  const tokenUsagePath = path.join(sandboxPath, 'token_usage.json');
  if (existsSync(tokenUsagePath)) {
    const tokenContent = await readFile(tokenUsagePath, 'utf-8');
    const tokenData = JSON.parse(tokenContent) as TokenUsageFile;

    await TokenUsage.findOneAndUpdate(
      { userId },
      {
        userId,
        inputTokens: tokenData.inputTokens,
        outputTokens: tokenData.outputTokens,
        totalTokens: tokenData.totalTokens,
        lastUpdated: new Date(tokenData.lastUpdated),
      },
      { upsert: true }
    );
    console.log(`  ✓ Migrated token usage for user ${userId}`);
  }
}

async function migrateScheduler(): Promise<void> {
  const schedulerPath = path.join(config.data.dir, 'scheduler.json');

  if (!existsSync(schedulerPath)) {
    console.log('ℹ️  No scheduler.json file found, skipping scheduler migration');
    return;
  }

  const schedulerContent = await readFile(schedulerPath, 'utf-8');
  const schedulerData = JSON.parse(schedulerContent) as SchedulerStoreFile;

  for (const event of schedulerData.events) {
    await ScheduledEvent.findOneAndUpdate(
      { legacyId: event.id },
      {
        legacyId: event.id,
        userId: event.userId,
        guildId: event.guildId,
        channelId: event.channelId,
        type: event.type,
        schedule: event.schedule,
        action: event.action,
        mention: event.mention,
        status: event.status,
        description: event.description,
        createdAt: new Date(event.createdAt),
        lastTriggeredAt: event.lastTriggeredAt
          ? new Date(event.lastTriggeredAt)
          : null,
        triggerCount: event.triggerCount,
        completedAt: event.completedAt ? new Date(event.completedAt) : null,
      },
      { upsert: true }
    );
  }

  console.log(`✓ Migrated ${schedulerData.events.length} scheduled events`);
}

async function main(): Promise<void> {
  console.log('🚀 Starting MongoDB migration...\n');

  try {
    await connectToDatabase();

    const sandboxesPath = path.join(config.data.dir, 'sandboxes');

    if (!existsSync(sandboxesPath)) {
      console.log('ℹ️  No sandboxes directory found, nothing to migrate');
      await disconnectFromDatabase();
      return;
    }

    const userDirs = await readdir(sandboxesPath);

    console.log(`Found ${userDirs.length} users to migrate\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const userId of userDirs) {
      try {
        console.log(`Migrating user ${userId}...`);
        await migrateUser(userId);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to migrate user ${userId}:`, error);
      }
    }

    // Migrate scheduler
    try {
      await migrateScheduler();
    } catch (error) {
      console.error('❌ Failed to migrate scheduler:', error);
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  Users migrated: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log('\n✅ Migration complete!');

    await disconnectFromDatabase();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
