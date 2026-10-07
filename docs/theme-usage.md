# astro-koharu 主题使用手册

本文汇总 astro-koharu 主题的使用方法，内容整合自仓库中原有的 7 篇主题说明文章。
所有路径与命令均按**当前仓库（`F:\myhomepage`）的实际情况**核对过；下文与原始文章中冲突之处，以本文为准（差异见文末「勘误」）。

- 主题版本：astro-koharu v6.3.0
- 上游仓库：https://github.com/cosZone/astro-koharu
- 本仓库：https://github.com/charienustc/charienustc.github.io

---

## 1. 快速开始

### 环境要求

- Node.js 22.x
- pnpm 10.28.2（`package.json` 的 `packageManager` 字段已锁定精确版本）

### 常用命令

```bash
pnpm install        # 安装依赖
pnpm dev            # 启动开发服务器（localhost:4321）
pnpm build          # 构建生产版本
pnpm preview        # 预览生产构建
```

> `pnpm dev` 与 `pnpm build` 都会先执行 `pnpm koharu migrate --check`，检查旧内容链接是否需要迁移。

### 站点基本信息

编辑 `config/site.yaml`：

```yaml
site:
  title: 站点标题
  alternate: 英文短名        # 用作 logo 文本
  subtitle: 副标题
  name: 作者简称
  description: 站点简介      # 用于 SEO
  avatar: /img/avatar.webp
  url: https://example.com/  # 站点域名，影响 RSS 与 sitemap
  startYear: 2024            # 页脚版权起始年份
  keywords:
    - 关键词1
```

> 修改 `config/site.yaml` 后需重启 dev server 或重新构建——YAML 在构建期被缓存。

### 构建缓存

`.cache/og-data.json` **有意提交到 Git**。它缓存链接嵌入所抓取的外部链接 OG 元数据，提交后 Vercel / Netlify 等平台构建时可复用，无需重复抓取。

`.cache/` 下的其他内容（`transformers/` 模型缓存、`summaries-cache.json`）仍被 `.gitignore` 忽略。

---

## 2. 文章系统

### 创建文章

**方式一：Koharu CLI（推荐）**

```bash
pnpm koharu new post      # 交互式创建文章，自动生成 frontmatter
pnpm koharu new friend    # 创建友链
```

**方式二：手动创建**

在 `src/content/blog/` 下新建 Markdown 文件。**目录结构决定分类**：

```plain
src/content/blog/
├── life/                  # 随笔
├── note/
│   └── front-end/         # 笔记 > 前端（嵌套分类）
├── tools/                 # 工具
└── en/                    # 英文译文（按 locale 子目录组织）
```

**方式三：本地 CMS** —— 见第 6 节。

### Frontmatter 字段

**必填：**

```yaml
---
title: 文章标题
date: 2024-12-06
---
```

**常用可选字段：**

```yaml
---
title: 文章标题
date: 2024-12-06
updated: 2024-12-15      # 存在时文章页显示更新时间
description: 摘要描述      # 用于 SEO 与列表展示
link: custom-url-slug    # 自定义 URL（默认取文件名）
cover: /img/cover/1.webp # 封面图
tags: [JavaScript, React]
categories: [笔记]
subtitle: 副标题
catalog: true            # 是否计入分类页统计，默认 true
tocNumbering: true       # 目录是否自动编号，默认 true
draft: false             # 草稿，默认 false
sticky: false            # 置顶，默认 false
excludeFromSummary: false # 排除 AI 摘要与相似度计算；系列文章建议 true
math: false              # 启用 KaTeX 数学公式
quiz: false              # 启用练习题交互
password: mySecret       # 整篇加密，设置后需密码才能阅读
---
```

**`description` 的优先级**：手写 `description` > AI 摘要 > 正文前 150 字。
建议重要文章手写描述以获得更好 SEO。

**`link` 字段会被自动转为小写**：

```yaml
link: my-awesome-post   # ✅ 推荐：URL = /post/my-awesome-post
link: MyAwesomePost     # ⚠️ URL = /post/myawesomepost
```

省略 `link` 时使用文件名，同样会转小写。`summaries.json` / `similarities.json` 的 key 也统一为小写。

### 嵌套分类

