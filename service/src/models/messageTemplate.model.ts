import mongoose, { Document, Schema, Types } from 'mongoose';

export type TemplateCategory = 'otp' | 'notification' | 'security' | 'custom';

export interface IMessageTemplateDocument extends Document {
  userId?: Types.ObjectId;
  name: string;
  category: TemplateCategory;
  body: string;
  variables: string[];
  isPreset: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageTemplateSchema = new Schema<IMessageTemplateDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['otp', 'notification', 'security', 'custom'],
      default: 'otp',
    },
    body: {
      type: String,
      required: true,
    },
    variables: {
      type: [String],
      default: [],
    },
    isPreset: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

MessageTemplateSchema.index({ userId: 1, name: 1 });

export const MessageTemplate = mongoose.model<IMessageTemplateDocument>(
  'MessageTemplate',
  MessageTemplateSchema
);
