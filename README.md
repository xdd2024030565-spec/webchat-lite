# 网页聊天 · 兼容版

> **在线访问**：https://xdd2024030565-spec.github.io/webchat-lite/
> 纯静态、无构建：拷走 `index.html` + `assets/` 就能离线打开。

把网页版聊天（DeepSeek、豆包……）用**纯 ES5** 复刻成一套界面，让老设备 / 老 WebView / 电子墨水屏也能用；顶部一键切换站点，每个站点保留它自己的配色、文案与能力开关。

## 为什么做这个

官方网页版依赖现代前端框架，老设备上要么白屏、要么卡死。本版：

- **零现代语法**：不用 `let`/`const`/箭头函数/`Promise`/`fetch`/模板字符串
- **请求走 XHR**：用 `readyState === 3` 增量读 SSE，不需要 `fetch` 流
- **无构建**：静态文件直接跑，`index.html` + `assets/`
- **一套内核，多站皮肤**：加一个站点只加一个 `assets/sites/<id>.js`

## 功能

| 功能 | 说明 |
|---|---|
| 站点切换 | 顶栏胶囊按钮，会话、设置、增量 scope 全部按站点隔离 |
| 对话 | 流式输出，逐字出现 |
| 深度思考 | `reasoning_content` 独立成可折叠块，与正文分开 |
| 联网搜索 | 开关式（站点支持时显示），请求带 `search_enabled` |
| 增量模式 | 只发本轮输入，上下文由上游会话记忆维持 |
| 多对话 | 本机保存、切换；侧栏每条右边有 × 可删除单条（删光自动补一个空对话），刷新不丢 |
| 网页版对话 | 站点支持时自动拉取上游已有会话；点开即载入完整历史（含思考过程） |
| Markdown | 粗体 / 斜体 / 行内代码 / 代码块 / 标题 / 列表 / 引用 / 链接 |
| 主题 | 深色 / 浅色切换 |
| 电子墨水屏模式 | 去掉过渡动画与阴影，减少重绘 |
| 导出 | 当前对话导出为 Markdown 到剪贴板 |
| 本机口令 | 反代启用 `PROXY_KEY` 时，可在设置里填口令，随请求带上 |

站点能力由 `assets/sites/<id>.js` 里的 `caps` 决定，关闭的能力对应控件会隐藏（不是删掉）：

```js
caps: { search: true, think: true, incr: true, remoteSessions: true, pin: true }
```

## 文件结构

```
index.html                 页面骨架（只有骨架，文案由站点定义注入）
assets/app.css             设计令牌 + 深/浅主题 + 侧栏
assets/chat.css            主区样式（消息区、输入区、浮层、站点切换器）
assets/app.js              启动与事件绑定
assets/core/ns.js          共享状态（当前站点、会话、UI 偏好）
assets/core/dom.js         DOM 查询与通用工具
assets/core/md.js          Markdown 渲染
assets/core/sse.js         SSE / OpenAI chunk 解析（纯函数）
assets/core/store.js       按站点命名空间的 localStorage 封装
assets/core/sites.js       站点定义规范化、选择、URL 拼装
assets/core/data.js        存储读写、请求体拼装、会话数据
assets/core/chrome.js      主题、标题、站点切换器、能力开关
assets/core/view.js        侧栏与会话区渲染
assets/core/chat.js        发送、流式接收、中止
assets/core/remote.js      网页版会话列表、健康检查
assets/core/shell.js       设置、选择对话、导出、清空
assets/sites/index.js      站点清单 + 顺序加载器
assets/sites/deepseek.js   DeepSeek 站点定义
assets/sites/doubao.js     豆包站点定义
tools/                     开发工具（ES5 门禁、本地假后端、e2e 驱动）
tests/                     node --test 用例
```

本地键：`webchat.v1.<siteId>`（会话/设置/scope）、`webchat.v1.ui`（主题、当前站、反代地址、口令）。
首次打开会把旧版的 `dsweb-lite.v1` / `dsweb-lite.scope` 迁移成 `webchat.v1.deepseek`。

## 后端

同一个 Cloudflare Worker（`https://deepseek-web.yongjiu.ccwu.cc`）按站点路由：

| 路径 | 说明 |
|---|---|
| `/<site>/v1/chat/completions` | 该站点的 OpenAI 兼容对话接口 |
| `/<site>/v1/models` | 该站点可用模型 |
| `/<site>/v1/sessions`、`/sessions/messages` | 上游网页版会话（站点支持时） |
| `/<site>/health` | 站点健康检查 |
| `/v1/*` | legacy，等价于 `/deepseek/v1/*` |

- 反代源码在 [lite1](https://github.com/xdd2024030565-spec/lite1) 仓库的 `worker/deepseek/`
- token 放在 Worker 的 secret 里，**不在前端**；未配 secret 时也可在设置里填口令走请求头兜底
- 换成自己的反代：页面 URL 加 `?base=https://你的反代`，或在引入脚本前设置 `window.WCL_BASE`

## 豆包怎么才能用

豆包的反代需要的不是 API Key，而是**网页登录态的 `sessionid` cookie**（一次登录可以长期用）：

1. 电脑浏览器打开 `https://www.doubao.com/` 并登录，随便发一条消息确认能用
2. F12 → Application（应用）→ Storage → Cookies → `https://www.doubao.com`
3. 复制 `sessionid` 的值（形如 `a1b2c3…`，很长）
4. 两种放法，任选一种：
   - **放反代**（推荐，多设备共用）：`cd worker/deepseek && npx wrangler secret put DOUBAO_TOKENS`，值就是那串 `sessionid`
   - **放本机**：页面右上 ⚙ → 连接 → 端口令框填进去（存在浏览器本地，只对这个设备生效）

放好之后点一下 ⚙ 里的「检查」，正常会显示可用。豆包暂不支持「绑定网页版对话」「联网搜索」，
这两个开关在豆包站会自动隐藏。

## 兼容性

- 目标：Android 5.1+ / Chromium 49+ WebView、老 Chrome/Safari、电子墨水屏浏览器
- 依赖：`XMLHttpRequest`、`localStorage`、CSS 变量、Flexbox、`<details>`
- 不用 CSS Grid、`flex gap`（用外边距代替）、`:has()`、`backdrop-filter`

## 开发

```bash
node tools/es5-check.mjs        # ES5 门禁：assets/**/*.js 不许出现 ES6+ 语法
node --test tests/*.test.mjs    # 单测 + e2e（e2e 需要本机 chromium，只打本地 stub）
node tools/stub-server.mjs      # 起本地假后端 + 静态站点（默认 8765）
```

自检口径：`node --test tests/` 这种写法会报 MODULE_NOT_FOUND，请用 `tests/*.test.mjs` 这个 glob。
e2e 不会访问任何真实站点，重复跑不会碰上游风控；真实上游只在人工验收时打一次。

## 版本记录

| 版本 | 内容 |
|---|---|
| v2.0.1 | 侧栏支持删除单个本机对话；flex gap 全换外边距 |
| v2.0.0 | 改名「网页聊天 · 兼容版」：一套 ES5 内核 + 站点定义，顶栏切换站点；新增豆包站点；会话与偏好按站点隔离；后端路由改为 `/<site>/v1/*`（legacy `/v1/*` 保留）；前端拆成 core/* 小模块，新增 ES5 门禁、本地假后端与 40 条自动化用例；样式拆成 app.css + chat.css |
| v1.0.0 | 单站 DeepSeek 网页版客户端（`dsweb-lite`） |
