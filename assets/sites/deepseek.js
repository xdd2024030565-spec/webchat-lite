/* 站点清单：DeepSeek（网页版反代，含会话列表与思考） */
(function (root) {
  'use strict';
  root.WCL_SITE_DEFS = root.WCL_SITE_DEFS || [];
  root.WCL_SITE_DEFS.push({
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: '/deepseek/v1',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1（深度思考）' }
    ],
    caps: { search: true, think: true, incr: true, pin: true, remoteSessions: true },
    copy: {
      newChat: '开启新对话',
      placeholder: '给 DeepSeek 发送消息',
      welcomeTitle: '我是 DeepSeek，很高兴见到你！',
      welcomeSub: '可以问我任何问题，或直接粘贴文字让我帮你处理',
      thinkLabel: '思考中… / 已深度思考',
      hint: '内容由 AI 生成，请仔细甄别',
      avatar: 'D',
      cards: [
        { q: '帮我写一段简洁的自我介绍，100 字以内', t: '帮我写点东西', d: '文案、邮件、总结' },
        { q: '用通俗的话解释一下什么是向量数据库', t: '解释一个概念', d: '通俗易懂地讲清楚' },
        { q: '帮我看看这段代码有什么问题：\n', t: '看看代码', d: '找问题、给建议' }
      ]
    }
  });
})(typeof window !== 'undefined' ? window : this);
