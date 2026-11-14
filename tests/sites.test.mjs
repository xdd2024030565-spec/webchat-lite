import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalize, pick, byId, apiUrl, healthUrl } = require('../assets/core/sites.js');

test('caps.pin 必须有 remoteSessions 支撑', () => {
  assert.strictEqual(normalize({ id: 'x', name: 'X', caps: { pin: true } }).caps.pin, false);
  assert.strictEqual(normalize({ id: 'x', name: 'X', caps: { pin: true, remoteSessions: true } }).caps.pin, true);
});

test('缺失字段有默认值', () => {
  const s = normalize({ id: 'x', name: 'X' });
  assert.strictEqual(s.copy.newChat, '开启新对话');
  assert.strictEqual(s.copy.placeholder, '发送消息…');
  assert.strictEqual(s.copy.welcomeTitle, '今天聊点什么？');
  assert.strictEqual(s.copy.hint, '内容由 AI 生成，请仔细甄别');
  assert.deepStrictEqual(s.copy.cards, []);
  assert.strictEqual(s.caps.search, false);
  assert.strictEqual(s.endpoint, '/x/v1');
  assert.deepStrictEqual(s.models, [{ id: 'default', name: '默认' }]);
});

test('pick: wanted > last > 第一项', () => {
  const l = [normalize({ id: 'a', name: 'A' }), normalize({ id: 'b', name: 'B' })];
  assert.strictEqual(pick(l, 'b', 'a').id, 'b');
  assert.strictEqual(pick(l, 'zzz', 'b').id, 'b');
  assert.strictEqual(pick(l, '', 'zzz').id, 'a');
  assert.strictEqual(pick([], 'a', 'b'), null);
});

test('byId 找不到返回 null', () => {
  const l = [normalize({ id: 'a', name: 'A' })];
  assert.strictEqual(byId(l, 'a').id, 'a');
  assert.strictEqual(byId(l, 'nope'), null);
});

test('url 拼装：api 用 endpoint，health 去掉末尾 /v1', () => {
  const s = normalize({ id: 'doubao', name: '豆包' });
  assert.strictEqual(apiUrl(s, 'https://h', '/chat/completions'), 'https://h/doubao/v1/chat/completions');
  assert.strictEqual(healthUrl(s, 'https://h'), 'https://h/doubao/health');
});

test('copy 自定义覆盖默认', () => {
  const s = normalize({ id: 'd', name: 'D', copy: { placeholder: '给豆包发送消息', cards: [{ q: 'q', t: 't', d: 'd' }] } });
  assert.strictEqual(s.copy.placeholder, '给豆包发送消息');
  assert.strictEqual(s.copy.cards.length, 1);
  assert.strictEqual(s.copy.newChat, '开启新对话');
});
