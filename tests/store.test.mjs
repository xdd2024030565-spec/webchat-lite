import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { create } = require('../assets/core/store.js');

function mem(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _m: m
  };
}

test('键名按站点命名空间', () => {
  const s = create(mem());
  assert.strictEqual(s.siteKey('doubao'), 'webchat.v1.doubao');
  assert.strictEqual(s.uiKey(), 'webchat.v1.ui');
});

test('迁移：旧键整体搬进 deepseek 站并删除旧键', () => {
  const b = mem({
    'dsweb-lite.v1': JSON.stringify({ sessions: [{ id: 'a', title: 't', messages: [] }], activeId: 'a', settings: { search: true } }),
    'dsweb-lite.scope': 'sold'
  });
  const s = create(b);
  assert.deepStrictEqual(s.migrate(), { migrated: true, from: 'dsweb-lite.v1' });
  const d = JSON.parse(b.getItem('webchat.v1.deepseek'));
  assert.strictEqual(d.sessions[0].id, 'a');
  assert.strictEqual(d.settings.search, true);
  assert.strictEqual(d.scope, 'sold');
  assert.strictEqual(b.getItem('dsweb-lite.v1'), null);
  assert.strictEqual(b.getItem('dsweb-lite.scope'), null);
  assert.strictEqual(s.migrate().migrated, false);
});

test('目标键已存在时不覆盖', () => {
  const b = mem({
    'dsweb-lite.v1': JSON.stringify({ sessions: [{ id: 'old' }] }),
    'webchat.v1.deepseek': JSON.stringify({ sessions: [{ id: 'new' }], activeId: 'new', settings: {}, scope: 'z' })
  });
  const s = create(b);
  assert.strictEqual(s.migrate().migrated, false);
  assert.strictEqual(JSON.parse(b.getItem('webchat.v1.deepseek')).sessions[0].id, 'new');
});

test('损坏 JSON 取默认值且不抛', () => {
  const s = create(mem({ 'webchat.v1.deepseek': '{{' }));
  assert.deepStrictEqual(s.loadSite('deepseek'), { sessions: [], activeId: '', settings: {}, scope: '' });
});

test('setItem 抛异常（配额满）时 saveSite 返回 false 不抛', () => {
  const b = mem();
  b.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.strictEqual(create(b).saveSite('deepseek', { sessions: [] }), false);
});

test('saveSite/loadSite 往返', () => {
  const s = create(mem());
  assert.strictEqual(s.saveSite('doubao', { sessions: [{ id: 'x' }], activeId: 'x', settings: { think: true }, scope: 'sc' }), true);
  assert.deepStrictEqual(s.loadSite('doubao'), { sessions: [{ id: 'x' }], activeId: 'x', settings: { think: true }, scope: 'sc' });
});

test('clearAll 清掉 UI 与旧键', () => {
  const b = mem({
    'webchat.v1.ui': '{"site":"doubao"}',
    'dsweb-lite.v1': '{"sessions":[]}',
    'dsweb-lite.scope': 's',
    'unrelated': 'keep'
  });
  const s = create(b);
  s.clearAll();
  assert.strictEqual(b.getItem('webchat.v1.ui'), null);
  assert.strictEqual(b.getItem('dsweb-lite.v1'), null);
  assert.strictEqual(b.getItem('unrelated'), 'keep');
});
