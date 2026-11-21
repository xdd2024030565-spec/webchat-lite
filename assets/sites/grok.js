/* 站点清单：Grok（grok.com 网页版反代；只做纯对话） */
(function (root) {
  'use strict';
  root.WCL_SITE_DEFS = root.WCL_SITE_DEFS || [];
  root.WCL_SITE_DEFS.push({
    id: 'grok',
    name: 'Grok',
    endpoint: '/grok/v1',
    models: [
      { id: 'grok-3', name: 'Grok 3' },
      { id: 'grok-4-1-thinking-1129', name: 'Grok 4.1 思考' }
    ],
    caps: { search: false, think: false, incr: false, pin: false, remoteSessions: true },
    copy: {
      newChat: '开启新对话',
      placeholder: '给 Grok 发送消息',
      welcomeTitle: '我是 Grok，有什么想问的？',
      welcomeSub: '想到什么就说什么，不用客气',
      thinkLabel: '思考中… / 已深度思考',
      hint: '内容由 AI 生成，请仔细甄别',
      avatar: 'G',
      cards: [
        { q: '最近有什么值得关注的科技新闻？', t: '看看新闻', d: '聊点时下的事' },
        { q: '帮我解释一下量子纠缠，别太学术', t: '解释一下', d: '通俗易懂地讲清楚' },
        { q: '给我出个脑筋急转弯', t: '出个题', d: '换换脑子' }
      ]
    }
  });
})(typeof window !== 'undefined' ? window : this);
