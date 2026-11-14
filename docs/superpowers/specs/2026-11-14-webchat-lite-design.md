# 网页聊天门户 · 设计文档

- 日期：2026-11-14
- 仓库：`xdd2024030565-spec/dsweb-lite` → 计划改名 `webchat-lite`
- 状态：待确认

## 1. 意图与由来

现有 `dsweb-lite` 是 `chat.deepseek.com` 的一个纯静态 ES5 复刻：三文件、无构建、
XHR + `readyState === 3` 增量读 SSE，专为老设备（Android 4.4 WebView、电子墨水屏）
在官方页白屏/卡死时仍能聊天而做。配套反代是一个 Cloudflare Worker
（`lite1/worker/deepseek`，线上名 `deepseek-web`），把网页版私有接口转成 OpenAI 兼容，
token 存在 Worker secret 里。

这次要把它升级成**多站点门户**：顶部一个站点切换器，切到豆包就是豆包那套界面，
切到通义就是通义那套，每套都按原站复刻（侧栏、会话、思考块、输入框、设置页）。
不是「一个对话框汇总多家模型」——那是 `lite1/ai.html` 已经在做的事，这里刻意不做。

反代在这套设计里只承担两件事：

1. **跨设备复用登录状态**：token 存在 Worker，任何一台设备打开即用，无需各自登录。
2. **让老设备能跑**：官方页的重型 SPA 在老设备上白屏，复刻版不会。

## 2. 目标 / 非目标 / 反目标

**目标**

- 一个域名、一个入口，站点可切换；每站首屏即原站的样子
- 每站「基本聊天 + 简单设置页」完整可用：流式输出、思考块、联网开关（有则显示）、
  多会话（本地保存）、导出、主题、墨水屏模式
- 老设备可用：目标 Android 4.4+ WebView、老 Chrome/Safari、电子墨水屏浏览器
- 加一个新站 ≈ 一个 Worker 适配器 + 一份皮肤/文案，不改内核
- token 永不出现在前端产物里

**非目标（本期明确不做）**

- 生图、文件上传、语音、分享、协作、账号体系
- 原站的设置全集（只做简单设置：主题、墨水屏、模型（有则显示）、反代地址、导出、清空）
- 对外开放给他人使用（不做注册、限流、租户隔离）——它是自用门户
- OpenAI 兼容 API 的对外售卖/分发能力（现存的 `/v1/*` 只保兼容，不扩展）

**反目标（技术上能跑也算失败）**

- 为了加站引入构建工具、npm 依赖、现代语法
- 内核里出现 `if (site === 'doubao')` 这类站点分支——站点差异只能进皮肤与适配器
- 站点失效时整站白屏或静默失败；必须能在界面上看到「这一站挂了、原因是什么」
- 把三家配置混成一个全局状态（切站后会话串味）

## 3. 约束

| 约束 | 说明 |
|---|---|
| ES5 | 无 `let`/`const`/箭头函数/`Promise`/`fetch`/模板字符串/`class`。内核与皮肤 JS 一律如此；`node --check` + 关键词 grep 自检 |
| 无构建 | 仓库根目录直接就是可发布产物；GitHub Pages 直出 |
| 老设备 | 只用 `XMLHttpRequest`、`localStorage`、Flexbox、`<details>`；不用 CSS Grid、`position: sticky`、IntersectionObserver、CSS 自定义属性以外的新特性（现有 CSS 已用 `var()`，保留） |
| 前端不含密钥 | token 只在 Worker secret 或 `Authorization` 头里 |
| **老设备兼容现状有欠账** | 见下方「3.1 已发现的兼容性欠账」，本次必须一并还清，否则「老设备可用」只是句口号 |
| 现有线上不受影响 | `deepseek-web.yongjiu.ccwu.cc` 域名与 `/v1/*` 行为不变（`lite1/ai.html` 仍指向它） |
| 现有数据不丢 | `localStorage` 里 `dsweb-lite.v1` 的老会话要迁移进 DeepSeek 站 |

### 3.1 已发现的兼容性欠账（本次必须处理）

仓库 README 声称「目标 Android 4.4+ WebView」，但当前 `app.css` 实际用了：

