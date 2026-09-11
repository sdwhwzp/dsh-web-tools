<div align="center">

<p align="center">
  <img src="https://raw.githubusercontent.com/A3Boy/dsh-web-tools/main/assets/logo.png" alt="dsh-web-tools" width="160" />
</p>

# dsh-web-tools

让 DeepSeek Harness 拥有直连全网与社媒平台的搜索与抓取能力。

**15 大 Web Provider 原生能力适配 · SearchHints 语义编译 · 多源自动容灾 · 小红书 / Twitter X 平台检索**

<p align="center">
  <a href="https://github.com/A3Boy/dsh-web-tools/stargazers">
    <img src="https://img.shields.io/github/stars/A3Boy/dsh-web-tools?style=flat-square&label=Stars" alt="GitHub Stars" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-2ea44f?style=flat-square" alt="MIT License" />
  </a>
  <a href="https://github.com/deepseek-ai/deepseek-harness">
    <img src="https://img.shields.io/badge/DeepSeek%20Harness-Web%20Runtime-4D6BFE?style=flat-square" alt="DeepSeek Harness" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
</p>

[English](README.md) | **简体中文**

</div>

## `dev` 分支：免费与 API 搜索融合版

本分支将 [dsh-free-search](https://github.com/DDDMUC/dsh-free-search/tree/d1beabcf643256d95823a9cb8f06fc8f84a40483) 的搜索引擎和公开平台检索接入现有 dsh-web-tools，共用 Provider、密钥池、代理、设置页面及标准 `web_search` / `web_fetch` 工具。切换时请停用单独安装的 dsh-free-search，将本插件作为 Web Provider。已有搜索顺序和凭证继续保留，凭证统一由本插件的 Host 凭证服务管理。

在 **设置 → Web 搜索** 中选择访问模式：

| 模式 | 搜索顺序 | 网页正文提取 |
| --- | --- | --- |
| `free-only`（仅免费） | 匿名端点及明确配置的 SearXNG 实例；不发送已保存的 API Key | 内置 HTTP 提取；原有已登录 X / 小红书来源仍可使用 |
| `free-first`（免费优先） | 先尝试匿名端点，再尝试已配置的 API 账号 | 原生提取及 HTTP 回退 |
| `api-first`（API 优先，默认） | 先尝试已配置的 API 账号，再尝试匿名端点 | 原生提取及 HTTP 回退 |

模式对已配置搜索顺序中的来源分组。Exa、Tavily、Keenable 各自支持匿名和账号两种访问方式，匿名失败与账号鉴权失败、冷却状态分别记录。Bing、DuckDuckGo HTML、DuckDuckGo Lite、AnySearch 不需要 Key；Perplexity Sonar 和 DeepSeek 官方联网搜索需要账号 Key。SearXNG 只使用明确填写的 Base URL 或实例列表，需要实例启用 JSON 输出，可配置每个实例的超时；整个 SearXNG 调用仍受 Provider 总尝试超时限制。

建议从 `free-first` 开始，按需将 Bing、DuckDuckGo Lite、Exa、Tavily、AnySearch、Keenable 加入搜索顺序。新安装仍首选 Exa，默认回退顺序为 Bing → DuckDuckGo HTML → DuckDuckGo Lite → AnySearch → Tavily → Keenable；已有保存顺序不会自动添加来源。测试按钮检查当前模式允许的已启用通用搜索源；平台查询可在下方搜索测试中使用明确前缀检查。

公开平台使用明确前缀，独立于通用 Provider 搜索顺序：

| 查询示例 | 实际检索范围 |
| --- | --- |
| `GitHub: deepseek harness` | 仓库搜索，不包含需要鉴权的代码搜索 |
| `V2EX: AI` | 筛选当前热门主题列表，不提供历史全站检索 |
| `B站: DeepSeek` | Bilibili 视频搜索 |
| `Reddit: typescript` | Reddit 公开帖子 |
| `HN: agents` | 通过 Algolia 搜索 Hacker News，链接到讨论页 |
| `StackOverflow: node fetch` | Stack Overflow 问题 |
| `Wikipedia: 人工智能` | 中文或英文维基百科，可在设置中切换 |
| `npm: cordis` | npm 软件包搜索 |

每个平台均有独立开关。明确指定的平台被禁用或公开 API 不可用时，会返回错误，不用通用网页结果代替站内结果。普通主题词不会触发这些公开平台。X 与小红书沿用下文的浏览器登录流程。

支持 `time:3d`、`time:12h`、`time:2mo`、`time:1y` 相对时间提示；明确的 `after:YYYY-MM-DD` 优先。日期精度为天，各引擎只应用自身支持的过滤条件。搜索结果使用插件实例独立的 LRU 缓存，默认 300 秒、50 条；缓存区分查询、来源、账号和生效配置。缓存时间设为 0 即关闭，空结果、失败和取消请求不写入缓存。

免费端点可能调整、要求浏览器验证、返回空结果或受到共享限流，不保证持续可用。可运行 `npm run probe:search` 检查当前网络下的免 Key 来源；该命令不测试付费 API 账号、私有 SearXNG 实例或已登录的 X / 小红书会话。上游版本及验证记录见[实现说明](https://github.com/sdwhwzp/dsh-web-tools/blob/dev/.agents/notes/implemented/feature/2026-09-11-unified-free-web-search.md)，来源许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

### 多账号部署

小红书和 X 的登录窗口打开在运行 DSH 的主机上。远程网页不会在访问者的电脑上弹出该窗口，当前版本不提供网页远程桌面。主机需要安装 Chrome／Chromium 或 Edge，Linux 还需要服务进程可访问的图形桌面。平台设置会显示缺少浏览器或桌面的原因、等待登录状态及启动失败或超时错误；重复点击不会启动多个登录流程。

Harness 安装 `requestPrincipal` 服务后，`/web-tools/api` 通过该服务验证每个调用者。全局搜索配置、密钥、配额、搜索测试及浏览器登录管理仅限管理员；普通账号只能读取或修改 `principalAccess` 允许访问的会话搜索模式。身份验证或会话授权不可用时拒绝访问。独立本机安装保留回环地址和同源检查。

提供方密钥及已登录的 X／小红书浏览器 Profile 属于共享 Host。多账号生产环境应通过 `platformEnabled: { x: false, xiaohongshu: false }` 关闭这两个来源，除非明确允许所有账号共享这些登录来源。公开平台及匿名网页搜索仍可使用。安装此 bundle 前记录完整的现有依赖固定版本和 Cordis patch 行；其中 `web` 和 `tool-web` 行会替换对应的整个配置对象。

## 它解决什么问题

当联网能力只依赖一个 Web Provider 时，额度耗尽、限流或服务异常都可能直接中断检索；而简单接入多个搜索 API，往往又只能使用它们共同支持的基础能力，没有真正发挥不同搜索源各自擅长的搜索模式、分类、时效、域名策略和正文提取能力。

dsh-web-tools 将 15 个通用搜索 Provider、8 个公开平台来源，以及小红书、Twitter / X 接入 DSH 标准 `web_search` / `web_fetch`。

在统一 DSH 工具接口的同时，dsh-web-tools 通过 SearchHints 归一化查询意图，再针对不同 Provider 分别编译为其支持的原生参数，尽可能使用各家的分类、时效、域名、地区、深度搜索与正文提取能力；同时通过多 API Key、Provider Fallback 和平台专用浏览器会话，提高整个联网链路的可用性。

---

**核心亮点**：

- **15 大 Web Provider 原生能力深度适配**：保持统一 `web_search` / `web_fetch` 接口，但不把不同搜索源压成最低公共能力。针对 Exa、Tavily、Firecrawl、Parallel、Brave、You.com、Jina、SearXNG 分别适配搜索类型、时效、域名策略、地区语言、深度检索与正文提取能力。
- **SearchHints → Provider-specific 参数编译**：将 Query 中的技术 / 论文 / 新闻、时效、域名、地区与语言等搜索意图归一化，再按不同 Provider 的能力映射为各自原生参数；整个过程由确定性代码完成，不增加额外 LLM 调用。
- **小红书与 Twitter / X 平台来源**：两个平台均通过独立的本地浏览器 Profile 提供已登录站内搜索、详情抓取，以及页面实际返回的评论或回复。
- **多搜索源调度与自动容灾**：支持多 API Key 分配、鉴权失败切换、429 冷却、Ordered / Round-Robin / Random 路由，以及可配置 Provider Fallback。
- **DSH 原生工具集成**：直接复用标准 `web_search` / `web_fetch`，模型侧无需学习额外工具，同时提供会话级「联网搜索」模式。

```text
                         DSH Agent
                            │
                 web_search / web_fetch
                            │
                            ▼
                       SearchHints
            topic / freshness / domains
               locale / cleanQuery ...
                            │
                 Provider-specific
                    compilation
                            │
      ┌────────┬─────────┬───────────┬──────────┐
      │  Exa   │ Tavily  │ Firecrawl │ Parallel │ ...
      │        │         │           │          │
      │category│ topic   │ github    │objective │
      │ date   │ chunks  │ research  │ policy   │
      │domains │ time    │ tbs       │ queries  │
      └────────┴─────────┴───────────┴──────────┘

```

<p align="center">
  <img src="https://raw.githubusercontent.com/A3Boy/dsh-web-tools/main/assets/searchOrderAndRouting.png" width="900" alt="dsh-web-tools 搜索策略与多源调度" />
</p>

## 15 大 Web Provider 原生能力深度适配

统一的是 DSH 的工具接口和搜索语义，不统一的是各家 Provider 的能力。

dsh-web-tools 通过 SearchHints 表达查询意图，再针对不同 Provider 分别构造请求，而不是把所有搜索源压缩成一套最低公共参数。

例如，同样是“搜索最近一周的 AI 编程资料”：

* **Exa**：映射分类、ISO 日期范围与域名限制；
* **Firecrawl**：技术查询映射至 `github` 分类，研究类查询映射至 `research`，并结合 `tbs` 时效过滤；
* **Parallel**：组合 `objective`、`search_queries` 与 `source_policy`；
* **Brave Search**：映射 freshness、国家与搜索语言，并优先使用 LLM Context；
* **You.com**：通过 `boost_domains` 对指定域名进行软加权。

这些适配全部由确定性代码完成，不会为了选择 Provider 参数再额外调用一次 LLM。

* **Exa**：精确分类映射（publication / news / financial report）、ISO 日期范围与域名限制。
* **Firecrawl**：代码与技术查询映射至 `github` 分类，论文与学术查询映射至 `research`，并支持 `tbs` 时效、域名限制与 Clean Markdown 抓取。
* **Parallel**：双层语义优化（`objective` 软引导 + `search_queries` 纯净词）与 `source_policy` 域名/时效过滤。
* **Tavily**：支持 `basic` / `advanced` / `fast` / `ultra-fast` 搜索深度；`basic`、`advanced`、`fast` 模式支持 `chunks_per_source` 分块控制，并映射 `news` / `finance` 话题、日期区间、国家与域名约束。
* **Brave Search**：LLM Context 预提取端点，支持 `pd/pw/pm/py` 时效、国家与搜索语言。
* **You.com**：原生 **`boost_domains`** 软加权支持，时效与地区国家过滤。
* **Jina**：搜索关键词降噪与 ReaderLM-v2 高精度 Markdown 正文解析。
* **SearXNG**：自建元搜索支持 `categories` (it/science/news) 与 `time_range`。
* **原生与通用正文提取 (`web_fetch`)**：配置 Tavily、Exa、Firecrawl、Parallel、You.com、Jina 时自动优先调用其原生云端提取接口；未配置或失败时，以及使用 SearXNG / Brave 时，自动平滑回退至**插件内置通用 HTTP 抓取器**（基于 Defuddle 纯本地 Markdown 解析与 SSRF / DNS 安全防护），无需额外配置或购买第三方 Fetch Key。

---

## 平台搜索源（小红书与 Twitter / X）

区别于通用搜索引擎，插件通过专用浏览器会话直接连接社媒平台：

* **原生独立浏览器会话架构**：
  * 基于本机已安装的 Edge / Chrome 专用 Profile 与 CDP 通信。
  * **0 浏览器扩展、0 Playwright / Chromium 外部打包**。Cookie 由专用浏览器 Profile 管理，插件不会将其写入配置、日志或中转服务；浏览器仍会按正常认证流程发送给对应平台。

* **小红书**：
  * **笔记详情与评论抓取 (`web_fetch`)**：通过专用浏览器 Profile 解析 `__INITIAL_STATE__` 结构化数据并自动 DOM 兜底，保留完整 `xsec_token` 签名 URL；页面成功加载评论数据时，同时逐条提取一级评论与已返回的楼中楼回复。
  * **站内搜索发现 (`web_search`)**：默认使用已登录浏览器，从 `/explore` 的真实搜索框进入，只输入清洗后的主题词，不带平台名或 `site:` 限定；同时区分登录墙、安全验证和真实退出登录。排查浏览器问题时可通过 `XHS_NATIVE_SEARCH=0` 临时关闭。

* **Twitter / X**：
  * **原生搜索、推文详情与回复**：通过 CDP 捕获 X Web 客户端自身的 GraphQL 数据流（SearchTimeline / TweetDetail），结构化解析目标推文及其回复树，并以 DOM 作为补充与兜底；支持 `from:`、`since:`、`until:` 等搜索算子。

单次详情抓取最多附带 30 条评论或回复，单条内容最多保留 800 个字符；仍有后续分页或楼中楼内容时会明确标记为截断，避免无界占用模型上下文。

> **能力边界说明**：对于正文主要位于图片中的小红书笔记，目前会返回标题、文字描述、互动数据、图片数量以及页面已加载的评论，但暂不识别图片中的文字，也不会自动抓取全部评论分页。

Agent 使用 `小红书:` 或 `X:` 作为平台路由前缀。前缀只负责选择平台，插件会在实际站内搜索前移除它；例如 `小红书: DeepSeek Harness` 最终输入小红书搜索框的是 `DeepSeek Harness`。

* **通用 Web 降级 (Web Fallback)**：平台来源未启用、运行时暂不可用或发生可重试故障时，改由已配置的通用搜索或抓取 Provider 处理；登录失效、访问受限、站内搜索受限、无效详情地址等非重试错误会直接返回，不会用索引内容冒充原生站内结果、详情或评论。
* **登录态自动验证**：Cookie 只作为第一层门槛。小红书要求同时存在 `a1` 与 `web_session`，随后还会通过交互浏览器稳定检查 `/explore` 的真实页面状态；可见登录墙会使旧 Session 立即失效并重新显示登录入口。搜索提交后的独立登录墙会直接标记为 `search-restricted`，不会再用网页索引结果掩盖站内搜索失败。

<p align="center">
  <img src="https://raw.githubusercontent.com/A3Boy/dsh-web-tools/main/assets/platformSessions.png" width="900" alt="小红书与 Twitter X 登录态自动验证" />
</p>

---

## 调度策略与容灾机制

* **多 API Key 负载与容灾**：支持为单个 Provider 配置多个 API Key，并发调用优先分配低 `inFlight` 的 Key，鉴权失败自动切换备用 Key。
* **确定性 Provider Fallback**：遇到网络异常、超时、5xx 服务端错误、429 限流或配额耗尽时，自动降级至链条中的下一搜索源。
* **429 Retry-After 临时冷却**：遭遇限流并携带 `Retry-After` 时触发零请求冷却，避免在冷却期内产生无效请求。
* **搜索路由策略**：`web_search` 支持顺序模式（Ordered）、轮询模式（Round-Robin）和随机模式（Random）；`web_fetch` 始终按可抓取 Provider 的确定性链条执行。
* **会话级联网搜索 (Search Mode)**：开启后要求 Agent 在回答前至少完成一次 `web_search` 或 `web_fetch` 调用；失败也算已尝试，但 Agent 会被要求说明哪些内容未能验证。
* **代理支持**：支持 Windows 系统代理、`HTTP_PROXY`、`HTTPS_PROXY` 和 `NO_PROXY`，本地回环地址自动绕过代理。

---

## 安装与更新

```bash
# 安装插件
dsh plugin --profile web add github:sdwhwzp/dsh-web-tools#dev

# 更新插件
dsh plugin --profile web update dsh-web-tools

# 卸载插件
dsh plugin --profile web remove dsh-web-tools

```

重启 `dsh web`，在左侧侧边栏进入：`Settings` → `Web Search`。

---

## Provider 支持矩阵

| Provider | 搜索 (Search) | 抓取/提取 (Fetch / Extract) | 核心特性与深度适配能力 | 配额查询 (Quota) |
| --- | --- | --- | --- | --- |
| [Exa](https://exa.ai) | 支持 | 支持，`/contents` | 语义检索 (`auto` / `fast` / `deep`)、垂直分类映射、Query-aware 高亮切片、ISO 日期范围与域名限制 | 控制台自查 |
| [Tavily](https://tavily.com) | 支持 | 支持，`/extract` | 搜索深度 (`basic` / `advanced` / `fast` / `ultra-fast`)，前三种模式支持分块控制，并映射 `news` / `finance`、日期、国家与域名参数 | 官方 API |
| [Firecrawl](https://firecrawl.dev) | 支持 | 支持，`/scrape` | 技术查询映射 `github` 分类、学术查询映射 `research`，支持 `tbs`、域名限制与 Clean Markdown 提取 | 官方 API |
| [Parallel](https://parallel.ai) | 支持 | 支持，`/v1/extract` | 双层语义检索 (`advanced` / `basic` / `turbo`)、`objective` 软引导、`source_policy` 域名/时效过滤 | 控制台自查 |
| [Brave Search](https://brave.com/search/api/) | 支持 | — | 默认优先 LLM Context 预提取模式，支持时效/区域语言过滤，不支持时自动回退 Classic 搜索 | 响应头自动捕获 |
| [You.com](https://you.com) | 支持 | 支持，`/v1/contents` | 搜索高亮片段提取、原生 **`boost_domains`** 软加权、时效与国家过滤、Markdown 正文接口 | 官方 API |
| [Jina](https://jina.ai) | 支持 | 支持，Reader | 搜索关键词降噪、ReaderLM-v2 高精度 Markdown 转换、Token 预算控制 | 尽力解析 |
| [SearXNG](https://docs.searxng.org) | 支持 | — | 开源自托管元搜索引擎，映射 `categories` (it/science/news) 与受支持的 `time_range`，适配器无需 API Key | 由自建实例决定 |
| Bing | 支持 | — | 匿名 HTML 搜索，可选地区与安全搜索级别 | 公开端点限额 |
| DuckDuckGo HTML | 支持 | — | 匿名 HTML 搜索，支持地区、安全搜索与日期预设 | 公开端点限额 |
| DuckDuckGo Lite | 支持 | — | 匿名 Lite 搜索，可独立回退 | 公开端点限额 |
| AnySearch | 支持 | — | 匿名 JSON 搜索 | 公开端点限额 |
| Keenable | 支持 | — | 匿名 MCP 或带 Key 的 REST 搜索 | 由端点或账号决定 |
| Perplexity | 支持 | — | Sonar 回答与引用，可配置模型及输出 Token 数 | 账号计费 |
| DeepSeek 官方 | 支持 | — | 带引用的托管联网搜索，使用独立搜索凭证 | 账号计费 |

### 快速选型指南

新安装默认首选 Provider 为 **Exa**；已有安装继续沿用已保存的 Provider 配置。

| 需求场景 | 推荐首选 | 说明 |
| --- | --- | --- |
| **社媒内容发现 / 详情抓取** | **小红书 / Twitter / X** | 两个平台均支持已登录站内搜索、详情抓取，以及实际返回的评论或回复 |
| **语义检索 / 技术文档** | **Exa** | 支持语义模式、分类、日期、域名与高亮参数 |
| **预提取搜索上下文** | **Brave Search** | 优先使用 LLM Context，失败时回退 Classic Search |
| **可调深度搜索与正文提取** | **Tavily** / **Parallel** | 提供 Provider 原生深度档位与内容提取接口 |
| **正文转 Markdown** | **Firecrawl** / **Jina** | 支持正文提取、主内容过滤或 Reader 转换 |
| **时效、地区与域名偏好** | **You.com** | 支持 freshness、地区语言和 `boost_domains` 参数 |
| **自托管元搜索** | **SearXNG** | 使用用户自己的 SearXNG 地址，适配器不要求 API Key |

---

## 本地开发

使用 Node.js 22.21.1 或受支持的更新版本。CI 使用已提交的 npm lockfile 检查 `main` 和 `dev` 分支。

```bash
npm ci --include=optional # 安装依赖
npm test              # 运行测试套件
npm run typecheck    # 类型检查
npm run build        # 编译构建 (产物输出至 lib/)

```

---

## 常见问题

### 自建 SearXNG 配置与排错

使用 Docker 或自托管 SearXNG 时，若提示 `no usable provider` 或返回 403 拒绝访问，请检查以下两项配置：

1. **必须开启 JSON 格式输出**：SearXNG 默认仅启用了 HTML 输出。编辑 SearXNG 的 `settings.yml` 文件，在 `search.formats` 中增加 `- json`：
   ```yaml
   search:
     formats:
       - html
       - json # 必须包含 json，供 API 接口调用
   ```
   修改后重启 SearXNG 容器（例如 `docker restart searxng`）生效。
2. **免 Key 访问**：SearXNG 属于自建免 Key 搜索源，插件面板中无需填写 API Key（留空即可）。在 `Base URL` 中填入你的 SearXNG 实例地址（如 `http://127.0.0.1:8080`），点击「测试搜索」即可验证连通性。

### 缓存与重新安装

若使用本地包或软链接升级遇到缓存问题，可前往 Profile 目录重新安装：

```bash
cd ~/.dsh/profiles/web && pnpm install

```

Exa 和 Parallel 的余额需要在 Provider 控制台查看；Brave 的配额信息来自实际搜索响应头。配额展示仅用于状态说明，不影响正常检索与降级。

小红书和 Twitter / X 分别使用独立的本地浏览器 Profile。插件不会把原始 Cookie 导出到配置、日志或第三方中转服务；浏览器会按正常登录与访问流程将 Cookie 发送给对应的平台域名。

---

## 许可

[MIT](LICENSE) © A3Boy
