export type SSEClient = { res: import('express').Response; userId: string };
export type ClientSubscriptionKey = string; // "event:participant_joined|id:abc123"

export type SSEPubSubClient = {
  user_id: string;
  res: import("express").Response;
  subscriptions: Set<ClientSubscriptionKey>;
};