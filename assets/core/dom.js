/* ============================================================
   core/dom.js — DOM 与文本小工具（ES5）
   只做无状态的读写动作，不碰会话数据。
   ============================================================ */
(function (root) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function trim(s) { return String(s === null || s === undefined ? '' : s).replace(/^\s+|\s+$/g, ''); }

  function on(el, ev, fn) {
    if (!el) return;
    if (el.addEventListener) el.addEventListener(ev, fn, false);
    else if (el.attachEvent) el.attachEvent('on' + ev, fn);
  }

  function nowMs() { return new Date().getTime(); }
  function uid() { return nowMs().toString(36) + Math.random().toString(36).slice(2, 7); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    if (!t) return;
    t.innerHTML = esc(msg);
    t.className = 'toast show';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 2200);
  }

  function jParse(s) {
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function jStr(o) {
    try { return JSON.stringify(o); } catch (e) { return 'null'; }
  }

  function copyText(text) {
    var t = String(text || '');
    try {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('style', 'position:fixed;left:-9999px;top:0');
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand ? document.execCommand('copy') : false;
      document.body.removeChild(ta);
      if (ok) toast('已复制');
      else fallbackCopy(t);
    } catch (e) { fallbackCopy(t); }
  }

  function fallbackCopy(t) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t);
        toast('已复制');
      } else {
        toast('复制失败，请手动选择文本');
      }
    } catch (e2) { toast('复制失败，请手动选择文本'); }
  }

  function scrollBottom() {
    var box = $('chat');
    if (!box) return;
    box.scrollTop = box.scrollHeight;
  }

  function autoGrow() {
    var el = $('input');
    if (!el) return;
    el.style.height = 'auto';
    var h = el.scrollHeight;
    if (h > 200) h = 200;
    el.style.height = h + 'px';
  }

  function lastAssistantNode() {
    var nodes = document.querySelectorAll('#chat .msg.assistant');
    return nodes.length ? nodes[nodes.length - 1] : null;
  }

  root.WCL = root.WCL || {};
  root.WCL.dom = {
    $: $, esc: esc, trim: trim, on: on, nowMs: nowMs, uid: uid, toast: toast,
    jParse: jParse, jStr: jStr, copyText: copyText, scrollBottom: scrollBottom,
    autoGrow: autoGrow, lastAssistantNode: lastAssistantNode
  };
})(typeof window !== 'undefined' ? window : this);
