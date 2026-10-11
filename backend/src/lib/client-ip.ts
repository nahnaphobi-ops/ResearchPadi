import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';

/**
 * Real visitor IPs for rate limits and logs.
 *
 * Requests reach the app through Render's load balancer, so Express's req.ip is
 * an internal 10.x address shared by every visitor, and every per-IP limit (OTP,
 * login, the global API cap) became a site-wide limit.
 *
 *   browser → Vercel (/api proxy) → Cloudflare → Render LB → app
 *   browser → Cloudflare → Render LB → app            (direct to onrender.com)
 *
 * Vercel overwrites X-Forwarded-For with the visitor's IP, but a request sent
 * straight to Render could carry any X-Forwarded-For it likes. So the Vercel
 * proxy adds a shared secret header (vercel.json route transform), and only then
 * are Vercel's forwarded headers trusted. Otherwise CF-Connecting-IP, which
 * Cloudflare sets and clients cannot override, is the visitor.
 */
export const PROXY_SECRET_HEADER = 'x-researchpadi-proxy';

export type IpSource = 'vercel' | 'cloudflare' | 'socket';

function normalise(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let ip = raw.trim();
  if (ip.startsWith('[')) ip = ip.slice(1, ip.indexOf(']')); // [v6]:port
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':')); // v4:port
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return isIP(ip) ? ip : undefined;
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** First entry of a comma-separated forwarding header. */
function first(value: string | undefined): string | undefined {
  return normalise(value?.split(',')[0]);
}

function secretMatches(given: string | undefined): boolean {
  const secret = process.env.API_PROXY_SECRET;
  if (!secret || secret.length < 16 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

let lastMismatchLog = 0;

/** Once a minute at most: why a proxy header was not accepted (lengths only, never values). */
function noteMismatch(req: Request, given: string | undefined) {
  const now = Date.now();
  if (now - lastMismatchLog < 60_000) return;
  lastMismatchLog = now;
  const expected = process.env.API_PROXY_SECRET ?? '';
  console.warn(JSON.stringify({
    level: 40,
    module: 'client-ip',
    msg: 'Proxy secret header not accepted; using Cloudflare IP',
    headerPresent: given !== undefined,
    givenLength: given?.length ?? 0,
    expectedLength: expected.length,
    literalPlaceholder: given?.startsWith('$') ?? false,
    forwardingHeaders: ['x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for', 'x-vercel-id'].filter((h) => req.headers[h] !== undefined),
  }));
}

export function resolveClientIp(req: Request): { ip: string; source: IpSource } {
  const given = header(req, PROXY_SECRET_HEADER);
  const fromVercel = req.headers['x-vercel-id'] !== undefined || given !== undefined;
  if (!secretMatches(given) && fromVercel) noteMismatch(req, given);
  if (secretMatches(given)) {
    const viaVercel =
      first(header(req, 'x-vercel-forwarded-for')) ??
      first(header(req, 'x-real-ip')) ??
      first(header(req, 'x-forwarded-for'));
    if (viaVercel) return { ip: viaVercel, source: 'vercel' };
  }

  const viaCloudflare = normalise(header(req, 'cf-connecting-ip')) ?? normalise(header(req, 'true-client-ip'));
  if (viaCloudflare) return { ip: viaCloudflare, source: 'cloudflare' };

  return { ip: normalise(req.socket?.remoteAddress) ?? '0.0.0.0', source: 'socket' };
}

/** Sets req.ip to the visitor's IP before rate limiting and logging run. */
export function clientIp(req: Request, _res: Response, next: NextFunction) {
  const { ip, source } = resolveClientIp(req);
  Object.defineProperty(req, 'ip', { value: ip, configurable: true, enumerable: true });
  (req as Request & { ipSource?: IpSource }).ipSource = source;
  delete req.headers[PROXY_SECRET_HEADER]; // never let the secret travel further
  next();
}
