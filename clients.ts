import type { SessionId, SSEClient } from './types';

export const clients = new Map<SessionId, SSEClient[]>();

export function addClient(sessionId: SessionId, client: SSEClient) {
  if (!clients.has(sessionId)) clients.set(sessionId, []);
  clients.get(sessionId)!.push(client);
}

export function removeClient(sessionId: SessionId, res: import('express').Response) {
  const arr = clients.get(sessionId) || [];
  clients.set(sessionId, arr.filter((item) => item.res !== res));
}
