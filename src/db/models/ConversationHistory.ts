import mongoose from 'mongoose';

interface StoredMessage {
  role: 'human' | 'ai';
  content: string;
  timestamp: Date;
}

export interface IConversationHistory extends mongoose.Document {
  userId: string;
  channelId: string;
  messages: StoredMessage[];
  updatedAt: Date;
}

const messageSchema = new mongoose.Schema<StoredMessage>(
  {
    role: {
      type: String,
      enum: ['human', 'ai'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const conversationHistorySchema = new mongoose.Schema<IConversationHistory>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    channelId: {
      type: String,
      required: true,
      index: true,
    },
    messages: [messageSchema],
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying by user and channel
conversationHistorySchema.index({ userId: 1, channelId: 1 }, { unique: true });

export const ConversationHistory = mongoose.model<IConversationHistory>(
  'ConversationHistory',
  conversationHistorySchema
);
