import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSource, checkFiles, walkJs } from '../tools/es5-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('门禁能抓到 let / const / 箭头 / 模板串 / class', () => {
  assert.ok(checkSource('let a = 1;').some((h) => h.token === 'let'));
  assert.ok(checkSource('const a = 1;').some((h) => h.token === 'const'));
  assert.ok(checkSource('var f = function(){}; var g = () => 1;').some((h) => h.token === '=>'));
  assert.ok(checkSource('var s = `x`;').some((h) => h.token === '`'));
  assert.ok(checkSource('class A {}').some((h) => h.token === 'class'));
  assert.ok(checkSource('var p = new Promise(function(){});').some((h) => h.token === 'Promise'));
});

test('门禁不误报：字符串/注释/正则里的关键字', () => {
  assert.deepStrictEqual(checkSource('var s = "let const =>";'), []);
  assert.deepStrictEqual(checkSource('// let a = 1\nvar b = 2;'), []);
  assert.deepStrictEqual(checkSource('var re = /let|const/g;'), []);
  assert.deepStrictEqual(checkSource("var t = '箭头 => 不是语法';"), []);
});

test('行号准确', () => {
  const hits = checkSource('var a = 1;\nvar b = 2;\nlet c = 3;\n');
  assert.strictEqual(hits[0].token, 'let');
  assert.strictEqual(hits[0].line, 3);
});

test('全部前端源码通过 ES5 门禁', () => {
  const files = walkJs(path.join(ROOT, 'assets'));
  assert.ok(files.length >= 5, '至少扫到 5 个 js 文件，实际 ' + files.length);
  const bad = checkFiles(files);
  assert.deepStrictEqual(bad, [], '发现 ES6+ 语法: ' + JSON.stringify(bad));
});

test('CSS 不使用 Grid 与 :has()（老设备）', () => {
  const files = ['assets/app.css', 'assets/chat.css'];
  for (const f of files) {
    const css = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.strictEqual(/display\s*:\s*grid/i.test(css), false, f + ' 不能用 display:grid');
    assert.strictEqual(/:has\(/i.test(css), false, f + ' 不能用 :has()');
  }
});

test('Pages workflow 的 paths 覆盖 assets 与 index.html', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  assert.ok(/assets/.test(wf) || /'\*\*'/.test(wf), 'pages.yml 必须包含 assets 路径或 **');
});
