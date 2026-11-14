// dsh-skip-func-length: 前端模块用文件级 IIFE 封装作用域（ES5 无模块系统），不是单函数过长
/* ============================================================
   core/store.js — 按站点命名空间的本地存储（ES5）
   键：webchat.v1.<siteId>（sessions/activeId/settings/scope）、webchat.v1.ui
   迁移：dsweb-lite.v1 + dsweb-lite.scope -> webchat.v1.deepseek
   ============================================================ */
(function (root) {
  'use strict';

  var PREFIX = 'webchat.v1.';
  var UI_KEY = PREFIX + 'ui';
  var LEGACY_SITE = 'dsweb-lite.v1';
  var LEGACY_SCOPE = 'dsweb-lite.scope';
  var LEGACY_SITE_ID = 'deepseek';

  function defaultBackend() {
    return {
      getItem: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      setItem: function (k, v) { localStorage.setItem(k, v); },
      removeItem: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
    };
  }

  function blankSite() { return { sessions: [], activeId: '', settings: {}, scope: '' }; }

  function readObj(be, k) {
    var s = be.getItem(k);
    if (!s) return null;
    try {
      var o = JSON.parse(s);
      return (o && typeof o === 'object') ? o : null;
    } catch (e) { return null; }
  }

  function siteKey(id) { return PREFIX + String(id); }

  function loadSite(be, id) {
    var o = readObj(be, siteKey(id));
    if (!o) return blankSite();
    return {
      sessions: o.sessions && o.sessions.length ? o.sessions : [],
      activeId: o.activeId || '',
      settings: o.settings || {},
      scope: o.scope || ''
    };
  }

  function saveSite(be, id, data) {
    try {
      be.setItem(siteKey(id), JSON.stringify(data || {}));
      return true;
    } catch (e) { return false; }
  }

  function saveUi(be, data) {
    try {
      be.setItem(UI_KEY, JSON.stringify(data || {}));
      return true;
    } catch (e) { return false; }
  }

  // 清空只扫本地键：不碰同域下别人的数据
  function clearAll(be) {
    be.removeItem(UI_KEY);
    be.removeItem(LEGACY_SITE);
    be.removeItem(LEGACY_SCOPE);
    var i, k, keys = [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage && localStorage.length !== undefined) {
        for (i = 0; i < localStorage.length; i++) {
          k = localStorage.key(i);
          if (k) keys.push(k);
        }
      }
    } catch (e) { keys = []; }
    for (i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(PREFIX) === 0) be.removeItem(keys[i]);
    }
  }

  function migrate(be) {
    var legacy = readObj(be, LEGACY_SITE);
    if (!legacy) return { migrated: false, from: '' };
    if (be.getItem(siteKey(LEGACY_SITE_ID))) return { migrated: false, from: '' };
    var data = {
      sessions: legacy.sessions || [],
      activeId: legacy.activeId || '',
      settings: legacy.settings || {},
      scope: be.getItem(LEGACY_SCOPE) || ''
    };
    try { be.setItem(siteKey(LEGACY_SITE_ID), JSON.stringify(data)); } catch (e) {}
    be.removeItem(LEGACY_SITE);
    be.removeItem(LEGACY_SCOPE);
    return { migrated: true, from: LEGACY_SITE };
  }

  function create(backend) {
    var be = backend || defaultBackend();
    return {
      siteKey: siteKey,
      uiKey: function () { return UI_KEY; },
      loadSite: function (id) { return loadSite(be, id); },
      saveSite: function (id, data) { return saveSite(be, id, data); },
      loadUi: function () { return readObj(be, UI_KEY) || {}; },
      saveUi: function (data) { return saveUi(be, data); },
      clearSite: function (id) { be.removeItem(siteKey(id)); },
      clearAll: function () { clearAll(be); },
      migrate: function () { return migrate(be); }
    };
  }

  root.WCL = root.WCL || {};
  root.WCL.store = { create: create, PREFIX: PREFIX, UI_KEY: UI_KEY };
  if (typeof exports === 'object' && exports) exports.create = create;
})(typeof window !== 'undefined' ? window : this);
