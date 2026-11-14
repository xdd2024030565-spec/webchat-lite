/* 站点清单：智谱清言（chatglm.cn 网页版反代；只做纯对话） */
(function (root) {
  'use strict';
  root.WCL_SITE_DEFS = root.WCL_SITE_DEFS || [];
  root.WCL_SITE_DEFS.push({
    id: 'glm',
    name: '智谱清言',
    endpoint: '/glm/v1',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus' },
      { id: 'glm-4-think', name: 'GLM-4 思考' }
    ],
    caps: { search: false, think: true, incr: false, remoteSessions: false, pin: false },
    copy: {
      avatar: '智',
      placeholder: '给智谱清言发送消息',
      welcomeTitle: '我是智谱清言，今天想聊点什么？',
      welcomeSub: '写东西、查资料、讲清楚一个概念，都可以',
      cards: [
        { t: '帮我写一段介绍', d: '公众号、产品页、自我介绍', q: '帮我写一段 200 字左右的自我介绍' },
        { t: '解释一个概念', d: '用大白话讲明白', q: '用大白话解释一下什么是向量数据库' },
        { t: '整理一段材料', d: '总结要点、列清单', q: '把下面的内容整理成要点清单：' }
      ]
    }
  });
})(typeof window !== 'undefined' ? window : this);
