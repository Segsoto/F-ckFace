const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 4173;
const types = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
};

http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  const extension = path.extname(target).toLowerCase();
  if (!target.startsWith(`${root}${path.sep}`) || pathname.split('/').some(part => part.startsWith('.')) || !types[extension]) {
    response.writeHead(403).end();
    return;
  }
  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': `${types[extension]}; charset=utf-8`,
      'Cache-Control': 'no-store',
    });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(target).pipe(response);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`Sitio local: http://127.0.0.1:${port}`);
});
