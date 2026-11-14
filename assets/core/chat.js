// dsh-skip-func-length: 前端模块用文件级 IIFE 封装作用域（ES5 无模块系统），不是单函数过长
/* ============================================================
   core/chat.js — 发送与流式接收（ES5，XHR readyState 3 增量读）
   ============================================================ */
(function (root) {
  'use strict';
  var WCL = root.WCL;
  var ST = WCL.state;

  function D() { return WCL.dom; }

  function sendMessage() {
    if (!ST.site || ST.st.sending) return;
    var inp = D().$('input');
    if (!inp) return;
    var text = D().trim(inp.value);
    if (!text) return;
    var s = WCL.data.curSession() || WCL.data.newSession(true);
    s.messages.push({ role: 'user', content: text });
    if (!s.title || s.title === '新对话') s.title = text.slice(0, 20);
    s.updated = D().nowMs();
    inp.value = '';
    D().autoGrow();
    WCL.data.saveData();
    runChat();
  }

  function runChat() {
    var s = WCL.data.curSession();
    if (!s) return;
    var slot = { role: 'assistant', content: '', reasoning: '', _streaming: true };
    s.messages.push(slot);
    s.updated = D().nowMs();
    WCL.chrome.setSending(true);
    WCL.chrome.renderAll();
    ST.lastAsstEl = D().lastAssistantNode();
    streamReq(slot, WCL.data.contextMsgs(s));
  }

  function stop() {
    ST.st.stopFlag = true;
    if (ST.st.xhrCur) {
      try { ST.st.xhrCur.abort(); } catch (e) { /* 已结束的请求 abort 会抛，忽略 */ }
    }
  }

  function makeCtx(slot) {
    return {
      slot: slot,
      mySiteId: ST.site ? ST.site.id : '',
      reader: ST.reader(),
      xhr: null,
      seen: 0,
      gotSse: false,
      lastPaint: 0,
      finished: false
    };
  }

  function paint(c) {
    var t = D().nowMs();
    if (t - c.lastPaint < ST.cfg.paintMs) return;
    c.lastPaint = t;
    WCL.view.paintStream(c.slot);
  }

  function finish(c, errMsg) {
    if (c.finished) return;
    c.finished = true;
    c.slot._streaming = false;
    // 切站后旧请求的收尾必须停手：否则会把上一个站点的会话写进新站点的存储键
    if (!ST.site || ST.site.id !== c.mySiteId) return;
    if (errMsg) {
      c.slot._err = true;
      c.slot.content = c.slot.content ? (c.slot.content + '\n\n' + errMsg) : errMsg;
    }
    if (!c.slot.content && !errMsg) {
      c.slot._err = true;
      c.slot.content = '返回为空，请重试';
    }
    ST.st.xhrCur = null;
    ST.st.stopFlag = false;
    WCL.chrome.setSending(false);
    WCL.data.saveData();
    WCL.chrome.renderAll();
    D().scrollBottom();
  }

  function applyDeltas(c, deltas) {
    var changed = false, i;
    for (i = 0; i < deltas.length; i++) {
      var d = deltas[i];
      if (!d || c.finished) continue;
      if (d.error) { finish(c, String(d.error)); return; }
      if (d.content) { c.slot.content += d.content; changed = true; c.gotSse = true; }
      if (d.reasoning) { c.slot.reasoning += d.reasoning; changed = true; c.gotSse = true; }
      if (d.citations) c.slot.citations = d.citations;
      if (d.finish === 'error') { finish(c, '上游返回错误'); return; }
    }
    if (changed) paint(c);
  }

  // 上游没走 SSE 但回了整包 JSON 时的兜底
  function wholeJson(text) {
    var d = D().jParse(text);
    if (!d) return null;
    var m = d.choices && d.choices[0] && (d.choices[0].message || d.choices[0].delta);
    if (!m) return null;
    return { content: m.content || '', reasoning: m.reasoning_content || '' };
  }

  function openXhr(xhr) {
    xhr.open('POST', WCL.data.siteUrl('/chat/completions'), true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    var hdr = WCL.data.reqHeaders(), k;
    for (k in hdr) {
      if (hdr.hasOwnProperty(k)) xhr.setRequestHeader(k, hdr[k]);
    }
  }

  function onState(c) {
    var xhr = c.xhr;
    if (xhr.readyState === 3 || xhr.readyState === 4) {
      var txt = '';
      try { txt = xhr.responseText || ''; } catch (e) { txt = ''; }
      if (txt.length > c.seen) {
        var part = txt.slice(c.seen);
        c.seen = txt.length;
        if (!c.finished) applyDeltas(c, c.reader.feed(part, false));
      }
    }
    if (xhr.readyState !== 4 || c.finished) return;
    if (ST.st.stopFlag) { finish(c, '已停止'); return; }
    var status = 0;
    try { status = xhr.status; } catch (e3) { status = 0; }
    if (status >= 200 && status < 300) {
      applyDeltas(c, c.reader.feed('', true));
      if (c.finished) return;
      if (c.gotSse) { finish(c, ''); return; }
      var w = wholeJson(xhr.responseText || '');
      if (w) {
        c.slot.content = w.content;
        c.slot.reasoning = w.reasoning;
        finish(c, '');
        return;
      }
      finish(c, '返回为空，请重试');
      return;
    }
    if (status === 0) { finish(c, '网络错误或跨域被拦截'); return; }
    finish(c, 'HTTP ' + status + '：' + String(xhr.responseText || '').slice(0, 200));
  }

  function streamReq(slot, msgs) {
    var c = makeCtx(slot);
    var xhr = new XMLHttpRequest();
    c.xhr = xhr;
    ST.st.xhrCur = xhr;
    ST.st.stopFlag = false;
    try {
      openXhr(xhr);
    } catch (e) {
      finish(c, '请求无法发起：' + e.message);
      return;
    }
    xhr.timeout = ST.cfg.chatTimeout;
    xhr.onreadystatechange = function () { onState(c); };
    xhr.ontimeout = function () { finish(c, '请求超时（180 秒）'); };
    xhr.onerror = function () { finish(c, '网络错误'); };
    try {
      xhr.send(D().jStr(WCL.data.buildBody(ST.stored.settings.model, msgs)));
    } catch (e4) {
      finish(c, '发送失败：' + e4.message);
    }
  }

  WCL.chat = { sendMessage: sendMessage, runChat: runChat, stop: stop };
})(typeof window !== 'undefined' ? window : this);
