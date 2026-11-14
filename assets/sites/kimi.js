/* 站点清单：Kimi（kimi.moonshot.cn 网页版反代；只做纯对话） */
(function (root) {
  'use strict';
  root.WCL_SITE_DEFS = root.WCL_SITE_DEFS || [];
  root.WCL_SITE_DEFS.push({
    id: 'kimi',
    name: 'Kimi',
    endpoint: '/kimi/v1',
    models: [{ id: 'kimi', name: 'Kimi' }],
    caps: { search: false, think: false, incr: false, pin: false, remoteSessions: false },
    copy: {
      newChat: '开启新对话',
      placeholder: '给 Kimi 发送消息',
      welcomeTitle: '我是 Kimi，随便问点什么吧',
      welcomeSub: '长文本、看材料、整理信息都可以',
      thinkLabel: '思考中… / 已深度思考',
      hint: '内容由 AI 生成，请仔细甄别',
      avatar: 'K',
      cards: [
        { q: '帮我把这份材料提炼成五条要点', t: '提炼要点', d: '长文变短' },
        { q: '这段代码在做什么？有没有隐患', t: '看看代码', d: '找问题、给建议' },
        { q: '帮我写一封请假邮件，语气自然一点', t: '写封邮件', d: '直接可用' }
      ]
    }
  });
})(typeof window !== 'undefined' ? window : this);
