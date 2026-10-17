import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Session endpoints
router.post('/session/connect', authenticate, (req, res, next) =>
  whatsappController.connectSession(req, res, next)
);
router.get('/session/status', authenticate, (req, res, next) =>
  whatsappController.getSessionStatus(req, res, next)
);
router.get('/session/events', authenticate, (req, res) =>
  whatsappController.streamSessionEvents(req, res)
);
router.post('/session/disconnect', authenticate, (req, res, next) =>
  whatsappController.disconnectSession(req, res, next)
);
router.post('/session/ping', authenticate, (req, res, next) =>
  whatsappController.pingSession(req, res, next)
);

router.post('/lookup', authenticate, (req, res, next) =>
  whatsappController.lookupNumber(req, res, next)
);

// Messaging endpoints
router.post('/messages/send', authenticate, (req, res, next) =>
  whatsappController.sendMessage(req, res, next)
);
router.post('/messages/send-otp', authenticate, (req, res, next) =>
  whatsappController.sendOtp(req, res, next)
);
router.get('/messages/stats', authenticate, (req, res, next) =>
  whatsappController.getMessageStats(req, res, next)
);
router.get('/messages/export', authenticate, (req, res, next) =>
  whatsappController.exportLogsCsv(req, res, next)
);
router.get('/messages/logs', authenticate, (req, res, next) =>
  whatsappController.getMessageLogs(req, res, next)
);
router.get('/messages/:id', authenticate, (req, res, next) =>
  whatsappController.getMessageById(req, res, next)
);

export default router;
