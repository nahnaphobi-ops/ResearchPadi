import { lookup } from 'node:dns/promises';
import { lookup as lookupCallback, type LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import axios from 'axios';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

/** Longest text kept from one source (about 60k words). */
export const MAX_SOURCE_CHARS = 400_000;
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export class ExtractError extends Error {
  status = 400;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const tidy = (text: string) =>
  text.replace(/\r/g, '').replace(/[ \t\f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export async function extractPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const data = await parser.getText();
    return tidy(data.text || '');
  } catch {
    throw new ExtractError("Couldn't read that PDF. If it's a scanned image, it has no text to read.");
  } finally {
    await (parser as unknown as { destroy?: () => Promise<void> }).destroy?.();
  }
}

/** Word .docx: the text lives in word/document.xml inside the zip. */
export async function extractDocx(buffer: Buffer): Promise<string> {
  let xml: string | undefined;
  try {
    const zip = await JSZip.loadAsync(buffer);
    xml = await zip.file('word/document.xml')?.async('string');
  } catch {
    // fall through
  }
  if (!xml) throw new ExtractError("Couldn't read that file. Save it as .docx (Word 2007 or later) and try again.");
  return tidy(decodeEntities(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  ));
}

export function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const body = html
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return { title, text: tidy(decodeEntities(body)) };
}

/** True for addresses on the public internet; blocks loopback, private, link-local and similar. */
export function isPublicAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
    if (a >= 224) return false; // multicast and reserved
    return true;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return false;
    if (lower.startsWith('::ffff:')) return isPublicAddress(lower.slice(7));
    if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)) return false; // unique local, link-local
    return true;
  }
  return false;
}

/**
 * Resolver for the actual connection: refuses private addresses at connect time,
 * so a hostname can't pass the check above and then resolve elsewhere (DNS rebinding).
 */
function publicOnlyLookup(
  hostname: string,
  options: object,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) {
  lookupCallback(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = addresses as LookupAddress[];
    const safe = list.find((a) => isPublicAddress(a.address));
    if (!safe || list.some((a) => !isPublicAddress(a.address))) {
      return callback(Object.assign(new Error('Blocked private address'), { code: 'EBLOCKED' }), '');
    }
    callback(null, safe.address, safe.family);
  });
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ExtractError('That link is not a valid web address.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ExtractError('Only http and https links can be added.');
  if (url.username || url.password) throw new ExtractError('Links with a username or password are not allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new ExtractError("Couldn't find that website.");
  if (!addresses.every((a) => isPublicAddress(a.address))) throw new ExtractError('That link points to a private network address.');
  return url;
}

/**
 * Fetch a web page or PDF for a notebook source. Every hop (including redirects)
 * is resolved and checked so a link can't make the server fetch internal hosts.
 */
export async function extractUrl(raw: string): Promise<{ title: string; text: string; kind: 'url' | 'pdf' }> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await axios.get<ArrayBuffer>(url.toString(), {
      responseType: 'arraybuffer',
      maxRedirects: 0,
      timeout: 15_000,
      maxContentLength: MAX_DOWNLOAD_BYTES,
      validateStatus: () => true,
      lookup: publicOnlyLookup as never,
      headers: { 'User-Agent': 'ResearchPadi/1.0 (+https://researchpadi.vercel.app)', Accept: 'text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5' },
    }).catch((err) => {
      throw new ExtractError(err?.code === 'ERR_FR_MAX_CONTENT_LENGTH_EXCEEDED' || /maxContentLength/.test(err?.message ?? '')
        ? 'That page is too large to add (8 MB limit).'
        : "Couldn't open that link.");
    });

    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      url = await assertPublicUrl(new URL(String(res.headers.location), url).toString());
      continue;
    }
    if (res.status >= 400) throw new ExtractError(`That link returned an error (${res.status}).`);

    const type = String(res.headers['content-type'] ?? '').toLowerCase();
    const buffer = Buffer.from(res.data);
    if (type.includes('application/pdf') || url.pathname.toLowerCase().endsWith('.pdf')) {
      return { kind: 'pdf', title: decodeURIComponent(url.pathname.split('/').pop() || url.hostname), text: await extractPdf(buffer) };
    }
    if (type.includes('text/html') || type.includes('application/xhtml')) {
      const { title, text } = htmlToText(buffer.toString('utf8'));
      return { kind: 'url', title: title || url.hostname, text };
    }
    if (type.startsWith('text/')) return { kind: 'url', title: url.hostname, text: tidy(buffer.toString('utf8')) };
    throw new ExtractError('That link is not a web page or PDF.');
  }
  throw new ExtractError('That link redirects too many times.');
}
