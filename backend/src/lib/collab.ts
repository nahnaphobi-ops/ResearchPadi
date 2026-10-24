import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { Hocuspocus } from '@hocuspocus/server';
import { WebSocketServer, type WebSocket } from 'ws';
import * as Y from 'yjs';
import { childLogger } from './logger.js';
import { CollabDenied, authorize, loadState, storeState } from '../services/workspace/collab.service.js';

/**
 * The websocket that live editors of a shared document sync through
 * (wss://<api>/api/collab). Hocuspocus runs the Yjs sync protocol; this file
 * only connects it to the API's own HTTP server and to the database.
 *
 * One instance holds each document in memory, so this assumes a single API
 * instance (as on Render). Running several needs @hocuspocus/extension-redis.
 */
const log = childLogger('collab');
const PATH = '/api/collab';
const PING_MS = 25_000;
// Charts are embedded images, so a document can be a few megabytes.
const MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

export const hocuspocus = new Hocuspocus({
  name: 'researchpadi',
  quiet: true,
  debounce: 3_000,
  maxDebounce: 15_000,
  // The token is "<sign-in token>" for the owner, "<sign-in token> <edit link>" for a co-writer.
  async onAuthenticate({ documentName, token }) {
    try {
      const [signIn = '', share] = String(token ?? '').split(' ');
      const user = await authorize(documentName, signIn, share ?? null);
      return { user };
    } catch (err) {
      if (!(err instanceof CollabDenied)) log.warn({ err: (err as Error).message }, 'Collab sign-in failed');
      throw err;
    }
  },
  async onLoadDocument({ document, documentName }) {
    const state = await loadState(documentName);
    if (state) Y.applyUpdate(document, state);
    return document;
  },
  async onStoreDocument({ document, documentName }) {
    try {
      await storeState(documentName, Y.encodeStateAsUpdate(document));
    } catch (err) {
      log.error({ err: (err as Error).message, documentName }, 'Could not save the live document');
    }
  },
});

/** Everyone editing this document is disconnected; their editors reconnect and sign in again. */
export const closeCollab = (sessionId: string) => hocuspocus.closeConnections(sessionId);

function reject(socket: Duplex, status: number, reason: string) {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/** Accepts websocket upgrades on /api/collab from the site's own origins. */
export function attachCollab(server: Server, origins: string[]) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== PATH) return reject(socket, 404, 'Not Found');
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) return reject(socket, 403, 'Forbidden');

    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers.set(key, value);
      }
      const connection = hocuspocus.handleConnection(ws, new Request(`http://localhost${req.url ?? PATH}`, { headers }));
      const ping = setInterval(() => ws.ping(), PING_MS);
      ws.on('pong', () => connection.touch());
      ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
        const bytes = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
        connection.handleMessage(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
      });
      ws.on('close', (code: number, reason: Buffer) => {
        clearInterval(ping);
        connection.handleClose({ code, reason: reason.toString() });
      });
      ws.on('error', (err: Error) => log.warn({ err: err.message }, 'Collab socket error'));
    });
  });
  log.info({ path: PATH }, 'Live co-writing ready');
}

/** Saves every document still waiting to be stored (on shutdown), giving the saves a moment to finish. */
export async function flushCollab() {
  if (!hocuspocus.getDocumentsCount()) return;
  hocuspocus.flushPendingStores();
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}
