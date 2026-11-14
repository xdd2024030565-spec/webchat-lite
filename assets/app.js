// dsh-skip-func-length: 前端模块用文件级 IIFE 封装作用域（ES5 无模块系统），不是单函数过长
/* ============================================================
   网页聊天 · 兼容版 — 装配与启动（ES5）
   这里只做事件绑定与启动顺序；各功能在 core/* 里。
   ============================================================ */
(function (root) {
  'use strict';
  var WCL = root.WCL;
  var ST = WCL.state;

  function D() { return WCL.dom; }

  function bindComposer() {
    D().on(D().$('btnNew'), 'click', function () {
      WCL.data.newSession(false);
      WCL.shell.closeSide();
    });
    D().on(D().$('btnSend'), 'click', WCL.chat.sendMessage);
    D().on(D().$('btnStop'), 'click', WCL.chat.stop);
    var inp = D().$('input');
    D().on(inp, 'keydown', function (e) {
      var ev = e || root.event;
      if (ev.keyCode === 13 && !ev.shiftKey) {
        if (ev.preventDefault) ev.preventDefault();
        WCL.chat.sendMessage();
        return false;
      }
    });
    D().on(inp, 'input', D().autoGrow);
  }

  function bindChips() {
    D().on(D().$('chipSearch'), 'click', function () {
      if (!ST.site.caps.search) return;
      ST.stored.settings.search = !ST.stored.settings.search;
      WCL.data.saveData();
      WCL.chrome.renderChips();
    });
    D().on(D().$('chipThink'), 'click', function () {
      if (!ST.site.caps.think) return;
      ST.stored.settings.think = !ST.stored.settings.think;
      var ids = WCL.data.modelIds();
      if (ids.indexOf('deepseek-reasoner') >= 0 && ids.indexOf('deepseek-chat') >= 0) {
        ST.stored.settings.model = ST.stored.settings.think ? 'deepseek-reasoner' : 'deepseek-chat';
      }
      WCL.data.saveData();
      WCL.chrome.renderChips();
    });
    D().on(D().$('chipInc'), 'click', function () {
      if (!ST.site.caps.incr) return;
      ST.stored.settings.incr = !ST.stored.settings.incr;
      WCL.data.saveData();
      WCL.chrome.renderChips();
    });
  }

  function bindFoot() {
    D().on(D().$('btnMenu'), 'click', WCL.shell.openSide);
    D().on(D().$('btnModel'), 'click', WCL.shell.openSet);
    D().on(D().$('setClose'), 'click', WCL.shell.closeMask);
    D().on(D().$('pickCancel'), 'click', WCL.shell.closeMask);
    D().on(D().$('lnkPick'), 'click', function (e) {
      if (e.preventDefault) e.preventDefault();
      WCL.shell.openPick();
      return false;
    });
    D().on(D().$('lnkTheme'), 'click', function (e) {
      if (e.preventDefault) e.preventDefault();
      ST.ui.theme = ST.ui.theme === 'dark' ? 'light' : 'dark';
      WCL.data.saveUi();
      WCL.chrome.applyUi();
      return false;
    });
    D().on(D().$('lnkEink'), 'click', function (e) {
      if (e.preventDefault) e.preventDefault();
      ST.ui.eink = !ST.ui.eink;
      WCL.data.saveUi();
      WCL.chrome.applyUi();
      D().toast(ST.ui.eink ? '电子墨水屏模式已开' : '电子墨水屏模式已关');
      return false;
    });
    D().on(D().$('lnkExport'), 'click', function (e) {
      if (e.preventDefault) e.preventDefault();
      WCL.shell.exportChat();
      return false;
    });
    D().on(D().$('lnkClear'), 'click', function (e) {
      if (e.preventDefault) e.preventDefault();
      WCL.shell.clearAll();
      return false;
    });
  }

  function bindMasks() {
    D().on(D().$('setMask'), 'click', function (e) {
      var ev = e || root.event;
      if (ev.target === D().$('setMask')) WCL.shell.closeMask();
    });
    D().on(D().$('pickMask'), 'click', function (e) {
      var ev = e || root.event;
      if (ev.target === D().$('pickMask')) WCL.shell.closeMask();
    });
  }

  function bindAll() {
    bindComposer();
    bindChips();
    bindFoot();
    bindMasks();
  }

  function exposeApp() {
    root.WCL_APP = {
      site: function () { return ST.site; },
      sites: function () { return ST.sites; },
      data: function () { return ST.stored; },
      ui: function () { return ST.ui; },
      switchSite: WCL.shell.switchSite,
      send: WCL.chat.sendMessage,
      openSet: WCL.shell.openSet,
      openPick: WCL.shell.openPick,
      health: function () { return ST.st.health; }
    };
  }

  function startFrom(defs) {
    var i;
    ST.sites = [];
    for (i = 0; i < (defs || []).length; i++) {
      ST.sites.push(ST.sitesApi.normalize(defs[i]));
    }
    ST.site = ST.sitesApi.pick(ST.sites, ST.ui.site, '') || null;
    if (!ST.site) {
      var box = D().$('chat');
      if (box) {
        box.innerHTML = '<div class="welcome"><h1>没有可用站点</h1>' +
          '<p>assets/sites/ 里至少需要一个站点定义</p></div>';
      }
      return;
    }
    ST.ui.site = ST.site.id;
    WCL.data.loadSiteData();
    WCL.chrome.applyUi();
    bindAll();
    WCL.chrome.updateCopy();
    WCL.chrome.renderAll();
    D().autoGrow();
    if (ST.site.caps.remoteSessions) WCL.remote.loadRemote();
    WCL.remote.checkHealth();
    exposeApp();
  }

  function init() {
    ST.sitesApi = WCL.sites;
    ST.md = WCL.md;
    ST.reader = WCL.sse.createReader;
    if (WCL.store && WCL.store.create) ST.store = WCL.store.create();
    if (ST.store && ST.store.migrate) ST.store.migrate();
    WCL.data.readBaseOverride();
    WCL.data.loadUi();
    var qs = WCL.data.readSiteOverride();
    if (qs) ST.ui.site = qs;

    var loader = (WCL.sites && WCL.sites.load) ? WCL.sites.load : function (cb) {
      cb(root.WCL_SITE_DEFS || []);
    };
    loader(startFrom);
  }

  if (document.readyState === 'loading') {
    D().on(document, 'DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
