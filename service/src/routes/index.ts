import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import whatsappRoutes from './whatsapp.routes';
import apiKeyRoutes from './apiKey.routes';
import otpRoutes from './otp.routes';
import webhookRoutes from './webhook.routes';
import templateRoutes from './template.routes';
import { sendSuccess } from '../utils/response.util';
import { env } from '../config/env';

const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, { status: 'healthy', service: 'verifinder-backend' }, 'Verifinder API is operating normally.');
});

// Public Configuration endpoint for frontend dynamic integration
apiRouter.get('/public-config', (req: Request, res: Response) => {
  const dynamicOrigin = `${req.protocol}://${req.get('host')}/api`;
  sendSuccess(
    res,
    { apiUrl: env.API_URL || dynamicOrigin },
    'Public configuration retrieved successfully.'
  );
});

// Feature routers
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/whatsapp', whatsappRoutes);
apiRouter.use('/otp', otpRoutes);
apiRouter.use('/webhooks', webhookRoutes);
apiRouter.use('/templates', templateRoutes);
apiRouter.use('/api-keys', apiKeyRoutes);

export default apiRouter;
