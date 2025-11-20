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
  (res as any).flushHeaders && (res as any).flushHeaders();

  const user_id = req.query.user_id as string;
  if (!user_id) {
    res.status(400).end('No user_id');
    return;
  }
  addClient(user_id, res);
  req.on('close', () => {
    removeClient(user_id);
    console.log(`[SSE] Disconnected: user_id=${user_id}`);
  });
  res.write(`event: ping\ndata: "connected"\n\n`);
});

router.post('/subscribe', express.json(), (req: Request, res: Response) => {
  const { user_id, event, event_id } = req.body;
  if (!user_id || !event || !event_id) return res.status(400).send("Required: user_id, event, event_id");
  subscribe(user_id, event, event_id);
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
  if (!event || !event_id) return res.status(400).send('Missing event or event_id');
  const targets = getSubscribers(event, event_id);
  for (const client of targets) {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(payload ?? {})}\n\n`);
  }
  res.send('OK');
});

export default router;
