import mongoose, { Document, Schema, Types } from 'mongoose';

export type WebhookEvent =
  | 'otp.verified'
  | 'message.sent'
  | 'message.delivered'
  | 'message.failed'
  | 'session.disconnected';

export interface IWebhookConfigDocument extends Document {
  userId: Types.ObjectId;
  url: string;
  secretKey: string;
  events: WebhookEvent[];
  isActive: boolean;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: number;
  lastDeliveryError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookConfigSchema = new Schema<IWebhookConfigDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    secretKey: {
      type: String,
      required: true,
    },
    events: {
      type: [String],
      default: ['otp.verified', 'message.sent', 'message.delivered', 'message.failed'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastDeliveryAt: {
      type: Date,
    },
    lastDeliveryStatus: {
      type: Number,
    },
    lastDeliveryError: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const WebhookConfig = mongoose.model<IWebhookConfigDocument>(
  'WebhookConfig',
  WebhookConfigSchema
);
