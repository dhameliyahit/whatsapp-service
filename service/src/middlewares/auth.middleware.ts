import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.util';
import { sendError } from '../utils/response.util';
import { apiKeyService } from '../services/apiKey.service';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Check for Developer X-API-Key header first
    const apiKeyHeader = req.headers['x-api-key'] || req.headers['x-api-token'];
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.startsWith('vf_live_')) {
      const apiAuth = await apiKeyService.validateApiKey(apiKeyHeader);
      if (apiAuth) {
        req.user = {
          userId: apiAuth.userId,
          email: '',
          role: 'user',
        };
        next();
        return;
      } else {
        sendError(res, 'Invalid or revoked API key.', 401);
        return;
      }
    }

    // 2. Check for Authorization header or query token
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token;
    } else if (req.query && typeof req.query.accessToken === 'string') {
      token = req.query.accessToken;
    }

    if (!token) {
      sendError(res, 'Authentication required. No token or API key provided.', 401);
      return;
    }

    // Check if Bearer token is an API key (vf_live_...)
    if (token.startsWith('vf_live_')) {
      const apiAuth = await apiKeyService.validateApiKey(token);
      if (apiAuth) {
        req.user = {
          userId: apiAuth.userId,
          email: '',
          role: 'user',
        };
        next();
        return;
      } else {
        sendError(res, 'Invalid or revoked API key.', 401);
        return;
      }
    }

    // Standard JWT token verification
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error: any) {
    sendError(res, 'Invalid or expired authentication credentials.', 401, error);
  }
};

export const requireRole = (role: 'admin' | 'user') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Unauthorized access.', 401);
      return;
    }

    if (role === 'admin' && req.user.role !== 'admin') {
      sendError(res, 'Forbidden. Administrator privileges required.', 403);
      return;
    }

    next();
  };
};
