#!/usr/bin/env node
/**
 * NON-PRODUCTION WebSocket ↔ TCP byte bridge for local lab use.
 * Prefer upstream websockify (or native WSS VNC) in real deployments.
 *
 * Usage:
 *   node examples/ws-tcp-bridge/bridge.mjs [wsPort] [tcpHost] [tcpPort]
 * Defaults: 6081  127.0.0.1  5901
 */
import net from 'node:net';
import { WebSocketServer } from 'ws';

const wsPort = Number(process.argv[2] || 6081);
const tcpHost = process.argv[3] || '127.0.0.1';
const tcpPort = Number(process.argv[4] || 5901);

const wss = new WebSocketServer({ port: wsPort });
console.error(
  `[ws-tcp-bridge] NON-PRODUCTION listening ws://127.0.0.1:${wsPort}/ → ${tcpHost}:${tcpPort}`,
);

wss.on('connection', (ws) => {
  const tcp = net.connect({ host: tcpHost, port: tcpPort });
  tcp.on('data', (chunk) => {
    if (ws.readyState === ws.OPEN) ws.send(chunk);
  });
  tcp.on('error', (err) => {
    console.error('[ws-tcp-bridge] tcp error', err.message);
    ws.close();
  });
  tcp.on('close', () => ws.close());
  ws.on('message', (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!tcp.destroyed) tcp.write(buf);
  });
  ws.on('close', () => tcp.destroy());
  ws.on('error', () => tcp.destroy());
});
