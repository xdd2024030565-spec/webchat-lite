/* ============================================================
   tests/e2e.test.mjs — 真浏览器端到端（chromium headless + CDP）
   覆盖 Task 6/7：切站器、按站 caps 裁剪、流式渲染、错误可读、
   网络不可达、切站中止在途请求、本机会话互相隔离、存储失败降级。

   注意：全部请求只打本地 stub（127.0.0.1），不触达任何真实站点，
   所以反复跑也不会碰到上游风控。真实上游只在人工验收时打一次。
   运行：node --test tests/e2e.test.mjs
   ============================================================ */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../tools/stub-server.mjs';
import { launch } from '../tools/e2e.mjs';

let stub;
let br;
let page;

before(async () => {
  stub = await start();
  br = await launch();
  page = br.page;
});

after(async () => {
  if (br) await br.close();
  if (stub) await stub.close();
});

const enc = (u) => encodeURIComponent(u);

async function fresh(qs) {
  const url = stub.url + '/index.html' + (qs ? '?' + qs : '');
  await page.goto(url);
  await page.run('localStorage.clear(); return true;');
  await page.goto(url);
}

// waitFor 的表达式需要自带 return；这里统一补上，超时就抛错（不静默）
async function until(expr, timeout = 10000) {
  const ok = await page.waitFor('return ' + expr, timeout);
  assert.ok(ok, '等待超时: ' + expr);
}

async function send(text) {
  await page.run(
    'var i=document.getElementById("input"); i.value=' + JSON.stringify(text) +
    '; i.dispatchEvent(new Event("input")); return true;'
  );
  await page.click('#btnSend');
}

function stubHits(p) {
  return stub.hits.filter((h) => h.path === p).length;
}

function chatText() {
  return page.run('return document.getElementById("chat").textContent || "";');
}

test('首屏：五个站点、默认 DeepSeek、caps 全开', async () => {
  await fresh('base=' + enc(stub.url));
  await until('document.querySelectorAll("#siteSwitch .sbtn").length === 5');

  const on = await page.run(
    'var e=document.querySelector("#siteSwitch .sbtn.on"); return e ? e.getAttribute("data-site") : null;'
  );
  assert.equal(on, 'deepseek');
  assert.match(await page.text('#chat'), /我是 DeepSeek/);
  assert.equal(await page.run('return document.getElementById("chipSearch").hidden;'), false);
  assert.equal(await page.run('return document.getElementById("chipThink").hidden;'), false);
  assert.equal(await page.run('return document.getElementById("chipInc").hidden;'), false);
  // 健康检查打到假后端 /deepseek/health
  await until('window.WCL_APP && window.WCL_APP.health() !== null', 5000);
  assert.ok(stubHits('/deepseek/health') >= 1);
});

test('?site=doubao：品牌类生效、文案切换、caps 关闭的 chip 隐藏', async () => {
  await fresh('site=doubao&base=' + enc(stub.url));
  await until('document.body.className.indexOf("site-doubao") >= 0');

  assert.match(await page.text('#chat'), /我是豆包/);
  assert.equal(await page.run('return document.getElementById("chipSearch").hidden;'), true);
  assert.equal(await page.run('return document.getElementById("chipThink").hidden;'), true);
  assert.equal(await page.run('return document.getElementById("chipInc").hidden;'), true);
  assert.equal(
    await page.run('var e=document.querySelector("#siteSwitch .sbtn.on"); return e.getAttribute("data-site");'),
    'doubao'
  );
});

test('切到 Grok：品牌类、欢迎语与 caps 都跟着变', async () => {
  await fresh('base=' + enc(stub.url));
  await until('document.querySelectorAll("#siteSwitch .sbtn").length === 5');

  await page.run('document.querySelector("#siteSwitch .sbtn[data-site=grok]").click(); return true;');
  await until('document.body.className.indexOf("site-grok") >= 0');
  assert.match(await page.text('#chat'), /我是 Grok/);
  assert.equal(await page.run('return document.getElementById("chipSearch").hidden;'), true);
  assert.equal(await page.run('return document.getElementById("chipInc").hidden;'), true);

  const on = await page.run(
    'var e=document.querySelector("#siteSwitch .sbtn.on"); return e ? e.getAttribute("data-site") : null;'
  );
  assert.equal(on, 'grok');
  const ui = await page.run('return localStorage.getItem("webchat.v1.ui") || "";');
  assert.match(ui, /"site":"grok"/);
});

test('切到通义与 Kimi：品牌类、欢迎语各自独立', async () => {
  await fresh('base=' + enc(stub.url));
  await until('document.querySelectorAll("#siteSwitch .sbtn").length === 5');

  await page.run('document.querySelector("#siteSwitch .sbtn[data-site=qwen]").click(); return true;');
  await until('document.body.className.indexOf("site-qwen") >= 0');
  assert.match(await page.text('#chat'), /我是通义千问/);
  assert.ok(String(await page.run('return document.getElementById("input").getAttribute("placeholder");')).indexOf('通义千问') >= 0);

  await page.run('document.querySelector("#siteSwitch .sbtn[data-site=kimi]").click(); return true;');
  await until('document.body.className.indexOf("site-kimi") >= 0');
  assert.match(await page.text('#chat'), /我是 Kimi/);

  const on = await page.run(
    'var e=document.querySelector("#siteSwitch .sbtn.on"); return e ? e.getAttribute("data-site") : null;'
  );
  assert.equal(on, 'kimi');
});

