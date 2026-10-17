import crypto from 'crypto';
import { OtpVerification, IOtpVerificationDocument } from '../models/otpVerification.model';
import { whatsappMessageService } from './whatsappMessage.service';
import { webhookService } from './webhook.service';

const OTP_HASH_SALT = process.env.OTP_SALT || 'verifinder_otp_secure_salt_2026';

export interface SendOtpVerificationOptions {
  userId: string;
  to: string;
  brandName?: string;
  codeLength?: number;
  expiryMinutes?: number;
  templateText?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface VerifyOtpOptions {
  userId: string;
  to?: string;
  verificationId?: string;
  code: string;
}

export class OtpVerificationService {
  /**
   * Hashes OTP code securely with SHA-256 and server-side salt
   */
  private hashOtp(code: string): string {
    return crypto
      .createHash('sha256')
      .update(`${code}_${OTP_HASH_SALT}`)
      .digest('hex');
  }

  /**
   * Generates a cryptographically random numeric OTP code
   */
  private generateCode(length: number = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return crypto.randomInt(min, max + 1).toString();
  }

  /**
   * Send a new OTP verification request
   */
  async sendOtp(options: SendOtpVerificationOptions): Promise<{
    verificationId: string;
    phoneNumber: string;
    status: string;
    expiresAt: Date;
    messageDocId: string;
  }> {
    const {
      userId,
      to,
      brandName = 'Verifinder',
      codeLength = 6,
      expiryMinutes = 5,
      templateText,
      sessionId = 'primary',
      metadata = {},
    } = options;

    const { cleanNumber } = whatsappMessageService.normalizePhoneNumber(to);

    // Rate limiting: check recent pending requests to this phone number in last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentCount = await OtpVerification.countDocuments({
      userId,
      phoneNumber: cleanNumber,
      createdAt: { $gte: twoMinutesAgo },
    });

    if (recentCount >= 4) {
      throw new Error('Too many OTP requests for this phone number. Please wait a few minutes before retrying.');
    }

    // Invalidate previous pending OTPs for this user and number
    await OtpVerification.updateMany(
      { userId, phoneNumber: cleanNumber, status: 'pending' },
      { status: 'expired' }
    );

    // Generate code and hash
    const code = this.generateCode(codeLength);
    const otpHash = this.hashOtp(code);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const verificationDoc = new OtpVerification({
      userId,
      sessionId,
      phoneNumber: cleanNumber,
      otpHash,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      expiresAt,
      brandName,
      metadata,
    });
    await verificationDoc.save();

    // Prepare message text
    let messageBody = templateText;
    if (messageBody) {
      messageBody = messageBody
        .replace(/\{\{code\}\}/g, code)
        .replace(/\{\{brand\}\}/g, brandName)
        .replace(/\{\{minutes\}\}/g, expiryMinutes.toString());
    }

    // Dispatch WhatsApp message
    const messageDoc = await whatsappMessageService.sendOtp({
      userId,
      to: cleanNumber,
      code,
      brandName,
      message: messageBody,
      sessionId,
    });

    return {
      verificationId: verificationDoc._id.toString(),
      phoneNumber: cleanNumber,
      status: 'pending',
      expiresAt,
      messageDocId: messageDoc._id.toString(),
    };
  }

  /**
   * Verify an incoming OTP code
   */
  async verifyOtp(options: VerifyOtpOptions): Promise<{
    valid: boolean;
    status: string;
    message: string;
    verificationId?: string;
    phoneNumber?: string;
    verifiedAt?: Date;
    attemptsRemaining?: number;
  }> {
    const { userId, to, verificationId, code } = options;

    if (!code || code.trim().length === 0) {
      throw new Error('Verification code is required.');
    }

    // Locate record by verificationId or latest pending by phoneNumber
    let verificationDoc: IOtpVerificationDocument | null = null;
    if (verificationId) {
      verificationDoc = await OtpVerification.findOne({ _id: verificationId, userId });
    } else if (to) {
      const { cleanNumber } = whatsappMessageService.normalizePhoneNumber(to);
      verificationDoc = await OtpVerification.findOne({
        userId,
        phoneNumber: cleanNumber,
        status: 'pending',
      }).sort({ createdAt: -1 });
    }

    if (!verificationDoc) {
      return {
        valid: false,
        status: 'not_found',
        message: 'No pending OTP verification request found for this phone number or ID.',
      };
    }

    // Check if already verified
    if (verificationDoc.status === 'verified') {
      return {
        valid: false,
        status: 'already_verified',
        message: 'This verification code has already been used.',
        verificationId: verificationDoc._id.toString(),
        phoneNumber: verificationDoc.phoneNumber,
        verifiedAt: verificationDoc.verifiedAt,
      };
    }

    // Check if expired
    const now = new Date();
    if (verificationDoc.expiresAt < now || verificationDoc.status === 'expired') {
      verificationDoc.status = 'expired';
      await verificationDoc.save();
      return {
        valid: false,
        status: 'expired',
        message: 'This verification code has expired. Please request a new code.',
        verificationId: verificationDoc._id.toString(),
        phoneNumber: verificationDoc.phoneNumber,
      };
    }

    // Check max attempts
    if (verificationDoc.attempts >= verificationDoc.maxAttempts || verificationDoc.status === 'failed') {
      verificationDoc.status = 'failed';
      await verificationDoc.save();
      return {
        valid: false,
        status: 'max_attempts_exceeded',
        message: 'Maximum verification attempts exceeded. Please request a fresh code.',
        attemptsRemaining: 0,
      };
    }

    // Hash user-provided code and compare
    const incomingHash = this.hashOtp(code.trim());
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(incomingHash, 'hex'),
      Buffer.from(verificationDoc.otpHash, 'hex')
    );

    if (!isMatch) {
      verificationDoc.attempts += 1;
      const attemptsRemaining = Math.max(0, verificationDoc.maxAttempts - verificationDoc.attempts);

      if (attemptsRemaining === 0) {
        verificationDoc.status = 'failed';
      }
      await verificationDoc.save();

      return {
        valid: false,
        status: attemptsRemaining === 0 ? 'failed' : 'invalid_code',
        message:
          attemptsRemaining === 0
            ? 'Incorrect code. Maximum attempts reached.'
            : `Incorrect verification code. ${attemptsRemaining} attempt(s) remaining.`,
        attemptsRemaining,
      };
    }

    // Successful Verification
    verificationDoc.status = 'verified';
    verificationDoc.verifiedAt = now;
    await verificationDoc.save();

    // Trigger Outbound Webhook asynchronously
    webhookService.dispatchEvent(userId, 'otp.verified', {
      verificationId: verificationDoc._id.toString(),
      phoneNumber: verificationDoc.phoneNumber,
      brandName: verificationDoc.brandName,
      verifiedAt: now.toISOString(),
      metadata: verificationDoc.metadata,
    });

    return {
      valid: true,
      status: 'verified',
      message: 'Verification code confirmed successfully.',
      verificationId: verificationDoc._id.toString(),
      phoneNumber: verificationDoc.phoneNumber,
      verifiedAt: now,
    };
  }

  /**
   * Get verification history logs
   */
  async getVerificationLogs(userId: string, query: { page?: number; limit?: number; status?: string }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { userId };
    if (query.status) {
      filter.status = query.status;
    }

    const [items, total] = await Promise.all([
      OtpVerification.find(filter)
        .select('-otpHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      OtpVerification.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const otpVerificationService = new OtpVerificationService();
