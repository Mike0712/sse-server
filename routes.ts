import express, { Router, Request, Response } from 'express';
import {
  addClient,
  removeClient,
  subscribe,
  unsubscribe,
  getSubscribers,
} from './clients';

const router = Router();

router.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  (res as any).flushHeaders && (res as any).flushHeaders();

  const user_id = req.query.user_id as string;
  if (!user_id) {
    res.status(400).end('No user_id');
    return;
  }
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
      }
    } catch (error) {
      clearInterval(heartbeatInterval);
      removeClient(user_id);
    }
  }, 30000);
  
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    removeClient(user_id);
    console.log(`[SSE] Disconnected: user_id=${user_id}`);
  });
  
  res.on('error', (error) => {
    clearInterval(heartbeatInterval);
    removeClient(user_id);
    console.log(`[SSE] Connection error: user_id=${user_id}`, error);
  });
});

router.post('/subscribe', express.json(), (req: Request, res: Response) => {
  const { user_id, event, event_id } = req.body;
  if (!user_id || !event || !event_id) return res.status(400).send("Required: user_id, event, event_id");
  subscribe(user_id, event, event_id);
  console.log(`[SSE] Subscribed: user_id=${user_id}, event=${event}, event_id=${event_id}`);
  res.send('OK');
});

router.post('/unsubscribe', express.json(), (req: Request, res: Response) => {
  const { user_id, event, event_id } = req.body;
  if (!user_id || !event || !event_id) return res.status(400).send("Required: user_id, event, event_id");
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
