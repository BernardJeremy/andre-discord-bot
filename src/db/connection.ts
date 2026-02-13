import mongoose from 'mongoose';
import { config } from '../config/index.js';

let isConnected = false;

export async function connectToDatabase(): Promise<void> {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(config.database.uri);
    isConnected = true;
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Failed to disconnect from MongoDB:', error);
    throw error;
  }
}

export function isMongoConnected(): boolean {
  return isConnected;
}

export function getMongooseConnection(): typeof mongoose {
  return mongoose;
}
