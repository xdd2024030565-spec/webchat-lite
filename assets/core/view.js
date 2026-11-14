// dsh-skip-func-length: 前端模块用文件级 IIFE 封装作用域（ES5 无模块系统），不是单函数过长
/* ============================================================
   core/view.js — 侧栏与会话区渲染（ES5）
   渲染函数只拼 HTML，不确定状态；事件在 bind* 里补绑。
   ============================================================ */
(function (root) {
  'use strict';
  var WCL = root.WCL;
  var ST = WCL.state;

  function D() { return WCL.dom; }
  function md(s) { return ST.md ? ST.md(s) : D().esc(s); }

  function isPinned(rid) {
    var list = ST.stored.sessions, i;
    for (i = 0; i < list.length; i++) {
      if (list[i].pinnedSessionId === rid) return true;
    }
    return false;
  }

  function renderSide() {
    var box = D().$('sessList'), site = ST.site;
    if (!box) return;
    var h = '', i, s, list = ST.stored.sessions;
    h += '<div class="grp">本机对话</div>';
    if (!list.length) h += '<div class="grp-empty">还没有本机对话</div>';
    for (i = 0; i < list.length; i++) {
      s = list[i];
      h += '<div class="sess' + (s.id === ST.stored.activeId ? ' on' : '') + '" data-id="' +
        D().esc(s.id) + '"><span class="stitle">' + D().esc(s.title || '新对话') + '</span>' +
        '<button class="sdel" type="button" data-del="' + D().esc(s.id) +
        '" title="删除这个对话" aria-label="删除这个对话">×</button></div>';
    }
    if (site && site.caps.remoteSessions) {
      var tag = ST.st.remoteLoading ? '加载中…' :
        (ST.st.remoteErr ? '读取失败' : (ST.st.remoteSessions.length + ' 个'));
      h += '<div class="grp">网页版对话<span class="grp-tag">' + D().esc(tag) + '</span></div>';
      if (ST.st.remoteErr) {
        h += '<div class="grp-err">' + D().esc(ST.st.remoteErr) + ' <a href="#" id="remoteRetry">重试</a></div>';
      } else if (!ST.st.remoteSessions.length && !ST.st.remoteLoading) {
        h += '<div class="grp-empty">网页版里还没有对话</div>';
      }
      for (i = 0; i < ST.st.remoteSessions.length; i++) {
        s = ST.st.remoteSessions[i];
        h += '<div class="sess rm' + (isPinned(s.id) ? ' on' : '') + '" data-rid="' + D().esc(s.id) + '">' +
          D().esc(s.title || '网页版对话') + (s.tagged ? '<span class="rm-tag">固定</span>' : '') + '</div>';
      }
    }
    box.innerHTML = h;
    bindSide();
  }

  function bindSide() {
    var box = D().$('sessList'), i;
    if (!box) return;
    var els = box.querySelectorAll('.sess[data-id]');
    for (i = 0; i < els.length; i++) {
      (function (el) {
        D().on(el, 'click', function () {
          ST.stored.activeId = el.getAttribute('data-id');
          WCL.data.saveData();
          WCL.chrome.renderAll();
          if (WCL.shell) WCL.shell.closeSide();
        });
      })(els[i]);
    }
    els = box.querySelectorAll('.sdel[data-del]');
    for (i = 0; i < els.length; i++) {
      (function (el) {
        D().on(el, 'click', function (e) {
          if (e && e.preventDefault) e.preventDefault();
          if (e && e.stopPropagation) e.stopPropagation();
          var id = el.getAttribute('data-del');
          if (!root.confirm('删除这个对话？只存在本机，删除后无法恢复。')) return;
          WCL.data.delSession(id);
        });
      })(els[i]);
    }
    els = box.querySelectorAll('.sess[data-rid]');
    for (i = 0; i < els.length; i++) {
      (function (el) {
        D().on(el, 'click', function () {
          if (WCL.remote) WCL.remote.openRemote(el.getAttribute('data-rid'));
        });
      })(els[i]);
    }
    var retry = D().$('remoteRetry');
    if (retry) D().on(retry, 'click', function (e) {
      if (e.preventDefault) e.preventDefault();
      if (WCL.remote) WCL.remote.loadRemote();
    });
  }

  function welcomeHtml() {
    var c = ST.site.copy;
    var h = '<div class="welcome"><div class="logo">' + D().esc(WCL.chrome.avatar()) + '</div>' +
      '<h1>' + D().esc(c.welcomeTitle) + '</h1>';
    if (c.welcomeSub) h += '<p>' + D().esc(c.welcomeSub) + '</p>';
    if (c.cards && c.cards.length) {
      h += '<div class="cards">';
      for (var i = 0; i < c.cards.length; i++) {
        var card = c.cards[i];
        h += '<button class="card" type="button" data-q="' + D().esc(card.q || '') + '">' +
          '<span class="t">' + D().esc(card.t || '') + '</span>' +
          '<span class="d">' + D().esc(card.d || '') + '</span></button>';
      }
      h += '</div>';
    }
    return h + '</div>';
  }

  function thinkHtml(txt, streaming, key) {
    return '<details class="think" data-key="' + D().esc(key) + '"' + (streaming ? ' open' : '') + '>' +
      '<summary>' + WCL.chrome.thinkLabel(streaming, String(txt || '').length) + '</summary>' +
      '<div class="tb">' + D().esc(txt) + '</div></details>';
  }

  function actsHtml(i) {
    return '<div class="acts">' +
      '<button type="button" data-act="copy" data-i="' + i + '">复制</button>' +
      '<button type="button" data-act="retry" data-i="' + i + '">重试</button>' +
      '<button type="button" data-act="del" data-i="' + i + '">删除</button>' +
      '</div>';
  }

  function msgHtml(m, i) {
    if (m.role === 'user') {
      return '<div class="wrap"><div class="msg user"><div class="body">' +
        '<div class="md">' + md(m.content) + '</div></div></div></div>';
    }
    var inner = '';
    if (m.reasoning) inner += thinkHtml(m.reasoning, !!m._streaming, 'k' + i);
    if (m._err) inner += '<div class="md" style="color:var(--danger)">' + D().esc(m.content) + '</div>';
    else inner += '<div class="md">' + md(m.content) + '</div>';
    if (!m._streaming) inner += actsHtml(i);
    return '<div class="wrap"><div class="msg assistant"><div class="avatar">' +
      D().esc(WCL.chrome.avatar()) + '</div><div class="body">' + inner + '</div></div></div>';
  }

  function renderChat() {
    var box = D().$('chat');
    if (!box) return;
    var s = WCL.data.curSession(), h = '', i;
    if (!s || !s.messages.length) h = welcomeHtml();
    else {
      for (i = 0; i < s.messages.length; i++) h += msgHtml(s.messages[i], i);
    }
    box.innerHTML = h;
    ST.lastAsstEl = null;
    bindWelcome();
    bindActs();
    D().scrollBottom();
  }

  function bindWelcome() {
    var els = document.querySelectorAll('#chat .card[data-q]');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        D().on(el, 'click', function () {
          var inp = D().$('input');
          if (!inp) return;
          inp.value = el.getAttribute('data-q') || '';
          inp.focus();
          D().autoGrow();
        });
      })(els[i]);
    }
  }

  function bindActs() {
    var els = document.querySelectorAll('#chat .acts button[data-act]');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        D().on(el, 'click', function () {
          msgAct(el.getAttribute('data-act'), parseInt(el.getAttribute('data-i'), 10));
        });
      })(els[i]);
    }
  }

  function msgAct(act, i) {
    var s = WCL.data.curSession();
    if (!s || !s.messages[i]) return;
    var m = s.messages[i];
    if (act === 'copy') { D().copyText(m.content || ''); return; }
    if (act === 'del') {
      s.messages.splice(i, 1);
      WCL.data.saveData();
      WCL.chrome.renderAll();
      return;
    }
    if (act === 'retry') {
      s.messages.splice(i, 1);
      if (s.messages.length && s.messages[s.messages.length - 1].role === 'assistant') {
        s.messages.splice(s.messages.length - 1, 1);
      }
      WCL.data.saveData();
      WCL.chrome.renderAll();
      WCL.chat.runChat();
    }
  }

  // 流式期间只改最后一个助手节点，避免整段重排
  function paintStream(slot) {
    var el = ST.lastAsstEl;
    if (!el || !el.querySelector) { el = D().lastAssistantNode(); ST.lastAsstEl = el; }
    if (!el) return;
    var body = el.querySelector('.body') || el;
    if (slot.reasoning) {
      var think = body.querySelector('details.think');
      if (!think) {
        var tmp = document.createElement('div');
        tmp.innerHTML = thinkHtml(slot.reasoning, true, 'cur');
        var node = tmp.firstChild;
        body.insertBefore(node, body.firstChild);
        think = node;
      } else {
        var tb = think.querySelector('.tb');
        if (tb) tb.innerHTML = D().esc(slot.reasoning);
        var sm = think.querySelector('summary');
        if (sm) sm.innerHTML = WCL.chrome.thinkLabel(true, String(slot.reasoning).length);
      }
    }
    var box = body.querySelector('.md');
    if (box && !slot._err) box.innerHTML = md(slot.content);
  }

  WCL.view = {
    renderSide: renderSide, renderChat: renderChat, msgAct: msgAct,
    thinkHtml: thinkHtml, paintStream: paintStream, welcomeHtml: welcomeHtml
  };
})(typeof window !== 'undefined' ? window : this);
