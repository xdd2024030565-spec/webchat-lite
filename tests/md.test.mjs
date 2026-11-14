import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { md } = require('../assets/core/md.js');

test('HTML 被转义，不执行', () => {
  assert.ok(md('<script>alert(1)</script>').indexOf('<script>') === -1);
});

test('粗体 / 行内代码 / 代码块 / 链接', () => {
  assert.ok(md('**粗**').indexOf('<strong>粗</strong>') >= 0);
  assert.ok(md('`x<y`').indexOf('<code>x&lt;y</code>') >= 0);
  assert.ok(md('```js\nvar a=1;\n```').indexOf('<pre>') >= 0);
  assert.ok(md('[a](https://e.com)').indexOf('href="https://e.com"') >= 0);
});

test('标题 / 列表 / 引用', () => {
  assert.ok(md('## 小标题').indexOf('<h2>小标题</h2>') >= 0);
  assert.ok(md('- 一\n- 二').indexOf('<ul><li>一</li><li>二</li></ul>') >= 0);
  assert.ok(md('> 引').indexOf('<blockquote>引</blockquote>') >= 0);
});

test('空输入返回空串', () => {
  assert.strictEqual(md(''), '');
  assert.strictEqual(md(null), '');
});
