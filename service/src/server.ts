import { createApp } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { whatsappSessionService } from './services/whatsappSession.service';

const startServer = async (): Promise<void> => {
  // Connect to database
  await connectDB();

  // Restore any existing active WhatsApp sessions from storage
  await whatsappSessionService.restoreSavedSessions();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`===============================================`);
    console.log(`:-> Verifinder Service running on port ${env.PORT}`);
    console.log(`:-> Frontend Web App: http://localhost:${env.PORT}`);
    console.log(`:-> Health Check: http://localhost:${env.PORT}/api/health`);
    console.log(`:-> Google Client ID: ${env.GOOGLE_CLIENT_ID.substring(0, 20)}...`);
    console.log(`:-> WhatsApp Gateway Engine: Active (@whiskeysockets/baileys)`);
    console.log(`===============================================`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      console.error('[Server] Forced exit due to shutdown timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((error) => {
  console.error('[Fatal Error] Failed to start backend service:', error);
  process.exit(1);
});
