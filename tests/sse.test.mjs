import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createReader } = require('../assets/core/sse.js');

test('整块单事件', () => {
  const r = createReader();
  assert.deepStrictEqual(r.feed('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n', true), [{ content: '你好' }]);
});

test('跨块半行不丢不重', () => {
  const r = createReader();
  assert.deepStrictEqual(r.feed('data: {"choices":[{"delta":{"cont', false), []);
  assert.deepStrictEqual(r.feed('ent":"a"}}]}\n\n', true), [{ content: 'a' }]);
});

test('[DONE] 产出 finish=stop', () => {
  const r = createReader();
  r.feed('data: {"choices":[{"delta":{"content":"x"}}]}\n\n', false);
  assert.deepStrictEqual(r.feed('data: [DONE]\n\n', true), [{ finish: 'stop' }]);
});

test('reasoning_content 映射 reasoning', () => {
  const r = createReader();
  assert.deepStrictEqual(r.feed('data: {"choices":[{"delta":{"reasoning_content":"想"}}]}\n', true), [{ reasoning: '想' }]);
});

test('非 data 行与坏 JSON 忽略', () => {
  const r = createReader();
  assert.deepStrictEqual(r.feed('event: ping\n\ndata: {oops\n\n', true), []);
});

test('错误体转 error delta（含 HTML 200 页）', () => {
  assert.deepStrictEqual(
    createReader().feed('data: {"error":{"message":"上游 710022004"}}\n\n', true),
    [{ finish: 'error', error: '上游 710022004' }]
  );
  assert.deepStrictEqual(
    createReader().feed('<html>502 Bad Gateway</html>', true),
    [{ finish: 'error', error: '上游返回了非流式内容' }]
  );
});

test('finish_reason 转 finish', () => {
  const r = createReader();
  assert.deepStrictEqual(
    r.feed('data: {"choices":[{"delta":{"content":"完"},"finish_reason":"stop"}]}\n\n', true),
    [{ content: '完' }, { finish: 'stop' }]
  );
});

test('citations 透传', () => {
  const r = createReader();
  assert.deepStrictEqual(
    r.feed('data: {"choices":[{"delta":{"citations":[{"n":1}]}}]}\n\n', true),
    [{ citations: [{ n: 1 }] }]
  );
});

test('reset 后可以重新读', () => {
  const r = createReader();
  r.feed('data: [DONE]\n\n', false);
  r.reset();
  assert.deepStrictEqual(r.feed('data: {"choices":[{"delta":{"content":"重"}}]}\n\n', true), [{ content: '重' }]);
});
