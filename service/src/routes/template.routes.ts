import { Router } from 'express';
import { templateController } from '../controllers/template.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, (req, res, next) => templateController.listTemplates(req, res, next));
router.post('/', authenticate, (req, res, next) => templateController.createTemplate(req, res, next));
router.delete('/:id', authenticate, (req, res, next) => templateController.deleteTemplate(req, res, next));

export default router;
