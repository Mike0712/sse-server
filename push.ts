import { clients } from './clients';

export function pushToSession(
  sessionId: string,
  messageEvent: string,
  data: unknown
) {
  const channel = clients.get(sessionId) || [];
  for (const { res } of channel) {
    res.write(`event: ${messageEvent}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}