| 特性 | 位置 | 后果 |
|---|---|---|
| `var(--x)` 自定义属性（104 处，**零 fallback**） | 全文件 | Android 4.4 WebView（Chromium 33）**完全不支持** CSS 变量。全部颜色、圆角、间距失效 → 界面退化成无色块堆，即 README 立誓要消灭的「白屏/糊成一团」 |
| `gap:`（flex 间距，6 处） | `:140/:201/:248/:263/:378/:435` | Chromium 33–83 不支持 flex `gap`，元素贴在一起 |
| `<details>/<summary>` | 思考块 | Chromium 33 支持 `<details>` 但不支持 `<summary>` 的 `::-webkit-details-marker` 隐藏；可用但样式退化 |

也就是说：**JS 侧的 ES5 纪律守住了（`node --check` 通过、无 `let/const/箭头/Promise/fetch`），CSS 侧没守住。**
真实可用下限其实是 Android 5.1+/Chromium 49+（勉强）到 Chromium 84+（`gap`）。

处置：二选一，写进实现阶段之初，不做隐性妥协——
- **A1 保 4.4**：把 `:root` 变量在构建期展开成字面量（由于无构建，改为手写两套：变量版 + 展开版，
  用 `<style>` 条件注入），`gap` 改 `margin`，`<details>` 思考块改 `div + toggle`。
- **A2 改口径**：README 与验收标准改为「Android 5.1+ / Chromium 49+ 等效」，保留变量与 `gap`，
  省掉大量样式改写，代价是 4.4 老机不在承诺内。

推荐 **A2**：目前没有证据表明还有 4.4 设备在真实使用，而 A1 要重写整个 CSS 并放弃变量体系。
但这是「承诺」层面的决定，需要你点头——见第 12 节。

## 4. 方案选择

三条路，已在对话里比较过：

**A. 每站一套独立三文件** — 互不干扰，与现有风格一致。但对话页、侧栏、Markdown、
SSE、设置页要复制五遍，第五个站上线时约一万五千行近似 ES5，改一个通用 bug 改五处。

**B. 一套 ES5 内核 + 每站皮肤/适配（采用）** — 内核管会话模型、侧栏、Markdown、
流式渲染、设置页。每站只提供：皮肤（配色/圆角/字号/logo/文案）、能力声明、一个 Worker 适配器。
内核只认一种线格式，站点私有 SSE 由 Worker 转好。

**C. iframe 嵌原站** — 零逆向、界面 100% 原生，但目标站普遍设 `X-Frame-Options` /
CSP `frame-ancestors`，嵌不进；跨域拿不到会话；老设备跑原站照样白屏，正好违背立项理由。排除。

选 B 的代价，明说：逼真度来自皮肤与文案，不来自独立代码，所以各站的「怪」只能用配置与
少量钩子表达，做不到像素级。功能只到基本聊天时，这个代价可接受。

## 5. 站点清单

按「社区已有成熟逆向 + 纯 HTTP 可达」分档。档位决定排期，不决定是否支持。

**第一档（已确认有社区实现，纯 HTTP 可取）**

| 站点 | 键 | 凭据形态 | 备注 |
|---|---|---|---|
| DeepSeek | `deepseek` | 网页版 token（已有） | 现有 Worker 直接迁入 |
| 豆包 | `doubao` | cookie `sessionid` + `msToken` | 聊天接口实测**不加** `a_bogus` 更稳；生图/上传必须前端签名，已在非目标内排除 |
| 通义千问 | `qwen` | cookie `tongyi_sso_ticket` | 社区实现成熟 |
| Kimi | `kimi` | `refresh_token` | 2025 年后走 Connect RPC，社区已适配 |
| 智谱清言 | `glm` | `refresh_token` | 协议较稳 |

**第二档（能接，但原站界面重、复刻性价比低）**：腾讯元宝（签名重）、MiniMax 海螺、
秘塔搜索（偏检索）。

**不建议**：ChatGPT / Claude / Gemini / Grok（需海外出口 + 对抗 Turnstile 与设备指纹，
Workers 直连基本不通）、文心一言（协议频繁变、强绑风控）。

**排期**：

