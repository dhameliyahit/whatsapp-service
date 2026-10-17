import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { sendSuccess, sendError } from '../utils/response.util';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class AuthController {
  /**
   * POST /api/auth/google
   * Authenticate with Google ID Token / Credential
   */
  async googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idToken = req.body.idToken || req.body.credential;

      if (!idToken) {
        sendError(res, 'Google ID Token or credential is required.', 400);
        return;
      }

      const { user, accessToken, refreshToken } = await authService.authenticateWithGoogle(idToken);

      // Optionally set HTTP-only cookie for refresh token
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      sendSuccess(
        res,
        {
          user,
          accessToken,
          refreshToken,
        },
        'Google authentication successful.'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Refresh session tokens
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

      if (!refreshToken) {
        sendError(res, 'Refresh token is required.', 400);
        return;
      }

      const tokens = await authService.refreshSession(refreshToken);

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      sendSuccess(res, tokens, 'Tokens refreshed successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Get current authenticated user profile
   */
  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        sendError(res, 'Unauthenticated.', 401);
        return;
      }

      const user = await userService.getUserById(req.user.userId);
      if (!user) {
        sendError(res, 'User not found.', 404);
        return;
      }

      sendSuccess(res, { user }, 'User profile retrieved.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Terminate active session
   */
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.userId) {
        await authService.logout(req.user.userId);
      }

      res.clearCookie('refreshToken');
      sendSuccess(res, null, 'Logged out successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
