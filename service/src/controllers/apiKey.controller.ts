import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { apiKeyService } from '../services/apiKey.service';
import { sendSuccess, sendError } from '../utils/response.util';

export class ApiKeyController {
  async listKeys(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const keys = await apiKeyService.getUserApiKeys(userId);
      sendSuccess(res, { keys }, 'API keys retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async createKey(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { name } = req.body;

      if (!name || !name.trim()) {
        sendError(res, 'A friendly name or label is required for the API key.', 400);
        return;
      }

      const result = await apiKeyService.createApiKey(userId, name);
      sendSuccess(
        res,
        {
          apiKey: result.apiKey,
          keyRecord: result.record,
        },
        'New API key created. Copy it now, it will not be shown again.',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async revokeKey(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const success = await apiKeyService.revokeApiKey(userId, id);
      if (!success) {
        sendError(res, 'API key not found or already revoked.', 404);
        return;
      }

      sendSuccess(res, null, 'API key revoked successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const apiKeyController = new ApiKeyController();
