import { Response, NextFunction } from 'express';
import { templateService } from '../services/template.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../utils/response.util';

export class TemplateController {
  /**
   * GET /api/templates
   */
  async listTemplates(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const templates = await templateService.getTemplates(userId);
      sendSuccess(res, { templates }, 'Templates retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/templates
   */
  async createTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { name, body, category } = req.body;

      if (!name || !body) {
        sendError(res, 'Template name and body are required.', 400);
        return;
      }

      const template = await templateService.createTemplate(userId, { name, body, category });
      sendSuccess(res, { template }, 'Template created successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/templates/:id
   */
  async deleteTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const deleted = await templateService.deleteTemplate(userId, id);
      if (!deleted) {
        sendError(res, 'Template not found or cannot delete system preset.', 404);
        return;
      }

      sendSuccess(res, null, 'Template deleted.');
    } catch (error) {
      next(error);
    }
  }
}

export const templateController = new TemplateController();