- P1：内核重构 + `deepseek` 迁移 + `doubao`（先把「加一个站」的路径走通）
- P2：`qwen`、`kimi`
- P3：`glm`（视前三站稳定性）

### 5.1 参考实现与依据（豆包是 P1 关键路径，必须有对照组）

已有可对照的社区实现，不是从零逆向：

| 站点 | 参考 | 关键事实 |
|---|---|---|
| 豆包 | [1994qrq/2025doubao-free-api](https://github.com/1994qrq/2025doubao-free-api)（[接口文档](https://deepwiki.com/1994qrq/2025doubao-free-api/4.4-doubao-api-integration)） | 对话端点 `POST /samantha/chat/completion`；鉴权 = cookie `sessionid`（+ `ttwid`）；请求头需 `Referer: https://www.doubao.com/chat/`、`agw-js-conv: str, str` |
| 豆包（Cookie 字段） | [astrbot 插件说明](https://github.com/hl7235659-droid/astrbot_plugin_doubao_free) | Cookie 需含 `msToken=`、`s_v_web_id=`、`sessionid=` 才有效 |
| 豆包（签名取舍） | [实测帖](https://juejin.cn/post/7706511896069472306) | 加 `a_bogus`/`X-Bogus` 反而更容易触发 `710022004`；假 `msToken` 触发 `710022002`。「不加更稳」的适用条件是**聊天接口**，不是上传/生图 |
| Kimi | [LLM-Red-Team/kimi-free-api](https://deepwiki.com/LLM-Red-Team/kimi-free-api/4-deployment-guide) | `refresh_token` 取自 `kimi.moonshot.cn` Local Storage；若是数组要用 `.` 连接 |
| 智谱 | [glm-free-api](https://gitee.ltd/MigrateRepos/glm-free-api) | `chatglm_refresh_token` 取自 cookie |
| 通义 | [qwen-free-api](https://huggingface.co/spaces/zzitai/redteam-qwen-free-api/raw/main/README.md--) | `tongyi_sso_ticket` 取自 cookies |

**止损出口（写死，避免无限期耗在豆包上）**：豆包适配器给 3 天预算。若
`/samantha/chat/completion` 在无头环境稳定被 `710022004` 挡住，则降级为
**「deepseek 迁移完成 + 豆包壳上线（界面皮肤与文案可用，聊天显示『该站暂不可用，原因：风控』）」**，
把豆包排到 P1.5 再攻，其余站点不受影响。这条写进计划，不许悄悄延期。

## 6. 架构

```
浏览器（老设备）
   │  静态：index.html + assets/*
   ▼
GitHub Pages ── 内核 + 皮肤/站点清单（ES5）
   │  XHR / SSE(readyState 3)，同一线格式
   ▼
Cloudflare Worker「deepseek-web」（沿用现有名字与域名）
   │  路由：/v1/*（legacy，DeepSeek）· /<site>/v1/*（各站）
   ▼
chat.deepseek.com / www.doubao.com / tongyi.aliyun.com / kimi.moonshot.cn / chatglm.cn
```

### 6.1 线格式（关键决定）

**统一用 OpenAI Chat Completions chunk 格式，仅做向后兼容的扩展字段。**

理由：现有前端解析逻辑（`choices[0].delta.content` / `delta.reasoning_content`）与
Worker 转换代码都能直接复用；同时 `lite1/ai.html` 这类外部客户端仍能指向新路由。
自定义归一化事件流要重写两端，收益为零。

扩展字段（均为可选）：

| 字段 | 含义 | 前端处理 |
|---|---|---|
| `delta.content` | 正文增量 | 追加渲染 |
| `delta.reasoning_content` | 思考增量 | 追加思考块 |
| `delta.citations` | 引用数组 `[{title,url}]` | 正文后渲染引用列表（有才显示） |
| `finish_reason` | `stop` / `length` / `error` | 收尾 |
| `error.message` | 站点级失败原因 | 气泡内红字 + 侧栏站点标红 |

站点适配器的职责就是「不管上游长什么样，都吐这几样」。

### 6.2 Worker 结构

**Worker 源码继续留在 `lite1` 仓库的 `worker/` 下，不搬进新仓库。**（我的决定，理由见下）

理由：

1. CI 与凭据都在 lite1（`.github/workflows/deploy-deepseek.yml` + 仓库 secret `CF_API_TOKEN` /
   `DEEPSEEK_TOKEN`），搬仓就得在新仓库重配一遍 Cloudflare 与各站凭据，纯粹是新增失败点；
2. Pages 会把仓库根目录整体发布，`worker/` 若在站点仓库里，Worker 源码与 1MB 级 `.wasm`
   会跟着上线，既臃肿又无意义；
3. `lite1/ai.html` 已经在用这个 Worker，同仓演进不会产生版本漂移。

代价：加一个站要动两个仓库。可接受，因为本来前端与 Worker 就是分开部署的。
**冻结规则**：Worker 名 `deepseek-web` 只由 lite1 的 workflow 部署，任何其它地方不得再部署同名
Worker，否则互相覆盖。

```
lite1/worker/deepseek/
  deepseek-web.js      入口 + 路由 + CORS + 健康检查 + legacy /v1 兼容
  lib/sse.js           统一 SSE 分块与收尾
  lib/pool.js          多 token 轮询 + 失败切换（从现 deepseek-web.js 抽）
  lib/http.js          浏览器指纹头、超时、重试
  sites/deepseek.js    现有实现的适配层（PoW WASM 原样保留）
  sites/doubao.js
  sites/qwen.js
  sites/kimi.js
  sites/glm.js
  sha3_wasm_bg.wasm    DeepSeek PoW 用（wrangler CompiledWasm）
```

**适配器接口**（每个 `sites/*.js` 导出一份）：

```js
{
  id: 'doubao',
  models: ['doubao-chat'],
  async chat({ token, messages, model, stream, search, think, signal }, env)
    → { stream: ReadableStream | string, usage? }   // 线格式见 6.1
  async listSessions({ token }, env) → [{ id, title, tagged }]   // 可选，不支持则返回 null
  async sessionMessages({ token, id, limit }, env) → [{ role, content, reasoning }]  // 可选
  async health({ token }, env) → { ok, kind: 'ok'|'no_token'|'expired'|'blocked', msg }
}
```

`listSessions` / `sessionMessages` 返回 `null` 即该站不支持「网页版对话」分组，
内核据此隐藏该分组——这正是皮肤/能力声明要表达的东西。

**上游会话绑定（pinned）保留，作为可选能力。** 今天的「选择已有对话…」不只列列表，它写
`pinnedSessionId`、请求带 `pinned_session_id`，Worker 侧有 pin 复用与 `[DSH#…]` 标记
（`app.js:318/563/839`、`deepseek-web.js:321/614/736`）。这是现有能力，砍掉是功能退化。

声明方式：新增 `caps.pin: true`，内核据此显示「绑定网页版对话」入口；对话体里额外带
`pinned_session_id`（无绑定则不带）。只有 `listSessions` 与 `sessionMessages` 都实现的站点才可
置 `caps.pin`，否则内核自动当 false——避免站点声明了能力却没有实现。

**路由**：

| 路径 | 说明 |
|---|---|
| `/health` | 全局：各站 `health()` 汇总（不泄露 token） |
| `/<site>/health` | 单站健康 |
| `/<site>/v1/models` | 单站模型 |
| `/<site>/v1/chat/completions` | 单站对话 |
| `/<site>/v1/sessions`、`/<site>/v1/sessions/messages` | 可选能力 |
| `/v1/*` | legacy，等价于 `/deepseek/v1/*`，保持 `lite1/ai.html` 可用 |

**Worker 名字与域名**：沿用 `deepseek-web`。改名会牵动 `lite1/ai.html` 与既有自定义域名，
收益只有观感。名字与它现在承载的职责不再匹配，这是刻意吞下的债，记在这里以免后人困惑。

**密钥命名**：`DEEPSEEK_TOKENS`（沿用，兼容）、`DOUBAO_TOKENS`、`QWEN_TOKENS`、
`KIMI_TOKENS`、`GLM_TOKENS`；均可英文逗号分隔多账号。`PROXY_KEY` 可选，配了则前端需带。

### 6.3 前端结构

```
index.html                 骨架：站点切换器 + 侧栏 + 主区 + 设置/选择弹层
assets/app.css             内核样式（沿用现有设计令牌，按皮肤变量覆盖）
assets/app.js              内核（ES5）：会话、渲染、SSE、设置、皮肤应用
assets/sites/deepseek.js   站点清单：id/名称/logo/文案/能力/皮肤变量/端点
assets/sites/doubao.js
assets/sites/qwen.js ...
assets/skins/deepseek.css  可选：站点级样式覆盖
assets/skins/doubao.css
```

**站点清单对象**（皮肤即数据，不写分支）：

```js
{
  id: 'doubao',
  name: '豆包',
  home: 'https://www.doubao.com/chat/',
  brand: { mark: '豆', color: '#3b6ef5', bubble: 'var(--ds-50)' },  // 喂给 CSS 变量
  copy: {
    newChat: '发起新对话',
    placeholder: '发消息给豆包…',
    welcomeTitle: '我是豆包',
    welcomeSub: '有问题尽管问我',
    thinkLabel: '思考中… / 已思考（{n} 字）',
    cards: [ { t: '…', d: '…', q: '…' }, … ]
  },
  caps: { search: true, think: true, modelPick: false, remoteSessions: false, incr: false },
  models: ['doubao-chat'],
  endpoint: '/doubao/v1'   // 相对 Worker base
}
```

`caps` 为假的控件直接不渲染（不是灰掉）——原站没有的东西，复刻版也不该有。

**状态隔离**：`localStorage` 键

| 键 | 内容 |
|---|---|
| `webchat.v1.<siteId>` | 该站会话、当前会话、该站设置（模型/联网/思考/增量/**上游会话作用域 scope**） |
| `webchat.v1.ui` | 全局 UI：主题、墨水屏、上次所在站点、Worker base 覆盖、访问口令 |
| — | 不再有全局 scope 键 |

切站 = 换名字空间 + 换皮肤 + 重拉该站会话，互不可见。

**scope 必须 per-site**：增量模式的会话身份现在是全局单键 `dsweb-lite.scope`，第二个站也用增量
就会跨站串味（撞反目标）。本次挪进 `webchat.v1.<siteId>.scope`，原键迁移进 deepseek 站。

**迁移**：首次启动若存在 `dsweb-lite.v1`，整体搬进 `webchat.v1.deepseek` 后删除旧键。

**入口 URL**：`?site=doubao` 直进某站；缺省 = 上次所在站点，首次 = `deepseek`。
老的 `https://…/dsweb-lite/` 书签会落到门户默认站，行为与今天一致。

### 6.4 设置页（简单版）

一个共享弹层，皮肤决定外观，内容按 `caps` 裁剪：

- 外观：主题（深/浅/跟随）、电子墨水屏模式
- 本站：模型（`caps.modelPick` 才出现）、联网搜索（`caps.search`）、深度思考（`caps.think`）、增量模式（`caps.incr`）
- 连接：Worker base（留空用默认）、`PROXY_KEY`（若配）、本站健康状态（调 `/<site>/health` 显示 ok/未配 token/已失效/被风控）
- 数据：导出当前对话为 Markdown、清空本站数据、清空全部

### 6.5 访问控制

页面在公开的 GitHub Pages 上、token 在 Worker 里，**不设口令 = 拿到 URL 的人都能烧你的额度**。

- **P1 生产启用 `PROXY_KEY`**。首台新设备进设置页填一次口令即存本地，之后「打开即用」。
  这确实让首次使用多一步，但它是唯一能挡陌生人的门槛；不设的话这个项目就是公开的免费 API。
- `/health` 一并脱敏：未带口令只回 `{ ok: true/false }`，**不再回 token 数量与来源**
  （现网 `deepseek-web.js:554-570` 会回 `tokens` 与 `tokenSource`，等于告诉扫描者「这里有 1 个可用 token」）。
  带口令才回明细。
- **保留「手动填网页版 token」兜底**（DeepSeek 路径今天就有）。它同时是开发期在没有 CF secret 时
  唯一能自测豆包的路径。边界写清：手动 token 只存在浏览器 localStorage、只随请求头走，
  不进任何静态产物；README 里明确它与「前端不含密钥」不矛盾——前端不含的是**你的**密钥。

### 6.6 部署触发（现有 CI 会漏掉搬迁后的文件）

现有 `.github/workflows/pages.yml` 的 `paths` 白名单只有 `index.html` / `app.css` / `app.js`。
文件搬进 `assets/` 后不改 workflow **根本不会触发部署**——这不是小问题，会表现为「提交成功但线上没变」。
处置：白名单改为 `'**'` 并排除 `docs/**`、`worker/**`，或直接去掉 `paths` 过滤。

## 7. 名字与仓库

**推荐**：仓库 `webchat-lite`，展示名「网页聊天 · 兼容版」，副标题「DeepSeek / 豆包 / 通义 / Kimi / 智谱」。

候选与取舍：

| 名字 | 评 |
|---|---|
| `webchat-lite` | 与 `lite` / `lite1` 同族，一眼看懂「网页版 + 精简」，推荐 |
| `chatportal` | 更强调门户，但与现有命名无关联 |
| `dsweb-lite`（不改） | 零成本，但名字只覆盖 DeepSeek，第二个站出来就名不副实 |

**改名代价与处置**：GitHub Pages 项目地址随仓库名变化，旧地址
`…/dsweb-lite/` 会失效，而老设备上恰恰存着这个书签。
处置：改名后新建一个同名空仓库 `dsweb-lite`，只放一个 meta refresh 的 `index.html`
跳到新地址。成本一个空仓库，换回「老设备书签不断」。**这是本次唯一不可逆的操作**，
执行前会再确认一次。

## 8. token 获取（由你操作，我按阶段给步骤）

前端不含密钥，所以每个站点的凭据要由你从对应网页版抓一次，写进 Worker secret。
形态不同、有效期不同：

| 站点 | 需要什么 | 有效期 |
|---|---|---|
| DeepSeek | 网页版 token（已在 secret 里） | 长期，除非退出登录/改密 |
| 豆包 | `sessionid` + `msToken` | 中等，风控触发需重取 |
| 通义 | `tongyi_sso_ticket` | 中等 |
| Kimi | `refresh_token` | 可续期 |
| 智谱 | `refresh_token` | 可续期 |

**交付节奏**：不要现在一次性取五个。P1 只取豆包一个，我会给出「打开哪个页面 → F12 →
哪个面板 → 复制哪个值 → 粘到哪」的具体步骤；跑通再加下一个。一次取五个，
四个会因为你不知道哪个值过期而白费。

## 9. 风险

| 风险 | 影响 | 应对 |
|---|---|---|
| **本地与远端历史已分叉** | 5 个提交、树完全相同但 SHA 全不同（本地是 `xdd2024030565-spec <…users.noreply.github.com>`，远端是 `xdd2024030565 <…@gmail.com>`，本地是身份改写后的产物）。下一次推送会被拒或需要 force | 动工前先统一身份方向：要么把远端也改写成 noreply 身份（`git_identity_rewrite`，自带备份引用与 force-with-lease），要么把本地 reset 回远端。**不做这一步，第一个提交就推不上去** |
| 上游协议随时变（豆包尤甚） | 单站不可用 | 适配器隔离 + `/health` 与界面明确报「本站上游变更」，不静默；一站的坏不传染 |
| 风控：同一 session 多 IP 并发 | 被挤下线/人机验证 | 默认单 session；`*_TOKENS` 支持多账号轮询；界面提示被风控 |
| Worker 体积增长 | 部署失败 | 免费版压缩后 1MB 上限；5 个纯 JS 适配器 + 一个 WASM 远未触及，部署流水线加体积打印 |
| Cloudflare 国内可达性 | 打不开 | 沿用现有自定义域 `ccwu.cc`；页面加载失败时给明确提示（不是空白） |
| Pages 国内慢 | 首屏慢 | 沿用 `lite1` 的帽子云加速方案，作为部署选项写入 README |
| 老设备 localStorage 配额 | 写不进去 | 写入失败捕获并提示「本机存储已满」，不抛白屏 |

## 10. 交付物与完成定义

**P1 完成的判据（可验证，不靠感觉）**

1. 门户默认落在 DeepSeek，功能与今天的 `dsweb-lite` 等价（含「绑定网页版对话」），老会话已迁移
2. 切到豆包，界面换成豆包皮肤与文案，能流式聊天、能保存多会话
3. 断开 Worker（改错 base）时，界面明确显示「无法连接」，不白屏
4. `/health` 未带口令只回 ok/不 ok；带口令回两站明细
5. `node --check` 与 ES5 关键词自检对全部前端 JS 为 0；老设备判据见 10.1
6. README 重写：站点支持表、切站用法、token 配置、加站指南

### 10.1 老设备验收怎么算数

没有 4.4 实机在手上的前提，用「静态门禁 + 等效运行」判定，并把「未在真机验证」写成残余风险：

- **静态门禁（进 CI，可复现）**：`node --check` 全部 JS；关键词扫描禁 `let`/`const`/箭头/模板串/
  `class`/`Promise`/`fetch`（扫描前先剥离字符串与正则字面量，避免误报——现有 `app.js` 直接 grep
  会把 CSS 类名和 Markdown 正则里的反引号误判成违规）；禁 `gap:` / `:root` 变量以外的新 CSS 特性（若选 A2）。
- **等效运行**：桌面 Chromium + 移动 UA + 窄视口，走完「发一条 → 收流式回复 → 刷新后仍在 → 导出」。
- **专项手测**（这几条 Chromium 新版测不出差异，必须人工确认代码路径）：`readyState===3` 增量读流、
  `localStorage` 写入失败兜底、`document.execCommand('copy')` 回退、无 `<details>` 时的思考块降级。
- 若日后拿到 4.4 实机或墨水屏设备，补一次真机验证并在 README 记下结果。

**P2/P3** 以「新增站点不触碰内核文件」为验收：加站只新增 `assets/sites/<id>.js`（+可选 skin）
与 `worker/sites/<id>.js`，`app.js` 与 `index.html` 零改动（站点清单由 `assets/sites/index.js` 声明）。

## 11. 留给实现者的决定

- 内核内部函数划分、渲染节流阈值、Markdown 解析器细节
- 各适配器的请求头、重试次数、超时值
- 皮肤具体色值（从各原站取色，取不到就用相近值并注明）
- 会话列表分页与「网页版对话」拉取条数
- Worker 内部模块拆分粒度

## 12. 我替你做的决定（读文档时请重点核对这几条）

这些是可自行决定但影响不小的选择，我定了，列出来方便你推翻：

1. **Worker 留在 lite1，不搬进新仓库**（§6.2）。避免重配 CF 凭据、避免 Pages 发布 Worker 源码。
   代价：加站要动两个仓库。
2. **保留「绑定网页版对话」能力**，声明为 `caps.pin`（§6.2）。砍掉是功能退化。
3. **生产启用 `PROXY_KEY`，`/health` 脱敏**（§6.5）。不启用等于公开的免费 API。
4. **保留手动填 token 兜底**（§6.5）。开发期没 CF secret 时唯一能自测的路。
5. **增量 scope 改成 per-site**（§6.3）。否则第二个站也开增量就跨站串味。
6. **Pages workflow 的 `paths` 白名单必须改**（§6.6）。不改则搬进 `assets/` 的文件不触发部署，
   表现为「提交成功但线上没变」。
7. **豆包 3 天止损出口**（§5.1）：攻不下就上壳，不拖住整个 P1。

## 13. 需要你确认的

1. 名字 `webchat-lite` + 「网页聊天 · 兼容版」是否可用（改名不可逆，会先备份再动）
2. P1 只做 DeepSeek + 豆包，是否同意
3. 旧地址兜底重定向仓库（`dsweb-lite` 空壳跳新站）要不要
4. **老设备兼容口径选 A1（保 Android 4.4，重写 CSS、弃用变量）还是 A2（改口径为 5.1+/Chromium 49+，保留现有样式体系）** —— 推荐 A2
5. **git 身份方向**：把远端历史改写成 noreply 规范身份（推荐，与本机一致），还是把本地重置到远端 gmail 身份
6. Cloudflare：`CF_API_TOKEN` 还在 lite1 的仓库 secret 里、仍然有效吗？（P1 要往 Worker 加豆包路由，得能部署）
