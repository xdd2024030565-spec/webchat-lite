# DeepSeek 网页版 · 兼容版

> **在线访问**：https://xdd2024030565-spec.github.io/dsweb-lite/
> 也可直接下载 `index.html` / `app.css` / `app.js` 三个文件离线打开。

把 `chat.deepseek.com` 的界面与核心功能，用**纯 ES5** 重做一份，让老设备 / 老 WebView / 电子墨水屏也能用。

外观按官方 `main.dc093a796f.css` 的**设计令牌**复刻（配色、字号、圆角、间距），不是凭印象画的。

## 为什么做这个

官方网页版依赖现代前端框架，老设备上要么白屏、要么卡死。本版：

- **零现代语法**：不用 `let`/`const`/箭头函数/`Promise`/`fetch`/模板字符串
- **请求走 XHR**：用 `readyState === 3` 增量读 SSE，不需要 `fetch` 流
- **无构建**：三个文件（`index.html` / `app.css` / `app.js`），拷过去就能跑
- **可离线打开**：直接双击 `index.html` 也能用（跨域由反代允许）

## 功能

| 功能 | 说明 |
|---|---|
| 对话 | 流式输出，逐字出现 |
| 深度思考 | `reasoning_content` 独立成「小而灰」的可折叠块，与正文分开 |
| 联网搜索 | 开关式，请求带 `search_enabled` |
| 增量模式 | 只发本轮输入，上下文由上游会话记忆维持 |
| 多对话 | 本地保存、切换、删除；刷新不丢 |
| 选择已有对话 | 列出网页版里已有的会话，可导入最近 N 条作为起点 |
| Markdown | 粗体 / 斜体 / 行内代码 / 代码块 / 标题 / 列表 / 引用 / 链接 |
| 主题 | 深色 / 浅色切换，跟随官方色板 |
| 电子墨水屏模式 | 去掉过渡动画与阴影，减少重绘 |
| 导出 | 当前对话导出为 Markdown 到剪贴板 |

## 后端

复用自建反代（Cloudflare Worker）：`https://deepseek-web.yongjiu.ccwu.cc/v1`

- 反代源码在 [lite1](https://github.com/xdd2024030565-spec/lite1) 仓库的 `worker/deepseek/`
- 它把网页版私有接口转成 OpenAI 兼容格式（含 PoW 求解、SSE 转换）
- token 放在 Worker 的 secret 里，**不在前端**

要换成自己的反代，改 `app.js` 顶部的 `CFG.base` 即可。

## 兼容性

- 目标：Android 4.4+ WebView、老版 Chrome/Safari、电子墨水屏浏览器
- 依赖：`XMLHttpRequest`、`localStorage`、CSS Flexbox、`<details>`
  （都是十多年前就有的能力；`<details>` 不可用时思考块会退化为常显文本）

## 文件

```
index.html   页面骨架
app.css      样式（官方设计令牌 + 深/浅主题 + 响应式）
app.js       全部逻辑（ES5）
```

## 开发约束

改动 `app.js` 时请保持 ES5。可用下面的命令自检：

```bash
node --check app.js
grep -cE '=>|\bconst \b|\blet \b|`|\bclass \b|\bPromise\b|\bfetch\(|\basync \b|\bawait \b' app.js
# 期望输出 0（正则字面量里的反引号除外）
```
