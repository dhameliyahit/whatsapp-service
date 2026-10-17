import mongoose, { Document, Schema, Model } from 'mongoose';

export type WhatsAppSessionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

export interface IWhatsAppSession {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  phoneNumber?: string;
  name?: string;
  status: WhatsAppSessionStatus;
  qrCode?: string;
  reconnectAttempts: number;
  connectedAt?: Date;
  disconnectedAt?: Date;
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWhatsAppSessionDocument extends IWhatsAppSession, Document {}

const WhatsAppSessionSchema = new Schema<IWhatsAppSessionDocument>(
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
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: '',
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['disconnected', 'connecting', 'qr_ready', 'connected'],
      default: 'disconnected',
      index: true,
    },
    qrCode: {
      type: String,
      default: '',
    },
    reconnectAttempts: {
      type: Number,
      default: 0,
    },
    connectedAt: {
      type: Date,
    },
    disconnectedAt: {
      type: Date,
    },
    lastSeenAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

WhatsAppSessionSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

export const WhatsAppSession: Model<IWhatsAppSessionDocument> = mongoose.model<IWhatsAppSessionDocument>(
  'WhatsAppSession',
  WhatsAppSessionSchema
);
