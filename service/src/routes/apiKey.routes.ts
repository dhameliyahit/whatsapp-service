import { Router } from 'express';
import { apiKeyController } from '../controllers/apiKey.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, (req, res, next) => apiKeyController.listKeys(req, res, next));
router.post('/', authenticate, (req, res, next) => apiKeyController.createKey(req, res, next));
router.delete('/:id', authenticate, (req, res, next) => apiKeyController.revokeKey(req, res, next));

export default router;
