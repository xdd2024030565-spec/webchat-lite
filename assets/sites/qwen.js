/* 站点清单：通义千问（chat.qwen.ai 网页版反代；只做纯对话） */
(function (root) {
  'use strict';
  root.WCL_SITE_DEFS = root.WCL_SITE_DEFS || [];
  root.WCL_SITE_DEFS.push({
    id: 'qwen',
    name: '通义千问',
    endpoint: '/qwen/v1',
    models: [
      { id: 'qwen3.7-max', name: 'Qwen3.7 Max' },
      { id: 'qwen3.7-plus', name: 'Qwen3.7 Plus' }
    ],
    caps: { search: false, think: false, incr: false, pin: false, remoteSessions: false },
    copy: {
      newChat: '开启新对话',
      placeholder: '给通义千问发送消息',
      welcomeTitle: '我是通义千问，有什么可以帮你？',
      welcomeSub: '写东西、查资料、理思路都行',
      thinkLabel: '思考中… / 已深度思考',
      hint: '内容由 AI 生成，请仔细甄别',
      avatar: '通',
      cards: [
        { q: '帮我把这段话改得更通顺，保留原意', t: '改一段话', d: '顺一顺表达' },
        { q: '用大白话解释一下什么是向量数据库', t: '解释概念', d: '通俗易懂地讲清楚' },
        { q: '给我一份周末两天的城市散步路线', t: '出个计划', d: '路线与时间安排' }
      ]
    }
  });
})(typeof window !== 'undefined' ? window : this);
