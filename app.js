/* ============================================================
   DeepSeek 网页版 · 兼容版
   严格 ES5：无 let/const、箭头函数、Promise、fetch、模板字符串。
   请求用 XMLHttpRequest（readyState 3 增量读流），老设备/老 WebView 可跑。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 配置 ---------- */
  var CFG = {
    // 走自建反代（与 lite1 同一个 Worker）
    base: 'https://deepseek-web.yongjiu.ccwu.cc/v1',
    storeKey: 'dsweb-lite.v1'
  };
  // 允许覆盖反代地址：window.DSWEB_BASE = 'https://你自己的反代/v1'
  // 也支持 ?base=... 临时指定（自部署或调试时方便）
  (function () {
    try {
      if (window.DSWEB_BASE) { CFG.base = String(window.DSWEB_BASE); return; }
      var m = (window.location.search || '').match(/[?&]base=([^&]+)/);
      if (m) CFG.base = decodeURIComponent(m[1]);
    } catch (e) {}
  })();

  /* ---------- 小工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function trim(s) { return String(s === null || s === undefined ? '' : s).replace(/^\s+|\s+$/g, ''); }
  function on(el, ev, fn) {
    if (!el) return;
    if (el.addEventListener) el.addEventListener(ev, fn, false);
    else if (el.attachEvent) el.attachEvent('on' + ev, fn);
  }
  function nowMs() { return new Date().getTime(); }
  function uid() { return nowMs().toString(36) + Math.random().toString(36).slice(2, 7); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast'); if (!t) return;
    t.innerHTML = esc(msg);
    t.className = 'toast show';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 2200);
  }

  /* ---------- 存储 ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function jParse(s) {
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  }
  // ES5 下的 JSON.stringify：老设备都有原生，包一层兜底
  function jStr(o) {
    try { return JSON.stringify(o); } catch (e) { return 'null'; }
  }

  /* ---------- 状态 ---------- */
  var sessions = [];
  var activeId = '';
  // 上游（网页版）里已有的会话列表：进入页面就自动拉取并展示，与官方一致
  var remoteSessions = [];
  var remoteLoading = false;
  var remoteErr = '';
  var settings = {
    model: 'deepseek-chat',
    theme: 'dark',
    eink: false,
    search: false,
    think: false,
    incr: false
  };
  var sending = false;
  var xhrCur = null;
  var stopFlag = false;

  function loadAll() {
    var raw = jParse(lsGet(CFG.storeKey));
    if (raw && typeof raw === 'object') {
      sessions = (raw.sessions instanceof Array) ? raw.sessions : [];
      activeId = raw.activeId || '';
      if (raw.settings && typeof raw.settings === 'object') {
        var k;
        for (k in raw.settings) {
          if (raw.settings.hasOwnProperty(k)) settings[k] = raw.settings[k];
        }
      }
    }
    if (!findSession(activeId)) activeId = sessions.length ? sessions[0].id : '';
  }

  function saveAll() {
    lsSet(CFG.storeKey, jStr({
      sessions: sessions, activeId: activeId, settings: settings
    }));
  }

  function findSession(id) {
    var i;
    if (!id) return null;
    for (i = 0; i < sessions.length; i++) {
      if (sessions[i].id === id) return sessions[i];
    }
    return null;
  }
  function curSession() { return findSession(activeId); }

  /* ---------- 主题 ---------- */
  function applyTheme() {
    var cls = [];
    if (settings.theme === 'dark') cls.push('theme-dark');
    if (settings.eink) cls.push('eink');
    document.body.className = cls.join(' ');
  }

  /* ---------- Markdown 精简渲染 ----------
     先整体转义再按行处理，避免注入。支持：
     代码块 / 行内代码 / 粗体 / 斜体 / 标题 / 列表 / 引用 / 链接 / 表格略 */
  function md(src) {
    var s = String(src || '');
    if (!s) return '';

    // 1) 抽出围栏代码块，避免后续规则破坏
    var blocks = [];
    s = s.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g, function (all, lang, code) {
      blocks.push('<pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>');
      return '\u0001B' + (blocks.length - 1) + '\u0001';
    });

    // 2) 整体转义
    s = esc(s);

    // 3) 行内代码（先占位，避免里面内容被格式化）
    var inl = [];
    s = s.replace(/`([^`\n]+)`/g, function (all, code) {
      inl.push('<code>' + code + '</code>');
      return '\u0001I' + (inl.length - 1) + '\u0001';
    });

    // 4) 粗体 / 斜体
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

    // 5) 链接
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // 6) 按行组装段落 / 标题 / 列表 / 引用
    var lines = s.split('\n');
    var out = [];
    var inUl = false, inOl = false, para = [];

    function flushPara() {
      if (!para.length) return;
      out.push('<p>' + para.join('<br>') + '</p>');
      para = [];
    }
    function closeLists() {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    }

    var i, ln, m;
    for (i = 0; i < lines.length; i++) {
      ln = lines[i];

      if (/^\u0001B\d+\u0001$/.test(trim(ln))) {
        flushPara(); closeLists();
        out.push(ln);
        continue;
      }
      if (!trim(ln)) { flushPara(); closeLists(); continue; }

      m = ln.match(/^(#{1,3})\s+(.*)$/);
      if (m) {
        flushPara(); closeLists();
        out.push('<h' + m[1].length + '>' + m[2] + '</h' + m[1].length + '>');
        continue;
      }
      if (/^&gt;\s?/.test(ln)) {
        flushPara(); closeLists();
        out.push('<blockquote>' + ln.replace(/^&gt;\s?/, '') + '</blockquote>');
        continue;
      }
      m = ln.match(/^\s*[-*]\s+(.*)$/);
      if (m) {
        flushPara();
        if (!inUl) { closeLists(); out.push('<ul>'); inUl = true; }
        out.push('<li>' + m[1] + '</li>');
        continue;
      }
      m = ln.match(/^\s*\d+[.)]\s+(.*)$/);
      if (m) {
        flushPara();
        if (!inOl) { closeLists(); out.push('<ol>'); inOl = true; }
        out.push('<li>' + m[1] + '</li>');
        continue;
      }
      closeLists();
      para.push(ln);
    }
    flushPara(); closeLists();
    s = out.join('');

    // 7) 放回行内代码与代码块
    s = s.replace(/\u0001I(\d+)\u0001/g, function (all, n) {
      return inl[parseInt(n, 10)] || '';
    });
    s = s.replace(/\u0001B(\d+)\u0001/g, function (all, n) {
      return blocks[parseInt(n, 10)] || '';
    });
    return s;
  }

  /* ---------- 渲染 ---------- */
  function renderSide() {
    var box = $('sessList'); if (!box) return;
    var h = '', i;

    // ===== 本地对话 =====
    h += '<div class="grp">本机对话</div>';
    if (!sessions.length) {
      h += '<div class="grp-empty">还没有本机对话</div>';
    } else {
      for (i = 0; i < sessions.length; i++) {
        var sc = sessions[i];
        h += '<div class="sess' + (sc.id === activeId ? ' on' : '') + '" data-id="' + esc(sc.id) + '">' +
             esc(sc.title || '新对话') + '</div>';
      }
    }

    // ===== 网页版已有对话（进入页面自动加载，与官方一致）=====
    h += '<div class="grp">网页版对话';
    if (remoteLoading) h += '<span class="grp-tag">加载中…</span>';
    else if (remoteErr) h += '<span class="grp-tag grp-err">读取失败</span>';
    else h += '<span class="grp-tag">' + remoteSessions.length + '</span>';
    h += '</div>';

    if (remoteErr) {
      h += '<div class="grp-empty">' + esc(remoteErr) + ' <a href="#" id="remoteRetry">重试</a></div>';
    } else if (!remoteLoading && !remoteSessions.length) {
      h += '<div class="grp-empty">网页版里还没有对话</div>';
    } else {
      for (i = 0; i < remoteSessions.length; i++) {
        var rs = remoteSessions[i];
        var mark = rs.tagged ? '<span class="rm-tag">固定</span>' : '';
        h += '<div class="sess rm" data-rid="' + esc(rs.id) + '">' + mark +
             esc(rs.title || '(无标题)') + '</div>';
      }
    }

    box.innerHTML = h;

    var els = box.getElementsByTagName('div'), k;
    for (k = 0; k < els.length; k++) {
      (function (el) {
        var id = el.getAttribute && el.getAttribute('data-id');
        var rid = el.getAttribute && el.getAttribute('data-rid');
        if (id) {
          on(el, 'click', function () { activeId = id; saveAll(); renderAll(); closeSide(); });
        } else if (rid) {
          on(el, 'click', function () { openRemote(rid); });
        }
      })(els[k]);
    }
    var rb = $('remoteRetry');
    if (rb) on(rb, 'click', function (e) { e.preventDefault(); loadRemote(); });
  }

  // 拉取网页版已有对话（进入页面自动调用）
  function loadRemote() {
    if (remoteLoading) return;
    remoteLoading = true; remoteErr = '';
    renderSide();

    var x = new XMLHttpRequest();
    x.timeout = 30000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      remoteLoading = false;
      if (x.status >= 200 && x.status < 300) {
        var d = jParse(x.responseText || '');
        remoteSessions = (d && d.data) || [];
        remoteErr = '';
      } else if (x.status === 0) {
        remoteErr = '网络错误';
      } else {
        remoteErr = 'HTTP ' + x.status;
      }
      renderSide();
    };
    x.onerror = function () { remoteLoading = false; remoteErr = '网络错误'; renderSide(); };
    x.ontimeout = function () { remoteLoading = false; remoteErr = '超时'; renderSide(); };
    try {
      x.open('GET', CFG.base + '/sessions', true);
      x.send();
    } catch (e) {
      remoteLoading = false; remoteErr = '无法连接'; renderSide();
    }
  }

  // 打开某个网页版对话：拉它的历史消息，转成本地对话展示
  function openRemote(sid) {
    var rs = null, i;
    for (i = 0; i < remoteSessions.length; i++) {
      if (remoteSessions[i].id === sid) { rs = remoteSessions[i]; break; }
    }
    // 已经导入过就复用，避免重复拉取
    for (i = 0; i < sessions.length; i++) {
      if (sessions[i].pinnedSessionId === sid) {
        activeId = sessions[i].id; saveAll(); renderAll(); closeSide();
        return;
      }
    }
    var sc = {
      id: uid(), title: (rs && rs.title) || '网页版对话',
      messages: [], created: nowMs(), updated: nowMs(),
      pinnedSessionId: sid
    };
    sessions.unshift(sc);
    activeId = sc.id;
    saveAll(); renderAll(); closeSide();

    toast('正在读取对话…');
    var x = new XMLHttpRequest();
    x.timeout = 40000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status >= 200 && x.status < 300) {
        var d = jParse(x.responseText || '');
        var ms = (d && d.messages) || [];
        var k;
        for (k = 0; k < ms.length; k++) {
          sc.messages.push({
            role: ms[k].role, content: ms[k].content,
            reasoning: ms[k].reasoning || '', _imported: true
          });
        }
        sc.updated = nowMs();
        saveAll(); renderAll();
        toast('已载入 ' + ms.length + ' 条');
      } else {
        toast('读取失败');
      }
    };
    try {
      // 首屏给出足够上下文，默认取最近 40 条（上限 20 由后端限制，这里传 20）
      x.open('GET', CFG.base + '/sessions/messages?id=' + encodeURIComponent(sid) + '&limit=200', true);
      x.send();
    } catch (e) { toast('读取失败'); }
  }

  function thinkHtml(txt, streaming, key) {
    var n = String(txt || '').length;
    var label = streaming ? ('思考中…（' + n + ' 字）') : ('已深度思考（' + n + ' 字）');
    return '<details class="think" data-key="' + esc(key) + '"' + (streaming ? ' open' : '') + '>' +
      '<summary>' + esc(label) + '</summary>' +
      '<div class="tb">' + esc(txt) + '</div></details>';
  }

  function renderChat() {
    var box = $('chat'); if (!box) return;
    var s = curSession();

    if (!s || !s.messages.length) {
      box.innerHTML =
        '<div class="welcome">' +
          '<div class="logo">D</div>' +
          '<h1>我是 DeepSeek，很高兴见到你！</h1>' +
          '<p>可以问我任何问题，或直接粘贴文字让我帮你处理</p>' +
          '<div class="cards">' +
            '<button class="card" data-q="帮我写一段产品介绍"><span class="t">✎ 帮我写点东西</span><span class="d">文案、邮件、总结</span></button>' +
            '<button class="card" data-q="用通俗的话解释一下量子纠缠"><span class="t">◎ 解释一个概念</span><span class="d">通俗易懂地讲清楚</span></button>' +
            '<button class="card" data-q="帮我看看这段代码有什么问题"><span class="t">〈〉 看看代码</span><span class="d">找问题、给建议</span></button>' +
          '</div>' +
        '</div>';
      bindWelcome();
      return;
    }

    var h = '', i, m;
    for (i = 0; i < s.messages.length; i++) {
      m = s.messages[i];
      if (m.role === 'system') continue;

      if (m.role === 'user') {
        h += '<div class="wrap"><div class="msg user"><div class="body"><div class="md">' +
             md(m.content || '') + '</div></div></div></div>';
        continue;
      }

      h += '<div class="wrap"><div class="msg assistant">' +
           '<div class="avatar">D</div><div class="body">';
      if (m.reasoning) h += thinkHtml(m.reasoning, false, 'r' + i);
      h += '<div class="md' + (m._err ? '" style="color:var(--danger)' : '') + '">' +
           md(m.content || (m._streaming ? '' : '')) + '</div>';
      h += '<div class="acts">' +
           '<button data-act="copy" data-i="' + i + '">复制</button>' +
           (m._streaming ? '' : '<button data-act="retry" data-i="' + i + '">重新生成</button>') +
           '<button data-act="del" data-i="' + i + '">删除</button>' +
           '</div>';
      h += '</div></div></div>';
    }
    box.innerHTML = h;
    restoreThink();
    bindActs();
    scrollBottom();
  }

  // 记住思考块展开状态（整表重建后回填）
  var thinkOpen = {};
  function restoreThink() {
    var box = $('chat'); if (!box) return;
    var ds = box.getElementsByTagName('details'), i;
    for (i = 0; i < ds.length; i++) {
      (function (d) {
        var k = d.getAttribute && d.getAttribute('data-key');
        if (!k) return;
        if (thinkOpen[k] === true) d.open = true;
        on(d, 'toggle', function () { thinkOpen[k] = d.open; });
      })(ds[i]);
    }
  }
  function snapshotThink() {
    var box = $('chat'); if (!box) return;
    var ds = box.getElementsByTagName('details'), i;
    for (i = 0; i < ds.length; i++) {
      var k = ds[i].getAttribute && ds[i].getAttribute('data-key');
      if (k) thinkOpen[k] = ds[i].open;
    }
  }

  function bindWelcome() {
    var box = $('chat'); if (!box) return;
    var cs = box.getElementsByTagName('button'), i;
    for (i = 0; i < cs.length; i++) {
      (function (b) {
        var q = b.getAttribute && b.getAttribute('data-q');
        if (!q) return;
        on(b, 'click', function () {
          var inp = $('input');
          if (inp) { inp.value = q; inp.focus(); }
        });
      })(cs[i]);
    }
  }

  function bindActs() {
    var box = $('chat'); if (!box) return;
    var bs = box.getElementsByTagName('button'), i;
    for (i = 0; i < bs.length; i++) {
      (function (b) {
        var act = b.getAttribute && b.getAttribute('data-act');
        if (!act) return;
        var idx = parseInt(b.getAttribute('data-i'), 10);
        on(b, 'click', function () { msgAct(act, idx); });
      })(bs[i]);
    }
  }

  function msgAct(act, i) {
    var s = curSession(); if (!s || !s.messages[i]) return;
    var m = s.messages[i];

    if (act === 'copy') { copyText(m.content || ''); return; }
    if (act === 'del') {
      s.messages.splice(i, 1); saveAll(); renderAll(); return;
    }
    if (act === 'retry') {
      s.messages = s.messages.slice(0, i);
      saveAll(); renderAll(); runChat();
    }
  }

  function copyText(t) {
    t = String(t || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { navigator.clipboard.writeText(t); toast('已复制'); return; } catch (e) {}
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('已复制');
    } catch (e) { toast('复制失败，请长按选择'); }
  }

  function scrollBottom() {
    var box = $('chat'); if (!box) return;
    try { box.scrollTop = box.scrollHeight; } catch (e) {}
  }

  function renderAll() {
    renderSide(); renderChat(); renderChips(); renderTitle();
  }

  function renderTitle() {
    var s = curSession(), t = $('chatTitle');
    if (t) t.innerHTML = esc(s ? (s.title || '新对话') : '新对话');
  }

  function renderChips() {
    var c1 = $('chipSearch'), c2 = $('chipThink'), c3 = $('chipInc');
    if (c1) { c1.className = 'chip' + (settings.search ? ' on' : ''); c1.innerHTML = '联网搜索'; }
    if (c2) { c2.className = 'chip' + (settings.think ? ' on' : ''); c2.innerHTML = '深度思考'; }
    if (c3) { c3.className = 'chip' + (settings.incr ? ' on' : ''); c3.innerHTML = '增量模式'; }
  }

  /* ---------- 会话操作 ---------- */
  function newSession() {
    var s = { id: uid(), title: '新对话', messages: [], created: nowMs(), updated: nowMs() };
    sessions.unshift(s);
    activeId = s.id;
    saveAll(); renderAll();
    closeSide();
    var inp = $('input'); if (inp) inp.focus();
  }

  function delActive() {
    var s = curSession(); if (!s) return;
    if (!confirm('删除这个对话？只存在本机，删除后无法恢复。')) return;
    var out = [], i;
    for (i = 0; i < sessions.length; i++) {
      if (sessions[i].id !== s.id) out.push(sessions[i]);
    }
    sessions = out;
    activeId = sessions.length ? sessions[0].id : '';
    saveAll(); renderAll();
  }

  /* ---------- 发送 ---------- */
  function setSending(onOff) {
    sending = onOff;
    var b = $('btnSend'), st = $('btnStop');
    if (b) { b.disabled = onOff; }
    if (st) { st.style.display = onOff ? '' : 'none'; }
    if (b) { b.style.display = onOff ? 'none' : ''; }
  }

  function buildBody(model, msgs) {
    var body = {
      model: model,
      messages: msgs,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true
    };
    if (settings.search) body.search_enabled = true;
    if (settings.incr) body.incremental = true;
    body.conversation_scope = scopeId();
    var s = curSession();
    if (s && s.pinnedSessionId) body.pinned_session_id = s.pinnedSessionId;
    return jStr(body);
  }

  function scopeId() {
    var v = lsGet('dsweb-lite.scope');
    if (!v) {
      v = 's' + nowMs().toString(36) + Math.random().toString(36).slice(2, 7);
      lsSet('dsweb-lite.scope', v);
    }
    return v;
  }

  function contextMsgs(s) {
    var out = [], i, m;
    for (i = 0; i < s.messages.length; i++) {
      m = s.messages[i];
      if (m._err) continue;
      if (m.role === 'system') continue;
      if (m._streaming) continue;
      out.push({ role: m.role, content: String(m.content || '') });
    }
    return out;
  }

  function runChat() {
    var s = curSession();
    if (!s) { newSession(); s = curSession(); }
    if (sending) return;

    var lastUser = null, i;
    for (i = s.messages.length - 1; i >= 0; i--) {
      if (s.messages[i].role === 'user') { lastUser = s.messages[i]; break; }
    }
    if (!lastUser) { toast('没有可发送的内容'); return; }

    var msgs = contextMsgs(s);
    var slot = { role: 'assistant', content: '', reasoning: '', _streaming: true };
    s.messages.push(slot);
    s.updated = nowMs();
    if (!s.title || s.title === '新对话') {
      s.title = String(lastUser.content || '').slice(0, 20) || '新对话';
    }
    setSending(true);
    saveAll(); renderAll();
    streamReq(s, slot, msgs);
  }

  var lastPaint = 0;

  function streamReq(s, slot, msgs) {
    var x = new XMLHttpRequest();
    xhrCur = x;
    stopFlag = false;
    x.timeout = 180000;

    var seen = 0, buf = '', full = '', reasoning = '', gotSse = false;

    function paint() {
      slot.content = full;
      slot.reasoning = reasoning;

      var t = nowMs();
      if (t - lastPaint < 120) return;
      lastPaint = t;

      // 只更新最后一条消息，避免整表重绘（老设备性能）
      var box = $('chat'); if (!box) return;
      var wraps = box.getElementsByTagName('div');
      var bodyEl = null, i;
      // 取最后一个 .msg.assistant 的 .md
      var mds = box.getElementsByTagName('div');
      for (i = 0; i < mds.length; i++) {
        if (mds[i].className && mds[i].className.indexOf('md') === 0) bodyEl = mds[i];
      }
      if (bodyEl) bodyEl.innerHTML = md(full);

      // 思考块：边流边刷，不碰 open 状态
      var ds = box.getElementsByTagName('details');
      var te = null;
      for (i = 0; i < ds.length; i++) {
        if (ds[i].className && ds[i].className.indexOf('think') === 0) te = ds[i];
      }
      if (reasoning) {
        if (!te) {
          var tmp = document.createElement('div');
          tmp.innerHTML = thinkHtml(reasoning, true, 'stream');
          var node = tmp.firstChild;
          var target = bodyEl && bodyEl.parentNode ? bodyEl.parentNode : null;
          if (target) target.insertBefore(node, bodyEl);
          else box.appendChild(node);
          te = node;
        } else {
          var tb = te.getElementsByTagName('div');
          if (tb.length && tb[0].className === 'tb') tb[0].innerHTML = esc(reasoning);
          var sm = te.getElementsByTagName('summary');
          if (sm.length) sm[0].innerHTML = '思考中…（' + reasoning.length + ' 字）';
        }
      }
      scrollBottom();
    }

    function line(ln) {
      var t = trim(ln);
      if (t.indexOf('data:') !== 0) return;
      var d = trim(t.slice(5));
      if (!d || d === '[DONE]') return;
      var j = jParse(d);
      if (!j) return;
      var c = j.choices && j.choices[0];
      if (!c) return;
      var dl = c.delta || {};
      if (dl.reasoning_content) reasoning += dl.reasoning_content;
      if (dl.content) full += dl.content;
      gotSse = true;
    }

    function drain(final) {
      var t = x.responseText || '';
      if (t.length > seen) {
        buf += t.substring(seen);
        seen = t.length;
        var lines = buf.split('\n');
        buf = final ? '' : (lines.pop() || '');
        var i;
        for (i = 0; i < lines.length; i++) line(lines[i]);
        if (final && buf) line(buf);
      }
      paint();
    }

    function finish(errMsg) {
      slot._streaming = false;
      if (errMsg) { slot._err = true; slot.content = String(errMsg); }
      s.updated = nowMs();
      sending = false; xhrCur = null;
      setSending(false);
      saveAll();
      snapshotThink();
      renderAll();
    }

    x.onreadystatechange = function () {
      if (x.readyState === 3) { drain(false); return; }
      if (x.readyState !== 4) return;

      if (stopFlag) { finish(null); return; }

      if (x.status >= 200 && x.status < 300) {
        drain(true);
        if (!gotSse) {
          var d = jParse(x.responseText || '');
          var c = d && d.choices && d.choices[0];
          if (c) {
            var m = c.message || {};
            full = m.content || '';
            reasoning = m.reasoning_content || '';
          }
          slot.content = full; slot.reasoning = reasoning;
        }
        if (!trim(full) && !trim(reasoning)) {
          finish('返回为空，请重试');
          return;
        }
        slot.reasoning = reasoning;
        finish(null);
      } else if (x.status === 0) {
        finish('网络错误或跨域被拦截');
      } else {
        finish('HTTP ' + x.status + '：' + String(x.responseText || '').slice(0, 200));
      }
    };

    x.ontimeout = function () { finish('请求超时（180 秒）'); };
    x.onerror = function () { finish('网络错误'); };

    try {
      x.open('POST', CFG.base + '/chat/completions', true);
      x.setRequestHeader('Content-Type', 'application/json');
      try { x.setRequestHeader('Accept', 'text/event-stream'); } catch (e) {}
      x.send(buildBody(settings.model, msgs));
    } catch (e) {
      finish('请求异常：' + (e && e.message ? e.message : e));
    }
  }

  function sendMessage() {
    if (sending) return;
    var ta = $('input');
    var txt = trim(ta ? ta.value : '');
    if (!txt) return;
    var s = curSession();
    if (!s) { newSession(); s = curSession(); }
    s.messages.push({ role: 'user', content: txt });
    if (ta) ta.value = '';
    autoGrow();
    saveAll();
    runChat();
  }

  function autoGrow() {
    var ta = $('input'); if (!ta) return;
    ta.style.height = 'auto';
    var h = ta.scrollHeight;
    if (h > 200) h = 200;
    ta.style.height = h + 'px';
  }

  /* ---------- 选择已有对话（复用反代会话列表） ---------- */
  function openPick() {
    var m = $('pickMask'); if (!m) return;
    m.className = 'mask open';
    var body = $('pickBody');
    if (body) body.innerHTML = '<div style="padding:12px;font-size:13px;color:var(--fg-faint)">正在读取…</div>';

    var x = new XMLHttpRequest();
    x.timeout = 30000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status >= 200 && x.status < 300) {
        var d = jParse(x.responseText || '');
        var list = (d && d.data) || [];
        renderPick(list);
      } else {
        if (body) body.innerHTML = '<div style="padding:12px">读取失败：HTTP ' + x.status + '</div>';
      }
    };
    x.onerror = function () {
      if (body) body.innerHTML = '<div style="padding:12px">读取失败：网络错误</div>';
    };
    try {
      x.open('GET', CFG.base + '/sessions', true);
      x.send();
    } catch (e) {
      if (body) body.innerHTML = '<div style="padding:12px">读取失败</div>';
    }
  }

  var pickData = [];
  function renderPick(list) {
    pickData = list || [];
    var body = $('pickBody'); if (!body) return;
    if (!pickData.length) {
      body.innerHTML = '<div style="padding:12px;font-size:13px">网页版里还没有对话</div>';
      return;
    }
    var h = '', i, it;
    for (i = 0; i < pickData.length; i++) {
      it = pickData[i];
      h += '<button class="ditem" data-sid="' + esc(it.id) + '">' +
           '<span class="dt">' + esc(it.title || '(无标题)') + (it.tagged ? ' · 固定' : '') + '</span>' +
           '<span class="dd">导入它的最近几条作为上下文</span></button>';
    }
    body.innerHTML = h;
    var bs = body.getElementsByTagName('button'), k;
    for (k = 0; k < bs.length; k++) {
      (function (b) {
        var sid = b.getAttribute && b.getAttribute('data-sid');
        if (!sid) return;
        on(b, 'click', function () { bindPick(sid); });
      })(bs[k]);
    }
  }

  function bindPick(sid) {
    var it = null, i;
    for (i = 0; i < pickData.length; i++) {
      if (pickData[i].id === sid) { it = pickData[i]; break; }
    }
    var lim = parseInt(($('pickLimit') || {}).value, 10);
    if (isNaN(lim) || lim < 0) lim = 5;
    if (lim > 20) lim = 20;

    var s = {
      id: uid(), title: (it && it.title) || '固定对话',
      messages: [], created: nowMs(), updated: nowMs(),
      pinnedSessionId: sid
    };
    sessions.unshift(s);
    activeId = s.id;
    saveAll();
    closeMask('pickMask');

    if (lim <= 0) { renderAll(); toast('已绑定（不导入历史）'); return; }

    var x = new XMLHttpRequest();
    x.timeout = 40000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status >= 200 && x.status < 300) {
        var d = jParse(x.responseText || '');
        var ms = (d && d.messages) || [];
        var k;
        for (k = 0; k < ms.length; k++) {
          s.messages.push({
            role: ms[k].role, content: ms[k].content,
            reasoning: ms[k].reasoning || '', _imported: true
          });
        }
        toast('已导入 ' + s.messages.length + ' 条');
      } else {
        toast('已绑定，但导入失败');
      }
      s.updated = nowMs();
      saveAll(); renderAll();
    };
    x.onerror = function () { saveAll(); renderAll(); toast('已绑定，导入失败'); };
    try {
      x.open('GET', CFG.base + '/sessions/messages?id=' + encodeURIComponent(sid) + '&limit=' + lim, true);
      x.send();
    } catch (e) { renderAll(); }
  }

  /* ---------- 设置面板 ---------- */
  function openSet() {
    var m = $('setMask'); if (!m) return;
    m.className = 'mask open';
    var body = $('setBody'); if (!body) return;

    var models = [
      { id: 'deepseek-chat', name: 'DeepSeek-V3' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1（深度思考）' }
    ];
    var h = '<div style="font-size:13px;color:var(--fg-faint);padding:6px 12px">模型</div>';
    var i;
    for (i = 0; i < models.length; i++) {
      var on_ = settings.model === models[i].id;
      h += '<button class="ditem" data-model="' + esc(models[i].id) + '">' +
           '<span class="dt">' + esc(models[i].name) + (on_ ? ' · 当前' : '') + '</span></button>';
    }
    body.innerHTML = h;

    var bs = body.getElementsByTagName('button'), k;
    for (k = 0; k < bs.length; k++) {
      (function (b) {
        var mid = b.getAttribute && b.getAttribute('data-model');
        if (!mid) return;
        on(b, 'click', function () {
          settings.model = mid;
          if (mid === 'deepseek-reasoner') settings.think = true;
          saveAll(); renderChips(); openSet(); toast('已切换到 ' + mid);
        });
      })(bs[k]);
    }
  }

  function closeMask(id) {
    var m = $(id); if (m) m.className = 'mask';
  }

  /* ---------- 侧栏（移动端） ---------- */
  function openSide() { var s = $('side'); if (s) s.className = 'side open'; }
  function closeSide() { var s = $('side'); if (s) s.className = 'side'; }

  /* ---------- 绑定 ---------- */
  function bindAll() {
    on($('btnNew'), 'click', newSession);
    on($('btnSend'), 'click', sendMessage);
    on($('btnStop'), 'click', function () {
      stopFlag = true;
      if (xhrCur) { try { xhrCur.abort(); } catch (e) {} }
    });

    on($('input'), 'keydown', function (e) {
      e = e || window.event;
      var k = e.keyCode || e.which;
      if (k === 13 && !e.shiftKey) {
        if (e.preventDefault) e.preventDefault();
        sendMessage();
      }
    });
    on($('input'), 'input', autoGrow);

    on($('chipSearch'), 'click', function () {
      settings.search = !settings.search; saveAll(); renderChips();
    });
    on($('chipThink'), 'click', function () {
      settings.think = !settings.think;
      settings.model = settings.think ? 'deepseek-reasoner' : 'deepseek-chat';
      saveAll(); renderChips();
      toast(settings.think ? '已开启深度思考' : '已关闭深度思考');
    });
    on($('chipInc'), 'click', function () {
      settings.incr = !settings.incr; saveAll(); renderChips();
      toast(settings.incr ? '增量模式已开启' : '增量模式已关闭');
    });

    on($('btnMenu'), 'click', openSide);
    on($('btnModel'), 'click', openSet);
    on($('setClose'), 'click', function () { closeMask('setMask'); });

    on($('lnkPick'), 'click', function (e) { if (e.preventDefault) e.preventDefault(); openPick(); });
    on($('pickCancel'), 'click', function () { closeMask('pickMask'); });

    on($('lnkTheme'), 'click', function (e) {
      if (e.preventDefault) e.preventDefault();
      settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
      saveAll(); applyTheme();
    });
    on($('lnkEink'), 'click', function (e) {
      if (e.preventDefault) e.preventDefault();
      settings.eink = !settings.eink;
      saveAll(); applyTheme();
      toast(settings.eink ? '已开启电子墨水屏模式' : '已关闭');
    });
    on($('lnkExport'), 'click', function (e) {
      if (e.preventDefault) e.preventDefault();
      var s = curSession();
      if (!s || !s.messages.length) { toast('当前对话是空的'); return; }
      var out = '# ' + (s.title || '对话') + '\n\n', i;
      for (i = 0; i < s.messages.length; i++) {
        var m = s.messages[i];
        if (m.role === 'system') continue;
        out += (m.role === 'user' ? '## 你' : '## AI') + '\n\n' + (m.content || '') + '\n\n';
      }
      copyText(out);
      toast('已复制 Markdown 到剪贴板');
    });
    on($('lnkClear'), 'click', function (e) {
      if (e.preventDefault) e.preventDefault();
      if (!confirm('清空全部对话与设置？此操作不可恢复。')) return;
      lsDel(CFG.storeKey); lsDel('dsweb-lite.scope');
      sessions = []; activeId = '';
      loadAll(); applyTheme(); renderAll();
      toast('已清空');
    });

    // 点遮罩关闭
    on($('pickMask'), 'click', function (e) {
      e = e || window.event;
      var t = e.target || e.srcElement;
      if (t && t.id === 'pickMask') closeMask('pickMask');
    });
    on($('setMask'), 'click', function (e) {
      e = e || window.event;
      var t = e.target || e.srcElement;
      if (t && t.id === 'setMask') closeMask('setMask');
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    loadAll();
    applyTheme();
    bindAll();
    if (!sessions.length) {
      var s = { id: uid(), title: '新对话', messages: [], created: nowMs(), updated: nowMs() };
      sessions.push(s); activeId = s.id;
      saveAll();
    }
    renderAll();
    autoGrow();
    // 进入页面即拉取网页版已有对话，与官方一致（不需要额外的 token）
    loadRemote();
  }

  if (document.readyState === 'loading') {
    on(document, 'DOMContentLoaded', init);
  } else {
    init();
  }
})();
