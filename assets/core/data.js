// dsh-skip-func-length: 前端模块用文件级 IIFE 封装作用域（ES5 无模块系统），不是单函数过长
/* ============================================================
   core/data.js — 会话数据、站点地址与请求体（ES5）
   所有可变状态都在 WCL.state，切站时整体替换而不是复制一份。
   ============================================================ */
(function (root) {
  'use strict';
  var WCL = root.WCL;
  var ST = WCL.state;

  function D() { return WCL.dom; }
  function store() { return ST.store; }

  function readBaseOverride() {
    var b = '';
    try {
      if (root.WCL_BASE) b = String(root.WCL_BASE);
      else {
        var m = (root.location.search || '').match(/[?&]base=([^&]+)/);
        if (m) b = decodeURIComponent(m[1]);
      }
    } catch (e) { b = ''; }
    if (b) ST.ui.base = b;
  }

  function readSiteOverride() {
    try {
      var m = (root.location.search || '').match(/[?&]site=([^&]+)/);
      if (m) return decodeURIComponent(m[1]);
    } catch (e) { /* 老内核没有 location.search 时按默认站 */ }
    return '';
  }

  function loadUi() {
    var u = store() ? store().loadUi() : {};
    ST.ui.theme = (u && u.theme === 'light') ? 'light' : 'dark';
    ST.ui.eink = !!(u && u.eink);
    ST.ui.site = (u && u.site) || '';
    ST.ui.key = (u && u.key) || '';
    if (u && u.base && !ST.ui.base) ST.ui.base = u.base;
  }

  function saveUi() {
    if (!store()) return true;
    return store().saveUi({
      theme: ST.ui.theme, eink: ST.ui.eink, site: ST.ui.site, base: ST.ui.base, key: ST.ui.key
    });
  }

  function saveData() {
    if (!store() || !ST.site) return;
    var ok = store().saveSite(ST.site.id, ST.stored);
    if (!ok) D().toast('本机存储已满，这条对话可能不会被保存');
  }

  function siteBase() { return ST.ui.base || ST.cfg.origin; }

  function siteUrl(p) {
    return ST.sitesApi.apiUrl ? ST.sitesApi.apiUrl(ST.site, siteBase(), p) : siteBase() + p;
  }

  function siteHealthUrl() {
    return ST.sitesApi.healthUrl ? ST.sitesApi.healthUrl(ST.site, siteBase()) : siteBase() + '/health';
  }

  function reqHeaders() {
    var h = {};
    if (ST.ui.key) h['Authorization'] = 'Bearer ' + ST.ui.key;
    return h;
  }

  function modelIds() {
    var out = [], i, models = (ST.site && ST.site.models) || [];
    for (i = 0; i < models.length; i++) out.push(models[i].id);
    return out;
  }

  function mergeSettings(site, raw) {
    var s = raw || {};
    var ids = modelIds();
    var def = ids.length ? ids[0] : '';
    return {
      model: ids.indexOf(s.model) >= 0 ? s.model : def,
      search: site.caps.search ? !!s.search : false,
      think: site.caps.think ? !!s.think : false,
      incr: site.caps.incr ? !!s.incr : false
    };
  }

  function findSession(id) {
    var list = ST.stored.sessions, i;
    for (i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function curSession() { return findSession(ST.stored.activeId); }

  // 上次流式被中断（关页面/切站）时，占位消息会停在 _streaming 状态；
  // 载入时把它收尾，否则会永远显示「思考中」且不发请求。
  function sanitizeSessions() {
    var list = ST.stored.sessions, i, j;
    for (i = 0; i < list.length; i++) {
      var msgs = (list[i] && list[i].messages) || [];
      for (j = 0; j < msgs.length; j++) {
        if (msgs[j] && msgs[j]._streaming) {
          msgs[j]._streaming = false;
          if (!msgs[j].content) {
            msgs[j]._err = true;
            msgs[j].content = '上次生成被中断';
          }
        }
      }
    }
  }

  function loadSiteData() {
    var raw = store() ? store().loadSite(ST.site.id) : {};
    ST.stored = {
      sessions: (raw && raw.sessions && raw.sessions.length) ? raw.sessions : [],
      activeId: (raw && raw.activeId) || '',
      settings: (raw && raw.settings) || {},
      scope: (raw && raw.scope) || ''
    };
    sanitizeSessions();
    ST.stored.settings = mergeSettings(ST.site, ST.stored.settings);
    if (!findSession(ST.stored.activeId)) {
      ST.stored.activeId = ST.stored.sessions.length ? ST.stored.sessions[0].id : '';
    }
    if (!ST.stored.sessions.length) newSession(true);
  }

  function scopeId() {
    if (!ST.stored.scope) {
      ST.stored.scope = 's' + D().nowMs().toString(36) + Math.random().toString(36).slice(2, 6);
      saveData();
    }
    return ST.stored.scope;
  }

  function newSession(silent) {
    var s = {
      id: D().uid(), title: '新对话', messages: [],
      created: D().nowMs(), updated: D().nowMs()
    };
    ST.stored.sessions.unshift(s);
    ST.stored.activeId = s.id;
    if (!silent) {
      saveData();
      if (WCL.chrome) WCL.chrome.renderAll();
    }
    return s;
  }

  // 删除一个本机对话；删的正好是当前对话时，切到剩下的第一个，全删光就补一个新的
  function delSession(id) {
    var list = ST.stored.sessions, out = [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i].id !== id) out.push(list[i]);
    }
    ST.stored.sessions = out;
    if (!out.length) {
      ST.stored.activeId = '';
      newSession(true);
    } else if (!findSession(ST.stored.activeId)) {
      ST.stored.activeId = out[0].id;
    }
    saveData();
    if (WCL.chrome) WCL.chrome.renderAll();
  }

  function contextMsgs(s) {
    var out = [], i, m, msgs = (s && s.messages) || [];
    for (i = 0; i < msgs.length; i++) {
      m = msgs[i];
      if (!m || m._err || m._streaming || m.role === 'system') continue;
      out.push({ role: m.role, content: m.content || '' });
    }
    return out;
  }

  function buildBody(model, msgs) {
    var site = ST.site, stg = ST.stored.settings || {};
    var body = { model: model, messages: msgs, temperature: 0.7, max_tokens: 4096, stream: true };
    if (site.caps.search) body.search_enabled = !!stg.search;
    if (site.caps.incr) {
      body.incremental = !!stg.incr;
      body.conversation_scope = scopeId();
      var s = curSession();
      if (site.caps.pin && s && s.pinnedSessionId) body.pinned_session_id = s.pinnedSessionId;
    }
    return body;
  }

  function exportText(s) {
    var out = ['# ' + ((s && s.title) || '对话'), ''], i, m, msgs = (s && s.messages) || [];
    for (i = 0; i < msgs.length; i++) {
      m = msgs[i];
      if (m._streaming) continue;
      out.push(m.role === 'user' ? '## 你' : '## AI');
      out.push(m.content || '');
      out.push('');
    }
    return out.join('\n');
  }

  WCL.data = {
    readBaseOverride: readBaseOverride, readSiteOverride: readSiteOverride,
    loadUi: loadUi, saveUi: saveUi, saveData: saveData,
    siteBase: siteBase, siteUrl: siteUrl, siteHealthUrl: siteHealthUrl, reqHeaders: reqHeaders,
    modelIds: modelIds, mergeSettings: mergeSettings,
    findSession: findSession, curSession: curSession, sanitizeSessions: sanitizeSessions,
    loadSiteData: loadSiteData, scopeId: scopeId, newSession: newSession, delSession: delSession,
    contextMsgs: contextMsgs, buildBody: buildBody, exportText: exportText
  };
})(typeof window !== 'undefined' ? window : this);
