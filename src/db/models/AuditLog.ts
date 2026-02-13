import mongoose from 'mongoose';

export type AuditEventType =
  | 'user_message'
  | 'llm_request'
  | 'llm_response'
  | 'tool_invocation'
  | 'tool_result'
  | 'agent_error'
  | 'agent_response'
  | 'scheduler_event';

export interface IAuditLog extends mongoose.Document {
  conversationId: string;
  userId: string;
  channelId: string;
  eventType: AuditEventType;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

const auditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
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
    eventType: {
      type: String,
      required: true,
      enum: [
        'user_message',
        'llm_request',
        'llm_response',
        'tool_invocation',
        'tool_result',
        'agent_error',
        'agent_response',
        'scheduler_event',
      ],
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Compound indexes for common query patterns
auditLogSchema.index({ conversationId: 1, timestamp: 1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
