/* ============================================================
   tools/e2e.mjs — headless chromium 驱动（CDP，无第三方依赖）
   launch() -> { open(url) -> page, close() }
   page: eval / goto / waitFor / click / text / html / count
   ============================================================ */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROMIUM || '/usr/bin/chromium';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getJson(url, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {}
    await sleep(50);
  }
  throw new Error('CDP 未就绪: ' + url);
}

class Page {
  constructor(ws, id) {
    this.ws = ws;
    this.id = id;
    this.seq = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || 'CDP error'));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('CDP 超时: ' + method));
        }
      }, 20000);
    });
  }

  async run(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: `(function(){ ${expr} })()`,
      returnByValue: true,
      awaitPromise: true
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('页面异常: ' + ((d.exception && d.exception.description) || d.text));
    }
    return r.result ? r.result.value : undefined;
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
    await this.waitFor("return document.readyState === 'complete'", 15000);
    await sleep(150);
  }

  async waitFor(expr, timeout = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try {
        if (await this.run(expr)) return true;
      } catch (e) {}
      await sleep(50);
    }
    return false;
  }

  async click(sel) {
    return this.run(`var e=document.querySelector(${JSON.stringify(sel)});
      if(!e) throw new Error('元素不存在: ' + ${JSON.stringify(sel)});
      e.click(); return true;`);
  }

  async text(sel) {
    return this.run(`var e=document.querySelector(${JSON.stringify(sel)}); return e ? (e.innerText || e.textContent || '') : null;`);
  }

  async html(sel) {
    return this.run(`var e=document.querySelector(${JSON.stringify(sel)}); return e ? e.innerHTML : null;`);
  }

  async count(sel) {
    return this.run(`return document.querySelectorAll(${JSON.stringify(sel)}).length;`);
  }
}

export async function launch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wcl-chrome-'));
  const port = 9100 + Math.floor(Math.random() * 800);
  const proc = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + dir,
    'about:blank'
  ], { stdio: 'ignore' });

  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const target = list.find((t) => t.type === 'page') || list[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('CDP WebSocket 连接失败')));
  });

  const page = new Page(ws, target.id);
  await page.send('Page.enable');
  await page.send('Runtime.enable');

  return {
    page,
    async open(url) {
      await page.goto(url);
      return page;
    },
    async close() {
      try { ws.close(); } catch (e) {}
      try { proc.kill('SIGKILL'); } catch (e) {}
      await sleep(100);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    }
  };
}
