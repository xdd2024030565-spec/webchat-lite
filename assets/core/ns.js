/* ============================================================
   core/ns.js — 全局命名空间与共享状态（最先加载）
   其余模块只读 window.WCL.*，状态集中在 WCL.state，便于切站时整体替换。
   ============================================================ */
(function (root) {
  'use strict';
  var WCL = root.WCL = root.WCL || {};

  if (!WCL.state) {
    WCL.state = {
      // 反代地址（Worker 根，不带 /<site>/v1）
      cfg: {
        origin: 'https://deepseek-web.yongjiu.ccwu.cc',
        paintMs: 120,
        chatTimeout: 180000,
        listTimeout: 30000,
        healthTimeout: 8000
      },
      sites: [],
      site: null,
      stored: { sessions: [], activeId: '', settings: {}, scope: '' },
      ui: { theme: 'dark', eink: false, site: '', base: '', key: '' },
      st: {
        remoteSessions: [], remoteLoading: false, remoteErr: '',
        sending: false, xhrCur: null, stopFlag: false,
        health: null, healthLoading: false
      },
      lastAsstEl: null,
      // 依赖模块实例（app.js 启动时装配）
      store: null,
      reader: null,
      md: null,
      sitesApi: null
    };
  }

  if (typeof exports === 'object' && exports) exports.state = WCL.state;
})(typeof window !== 'undefined' ? window : this);
