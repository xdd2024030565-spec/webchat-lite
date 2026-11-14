// dsh-skip-func-length: 前端模块用文件级 IIFE 封装作用域（ES5 无模块系统），不是单函数过长
/* ============================================================
   core/chrome.js — 外壳：主题、文案、标题、切站器、能力开关（ES5）
   ============================================================ */
(function (root) {
  'use strict';
  var WCL = root.WCL;
  var ST = WCL.state;

  function D() { return WCL.dom; }

  function applyUi() {
    var cls = [];
    if (ST.ui.theme === 'dark') cls.push('theme-dark');
    if (ST.ui.eink) cls.push('eink');
    if (ST.site && ST.site.id) cls.push('site-' + ST.site.id);
    document.body.className = cls.join(' ');
    if (ST.site && ST.site.brand && ST.site.brand.color) {
      document.documentElement.style.setProperty('--brand', ST.site.brand.color);
    }
  }

  function avatar() {
    var site = ST.site;
    if (!site) return 'A';
    return site.copy.avatar || (site.name.charAt(0) || 'A');
  }

  function updateCopy() {
    var site = ST.site;
    if (!site) return;
    var t = D().$('newChatText'); if (t) t.innerHTML = D().esc(site.copy.newChat);
    var i = D().$('input'); if (i) i.setAttribute('placeholder', site.copy.placeholder);
    var h = D().$('hint'); if (h) h.innerHTML = D().esc(site.copy.hint);
    document.title = site.name + ' · 网页聊天';
  }

  function thinkLabel(streaming, n) {
    var site = ST.site;
    var raw = (site && site.copy.thinkLabel) || '思考中… / 已深度思考';
    var parts = String(raw).split(/\s*\/\s*/);
    var t = streaming ? (parts[0] || '思考中…') : (parts[1] || parts[0] || '已深度思考');
    return D().esc(t) + '（' + n + ' 字）';
  }

  function renderTitle() {
    var el = D().$('chatTitle');
    if (!el) return;
    var s = WCL.data.curSession();
    el.innerHTML = D().esc(s ? (s.title || '新对话') : '新对话');
  }

  function renderSiteSwitch() {
    var box = D().$('siteSwitch'), list = ST.sites, i;
    if (!box) return;
    var h = '';
    for (i = 0; i < list.length; i++) {
      var s = list[i];
      h += '<button type="button" class="sbtn' + (ST.site && s.id === ST.site.id ? ' on' : '') +
        '" data-site="' + D().esc(s.id) + '">' + D().esc(s.name) + '</button>';
    }
    box.innerHTML = h;
    var els = box.querySelectorAll('.sbtn[data-site]');
    for (i = 0; i < els.length; i++) {
      (function (el) {
        D().on(el, 'click', function () {
          if (WCL.shell) WCL.shell.switchSite(el.getAttribute('data-site'));
        });
      })(els[i]);
    }
  }

  function renderChips() {
    var map = [
      { id: 'chipSearch', cap: 'search', key: 'search' },
      { id: 'chipThink', cap: 'think', key: 'think' },
      { id: 'chipInc', cap: 'incr', key: 'incr' }
    ];
    for (var i = 0; i < map.length; i++) {
      var el = D().$(map[i].id);
      if (!el) continue;
      var has = !!(ST.site && ST.site.caps[map[i].cap]);
      el.hidden = !has;
      if (has && ST.stored.settings[map[i].key]) el.className = 'chip on';
      else el.className = 'chip';
    }
  }

  function setSending(v) {
    ST.st.sending = !!v;
    var send = D().$('btnSend'), stop = D().$('btnStop');
    if (send) send.style.display = v ? 'none' : '';
    if (stop) stop.style.display = v ? '' : 'none';
  }

  function renderAll() {
    renderTitle();
    renderSiteSwitch();
    renderChips();
    WCL.view.renderSide();
    WCL.view.renderChat();
    setSending(ST.st.sending);
  }

  WCL.chrome = {
    applyUi: applyUi, avatar: avatar, updateCopy: updateCopy, thinkLabel: thinkLabel,
    renderTitle: renderTitle, renderSiteSwitch: renderSiteSwitch, renderChips: renderChips,
    setSending: setSending, renderAll: renderAll
  };
})(typeof window !== 'undefined' ? window : this);
