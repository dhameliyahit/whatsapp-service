import mongoose, { Document, Schema, Model } from 'mongoose';

export type WhatsAppMessageType = 'text' | 'otp' | 'template';
export type WhatsAppMessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface IWhatsAppMessage {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  to: string;
  messageId?: string;
  type: WhatsAppMessageType;
  content: string;
  otpCode?: string;
  status: WhatsAppMessageStatus;
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWhatsAppMessageDocument extends IWhatsAppMessage, Document {}

const WhatsAppMessageSchema = new Schema<IWhatsAppMessageDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      default: 'primary',
      index: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    messageId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    type: {
      type: String,
      enum: ['text', 'otp', 'template'],
      default: 'text',
    },
    content: {
      type: String,
      required: true,
    },
    otpCode: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'read', 'failed'],
      default: 'queued',
      index: true,
    },
    error: {
      type: String,
    },
    sentAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

WhatsAppMessageSchema.index({ userId: 1, createdAt: -1 });

export const WhatsAppMessage: Model<IWhatsAppMessageDocument> = mongoose.model<IWhatsAppMessageDocument>(
  'WhatsAppMessage',
  WhatsAppMessageSchema
);
