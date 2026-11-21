# 网页聊天 · 兼容版

## 访问地址

- 🚀 **国内加速地址（帽子云）**：https://webchat-10i3d8c30u.maozi.io/
- 📦 GitHub Pages 原始地址：https://xdd2024030565-spec.github.io/webchat-lite/

> 纯静态、无构建：拷走 `index.html` + `assets/` 就能离线打开（对话需可达反代）。

**本质：网页端接入。** DeepSeek / Grok 的**网页版登录态**经自建 Cloudflare Worker 反代成 **OpenAI 兼容接口**，本仓库前端用**纯 ES5** 复刻网页界面，让老设备 / 老 WebView / 电子墨水屏也能用；**token 不进前端**。顶部一键切换站点，每站保留自己的配色、文案与能力开关。

## 为什么做这个

官方网页版依赖现代前端框架，老设备上要么白屏、要么卡死。本版：

- **零现代语法**：不用 `let`/`const`/箭头函数/`Promise`/`fetch`/模板字符串
- **请求走 XHR**：用 `readyState === 3` 增量读 SSE，不需要 `fetch` 流
- **无构建**：静态文件直接跑，`index.html` + `assets/`
- **一套内核，多站皮肤**：加一个站点只加一个 `assets/sites/<id>.js`
- **登录态在服务端复用**：反代持有网页版凭证，任何设备打开即用，不必各自登录

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
| 本机口令 | 反代启用 `PROXY_KEY` 时需填口令；未配服务端凭证时也可在此填网页版 token，随 `Authorization: Bearer` 请求头带上 |

站点能力由 `assets/sites/<id>.js` 里的 `caps` 决定，关闭的能力对应控件会隐藏（不是删掉）：

```js
caps: { search: true, think: true, incr: true, remoteSessions: true, pin: true }
```

五个开关含义：`search` 联网搜索、`think` 深度思考、`incr` 增量模式、`pin` 绑定上游网页版会话、`remoteSessions` 读取网页版会话列表。其中 `pin` 只有在 `remoteSessions` 同时为真时才生效（`assets/core/sites.js:32`）。DeepSeek 五项全开；Grok 只开 `remoteSessions`（能读网页版对话列表，不能绑定上游会话），联网搜索、深度思考、增量模式均不提供。

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
assets/sites/grok.js       Grok 站点定义
tools/                     开发工具（ES5 门禁、本地假后端、e2e 驱动）
tests/                     node --test 用例
```

本地键：`webchat.v1.<siteId>`（会话 / activeId / 设置 / 增量 scope）、`webchat.v1.ui`（主题、墨水屏、上次站点、反代地址、口令）。
首次打开会把旧版的 `dsweb-lite.v1` / `dsweb-lite.scope` 迁移成 `webchat.v1.deepseek`。
换用自己的反代：页面 URL 加 `?base=https://你的反代`，或在引入脚本前设置 `window.WCL_BASE`；`?site=grok` 可覆盖首次打开的站点。

## 后端

