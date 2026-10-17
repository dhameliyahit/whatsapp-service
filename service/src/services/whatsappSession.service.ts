import makeWASocket, {
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
  ConnectionState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import { EventEmitter } from 'events';
import { WhatsAppSession, IWhatsAppSessionDocument } from '../models/whatsappSession.model';
import { useMongoAuthState } from '../utils/mongoAuthState.util';

export class WhatsAppSessionService extends EventEmitter {
  private sockets: Map<string, WASocket> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
  }

  private getSessionKey(userId: string, sessionId: string = 'primary'): string {
    return `${userId}_${sessionId}`;
  }

  /**
   * Returns active Baileys socket for a session
   */
  getSocket(userId: string, sessionId: string = 'primary'): WASocket | undefined {
    return this.sockets.get(this.getSessionKey(userId, sessionId));
  }

  /**
   * Get session status from DB
   */
  async getSessionStatus(userId: string, sessionId: string = 'primary'): Promise<IWhatsAppSessionDocument | null> {
    return WhatsAppSession.findOne({ userId, sessionId });
  }

  /**
   * Initializes or connects a WhatsApp session using MongoDB-stored credentials
   */
  async initSession(userId: string, sessionId: string = 'primary'): Promise<IWhatsAppSessionDocument | null> {
    const sessionKey = this.getSessionKey(userId, sessionId);

    // Cancel any pending reconnect timers
    if (this.reconnectTimers.has(sessionKey)) {
      clearTimeout(this.reconnectTimers.get(sessionKey)!);
      this.reconnectTimers.delete(sessionKey);
    }

    // Existing active socket check
    const existingSocket = this.sockets.get(sessionKey);
    if (existingSocket) {
      if ((existingSocket.ws as any)?.isOpen) {
        const dbDoc = await WhatsAppSession.findOneAndUpdate(
          { userId, sessionId },
          { status: 'connected', qrCode: '' },
          { new: true, upsert: true }
        );
        return dbDoc;
      }
      try {
        existingSocket.ev.removeAllListeners('connection.update');
        existingSocket.ev.removeAllListeners('creds.update');
        existingSocket.end(undefined);
      } catch {
        // ignore socket close errors
      }
      this.sockets.delete(sessionKey);
    }

    // Update status to connecting in DB
    let sessionDoc: IWhatsAppSessionDocument | null = await WhatsAppSession.findOneAndUpdate(
      { userId, sessionId },
      { status: 'connecting', qrCode: '' },
      { new: true, upsert: true }
    );

    // Load credentials directly from MongoDB (Stateless & Cloud-Ready)
    const { state, saveCreds, clearCreds } = await useMongoAuthState(sessionKey);
    
    // Safely retrieve Baileys version with fallback
    let version = [2, 3000, 1015901307] as any;
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version) version = v.version;
    } catch {
      // Use fallback version if npm/remote lookup is unavailable
    }

    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['Verifinder', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      defaultQueryTimeoutMs: 60000,
    });

    this.sockets.set(sessionKey, sock);

    // Save updated credentials to MongoDB
    sock.ev.on('creds.update', saveCreds);

    // Handle connection updates
    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrCodeBase64 = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320,
            color: {
              dark: '#086288',
              light: '#ffffff',
            },
          });

          sessionDoc = await WhatsAppSession.findOneAndUpdate(
            { userId, sessionId },
            {
              status: 'qr_ready',
              qrCode: qrCodeBase64,
            },
            { new: true, upsert: true }
          );

          this.emit(`session:${sessionKey}`, {
            status: 'qr_ready',
            qrCode: qrCodeBase64,
          });
        } catch (err) {
          console.error(`:-> [WhatsApp] Failed to generate QR code for ${sessionKey}:`, err);
        }
      }

      if (connection === 'open') {
        const rawId = sock.user?.id || '';
        const phone = rawId.split(':')[0] || rawId.split('@')[0];
        const pushName = sock.user?.name || '';

        sessionDoc = await WhatsAppSession.findOneAndUpdate(
          { userId, sessionId },
          {
            status: 'connected',
            phoneNumber: phone,
            name: pushName,
            qrCode: '',
            reconnectAttempts: 0,
            connectedAt: new Date(),
            lastSeenAt: new Date(),
          },
          { new: true }
        );

        console.log(`:-> [WhatsApp] Session connected successfully: ${sessionKey} (${phone})`);
        this.emit(`session:${sessionKey}`, {
          status: 'connected',
          phoneNumber: phone,
          name: pushName,
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.warn(
          `:-> [WhatsApp] Connection closed for ${sessionKey}. Status code: ${statusCode}. Auto-reconnect: ${shouldReconnect}`
        );

        this.sockets.delete(sessionKey);

        if (!shouldReconnect) {
          // Permanently logged out: purge credentials from MongoDB
          await clearCreds();

          sessionDoc = await WhatsAppSession.findOneAndUpdate(
            { userId, sessionId },
            {
              status: 'disconnected',
              qrCode: '',
              phoneNumber: '',
              name: '',
              disconnectedAt: new Date(),
            },
            { new: true }
          );

          this.emit(`session:${sessionKey}`, {
            status: 'disconnected',
            reason: 'logged_out',
          });
        } else {
          // Temporary network drop: reconnect with exponential backoff
          const attempts = (sessionDoc?.reconnectAttempts || 0) + 1;
          const delay = Math.min(attempts * 2000, 25000);

          await WhatsAppSession.findOneAndUpdate(
            { userId, sessionId },
            {
              status: 'connecting',
              reconnectAttempts: attempts,
            }
          );

          const timer = setTimeout(() => {
            this.initSession(userId, sessionId).catch((err) =>
              console.error(`:-> [WhatsApp] Auto-reconnect failed for ${sessionKey}:`, err)
            );
          }, delay);

          this.reconnectTimers.set(sessionKey, timer);
        }
      }
    });

    // Wait briefly (up to 3 seconds) for the first QR code or connection status
    // so the initial HTTP response can directly return the QR code to the user!
    await new Promise<void>((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          this.off(`session:${sessionKey}`, handler);
          resolve();
        }
      };
      const handler = (data: any) => {
        if (data && (data.status === 'qr_ready' || data.status === 'connected')) {
          done();
        }
      };
      this.on(`session:${sessionKey}`, handler);
      setTimeout(done, 3000);
    });

    const finalDoc = await WhatsAppSession.findOne({ userId, sessionId });
    return finalDoc || sessionDoc;
  }

  /**
   * Disconnect and purge session from MongoDB
   */
  async disconnectSession(userId: string, sessionId: string = 'primary'): Promise<void> {
    const sessionKey = this.getSessionKey(userId, sessionId);

    if (this.reconnectTimers.has(sessionKey)) {
      clearTimeout(this.reconnectTimers.get(sessionKey)!);
      this.reconnectTimers.delete(sessionKey);
    }

    const sock = this.sockets.get(sessionKey);
    if (sock) {
      try {
        await sock.logout().catch(() => {});
        sock.end(new Error('Manual user logout'));
      } catch (err) {
        console.warn(`:-> [WhatsApp] Error during socket logout for ${sessionKey}:`, err);
      }
      this.sockets.delete(sessionKey);
    }

    // Purge session credentials from MongoDB
    const { clearCreds } = await useMongoAuthState(sessionKey);
    await clearCreds();

    await WhatsAppSession.findOneAndUpdate(
      { userId, sessionId },
      {
        status: 'disconnected',
        qrCode: '',
        phoneNumber: '',
        name: '',
        disconnectedAt: new Date(),
      }
    );

    this.emit(`session:${sessionKey}`, {
      status: 'disconnected',
      reason: 'manual_logout',
    });
  }

  /**
   * Diagnostic ping: checks if socket is connected and responsive
   */
  async pingSession(userId: string, sessionId: string = 'primary'): Promise<{ alive: boolean; latencyMs: number; phoneNumber?: string }> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    const sock = this.sockets.get(sessionKey);
    const sessionDoc = await WhatsAppSession.findOne({ userId, sessionId });

    if (!sock || sessionDoc?.status !== 'connected') {
      return { alive: false, latencyMs: 0 };
    }

    const start = Date.now();
    try {
      const state = (sock.ws as any)?.readyState;
      const isWsOpen = state === 1; // WebSocket.OPEN
      const latencyMs = Math.max(1, Date.now() - start);

      return {
        alive: isWsOpen,
        latencyMs,
        phoneNumber: sessionDoc.phoneNumber,
      };
    } catch {
      return { alive: false, latencyMs: Date.now() - start };
    }
  }

  /**
   * Restores any sessions that were active before server restart from MongoDB
   */
  async restoreSavedSessions(): Promise<void> {
    try {
      const activeSessions = await WhatsAppSession.find({ status: 'connected' });
      console.log(`:-> [WhatsApp] Restoring ${activeSessions.length} active sessions from MongoDB...`);

      for (const session of activeSessions) {
        this.initSession(session.userId.toString(), session.sessionId).catch((err) => {
          console.error(`:-> [WhatsApp] Failed to restore session ${session.sessionId}:`, err);
        });
      }
    } catch (err) {
      console.error(':-> [WhatsApp] Error querying saved sessions from database:', err);
    }
  }
}

export const whatsappSessionService = new WhatsAppSessionService();
