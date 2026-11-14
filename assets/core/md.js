// dsh-skip-func-length: 前端模块用文件级 IIFE 封装作用域（ES5 无模块系统），不是单函数过长
/* ============================================================
   core/md.js — 精简 Markdown 渲染（ES5）
   先整体转义再按行处理，避免注入。
   支持：围栏代码块 / 行内代码 / 粗体 / 斜体 / 标题 / 列表 / 引用 / 链接
   ============================================================ */
(function (root) {
  'use strict';

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function trim(s) { return String(s === null || s === undefined ? '' : s).replace(/^\s+|\s+$/g, ''); }

  // 围栏代码块先抽成占位符，避免被后续行内规则破坏
  function extractFences(s) {
    var blocks = [];
    var text = s.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g, function (all, lang, code) {
      blocks.push('<pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>');
      return '\u0001B' + (blocks.length - 1) + '\u0001';
    });
    return { text: text, blocks: blocks };
  }

  // 行内代码同样先占位，内容不再参与加粗/斜体
  function extractInline(s) {
    var inl = [];
    var text = s.replace(/`([^`\n]+)`/g, function (all, code) {
      inl.push('<code>' + code + '</code>');
      return '\u0001I' + (inl.length - 1) + '\u0001';
    });
    return { text: text, inl: inl };
  }

  function decorate(s) {
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }

  function blockTag(ln) {
    var m = ln.match(/^(#{1,3})\s+(.*)$/);
    if (m) return '<h' + m[1].length + '>' + m[2] + '</h' + m[1].length + '>';
    if (/^&gt;\s?/.test(ln)) return '<blockquote>' + ln.replace(/^&gt;\s?/, '') + '</blockquote>';
    return '';
  }

  function renderLines(s) {
    var lines = s.split('\n'), out = [], para = [], inUl = false, inOl = false;
    var i, ln, m;

    function flushPara() {
      if (!para.length) return;
      out.push('<p>' + para.join('<br>') + '</p>');
      para = [];
    }
    function closeLists() {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    }

    for (i = 0; i < lines.length; i++) {
      ln = lines[i];
      if (/^\u0001B\d+\u0001$/.test(trim(ln))) { flushPara(); closeLists(); out.push(ln); continue; }
      if (!trim(ln)) { flushPara(); closeLists(); continue; }

      var tag = blockTag(ln);
      if (tag) { flushPara(); closeLists(); out.push(tag); continue; }

      m = ln.match(/^\s*[-*]\s+(.*)$/);
      if (m) {
        flushPara();
        if (!inUl) { closeLists(); out.push('<ul>'); inUl = true; }
        out.push('<li>' + m[1] + '</li>');
        continue;
      }
      m = ln.match(/^\s*\d+[.)]\s+(.*)$/);
      if (m) {
        flushPara();
        if (!inOl) { closeLists(); out.push('<ol>'); inOl = true; }
        out.push('<li>' + m[1] + '</li>');
        continue;
      }
      closeLists();
      para.push(ln);
    }
    flushPara(); closeLists();
    return out.join('');
  }

  function restore(s, inl, blocks) {
    s = s.replace(/\u0001I(\d+)\u0001/g, function (all, n) { return inl[parseInt(n, 10)] || ''; });
    return s.replace(/\u0001B(\d+)\u0001/g, function (all, n) { return blocks[parseInt(n, 10)] || ''; });
  }

  function md(src) {
    var s = String(src || '');
    if (!s) return '';
    var f = extractFences(s);
    var i = extractInline(esc(f.text));
    var html = renderLines(decorate(i.text));
    return restore(html, i.inl, f.blocks);
  }

  root.WCL = root.WCL || {};
  root.WCL.md = md;
  if (typeof exports === 'object' && exports) exports.md = md;
})(typeof window !== 'undefined' ? window : this);
