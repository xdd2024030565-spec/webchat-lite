// dsh-skip-func-length: 前端模块用文件级 IIFE 封装作用域（ES5 无模块系统），不是单函数过长
/* ============================================================
   core/shell.js — 切站、弹层、侧栏抽屉、导出与清空（ES5）
   ============================================================ */
(function (root) {
  'use strict';
  var WCL = root.WCL;
  var ST = WCL.state;

  function D() { return WCL.dom; }

  function switchSite(id) {
    if (!ST.site || id === ST.site.id) return;
    WCL.data.saveData();
    var next = ST.sitesApi.byId(ST.sites, id);
    if (!next) return;
    ST.site = next;
    ST.ui.site = id;
    WCL.data.saveUi();
    ST.st.remoteSessions = [];
    ST.st.remoteErr = '';
    ST.st.remoteLoading = false;
    ST.st.health = null;
    if (ST.st.xhrCur) { try { ST.st.xhrCur.abort(); } catch (e) { /* 已结束 */ } ST.st.xhrCur = null; }
    ST.st.sending = false;
    WCL.data.loadSiteData();
    WCL.chrome.applyUi();
    WCL.chrome.updateCopy();
    WCL.chrome.renderAll();
    if (ST.site.caps.remoteSessions) WCL.remote.loadRemote();
    WCL.remote.checkHealth();
    D().toast('已切换到 ' + ST.site.name);
  }

  function settingsHtml() {
    var site = ST.site, h = '', i;
    h += '<div class="dsec">模型</div>';
    for (i = 0; i < site.models.length; i++) {
      var m = site.models[i];
      h += '<button class="ditem" type="button" data-model="' + D().esc(m.id) + '">' +
        '<span class="dt">' + D().esc(m.name) +
        (m.id === ST.stored.settings.model ? ' · 当前' : '') + '</span></button>';
    }
    h += '<div class="dsec">连接</div>';
    h += '<div class="hint" style="text-align:left;margin:2px 6px 8px">反代地址：' +
      D().esc(WCL.data.siteBase()) + '</div>';
    h += '<label class="hint" style="display:block;text-align:left;margin:6px 6px">' +
      '本机口令（可选，填了会随请求带上）' +
      '<input id="setKey" type="text" value="' + D().esc(ST.ui.key || '') + '" ' +
      'style="width:100%;margin-top:4px;padding:6px 8px;border:1px solid var(--line);' +
      'border-radius:6px;background:var(--bg);color:var(--fg)"></label>';
    h += '<button class="ditem" type="button" id="setKeySave"><span class="dt">保存口令</span></button>';
    h += '<div class="dsec">状态</div>';
    h += '<div class="hint" id="setHealth" style="text-align:left;margin:2px 6px 8px">' +
      D().esc(healthText()) + '</div>';
    h += '<button class="ditem" type="button" id="setHealthRun"><span class="dt">重新检查</span></button>';
    if (site.caps.remoteSessions) {
      h += '<div class="dsec">网页版</div>';
      h += '<button class="ditem" type="button" id="setPick"><span class="dt">选择已有对话…</span>' +
        '<span class="dd">把网页版里的历史载入本机</span></button>';
    }
    return h;
  }

  function healthText() {
    return WCL.remote ? WCL.remote.healthText() : '未检查';
  }

  function bindSettings() {
    var site = ST.site, i;
    var els = document.querySelectorAll('#setBody .ditem[data-model]');
    for (i = 0; i < els.length; i++) {
      (function (el) {
        D().on(el, 'click', function () {
          ST.stored.settings.model = el.getAttribute('data-model');
          if (site.caps.think) ST.stored.settings.think = (ST.stored.settings.model === 'deepseek-reasoner');
          WCL.data.saveData();
          openSet();
          WCL.chrome.renderChips();
        });
      })(els[i]);
    }
    var kSave = D().$('setKeySave');
    if (kSave) D().on(kSave, 'click', function () {
      var k = D().$('setKey');
      ST.ui.key = D().trim(k ? k.value : '');
      WCL.data.saveUi();
      D().toast(ST.ui.key ? '口令已保存' : '口令已清除');
      WCL.remote.checkHealth();
    });
    var kRun = D().$('setHealthRun');
    if (kRun) D().on(kRun, 'click', function () { WCL.remote.loadHealth(); });
    var pick = D().$('setPick');
    if (pick) D().on(pick, 'click', function () { closeMask(); openPick(); });
  }

  function openSet() {
    if (!ST.site) return;
    var body = D().$('setBody');
    if (body) body.innerHTML = settingsHtml();
    var mask = D().$('setMask');
    if (mask) mask.className = 'mask open';
    bindSettings();
  }

  function pickHtml() {
    var list = ST.st.remoteSessions, h = '', i;
    for (i = 0; i < list.length; i++) {
      var r = list[i];
      h += '<button class="ditem" type="button" data-rid="' + D().esc(r.id) + '">' +
        '<span class="dt">' + D().esc(r.title || '网页版对话') + '</span>' +
        '<span class="dd">' + D().esc(r.id) + (r.tagged ? ' · 固定' : '') + '</span></button>';
    }
    return h;
  }

  function openPick() {
    if (!ST.site || !ST.site.caps.remoteSessions) {
      D().toast('当前站不支持读取网页版对话');
      return;
    }
    var body = D().$('pickBody');
    if (!ST.st.remoteSessions.length) {
      if (body) body.innerHTML = '<div class="grp-empty">还没有拉到网页版对话</div>';
    } else {
      if (body) body.innerHTML = pickHtml();
      var els = document.querySelectorAll('#pickBody .ditem[data-rid]');
      for (var i = 0; i < els.length; i++) {
        (function (el) {
          D().on(el, 'click', function () {
            var rid = el.getAttribute('data-rid');
            closeMask();
            WCL.remote.openRemote(rid);
          });
        })(els[i]);
      }
    }
    var mask = D().$('pickMask');
    if (mask) mask.className = 'mask open';
  }

  function closeMask() {
    var a = D().$('setMask'), b = D().$('pickMask');
    if (a) a.className = 'mask';
    if (b) b.className = 'mask';
  }

  function openSide() {
    var el = D().$('side');
    if (el) el.className = 'side open';
  }

  function closeSide() {
    var el = D().$('side');
    if (el) el.className = 'side';
  }

  function exportChat() {
    var s = WCL.data.curSession();
    if (!s) return;
    D().copyText(WCL.data.exportText(s));
  }

  function clearAll() {
    if (!root.confirm) return;
    if (!root.confirm('清空全部数据？本机所有站点的对话与设置都会删除，无法恢复。')) return;
    if (ST.store) ST.store.clearAll();
    ST.ui = { theme: ST.ui.theme, eink: ST.ui.eink, site: ST.site ? ST.site.id : '', base: ST.ui.base, key: '' };
    ST.stored = { sessions: [], activeId: '', settings: {}, scope: '' };
    WCL.data.loadSiteData();
    WCL.chrome.renderAll();
    D().toast('已清空');
  }

  WCL.shell = {
    switchSite: switchSite, openSet: openSet, openPick: openPick, closeMask: closeMask,
    openSide: openSide, closeSide: closeSide, exportChat: exportChat, clearAll: clearAll
  };
})(typeof window !== 'undefined' ? window : this);
