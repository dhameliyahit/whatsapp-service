import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/profile', authenticate, (req, res, next) => userController.getProfile(req, res, next));
router.put('/profile', authenticate, (req, res, next) => userController.updateProfile(req, res, next));
router.get('/', authenticate, requireRole('admin'), (req, res, next) => userController.listUsers(req, res, next));

export default router;
