import mongoose, { Document, Schema, Types } from 'mongoose';

export type OtpVerificationStatus = 'pending' | 'verified' | 'expired' | 'failed';

export interface IOtpVerificationDocument extends Document {
  userId: Types.ObjectId;
  sessionId: string;
  phoneNumber: string;
  otpHash: string;
  status: OtpVerificationStatus;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  verifiedAt?: Date;
  brandName?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OtpVerificationSchema = new Schema<IOtpVerificationDocument>(
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
    phoneNumber: {
      type: String,
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'expired', 'failed'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
      min: 1,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    verifiedAt: {
      type: Date,
    },
    brandName: {
      type: String,
      default: 'Verifinder',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Auto-expire documents after 7 days for audit trail retention
OtpVerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
OtpVerificationSchema.index({ userId: 1, phoneNumber: 1, status: 1 });

export const OtpVerification = mongoose.model<IOtpVerificationDocument>(
  'OtpVerification',
  OtpVerificationSchema
);
