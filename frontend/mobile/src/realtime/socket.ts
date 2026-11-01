import { io, type Socket } from 'socket.io-client';

import { API_URL } from '@/api/client';
import type { LiveStatus } from '@/api/types';

export type PlaceStatusEvent = { placeId: string; liveStatus: LiveStatus };
export type JoinAck = { ok: boolean; error?: string };

type ServerToClient = { 'place:status': (event: PlaceStatusEvent) => void };
type ClientToServer = {
  'place:join': (placeId: string, ack: (result: JoinAck) => void) => void;
  'place:leave': (placeId: string) => void;
};

let socket: Socket<ServerToClient, ClientToServer> | null = null;

/** One shared connection to the API host. It reconnects by itself after network loss. */
export function getSocket() {
  socket ??= io(API_URL, { transports: ['websocket'], autoConnect: false });
  return socket;
}
