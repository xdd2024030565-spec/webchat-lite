/* ============================================================
   tools/stub-server.mjs — e2e 用的本地假后端 + 静态站点
   start() -> { url, close() }
   ============================================================ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function readBody(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => { s += c; });
    req.on('end', () => resolve(s));
  });
}

function sseHead(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*'
  });
}

function chunk(delta) {
  return 'data: ' + JSON.stringify({ id: 'stub', object: 'chat.completion.chunk', choices: [{ index: 0, delta }] }) + '\n\n';
}

export async function start(opts = {}) {
  const hits = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;
    hits.push({ method: req.method, path: p });

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      });
      res.end();
      return;
    }

    // ---- 假后端 ----
    const m = p.match(/^\/(?:stub\/)?(deepseek|doubao|grok|qwen|kimi)\/(health|v1\/models|v1\/sessions|v1\/sessions\/messages|v1\/chat\/completions)$/);
    if (m) {
      const site = m[1];
      const rest = m[2];
      if (rest === 'health') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, kind: 'ok' }));
        return;
      }
      if (rest === 'v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          object: 'list',
          data: [{ id: site === 'doubao' ? 'doubao-chat' : 'deepseek-chat', object: 'model' }]
        }));
        return;
      }
      if (rest === 'v1/sessions') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          object: 'list',
          data: [
            { id: 's-1', title: '网页版对话一', updated_at: 1, pinned: false, tagged: false },
            { id: 's-2', title: '网页版对话二', updated_at: 2, pinned: true, tagged: true }
          ]
        }));
        return;
      }
      if (rest === 'v1/sessions/messages') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          id: url.searchParams.get('id') || 's-1',
          count: 2,
          messages: [
            { role: 'user', content: '历史提问' },
            { role: 'assistant', content: '历史回答', reasoning: '历史思考' }
          ]
        }));
        return;
      }
      // chat
      const raw = await readBody(req);
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch (e) {}
      const last = (body.messages || [])[(body.messages || []).length - 1] || {};
      const text = String(last.content || '');
      if (text.indexOf('boom') >= 0) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: { message: '上游 500' } }));
        return;
      }
      if (text.indexOf('html') >= 0) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end('<!doctype html><html><body><h1>门户登录页</h1></body></html>');
        return;
      }
      sseHead(res);
      const slow = text.indexOf('slow') >= 0;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      if (slow) await wait(120);
      const parts = text.indexOf('thinking') >= 0 ? ['思考一', '思考二'] : [];
      res.write(chunk({ role: 'assistant', content: '' }));
      for (const t of parts) { res.write(chunk({ reasoning_content: t })); if (slow) await wait(200); }
      const words = ['你好', '，', '这是假后端'];
      for (const w of words) { res.write(chunk({ content: w })); if (slow) await wait(slow ? 900 : 0); }
      if (text.indexOf('cites') >= 0) res.write(chunk({ content: '', citations: [{ n: 1 }] }));
      res.write(chunk({ content: '' }));
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // ---- 静态文件 ----
    let rel = p === '/' ? '/index.html' : p;
    const file = path.join(ROOT, decodeURIComponent(rel));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  await new Promise((resolve) => server.listen(opts.port || 0, '127.0.0.1', resolve));
  const port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}`,
    hits,
    close() {
      // 浏览器保持 keep-alive 连接，只 close() 会一直等到对端断开；先掐断再关。
      try { if (server.closeAllConnections) server.closeAllConnections(); } catch (e) {}
      return new Promise((resolve) => server.close(() => resolve()));
    }
  };
}

if (process.argv[1] && process.argv[1].endsWith('stub-server.mjs')) {
  const s = await start({ port: Number(process.env.PORT) || 8765 });
  console.log('stub up:', s.url);
}
