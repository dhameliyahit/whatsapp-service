import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IWhatsAppAuthKey {
  sessionKey: string;
  keyId: string;
  data: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWhatsAppAuthKeyDocument extends IWhatsAppAuthKey, Document {}

const WhatsAppAuthKeySchema = new Schema<IWhatsAppAuthKeyDocument>(
  {
    sessionKey: {
      type: String,
      required: true,
      index: true,
    },
    keyId: {
      type: String,
      required: true,
      index: true,
    },
    data: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

WhatsAppAuthKeySchema.index({ sessionKey: 1, keyId: 1 }, { unique: true });

export const WhatsAppAuthKey: Model<IWhatsAppAuthKeyDocument> = mongoose.model<IWhatsAppAuthKeyDocument>(
  'WhatsAppAuthKey',
  WhatsAppAuthKeySchema
);
