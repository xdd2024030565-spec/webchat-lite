/* ============================================================
   core/sse.js — SSE 增量解析（ES5，浏览器与 node 测试共用）
   Delta = {content?, reasoning?, citations?, finish?, error?}
   浏览器：window.WCL.sse；Node：require/import 的具名导出
   ============================================================ */
(function (root) {
  'use strict';

  function parseDataLine(line, out) {
    var s = String(line).replace(/^\s+|\s+$/g, '');
    if (!s || s.charAt(0) === ':') return;
    if (s.indexOf('data:') !== 0) return;
    var payload = s.slice(5).replace(/^\s+/, '');
    if (payload === '[DONE]') { out.push({ finish: 'stop' }); return; }
    var j;
    try { j = JSON.parse(payload); } catch (e) { return; }
    if (j && j.error) {
      var msg = (j.error && j.error.message) ? j.error.message : j.error;
      out.push({ finish: 'error', error: String(msg) });
      return;
    }
    var ch = j && j.choices && j.choices[0];
    var d = ch && ch.delta;
    if (d) {
      var one = null;
      if (typeof d.content === 'string' && d.content) { one = one || {}; one.content = d.content; }
      if (typeof d.reasoning_content === 'string' && d.reasoning_content) {
        one = one || {}; one.reasoning = d.reasoning_content;
      }
      if (d.citations && d.citations.length) { one = one || {}; one.citations = d.citations; }
      if (one) out.push(one);
    }
    if (ch && ch.finish_reason) out.push({ finish: String(ch.finish_reason) });
  }

  function createReader() {
    var buf = '';
    var all = '';
    var sawData = false;
    var done = false;

    function take(line, out) {
      var s = String(line).replace(/^\s+|\s+$/g, '');
      if (s.indexOf('data:') === 0) sawData = true;
      parseDataLine(line, out);
      var i;
      for (i = 0; i < out.length; i++) {
        if (out[i] && out[i].finish) return true;
      }
      return false;
    }

    function feed(text, final) {
      var out = [];
      var t = (text === null || text === undefined) ? '' : String(text);
      all += t;
      if (done) return out;
      buf += t;
      var idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        var ln = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (take(ln, out)) { done = true; break; }
      }
      if (final && !done) {
        if (buf) { take(buf, out); buf = ''; }
        if (!done && !sawData) {
          var s = all.replace(/^\s+|\s+$/g, '');
          if (s) {
            var isJson = false;
            if (s.charAt(0) !== '<') {
              try { JSON.parse(s); isJson = true; } catch (e) {}
            }
            if (!isJson) out.push({ finish: 'error', error: '上游返回了非流式内容' });
          }
        }
      }
      return out;
    }

    function reset() { buf = ''; all = ''; sawData = false; done = false; }

    return { feed: feed, reset: reset };
  }

  root.WCL = root.WCL || {};
  root.WCL.sse = { createReader: createReader };
  if (typeof exports === 'object' && exports) exports.createReader = createReader;
})(typeof window !== 'undefined' ? window : this);
