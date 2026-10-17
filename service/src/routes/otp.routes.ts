import { Router } from 'express';
import { otpController } from '../controllers/otp.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/send', authenticate, (req, res, next) => otpController.sendOtp(req, res, next));
router.post('/verify', authenticate, (req, res, next) => otpController.verifyOtp(req, res, next));
router.get('/logs', authenticate, (req, res, next) => otpController.getLogs(req, res, next));

export default router;
