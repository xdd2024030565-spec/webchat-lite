/* ============================================================
   core/sites.js — 站点清单归一化与选择（ES5）
   caps：search / think / incr / pin / remoteSessions
   规则：caps.pin 必须同时具备 remoteSessions 才成立
   ============================================================ */
(function (root) {
  'use strict';

  var CAP_KEYS = ['search', 'think', 'incr', 'pin', 'remoteSessions'];
  var COPY_DEFAULT = {
    newChat: '开启新对话',
    placeholder: '发送消息…',
    welcomeTitle: '今天聊点什么？',
    welcomeSub: '',
    thinkLabel: '思考中… / 已深度思考',
    cards: [],
    hint: '内容由 AI 生成，请仔细甄别'
  };

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function normalize(def) {
    var d = def || {};
    var id = String(d.id || '');
    var srcCaps = d.caps || {};
    var caps = {};
    var i, k;
    for (i = 0; i < CAP_KEYS.length; i++) {
      k = CAP_KEYS[i];
      caps[k] = has(srcCaps, k) ? !!srcCaps[k] : false;
    }
    caps.pin = !!caps.pin && !!caps.remoteSessions;

    var copy = {};
    for (k in COPY_DEFAULT) {
      if (has(COPY_DEFAULT, k)) copy[k] = COPY_DEFAULT[k];
    }
    var srcCopy = d.copy || {};
    for (k in srcCopy) {
      if (has(srcCopy, k)) copy[k] = srcCopy[k];
    }
    if (!copy.cards) copy.cards = [];

    return {
      id: id,
      name: String(d.name || id),
      endpoint: String(d.endpoint || ('/' + id + '/v1')),
      models: (d.models && d.models.length) ? d.models.slice() : [{ id: 'default', name: '默认' }],
      caps: caps,
      copy: copy
    };
  }

  function byId(list, id) {
    var i;
    list = list || [];
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function pick(list, wanted, last) {
    list = list || [];
    if (!list.length) return null;
    return byId(list, wanted) || byId(list, last) || list[0];
  }

  function apiUrl(site, base, p) {
    return String(base || '') + String((site && site.endpoint) || '') + String(p || '');
  }

  function healthUrl(site, base) {
    var ep = String((site && site.endpoint) || '').replace(/\/v1\/?$/, '');
    return String(base || '') + ep + '/health';
  }

  root.WCL = root.WCL || {};
  root.WCL.sites = {
    normalize: normalize,
    byId: byId,
    pick: pick,
    apiUrl: apiUrl,
    healthUrl: healthUrl
  };
  if (typeof exports === 'object' && exports) {
    exports.normalize = normalize;
    exports.byId = byId;
    exports.pick = pick;
    exports.apiUrl = apiUrl;
    exports.healthUrl = healthUrl;
  }
})(typeof window !== 'undefined' ? window : this);
