import mongoose from 'mongoose';

export interface ITokenUsage extends mongoose.Document {
  userId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  lastUpdated: Date;
}

const tokenUsageSchema = new mongoose.Schema<ITokenUsage>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    inputTokens: {
      type: Number,
      default: 0,
    },
    outputTokens: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

export const TokenUsage = mongoose.model<ITokenUsage>(
  'TokenUsage',
  tokenUsageSchema
);
