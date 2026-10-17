import { Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { sendSuccess, sendError } from '../utils/response.util';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class UserController {
  /**
   * GET /api/users/profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getUserById(req.user!.userId);
      if (!user) {
        sendError(res, 'User not found.', 404);
        return;
      }
      sendSuccess(res, { user }, 'User profile retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/users/profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, picture } = req.body;
      const updatedUser = await userService.updateProfile(req.user!.userId, { name, picture });

      if (!updatedUser) {
        sendError(res, 'User not found.', 404);
        return;
      }

      sendSuccess(res, { user: updatedUser }, 'Profile updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users (Admin only)
   */
  async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await userService.getAllUsers(page, limit);
      sendSuccess(res, result, 'Users fetched successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
