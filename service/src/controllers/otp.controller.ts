import { Response, NextFunction } from 'express';
import { otpVerificationService } from '../services/otpVerification.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../utils/response.util';

export class OtpController {
  /**
   * POST /api/otp/send
   * Generate, hash, and dispatch an OTP verification code via WhatsApp
   */
  async sendOtp(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { to, brandName, codeLength, expiryMinutes, templateText, sessionId, metadata } = req.body;

      if (!to) {
        sendError(res, 'Destination phone number (to) is required.', 400);
        return;
      }

      const result = await otpVerificationService.sendOtp({
        userId,
        to,
        brandName,
        codeLength: codeLength ? parseInt(codeLength, 10) : 6,
        expiryMinutes: expiryMinutes ? parseInt(expiryMinutes, 10) : 5,
        templateText,
        sessionId,
        metadata,
      });

      sendSuccess(res, result, 'Verification code dispatched successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/otp/verify
   * Verify provided OTP code against stored hash with expiry & attempt limits
   */
  async verifyOtp(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { to, verificationId, code } = req.body;

      if (!code) {
        sendError(res, 'Verification code is required.', 400);
        return;
      }

      if (!to && !verificationId) {
        sendError(res, 'Either phone number (to) or verificationId must be provided.', 400);
        return;
      }

      const result = await otpVerificationService.verifyOtp({
        userId,
        to,
        verificationId,
        code: code.toString(),
      });

      if (!result.valid) {
        sendError(res, result.message, 400, {
          status: result.status,
          attemptsRemaining: result.attemptsRemaining,
        });
        return;
      }

      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/otp/logs
   * Verification audit trail
   */
  async getLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { page, limit, status } = req.query;

      const result = await otpVerificationService.getVerificationLogs(userId, {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        status: status as string,
      });

      sendSuccess(res, result, 'Verification logs retrieved.');
    } catch (error) {
      next(error);
    }
  }
}

export const otpController = new OtpController();
