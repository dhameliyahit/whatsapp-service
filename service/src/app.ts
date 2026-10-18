import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import apiRouter from './routes';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { sendError } from './utils/response.util';

export const createApp = (): Application => {
  const app: Application = express();

  // Security headers (configured to allow Google Identity Services popups to communicate back to window.opener)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );

  // Ensure Cross-Origin-Opener-Policy is never set to same-origin so Google OAuth popups can close and postMessage
  app.use((req: Request, res: Response, next) => {
    res.removeHeader('Cross-Origin-Opener-Policy');
    next();
  });

  // CORS configuration
  app.use(
    cors({
      origin: [env.CORS_ORIGIN, 'http://localhost:4200'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body and cookie parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Request logger
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // API Routes
  app.use('/api', apiRouter);

  // Serve Frontend Client build (Angular SPA)
  const candidateDistDirs = [
    path.resolve(__dirname, '../../verifinder/dist/verifinger/browser'),
    path.resolve(process.cwd(), 'verifinder/dist/verifinger/browser'),
    path.resolve(process.cwd(), '../verifinder/dist/verifinger/browser'),
  ];
  const clientDistDir = candidateDistDirs.find((dir) => fs.existsSync(dir));

  if (clientDistDir) {
    app.use(
      express.static(clientDistDir, {
        maxAge: '1d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      })
    );

    // SPA fallback: non-API GET requests serve index.html with runtime config injected
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const indexFile = fs.existsSync(path.join(clientDistDir, 'index.html'))
        ? path.join(clientDistDir, 'index.html')
        : path.join(clientDistDir, 'index.csr.html');

      if (fs.existsSync(indexFile)) {
        if (env.GOOGLE_CLIENT_ID) {
          try {
            let html = fs.readFileSync(indexFile, 'utf8');
            const envScript = `<script>window.__ENV=Object.assign(window.__ENV||{},{GOOGLE_CLIENT_ID:"${env.GOOGLE_CLIENT_ID}",API_URL:"/api"});</script>`;
            html = html.replace('</head>', `${envScript}</head>`);
            return res.send(html);
          } catch {
            // fallback to sendFile if read error occurs
          }
        }
        res.sendFile(indexFile);
      } else {
        next();
      }
    });
  }

  // 404 Route Handler
  app.use((req: Request, res: Response) => {
    sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
