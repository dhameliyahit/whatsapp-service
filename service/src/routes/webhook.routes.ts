import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, (req, res, next) => webhookController.getWebhook(req, res, next));
router.post('/', authenticate, (req, res, next) => webhookController.saveWebhook(req, res, next));
router.post('/rotate-secret', authenticate, (req, res, next) =>
  webhookController.rotateSecret(req, res, next)
);
router.post('/test', authenticate, (req, res, next) => webhookController.testWebhook(req, res, next));
router.delete('/', authenticate, (req, res, next) => webhookController.deleteWebhook(req, res, next));

export default router;
