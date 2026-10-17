/**
 * Content-Disposition for a file download.
 *
 * Node refuses header values with characters above U+00FF, and paper topics
 * typed on phones often carry curly quotes and long dashes, so a raw topic in
 * the header made the download fail. The plain `filename` is ASCII-only; the
 * full name goes in `filename*` (RFC 6266 / RFC 5987), which browsers prefer.
 */
const MAX_NAME_LENGTH = 100;

function asciiFallback(name: string): string {
  return name
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[‐-―−]/g, '-')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._'()-]/g, '');
}

function rfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function attachmentDisposition(baseName: string, extension: string): string {
  const name = Array.from(String(baseName).trim().replace(/\s+/g, '_')).slice(0, MAX_NAME_LENGTH).join('') || 'download';
  const ascii = asciiFallback(name) || 'download';
  return `attachment; filename="${ascii}${extension}"; filename*=UTF-8''${rfc5987(name + extension)}`;
}
