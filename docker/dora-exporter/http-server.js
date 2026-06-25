const http = require('http');
const fs = require('fs');
const METRICS_FILE = process.env.METRICS_FILE || '/tmp/dora-serve/metrics';

const server = http.createServer((req, res) => {
  if (req.url === '/metrics' || req.url === '/') {
    try {
      const content = fs.readFileSync(METRICS_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(content);
    } catch (e) {
      res.writeHead(500);
      res.end('# error reading metrics file: ' + e.message + '\n');
    }
  } else {
    res.writeHead(404);
    res.end('not found\n');
  }
});

server.listen(9100, () => {
  console.log('[dora-exporter] HTTP server listening on :9100/metrics');
});
