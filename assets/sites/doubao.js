/* 站点清单：豆包（网页版反代；暂无会话列表/思考/联网能力） */
(function (root) {
  'use strict';
  root.WCL_SITE_DEFS = root.WCL_SITE_DEFS || [];
  root.WCL_SITE_DEFS.push({
    id: 'doubao',
    name: '豆包',
    endpoint: '/doubao/v1',
    models: [{ id: 'doubao-chat', name: '豆包' }],
    caps: { search: false, think: false, incr: false, pin: false, remoteSessions: false },
    copy: {
      newChat: '开启新对话',
      placeholder: '给豆包发送消息',
      welcomeTitle: '我是豆包，很高兴见到你！',
      welcomeSub: '有什么想聊的，直接说吧',
      thinkLabel: '思考中… / 已深度思考',
      hint: '内容由 AI 生成，请仔细甄别',
      avatar: '豆',
      cards: [
        { q: '帮我写一条朋友圈文案，语气轻松一点', t: '写点文案', d: '朋友圈、邮件、总结' },
        { q: '用最简单的话解释一下什么是大模型', t: '解释一下', d: '通俗易懂地讲清楚' },
        { q: '今天有点累，陪我聊两句', t: '陪我聊聊', d: '随便聊聊也行' }
      ]
    }
  });
})(typeof window !== 'undefined' ? window : this);
