export type SessionId = string;
export type UserId = string;

export type SSEClient = { res: import('express').Response; userId: UserId };
