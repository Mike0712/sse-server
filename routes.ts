import express, { Router, Request, Response } from 'express';
import { addClient, removeClient } from './clients';
import { pushToSession } from './push';

const router = Router();

router.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  (res as any).flushHeaders && (res as any).flushHeaders();

  const sessionId = req.query.sessionId as string;
  const userId = (req.query.userId as string) || 'unknown';

  if (!sessionId) {
    res.status(400).end('No sessionId');
    return;
  }

  addClient(sessionId, { res, userId });

  req.on('close', () => {
    removeClient(sessionId, res);
    console.log(`[SSE] Disconnected: userId=${userId} sessionId=${sessionId}`);
  });

  res.write(`event: ping\ndata: "connected"\n\n`);
});

router.get('/dev/push', (req: Request, res: Response) => {
  const { sessionId = 'test', msg = 'hi' } = req.query;
  pushToSession(
    sessionId as string,
    'participantChange',
    { ts: Date.now(), msg }
  );
  res.send('OK');
});

router.post("/pushEvent", express.json(), (req: Request, res: Response) => {
  const { sessionId, event, payload } = req.body;
  if (!sessionId || !event) return res.status(400).send("Missing sessionId or event");
  pushToSession(sessionId, event, payload);
  res.send("OK");
});

export default router;
