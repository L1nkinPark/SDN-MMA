import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { registerPlaceSocket } from './gateways/placeSocket.js';

export function createHttpServer(cfg) {
  const server = http.createServer();
  let io;
  server.on('request', createApp(cfg, { to: room => io.to(room) }));
  io = new Server(server, { cors: { origin: cfg.origins } });

  registerPlaceSocket(io, cfg);
  return { server, io };
}
