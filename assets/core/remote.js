// dsh-skip-func-length: 前端模块用文件级 IIFE 封装作用域（ES5 无模块系统），不是单函数过长
/* ============================================================
   core/remote.js — 上游网页版会话与健康检查（ES5）
   只在站点 caps.remoteSessions 为真时启用。
   ============================================================ */
(function (root) {
  'use strict';
  var WCL = root.WCL;
  var ST = WCL.state;

  function D() { return WCL.dom; }

  function loadRemote() {
    if (!ST.site || !ST.site.caps.remoteSessions) return;
    ST.st.remoteLoading = true;
    ST.st.remoteErr = '';
    WCL.view.renderSide();
    var xhr = new XMLHttpRequest();
    try {
      xhr.open('GET', WCL.data.siteUrl('/sessions'), true);
      var hdr = WCL.data.reqHeaders(), k;
      for (k in hdr) if (hdr.hasOwnProperty(k)) xhr.setRequestHeader(k, hdr[k]);
    } catch (e) {
      ST.st.remoteLoading = false;
      ST.st.remoteErr = '请求无法发起';
      WCL.view.renderSide();
      return;
    }
    xhr.timeout = ST.cfg.listTimeout;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      ST.st.remoteLoading = false;
      if (xhr.status >= 200 && xhr.status < 300) {
        var d = D().jParse(xhr.responseText || '');
        ST.st.remoteSessions = (d && d.data) || [];
        ST.st.remoteErr = '';
      } else if (xhr.status === 0) {
        ST.st.remoteErr = '网络错误';
      } else {
        ST.st.remoteErr = 'HTTP ' + xhr.status;
      }
      WCL.view.renderSide();
    };
    xhr.ontimeout = function () { ST.st.remoteLoading = false; ST.st.remoteErr = '拉取超时'; WCL.view.renderSide(); };
    xhr.onerror = function () { ST.st.remoteLoading = false; ST.st.remoteErr = '网络错误'; WCL.view.renderSide(); };
    try { xhr.send(); } catch (e5) {
      ST.st.remoteLoading = false; ST.st.remoteErr = '发送失败'; WCL.view.renderSide();
    }
  }

  function pickLimit() {
    var el = D().$('pickLimit');
    var lim = el ? (parseInt(el.value, 10) || 5) : 5;
    if (lim < 1) lim = 1;
    if (lim > 200) lim = 200;
    return lim;
  }

  function findRemote(rid) {
    var list = ST.st.remoteSessions, i;
    for (i = 0; i < list.length; i++) if (list[i].id === rid) return list[i];
    return null;
  }

  function findPinned(rid) {
    var list = ST.stored.sessions, i;
    for (i = 0; i < list.length; i++) if (list[i].pinnedSessionId === rid) return list[i];
    return null;
  }

  function makeRemoteSession(rid, rs, msgs) {
    var s = {
      id: D().uid(),
      title: (rs && rs.title) || '网页版对话',
      messages: [],
      created: D().nowMs(),
      updated: D().nowMs(),
      pinnedSessionId: rid
    };
    for (var j = 0; j < msgs.length; j++) {
      s.messages.push({
        role: msgs[j].role,
        content: msgs[j].content || '',
        reasoning: msgs[j].reasoning || ''
      });
    }
    return s;
  }

  function openRemote(rid) {
    if (!ST.site || !ST.site.caps.remoteSessions) return;
    var exist = findPinned(rid);
    if (exist) {
      ST.stored.activeId = exist.id;
      WCL.data.saveData();
      WCL.chrome.renderAll();
      if (WCL.shell) WCL.shell.closeSide();
      return;
    }
    var rs = findRemote(rid);
    var xhr = new XMLHttpRequest();
    try {
      xhr.open('GET', WCL.data.siteUrl('/sessions/messages') +
        '?id=' + encodeURIComponent(rid) + '&limit=' + pickLimit(), true);
      var hdr = WCL.data.reqHeaders(), k;
      for (k in hdr) if (hdr.hasOwnProperty(k)) xhr.setRequestHeader(k, hdr[k]);
    } catch (e) { D().toast('请求无法发起'); return; }
    xhr.timeout = ST.cfg.listTimeout;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status < 200 || xhr.status >= 300) {
        D().toast('载入失败：HTTP ' + xhr.status);
        return;
      }
      var d = D().jParse(xhr.responseText || '');
      var msgs = (d && d.messages) || [];
      ST.stored.sessions.unshift(makeRemoteSession(rid, rs, msgs));
      ST.stored.activeId = ST.stored.sessions[0].id;
      WCL.data.saveData();
      WCL.chrome.renderAll();
      if (WCL.shell) WCL.shell.closeSide();
      D().toast('已载入 ' + msgs.length + ' 条消息');
    };
    xhr.ontimeout = function () { D().toast('载入超时'); };
    xhr.onerror = function () { D().toast('载入失败：网络错误'); };
    try { xhr.send(); } catch (e6) { D().toast('载入失败'); }
  }

  function healthKind(res, data) {
    if (data && data.kind) return String(data.kind);
    if (data && data.ok === false) return 'blocked';
    if (res && res.status >= 200 && res.status < 300) return 'ok';
    if (res && (res.status === 401 || res.status === 403)) return 'expired';
    return 'no_token';
  }

  function loadHealth() {
    if (!ST.site) return;
    ST.st.healthLoading = true;
    showHealth();
    var xhr = new XMLHttpRequest();
    var fail = function () {
      ST.st.healthLoading = false;
      ST.st.health = { ok: false, kind: 'blocked' };
      showHealth();
    };
    try { xhr.open('GET', WCL.data.siteHealthUrl(), true); }
    catch (e) { fail(); return; }
    xhr.timeout = ST.cfg.healthTimeout;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      ST.st.healthLoading = false;
      var d = D().jParse(xhr.responseText || '') || null;
      var ok = d ? (d.ok === true || d.status === 'ok') : false;
      ST.st.health = { ok: ok, kind: healthKind(xhr, d) };
      showHealth();
    };
    xhr.ontimeout = fail;
    xhr.onerror = fail;
    try { xhr.send(); } catch (e2) { fail(); }
  }

  function healthText() {
    if (ST.st.healthLoading) return '健康检查中…';
    if (!ST.st.health) return '未检查';
    if (ST.st.health.ok) return '正常（' + ST.st.health.kind + '）';
    var map = { no_token: '未配置凭据', expired: '凭据已过期', blocked: '被风控或不可达' };
    return '不可用：' + (map[ST.st.health.kind] || ST.st.health.kind);
  }

  function showHealth() {
    var el = D().$('setHealth');
    if (!el) return;
    el.innerHTML = D().esc(healthText());
    el.style.color = (ST.st.health && ST.st.health.ok) ? 'var(--ok)' : 'var(--danger)';
  }

  function checkHealth() {
    if (!ST.site) return;
    loadHealth();
  }

  WCL.remote = {
    loadRemote: loadRemote, openRemote: openRemote,
    loadHealth: loadHealth, healthText: healthText, showHealth: showHealth,
    checkHealth: checkHealth, healthKind: healthKind
  };
})(typeof window !== 'undefined' ? window : this);
