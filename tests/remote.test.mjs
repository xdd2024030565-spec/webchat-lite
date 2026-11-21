import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/*
 * remote.js 是挂在 window 上的 IIFE，这里给一个最小 window 桩再把文件跑一遍，
 * 只为拿到 WCL.remote.pickMsgs 这一个纯函数。
 */
function loadRemote() {
  const store = new Map();
  const g = globalThis;
  const hadWindow = Object.prototype.hasOwnProperty.call(g, 'window');
  const prevWindow = g.window;
  const fakeWin = {
    addEventListener() {},
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  g.window = fakeWin;
  try {
    delete require.cache[require.resolve('../assets/core/data.js')];
    delete require.cache[require.resolve('../assets/core/remote.js')];
    // remote.js 依赖 WCL.state / WCL.dom / WCL.view，pickMsgs 不碰它们，给空桩即可
    fakeWin.WCL = {
      state: { site: null, st: {}, cfg: {}, stored: { sessions: [] } },
      dom: {},
      view: { renderSide() {} },
      data: {},
    };
    const req = require('../assets/core/remote.js');
    void req;
    return fakeWin.WCL.remote;
  } finally {
    if (hadWindow) g.window = prevWindow;
    else delete g.window;
  }
}

test('messages 是嵌套对象时取出内层数组', () => {
  const r = loadRemote();
  const out = r.pickMsgs({
    messages: { count: 2, messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] },
  });
  assert.equal(out.length, 2);
  assert.equal(out[0].content, 'a');
});

test('messages 是裸数组时也能取出（兼容老格式）', () => {
  const r = loadRemote();
  const out = r.pickMsgs({ messages: [{ role: 'user', content: 'a' }] });
  assert.equal(out.length, 1);
});

test('没有 messages 字段时返回空数组', () => {
  const r = loadRemote();
  assert.deepEqual(r.pickMsgs({}), []);
  assert.deepEqual(r.pickMsgs(null), []);
});

test('剔掉没有正文也没有思考的占位条目', () => {
  const r = loadRemote();
  const out = r.pickMsgs({
    messages: { count: 3, messages: [{ role: 'user', content: '' }, { role: 'user', content: 'x' }, null] },
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].content, 'x');
});

test('只有思考过程的条目保留', () => {
  const r = loadRemote();
  const out = r.pickMsgs({ messages: { count: 1, messages: [{ role: 'assistant', reasoning: '想' }] } });
  assert.equal(out.length, 1);
});