`categories` 使用嵌套数组可创建层级：

```yaml
categories:
  - [笔记, 前端]
```

对应 URL `/categories/note/front-end`，面包屑显示「笔记 → 前端」。

> 中文分类名到 URL slug 的映射在 `config/site.yaml` 的 `categoryMap` 中配置（如 `笔记: note`）。

---

## 3. 界面功能

### 主题切换

点击右上角太阳/月亮图标切换深浅色。代码高亮主题：浅色 `github-light`，深色 `github-dark`。

### 全站搜索

基于 [Pagefind](https://pagefind.app/) 的静态搜索，无后端。

- 点击导航栏搜索图标，或按 `Cmd/Ctrl + K`
- 支持中文分词、实时高亮、显示摘要

### 阅读辅助

- **目录导航**：自动提取 h2–h6，用 CSS 计数器生成层级编号（`1.` / `1.1.` / `1.1.1.`）
- 通过 frontmatter 的 `tocNumbering: false` 关闭某篇文章的编号
- 阅读进度条与阅读时间估算
- 移动端文章头部显示当前章节标题与圆形进度

---

## 4. 特色功能

### 系列文章（featuredSeries）

在 `config/site.yaml` 配置，每个系列生成独立页面（如 `/weekly`）：

```yaml
featuredSeries:
  - slug: weekly
    categoryName: 周刊
    highlightOnHome: true    # 首页高亮最新一篇
  - slug: reading
    categoryName: 书摘
    highlightOnHome: false
```

**设计意图：把高产出分类从首页分离**，避免首页被单一类型文章刷屏。适合周刊/日记、读书笔记等更新频繁的分类。

- 系列文章从首页主列表排除
- `highlightOnHome: true` 时最新一篇在首页顶部高亮
- 归档、分类、标签、搜索页仍正常显示系列文章

> 每个系列需唯一 `slug`，且不得与保留路由冲突。

### 归档页

`/archives` —— 按年份分组、时间线展示，含数量统计。

### 友链

`/friends` —— 友链卡片 + 申请表单。友链数据配置见 `src/constants/friends-config.ts` 与 `config/site.yaml`。

### LQIP（低质量图片占位符）

构建时提取图片主色调生成 CSS 渐变占位，避免加载空白与布局抖动。纯 CSS、零运行时开销，每张图仅约 18 字符。

```bash
pnpm generate:lqips      # 处理 public/img/ 下所有图片
```

生成结果在 `src/assets/lqips.json`：

```json
{
  "cover/1.webp": "87a3c4c2dfefbddae9",
  "cover/2.webp": "6e3b38ae7472af7574"
}
```

应用于文章卡片封面、页面横幅、分类卡片、系列封面、侧边栏头像等。

> ⚠️ 请用 `pnpm generate:lqips` 或 `npx tsx src/scripts/generateLqips.ts` 生成。`pnpm koharu generate lqips` 这个包装命令在本仓库会静默失败。

### AI 摘要

```bash
pnpm generate:summaries          # 生成摘要
pnpm generate:summaries:force    # 强制重新生成
```

- 默认模型 `Xenova/LaMini-Flan-T5-783M`（约 300MB，首次运行自动下载到 `.cache/transformers`）
- 结果写入 `src/assets/summaries.json`，**需提交到 Git**
- 需本地运行（部署平台无法跑大模型）
- 未生成时会 fallback 到正文提取

模型与提示词可在 `src/scripts/generateSummaries.ts` 的 `MODEL_NAME` / `PROMPT_TEMPLATE` 中修改。

### 语义相似度推荐

```bash
pnpm generate:similarities        # 本地运行，首次需下载模型（约 3–5 分钟）
pnpm generate:similarities:gpu    # 使用 GPU
```

结果写入 `src/assets/similarities.json`，用于文章底部的相关推荐。

### 评论系统

`src/components/comment/Comment.astro` 是一个 **provider 路由组件**，按
`config/site.yaml` 的 `comment.provider` 动态选择并懒加载对应实现。内置四种，
依赖已装好，切换只需改配置。

| provider | 数据存放 | 需自建服务端 |
| --- | --- | --- |
| `giscus` | GitHub Discussions | ❌ |
| `waline` | 自建 / Vercel | ✅ |
| `twikoo` | 腾讯云 / Vercel | ✅ |
| `remark42` | 自建服务器 | ✅ |

**已挂载评论的页面**：文章页、`/about` 等独立页面（受 frontmatter
`comments: false` 控制）、`/friends`、`/bangumi`。其中 `/bangumi`
默认关闭（`bangumi` 段被注释 → 页面与导航一并隐藏）。

本仓库当前使用 **giscus**：

```yaml
comment:
  provider: giscus
  giscus:
    repo: charienustc/charienustc.github.io
    repoId: R_kgDOTdSR5Q
    category: Announcements
    categoryId: DIC_kwDOTdSR5c4DG2qx
    mapping: pathname
    reactionsEnabled: '1'
    emitMetadata: '0'
    inputPosition: top
    lang: zh-CN
```

**配置 giscus 的三个前置条件**（缺任一都会导致评论框不显示或报错）：

1. **仓库开启 Discussions** —— Settings → General → Features → 勾选 Discussions
2. **安装 giscus App** —— <https://github.com/apps/giscus>，选对应仓库。
   **必须走网页 OAuth，无 API 可替代**
3. **拿到 `repoId` 与 `categoryId`**

> ⚠️ `repoId` / `categoryId` 是 GitHub 内部 GraphQL ID（形如 `R_kgDO...` /
> `DIC_kwDO...`），无法手写推导。除在 <https://giscus.app> 手动抄取外，
> 也可用 `gh` 直接从 API 取，省去一步：
>
> ```bash
> # 开启 Discussions
> gh api -X PATCH repos/<owner>/<repo> -f has_discussions=true
>
> # repoId = 仓库 node_id
> gh repo view <owner>/<repo> --json id
>
> # categoryId = 从分类列表里找
> gh api graphql -f query='
> query {
>   repository(owner: "<owner>", name: "<repo>") {
>     discussionCategories(first: 25) { nodes { id name isAnswerable } }
>   }
> }'
> ```

**分类选择的硬约束**：giscus 只支持 **Announcement** 或普通
**Open-ended discussion** 类型的分类。列表里 `isAnswerable: true`
的分类（如 `Q&A`）**不能用于 giscus**，会被拒绝。

> ⚠️ GitHub GraphQL API **没有**创建 Discussion 分类的 mutation
> （`createDiscussionCategory` 不存在）。想要独立分类只能网页手动建。

**`mapping` 的取舍** —— 决定评论与页面的关联方式：

| 取值 | 关联依据 | 风险 |
| --- | --- | --- |
| `pathname`（默认） | 文章路径 | **改 URL 会丢评论关联** |
| `og:title` | 文章标题 | 改标题会丢关联 |

两者都只是把风险换个位置。建议写文章时定好 slug 就别再改。若确实要改
URL，可手动把原 discussion 的标题改成新路径来保住关联。

**验证是否配置成功** —— 打开任一有评论的页面，若 iframe 内渲染出
「**使用 GitHub 登录**」按钮，说明 App 已装、权限已通；若提示
`giscus is not installed on this repository`，则第 2 步未完成。

### 圣诞特效

可开关的节日装饰（雪花、圣诞配色、圣诞帽、灯串），配置见 `config/site.yaml` 的 `christmas` 部分。相关样式在 `src/styles/christmas/christmas-theme.css`。

### 一次性生成全部资产

```bash
pnpm generate:all    # lqips + summaries + similarities
```

---

## 5. 多语言（i18n）

**当前仓库只启用中文与英文**，`config/site.yaml`：

```yaml
i18n:
  defaultLocale: zh
  locales:
    - code: zh
      label: 中文
    - code: en
      label: English
```

两点机制：

- **UI 字符串**：`src/i18n/translations/` 下的 TypeScript 字典（`zh.ts` 是 key 的 source of truth，`en.ts` 为部分覆盖，缺失 key 回退到 zh）
- **内容译文**：非默认语言的文章放在 `src/content/blog/<locale>/`，由目录前缀识别；分类名/系列名等翻译在 `config/i18n-content.yaml`

**路由**：默认语言 URL 无前缀，其他语言加前缀（如 `/en/post/xxx`）。`src/pages/[lang]/` 下是镜像路由。

> ⚠️ 不要在 `astro.config.mjs` 中启用 Astro 的 `fallback`，它会破坏 `[seriesSlug].astro` 动态路由。

---

## 6. 本地 CMS（文章管理界面）

仓库自带独立的浏览器端文章管理应用。

```bash
pnpm cms:install    # 首次使用安装依赖（独立于主项目）
pnpm cms            # 启动，访问 http://localhost:4322
```

**功能：**

- 文章仪表盘：统计、分类分布、最近更新
- 浏览器内编辑：基于 BlockNote 的富文本编辑 + Markdown 预览
- Frontmatter 编辑：标题/日期/分类/标签
- 草稿切换、置顶管理、新建文章

**安全特性：** 服务端校验 Host 头，仅允许 localhost 访问；支持可选的 `CMS_API_KEY` 环境变量做 Bearer 鉴权。

> ⚠️ CMS **直接读写 `src/content/blog/` 下的源文件**，没有中间层。使用前建议先 `git commit`，改坏了可用 `git checkout -- src/content/blog` 回滚。

### 本地编辑器跳转

文章页的编辑按钮可一键用 VS Code / Cursor / Zed 打开对应文件，配置在 `config/site.yaml` 的 `dev` 部分：

```yaml
dev:
  localProjectPath: F:/myhomepage
  contentRelativePath: src/content/blog
  editors:
    - id: vscode
      name: VS Code
      urlTemplate: "vscode://file/{path}"
```

---

## 7. Koharu CLI

```bash
pnpm koharu                        # 交互式主菜单
pnpm koharu new [post|friend]      # 新建内容
pnpm koharu backup [--full]        # 备份内容与配置
pnpm koharu restore                # 还原（--latest / --dry-run / --force）
pnpm koharu migrate                # 迁移旧内容链接（--dry-run）
pnpm koharu update                 # 从上游更新主题（--check / --clean / --rebase 等）
pnpm koharu generate [lqips|similarities|summaries|all]
pnpm koharu clean [--keep N]       # 清理旧备份
pnpm koharu list                   # 列出所有备份
```

> `pnpm koharu update` 会用上游版本替换 `package.json` 等文件，执行前会先备份。

---

## 8. 定制外观

### 配色

主题色以 CSS 变量定义，入口在 `src/styles/theme/index.css`，浅深色分别通过 `:root` 与 `.dark` 覆盖。Tailwind 4 的命名空间配置在 `tailwind.config.mjs`。

> 注意 Tailwind 4 中 `backgroundImage` 与 `backgroundColor` 是**两个独立属性、会叠加**。若用 `bg-gradient-*` 与 `bg-background/NN` 同时作用在同一元素上，需额外用 `bg-none` 清掉渐变。

### 布局常量

`src/constants/layout.ts` 导出：

```typescript
export const CONTENT_PADDING = { /* ... */ };
export const MAX_WIDTH = { /* ... */ };
export const PAGINATION = { /* ... */ };
```

### 动画

动画基于 Motion 库，预设位于 `src/constants/anim/`（`spring.ts` 弹簧参数、`variants.ts` 变体）。主题会响应 `prefers-reduced-motion`。

### 响应式断点

沿用 Tailwind 默认断点：`sm` 640px / `md` 768px / `lg` 1024px / `xl` 1280px。

---

## 9. 开发指南

### 目录结构

```plain
├── src/
│   ├── components/      # 组件（common / ui / layout / post / category / theme）
│   ├── content/blog/    # 博客文章，en/ 为英文译文
│   ├── i18n/            # 国际化（config / utils / content / translations）
│   ├── layouts/         # 布局模板
│   ├── pages/           # 路由，[lang]/ 为镜像路由
│   ├── lib/             # 工具函数
│   ├── hooks/           # React hooks
│   ├── constants/       # 常量配置
│   ├── store/           # 全局状态（nanostores）
│   ├── scripts/         # 构建脚本
│   └── types/           # 类型定义
├── public/img/          # 静态图片资源
├── config/
│   ├── site.yaml        # 站点配置（含分类映射、i18n）
│   └── i18n-content.yaml # 内容级翻译
├── astro.config.mjs
├── tailwind.config.mjs
└── tsconfig.json
```

### 路径别名

```typescript
import { x } from '@/xxx';            // → src/xxx
import C from '@components/xxx';      // → src/components/xxx
import { u } from '@lib/xxx';         // → src/lib/xxx
import c from '@constants/xxx';       // → src/constants/xxx
```

完整列表见 `tsconfig.json`（另有 `@assets` `@content` `@layouts` `@pages` `@styles` `@hooks` `@store` `@scripts` `@types`）。

### 代码质量

```bash
pnpm lint          # Biome 检查
pnpm lint:fix      # Biome 自动修复
pnpm check         # Astro 类型检查
pnpm knip          # 查找未使用的文件与依赖
pnpm test          # 运行单元测试
pnpm lint-md       # 检查 Markdown
```

> 项目使用 **Biome**（非 ESLint），配置见 `biome.json`：行宽 128、单引号、尾逗号。提交前 `pnpm lint:fix` 与 `pnpm check` 应通过。

### Docker 部署

```bash
docker compose -f docker/docker-compose.yml up -d --build
open http://localhost:4321
```

目录：`docker/`（`Dockerfile` 多阶段构建、`docker-compose.yml`、`nginx/default.conf`、`rebuild.sh`）。

**生成脚本必须在本地运行**，不能在 Docker 构建期执行：

| 脚本 | 原因 |
|---|---|
| `pnpm generate:lqips` | 使用 `sharp` 原生模块 |
| `pnpm generate:similarities` | 需下载 500MB+ 模型 |
| `pnpm generate:summaries` | 需下载模型 |

推荐流程：本地 `pnpm generate:all` → 提交 `src/assets/*.json` → `./docker/rebuild.sh`。

---

## 10. 常见问题

**改了 `config/site.yaml` 没生效？**
YAML 在构建期缓存，需重启 dev server 或重新构建。

**`pnpm koharu generate lqips` 没反应？**
该包装命令在本仓库会静默失败，直接用 `pnpm generate:lqips`。

**分类 URL 是中文？**
在 `config/site.yaml` 的 `categoryMap` 中为分类名配置英文 slug。

**系列页面 404？**
检查 `featuredSeries[].slug` 是否与保留路由冲突。

**图片没显示占位色？**
运行 `pnpm generate:lqips` 后提交 `src/assets/lqips.json`。

**评论框不显示？**
先确认 `comment.provider` 不是 `none`。若为 `giscus`，检查仓库是否已开 Discussions 且装了 giscus App（见「评论系统」节）。

**换了文章 URL 后评论不见了？**
giscus 的 `mapping: pathname` 按路径关联评论，改 URL 会导致匹配不到原 discussion。discussion 本身还在 GitHub 上，未丢失。

---

## 勘误

原始 7 篇文章中以下内容与当前仓库不符，本文已修正：

| 原始表述 | 实际情况 |
|---|---|
| `pnpm lint` 运行 ESLint | 项目使用 **Biome**，无 ESLint |
| 编辑 `tailwind.config.ts` | 实际是 **`tailwind.config.mjs`** |
| `src/constants/layout.ts` 导出 `LAYOUT.maxWidth` 等 | 实际导出 `CONTENT_PADDING` / `MAX_WIDTH` / `PAGINATION` |
| 主题色变量位于 `src/styles/index.css` | 主题色定义在 `src/styles/theme/index.css` |
| 文中含 `blog.cosine.ren`、cosine 等个人信息 | 已替换为本仓库的实际配置 |
| 示例提及 `ja` / `ko` 语言 | 本仓库仅启用 **zh / en** |
| 配置示例中的 `christmasConfig` 位于 `site-config.ts` | 实际在 `config/site.yaml` 的 `christmas` 部分 |

---

*本文档整合自仓库原有的 7 篇文章（`getting-started`、`astro-koharu-guide`、`theme-customization`、`shoka-features`、`markdown-features`、`infographic-guide`、`astro-6-migration`），整合后这些文章已从博客中移除。Shoka 语法与 Markdown 语法的逐项示例（下划线、高亮、折叠块、标签卡、注音、练习题等）属于语法演示而非使用说明，未纳入本文，需要时可查阅上游仓库文档。*
