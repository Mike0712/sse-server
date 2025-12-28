import type { Response } from "express";
import type { SSEPubSubClient, ClientSubscriptionKey } from "./types";

export const clients = new Map<string, SSEPubSubClient>(); // key: user_id

export function addClient(user_id: string, res: Response) {
  clients.set(user_id, {
    user_id,
    res,
    subscriptions: new Set(),
  });
}
export function removeClient(user_id: string) {
  clients.delete(user_id);
}
export function subscribe(user_id: string, event: string | string[], event_id: string) {
  const client = clients.get(user_id);
  if (client) 
    if (Array.isArray(event)) {
      event.forEach(e => client.subscriptions.add(subscriptionKey(e, event_id)));
    } else {
      client.subscriptions.add(subscriptionKey(event, event_id));
    }
}
export function unsubscribe(user_id: string, event: string | string[], event_id: string) {
  const client = clients.get(user_id);
  if (client) {
    if (Array.isArray(event)) {
      event.forEach(e => client.subscriptions.delete(subscriptionKey(e, event_id)));
    } else {
      client.subscriptions.delete(subscriptionKey(event, event_id));
    }
  }
}
export function subscriptionKey(event: string, event_id: string) {
  return `event:${event}|id:${event_id}`;
}
export function getSubscribers(event: string, event_id: string) {
  const key = subscriptionKey(event, event_id);
  return Array.from(clients.values()).filter(client =>
    client.subscriptions.has(key) || client.subscriptions.has("ALL")
  );
}
