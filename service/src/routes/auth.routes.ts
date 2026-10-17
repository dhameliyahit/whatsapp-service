import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    },
  });
});
router.post('/google', (req, res, next) => authController.googleLogin(req, res, next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));
router.post('/logout', authenticate, (req, res, next) => authController.logout(req, res, next));

export default router;
