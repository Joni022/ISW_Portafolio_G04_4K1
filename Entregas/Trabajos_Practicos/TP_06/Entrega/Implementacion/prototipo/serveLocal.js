import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearApiInscripciones } from '../src/apiInscripciones.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8766);
const URL_PUBLICA = process.env.URL_PUBLICA ?? `http://127.0.0.1:${PORT}`;
const apiInscripciones = crearApiInscripciones({ urlPublica: URL_PUBLICA });
const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

createServer(async (request, response) => {
  if (await apiInscripciones.atender(request, response)) {
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
  } catch {
    response.writeHead(400).end();
    return;
  }

  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
  const target = resolve(ROOT, relative);
  if (!target.startsWith(ROOT + sep) || target.includes('\0')) {
    response.writeHead(403).end();
    return;
  }

  let info;
  try {
    info = await stat(target);
  } catch {
    response.writeHead(404).end();
    return;
  }
  if (!info.isFile()) {
    response.writeHead(404).end();
    return;
  }

  const headers = {
    'Content-Type': TYPES.get(extname(target)) ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };
  let start = 0;
  let end = info.size - 1;
  let status = 200;
  if (request.headers.range !== undefined) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
    if (match === null) {
      response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
      return;
    }
    start = Number(match[1]);
    end = match[2] === '' ? end : Math.min(Number(match[2]), end);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= info.size
    ) {
      response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
      return;
    }
    headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    status = 206;
  }

  headers['Content-Length'] = Math.max(0, end - start + 1);
  response.writeHead(status, headers);
  if (request.method === 'HEAD' || info.size === 0) {
    response.end();
    return;
  }
  const stream = createReadStream(target, { start, end });
  stream.on('error', () => response.destroy());
  stream.pipe(response);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`EcoHarmony local: http://127.0.0.1:${PORT}`);
});