反代源码在 [lite1](https://github.com/xdd2024030565-spec/lite1) 仓库的 `worker/deepseek/`，线上是同一个 Cloudflare Worker `https://deepseek-web.yongjiu.ccwu.cc`。路由拆分在 `worker/deepseek/lib/route.js`（`SITE_IDS = ['deepseek','grok']`）。

| 路径 | 上游 | 说明 |
|---|---|---|
| `/deepseek/v1/*` | `chat.deepseek.com` | DeepSeek 网页版反代，OpenAI 兼容 |
| `/grok/v1/*` | `grok.com` | Grok 网页版反代，纯对话 |
| `/v1/*`、`/chat/completions` | `chat.deepseek.com` | legacy，等价于 `/deepseek/v1/*` |
| `/<site>/health`、`/<site>` | — | 该站点健康检查 |
| `/health` | — | 不带口令只回 `{ok, sites}`；带 `Authorization` 才回 token 数量等细节 |

反代替前端解决的事（浏览器直连做不到）：

- **DeepSeek**：① CORS —— `chat.deepseek.com` 不允许跨域；② **PoW 工作量证明** —— 每次请求要带 `X-DS-PoW-Response`，是 `DeepSeekHashV1` 挑战，需用官方前端同款 WASM `sha3_wasm_bg.wasm` 现场解算，不是简单 hash；③ **私有协议** —— 请求体是 `chat_session_id` / `parent_message_id` / `prompt` 等字段，响应是自定义 SSE，正文有三种 delta 形态（快照、追加 fragment 数组、段内增量碎片）。Worker 对外暴露标准 OpenAI 格式，对内自动解 PoW + 协议转换。
- **Grok**：上游 `POST /rest/app-chat/conversations/new` 返回的是**逐行 JSON（NDJSON）**而非 `data:` 前缀 SSE；适配器把 `result.response.token` 翻成 `delta.content`，`isThinking` 翻成 `delta.reasoning_content`，`isFinal` 收尾，输出标准 OpenAI chunk。

凭证来源与轮换：

- **DeepSeek**：网页版 token 存在 Worker secret `DEEPSEEK_TOKENS`（多个用英文逗号分隔做账号池轮询，失效一个自动换下一个），或不配 secret 时在 ⚙ → 连接 → 口令框填 token 走 `Authorization: Bearer`（改完即生效，不必重新部署）。token 本身无有效期；退出登录、改密码或官方主动吊销会使其失效。
- **Grok**：凭证是 grok.com 的 `sso` cookie，写在 GitHub secret `GROK_TOKENS`；部署时在 `wrangler deploy` 阶段作为普通变量注入（CI 的 Cloudflare token 没有 Workers secret 写权限，`wrangler secret put` 会报 7003），值不落仓库、日志按字段脱敏。可选 secret `GROK_STATSIG_ID` 覆盖内置固定的 `x-statsig-id`，被上游拒绝时用。

**线上部署两个站点的服务端凭证都已配好**，任何设备打开就能直接用，不需要各自登录。下面两节是「换账号 / 自建反代」时怎么取凭证的说明。

## DeepSeek 怎么才能用

DeepSeek 网页版的 token 由 `https://chat.deepseek.com/` 登录后页面自动生成（开发者工具 Console 里从 `localStorage` 的 `userToken` 读取；输出里 `::` 之后的部分是噪声，不是 token 本体，**不要把完整值贴到公开地方**）。

线上反代已配好服务端凭证，直接用即可。换账号时：

1. 更新反代仓库的 GitHub secret `DEEPSEEK_TOKEN`（部署时写入 Worker 的 `DEEPSEEK_TOKENS`；多个 token 逗号分隔做账号池），重新部署；
2. 或不想动反代：直接在 ⚙ → 连接 → 口令框填新 token，Worker 从 `Authorization: Bearer` 取用，改完立即生效。

token 本身不含有效期，以下情况会失效：网页版退出登录、网页版改密码、官方主动吊销长期不活跃会话。失效后重新取 token 并按上面任一方式更新即可。

能力说明：

- 模型 `deepseek-chat`（日常对话）/ `deepseek-reasoner`（深度思考，思考过程放在 `reasoning_content`，前端显示为折叠思考块）。**不支持 function calling**（网页版本身没有这个能力）。
- 线上已验证：非流式对话、流式 SSE、联网搜索（`search_enabled: true` 会带 `[citation:N]` 引用）、CORS 预检。
- 支持「绑定网页版对话」「联网搜索」「深度思考」「增量模式」，开关在输入框上方；侧栏「网页版对话」分组直接列出网页版已有会话，点开即导入最近若干条。

## Grok 怎么才能用

Grok 免费网页版走 `grok.com` 的登录态，凭证是 Cookie 里的 `sso`：

1. 浏览器打开 `https://grok.com/` 并登录（需要能访问它的网络环境）
2. F12 → Application（应用）→ Storage → Cookies → `https://grok.com`
3. 找到 `sso` 项并复制其值（**不要贴到公开地方**）
4. 写进反代仓库的 GitHub secret `GROK_TOKENS`，重新部署即可（部署流程把它作为 Worker 普通变量注入；CI token 无 secret 写权限，故不能走 `wrangler secret put`）
5. 只想在单台设备上用的话，也可以直接填进 ⚙ → 连接 → 口令框，不必动反代

可选模型：

- `Grok 3`（`grok-3`，默认，速度快）
- `Grok 4.1 思考`（`grok-4-1-thinking-1129`，带思考块）

模型清单由反代 `POST /rest/models` 按当前 token 实时读取并缓存 10 分钟；聊天请求必须同时带 `modelName` 与 `modelMode`（模式由该接口给出），只发模型名会被上游回「This model is temporarily unavailable」。适配器把上游 NDJSON 逐行翻成 OpenAI chunk，`isThinking` 行进思考块、`isFinal` 收尾。

注意：

- 免费额度有限（大约 10 条 / 2 小时），本版**每条消息只打一次上游，失败不自动重试**，避免触发风控
- 支持读取网页版对话：侧栏「网页版对话」分组列出 grok.com 上已有的会话，点开导入最近若干条（默认 5 条，可在侧栏改）。只读不写，导入后是独立的本机对话，不会继续写回上游
- 没有绑定上游会话、没有联网搜索；部分模型会返回思考过程，页面会显示成思考块
- 健康检查只看 `GROK_TOKENS` 是否配置、不打上游，避免探测请求吃掉消息额度
- `sso` 等于账号登录态，泄露就等于把号交出去

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

反代侧单测：`cd worker/deepseek && node --test tests/*.test.mjs`（覆盖路由拆分、事件翻译、请求体字段、上游非流式兜底、Grok 只读接口的列表归一化与两步取数、鉴权与健康检查，源码在 `lite1` 仓库）。

## 版本记录

| 版本 | 内容 |
|---|---|
| v2.4.2 | Grok 站点支持读取网页版对话列表（侧栏「网页版对话」分组，点开导入最近若干条）；修复载入网页版对话时把 `{count, messages}` 当数组解析、导致导入 0 条消息的问题 |
| v2.4.1 | 新增帽子云国内加速访问地址；后端 CORS 白名单放行帽子云域名，解决跨域无法使用的问题 |
| v2.4.0 | 移除豆包、智谱清言、Kimi 三个站点，只保留长期可用的 DeepSeek 与 Grok；站点定义、路由、部署变量、文档同步收敛到两站 |
| v2.1.1 | Grok 适配器补发 `modelMode`（上游要求模型名与模式一起发，否则回「temporarily unavailable」）；模型清单改为按账号实时读取并缓存 10 分钟，新增 Grok 4.1 思考 |
| v2.1.0 | 新增 Grok 站点（grok.com 网页版反代，纯对话）；站点切换器变为三站；e2e 覆盖切到 Grok 的品牌与能力裁剪 |
| v2.0.1 | 侧栏支持删除单个本机对话；flex gap 全换外边距 |
| v2.0.0 | 改名「网页聊天 · 兼容版」：一套 ES5 内核 + 站点定义，顶栏切换站点；会话与偏好按站点隔离；后端路由改为 `/<site>/v1/*`（legacy `/v1/*` 保留）；前端拆成 core/* 小模块，新增 ES5 门禁、本地假后端与 40 条自动化用例；样式拆成 app.css + chat.css |
| v1.0.0 | 单站 DeepSeek 网页版客户端（`dsweb-lite`） |
