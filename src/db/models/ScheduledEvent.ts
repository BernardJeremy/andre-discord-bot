import mongoose from 'mongoose';

export interface IScheduledEvent extends mongoose.Document {
  legacyId: string;
  userId: string;
  guildId: string | null;
  channelId: string;
  type: 'cron' | 'once';
  schedule: string;
  action: string;
  mention?: string;
  status: 'active' | 'completed' | 'cancelled';
  description: string;
  createdAt: Date;
  lastTriggeredAt?: Date;
  triggerCount: number;
  completedAt?: Date;
}

const scheduledEventSchema = new mongoose.Schema<IScheduledEvent>(
  {
    legacyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    guildId: {
      type: String,
      default: null,
    },
    channelId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['cron', 'once'],
      required: true,
    },
    schedule: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    mention: {
      type: String,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    lastTriggeredAt: {
      type: Date,
    },
    triggerCount: {
      type: Number,
      default: 0,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient user + status queries
scheduledEventSchema.index({ userId: 1, status: 1 });

export const ScheduledEvent = mongoose.model<IScheduledEvent>(
  'ScheduledEvent',
  scheduledEventSchema
);
