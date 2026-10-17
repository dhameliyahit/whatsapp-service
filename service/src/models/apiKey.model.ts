import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IApiKey {
  userId: mongoose.Types.ObjectId;
  name: string;
  prefix: string;
  keyHash: string;
  status: 'active' | 'revoked';
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IApiKeyDocument extends IApiKey, Document {}

const ApiKeySchema = new Schema<IApiKeyDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    prefix: {
      type: String,
      required: true,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true,
    },
    lastUsedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const ApiKey: Model<IApiKeyDocument> = mongoose.model<IApiKeyDocument>(
  'ApiKey',
  ApiKeySchema
);