test('流式回复：SSE 增量渲染到对话区并留下操作按钮', async () => {
  await fresh('base=' + enc(stub.url));
  await until('document.querySelectorAll("#siteSwitch .sbtn").length === 5');

  await send('你好');
  await until('document.querySelectorAll("#chat .msg.assistant").length === 1');
  await until('document.getElementById("chat").textContent.indexOf("这是假后端") >= 0');

  assert.equal(await page.count('#chat .msg.user'), 1);
  assert.equal(await page.count('#chat .acts button[data-act="copy"]'), 1);
  assert.equal(await page.run('return document.getElementById("btnSend").style.display;'), '');
  assert.ok(stubHits('/deepseek/v1/chat/completions') >= 1);
});

test('上游 200 但返回 HTML：给出可读错误而不是空白', async () => {
  await fresh('base=' + enc(stub.url));
  await until('document.querySelectorAll("#siteSwitch .sbtn").length === 5');

  await send('html 测试');
  await until('document.getElementById("chat").textContent.indexOf("非流式") >= 0');
  assert.match(await chatText(), /非流式|HTTP/);
});

test('反代地址不可达：提示网络错误且输入区恢复可用', async () => {
  await fresh('base=' + enc('http://127.0.0.1:1'));
  await until('document.querySelectorAll("#siteSwitch .sbtn").length === 5');

  await send('在吗');
  await until('document.getElementById("chat").textContent.indexOf("网络错误") >= 0');
  assert.equal(await page.run('return document.getElementById("btnSend").style.display;'), '');
  assert.equal(await page.run('return document.getElementById("btnStop").style.display;'), 'none');
});

test('切站会中止在途请求，回复不串站', async () => {
  await fresh('site=doubao&base=' + enc(stub.url));
  await until('document.body.className.indexOf("site-doubao") >= 0');

  await send('slow 说点什么');
  // 等第一个字符落地，确保流已开始
  await until('document.getElementById("chat").textContent.indexOf("你好") >= 0');

  await page.run(
    'var b=document.querySelector("#siteSwitch .sbtn[data-site=deepseek]"); if(b) b.click(); return true;'
  );
  await until('document.body.className.indexOf("site-deepseek") >= 0');

  await new Promise((r) => setTimeout(r, 2500));
  const t = await chatText();
  assert.equal(t.indexOf('这是假后端'), -1, '豆包的回复不应写进 DeepSeek 的对话列表');
  assert.match(t, /我是 DeepSeek/);
});

test('站点会话互相隔离，切回来还在', async () => {
  await fresh('base=' + enc(stub.url));
  await until('document.querySelectorAll("#siteSwitch .sbtn").length === 5');

  await send('站点隔离测试');
  await until('document.getElementById("chat").textContent.indexOf("这是假后端") >= 0');

  await page.run('document.querySelector("#siteSwitch .sbtn[data-site=doubao]").click(); return true;');
  await until('document.body.className.indexOf("site-doubao") >= 0');
  assert.equal((await chatText()).indexOf('站点隔离测试'), -1);
  assert.match(await page.text('#chat'), /我是豆包/);

  const saved = await page.run('return localStorage.getItem("webchat.v1.deepseek");');
  assert.ok(saved && saved.length > 10, 'deepseek 会话应已落盘');

  await page.run('document.querySelector("#siteSwitch .sbtn[data-site=deepseek]").click(); return true;');
  await until('document.body.className.indexOf("site-deepseek") >= 0');
  await until('document.getElementById("chat").textContent.indexOf("站点隔离测试") >= 0', 5000);
});

test('删除本机对话：侧栏 × 删掉会话，删光后自动补一个空对话', async () => {
  await fresh('base=' + enc(stub.url));
  await until('document.querySelectorAll("#siteSwitch .sbtn").length === 5');
  await page.run('window.confirm = function () { return true; }; return true;');

  assert.equal(await page.count('#sessList .sess[data-id]'), 1);
  await page.run('document.getElementById("btnNew").click(); document.getElementById("btnNew").click(); return true;');
  await until('document.querySelectorAll("#sessList .sess[data-id]").length === 3');

  await page.run('document.querySelector("#sessList .sdel[data-del]").click(); return true;');
  await until('document.querySelectorAll("#sessList .sess[data-id]").length === 2');

  // 继续删到空：应该自动留下一个新的空对话，而不是列表为空
  await page.run('document.querySelector("#sessList .sdel[data-del]").click(); return true;');
  await page.run('document.querySelector("#sessList .sdel[data-del]").click(); return true;');
  await until('document.querySelectorAll("#sessList .sess[data-id]").length === 1');
  assert.match(await page.text('#sessList'), /新对话/);
});

test('本机存储写失败：给出提示但消息照常显示', async () => {
  await fresh('base=' + enc(stub.url));
  await until('document.querySelectorAll("#siteSwitch .sbtn").length === 5');

  await page.run(
    'Storage.prototype.setItem = function(){ throw new Error("QuotaExceededError"); }; return true;'
  );
  await send('存储失败也不能丢消息');
  await until('document.getElementById("toast").textContent.indexOf("存储") >= 0', 5000);
  assert.equal(await page.count('#chat .msg.user'), 1);
  assert.equal(await page.count('#chat .msg.assistant'), 1);
});
