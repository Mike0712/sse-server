import express, { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  addClient,
  removeClient,
  subscribe,
  unsubscribe,
  getSubscribers,
} from './clients';

const router = Router();

interface JWTPayload {
  userId: number;
  username?: string;
  telegramId: number;
  sessionId?: number;
}

interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

function authenticateToken(req: Request, res: Response, next: express.NextFunction) {
  // Пробуем получить токен из заголовка или query параметра
  const token = req.headers.authorization?.replace('Bearer ', '') || 
                (req.query.token as string);
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[SSE] JWT_SECRET is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const payload = jwt.verify(token, secret) as JWTPayload;
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

router.get('/events', authenticateToken, (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  (res as any).flushHeaders && (res as any).flushHeaders();

  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    res.status(401).end('Unauthorized');
    return;
  }
  
  // Берем user_id из токена
  const user_id = authReq.user.userId.toString();
  addClient(user_id, res);
  
  // Send initial connection message
  res.write(`event: ping\ndata: "connected"\n\n`);
  
  // Keep-alive heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    try {
      if (!res.destroyed && !res.closed) {
        res.write(`event: ping\ndata: ${Date.now()}\n\n`);
      } else {
        clearInterval(heartbeatInterval);
        removeClient(user_id);
        if (!res.destroyed && !res.closed) {
          res.end();
        }
      }
    } catch (error) {
      clearInterval(heartbeatInterval);
      removeClient(user_id);
      if (!res.destroyed && !res.closed) {
        res.destroy();
      }
    }
  }, 30000);
  
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    removeClient(user_id);
    // Явно закрываем response stream
    if (!res.destroyed && !res.closed) {
      res.end();
    }
    console.log(`[SSE] Disconnected: user_id=${user_id}`);
    
    // Отправляем уведомление на бэкенд через 7 секунд
    setTimeout(async () => {
      try {
        const backendUrl = process.env.BACKEND_URL;
        const response = await fetch(`${backendUrl}/api/users/sse/disconnected`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user_id,
            timestamp: new Date().toISOString(),
          }),
        });
        
        if (!response.ok) {
          console.log(`[SSE] Failed to notify backend about disconnect: ${response.status}`);
        } else {
          console.log(`[SSE] Notified backend about disconnect: user_id=${user_id}`);
        }
      } catch (error) {
        console.log(`[SSE] Error notifying backend about disconnect: user_id=${user_id}`, error);
      }
    }, 7000);
  });
  
  res.on('error', (error) => {
    clearInterval(heartbeatInterval);
    removeClient(user_id);
    // Закрываем stream при ошибке
    if (!res.destroyed && !res.closed) {
      res.destroy();
    }
    console.log(`[SSE] Connection error: user_id=${user_id}`, error);
  });
});

router.post('/subscribe', authenticateToken, express.json(), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { event, event_id } = req.body;
  if (!event || !event_id) return res.status(400).send("Required: event, event_id");
  
  // Берем user_id из токена
  const user_id = authReq.user.userId.toString();
  subscribe(user_id, event, event_id);
  console.log(`[SSE] Subscribed: user_id=${user_id}, event=${event}, event_id=${event_id}`);
  res.send('OK');
});

router.post('/unsubscribe', authenticateToken, express.json(), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { event, event_id } = req.body;
  if (!event || !event_id) return res.status(400).send("Required: event, event_id");
  
  // Берем user_id из токена
  const user_id = authReq.user.userId.toString();
  unsubscribe(user_id, event, event_id);
  res.send('OK');
});


router.post('/pushEvent', express.json(), (req: Request, res: Response) => {
  const { event, event_id, payload } = req.body;
  console.log({event, event_id, payload}, '[SSE] Pushing event');
  if (!event || !event_id) return res.status(400).send('Missing event or event_id');
  const targets = getSubscribers(event, event_id);
  for (const client of targets) {
    try {
      if (!client.res.destroyed && !client.res.closed) {
        console.log(`[SSE] Pushing event: user_id=${client.user_id}, event=${event}, event_id=${event_id}`);
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(payload ?? {})}\n\n`);
      } else {
        console.log(`[SSE] Client disconnected, removing: user_id=${client.user_id}`);
        removeClient(client.user_id);
      }
    } catch (error) {
      console.log(`[SSE] Error pushing to client: user_id=${client.user_id}`, error);
      removeClient(client.user_id);
    }
  }
  res.send('OK');
});

export default router;
