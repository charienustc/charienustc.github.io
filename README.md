# Charien 的小窝

个人博客，记录科研、代码与生活。

- **线上地址**：<https://charienustc.github.io>
- **建站年份**：2026
- **时区**：Asia/Shanghai

维护说明核对于 2026-10-15；完整入口见 [文档导航](docs/README.md) 与 [快速开始](GETTING-STARTED.md)。

## 技术栈

| 部分 | 说明 |
| --- | --- |
| 框架 | [Astro](https://astro.build/) 7.x，静态输出 |
| 交互 | React 19 |
| 样式 | Tailwind CSS 4.x |
| 内容 | Astro Content Collections（文章 + 碎碎念两个集合） |
| 搜索 | [Pagefind](https://pagefind.app/)，无后端 |
| 评论 | [giscus](https://giscus.app/)，基于 GitHub Discussions |
| 托管 | GitHub Pages，推送即自动部署 |
| 前端 CMS | 本地跑的一套写作面板，见下文 |

## 仓库结构

```plain
src/
├── content/
│   ├── blog/        # 文章（.md / .mdx）
│   └── moments/     # 碎碎念（.md，短内容）
├── pages/           # 文件路由；非默认语言在 [lang]/ 下有对应镜像
├── components/      # React 与 Astro 组件
├── layouts/         # 页面布局
├── lib/             # 工具函数（纯函数优先，带单测）
└── i18n/            # 翻译字典与路由
config/
├── site.yaml        # 站点配置：标题、导航、评论、各功能开关
└── i18n-content.yaml # 分类名、系列名等内容层翻译
cms/                 # 本地写作面板（独立的 TypeScript 项目）
```

## 本地开发

需要 **Node.js ≥ 22.20.0** 和 **pnpm 10.28.2**。

```bash
pnpm install
pnpm dev          # 开发服务器 → http://localhost:4321
```

`pnpm dev` 会先跑一次内容迁移检查，再启动 Astro。

### 常用命令

```bash
pnpm build        # 生产构建到 dist/
pnpm preview      # 预览构建产物
pnpm check        # Astro 类型检查
pnpm test         # 单元测试
pnpm lint:fix     # 格式化与自动修复
```

## 写内容

### 文章

放在 `src/content/blog/`，frontmatter 至少需要 `title` 和 `date`：

```markdown
---
title: 标题
date: 2026-10-03 15:30:00
categories:
  - [笔记, 前端]
tags: [Astro]
draft: true
---

正文。
```

- `draft: true` 的文章在开发环境可见，**生产构建里会被过滤掉**
- 正文里段内换行用**行尾双空格**表示
- 分类字段需为数组：单层写 `categories: [笔记]`，层级写 `categories: [[笔记, 前端]]`；不会按文件目录自动分类

### 碎碎念

放在 `src/content/moments/`，短内容，**没有标题**——正文就是内容：

```markdown
---
date: 2026-10-03 15:30:00
tags: ['日常']
---

随手写的一句话。
```

- 文件名用 `YYYY-MM-DD-HHmmss.md`，实际显示按 frontmatter 的 `date` 排序
- 编辑过的条目会多一个 `updated` 字段，页面上显示「改于 X」；没编辑过则不显示
- 站点页面：<https://charienustc.github.io/moments>
- 首页「最新动态」并列展示最新普通文章和最新可见碎碎念；详见 [静态碎碎念指南](docs/features/static-moments.md)

### 用 CMS 写作

仓库自带一套本地写作面板，适合不想开编辑器的时候用：

```bash
pnpm cms          # → http://localhost:4322
```

首次使用先装依赖：

```bash
pnpm cms:install
```

它能做的事：

- 文章仪表盘、搜索与筛选，独立的碎碎念列表
- 新建和编辑文章、碎碎念；文章提供历史浏览与恢复，碎碎念编辑前留存旧文件
- 碎碎念正文**支持表情和图片**：表情直接打；图片点「插入图片」选、粘贴截图、或拖进输入框，
  都会存到 `public/img/moments/` 并在光标处插入 Markdown 引用
- 删除任何内容——**不会真删**，会移到 `backups/deleted/` 带时间戳保留
- 一键提交并推送到 GitHub（会先跑代码检查）

> 上传的图片会**提交进仓库**（`public/` 是跟踪目录），并随静态站一起部署。
> 单张上限 5 MB，格式限 png / jpg / gif / webp / avif——服务端按**文件头字节**判定真实
> 类型，不信任文件名或 `Content-Type`。

> CMS API 校验本机 Host，支持可选 API key，但没有公网登录体系，**不要暴露到公网**。

完整操作、API 和存储边界见 [CMS 指南](docs/features/cms.md)。文章 Preview 需要另开终端运行 `pnpm dev`。

### 文章版本历史

在文章编辑器顶部点「历史版本」，可按备份时间查看保存前的 Markdown（包含文章属性），并恢复选中的版本。
恢复需再次确认，且会先备份当前文件，因此可以再次打开历史版本撤销恢复。有未保存改动时，请先保存再恢复。

文章备份保存在 `backups/versions/posts/`，按文章原目录组织，与碎碎念的旧版备份分开。
只有通过 CMS 保存的改动会自动备份；恢复会原样写回选中的文件内容，不会修改原版本的日期或属性。
这些备份仅保存在本机，不会提交到 Git，也不会自动清理。
手工改文件、Git 操作以及单独切换草稿/置顶不会生成文章版本；碎碎念目前仅保留文件旧版，没有历史弹窗。

### 删除与版本保留

`backups/` 目录（已加入 gitignore）里有两块：

| 目录 | 来源 |
| --- | --- |
| `backups/deleted/` | 删除的内容，文件名带毫秒时间戳 |
| `backups/versions/` | 碎碎念旧版；其中 `posts/` 子目录保存文章旧版 |

**这两处都不会自动清理**。清理前逐项确认并另存需要的备份，尤其注意 `versions/posts/` 中的文章历史。

注意这只是本地的安全网 —— 它不在 Git 里，所以**从版本控制的角度看，删除仍是一次删除**。想真正保住内容，先提交。

## 部署

推送到 `main` 即自动部署到 GitHub Pages，工作流在 `.github/workflows/deploy.yml`。

部署前会依次执行前台类型检查、CMS 类型检查、完整单元测试和生产构建；任何一步失败都会阻止发布。
工作流会通过各自的锁文件安装前台与 CMS 依赖。手动触发部署也执行相同检查。

不用手动构建，也不用配 Vercel / Netlify / Docker —— 这个站就是纯静态托管。

> 主题自带的「碎碎念」动态归档功能（从 Telegram 频道拉数据）**在本站未启用**，它需要 Node 按请求渲染的服务端，与静态托管不兼容。本站的碎碎念是上面那套自建方案，纯静态、可离线、无外部依赖。

## 配置

主要改 `config/site.yaml`：

- `site` —— 站点标题、副标题、作者、头像、URL、关键词
- `navigation` —— 顶部导航栏，支持子菜单
- `comment` —— 评论系统，当前用 giscus
- `friends` —— 友链列表与分组（buddies / theme 等）
- `announcements` —— 公告列表，新消息使用新 ID，旧消息可保留或设置 `endDate`；详见 [公告指南](docs/features/announcements.md)
- `analytics.umami` —— Umami Cloud 访客统计（`statistics_display` 可开页脚/文章 PV 展示）
- `moments` / `bangumi` / `featuredSeries` 等各功能开关

改完 YAML **需要重启开发服务器或重新构建**，配置在构建期被缓存。

## 开发验证

前台 `pnpm check` 与 `pnpm --dir cms exec tsc --noEmit` 均要求零错误。CMS 依赖独立安装，根目录安装不会覆盖它。
改代码后运行 `pnpm lint:fix`、相关类型检查、`pnpm test`、`pnpm build`，并验证受影响的界面。
Windows 上部分 POSIX 文件权限或符号链接测试可能因能力不足明确跳过；CI 的 Linux 环境继续验证这些分支。
智能体协作规则见 [AGENTS.md](AGENTS.md) 和 [CLAUDE.md](CLAUDE.md)。

## 致谢

本博客基于 **[astro-koharu](https://github.com/cosZone/astro-koharu)** 改造——感谢原作者
**[cosine](https://blog.cosine.ren/)** 设计并开源了这个主题。本站的导航结构、配色体系、
内容集合设计、i18n 架构与大部分组件都源自该项目，我只是在其基础上做了个人化调整。

主题的设计灵感来自 Hexo 的 [Shoka](https://shoka.lostyu.me/computer-science/note/theme-shoka-doc/) 主题。

同时感谢以下项目：

- [Astro](https://astro.build/) —— 静态站点框架
- [Pagefind](https://pagefind.app/) —— 无后端全站搜索
- [giscus](https://giscus.app/) —— 基于 GitHub Discussions 的评论
- [Biome](https://biomejs.dev/) —— 代码检查与格式化
- [es-toolkit](https://es-toolkit.slash.page/) —— 工具函数库
- [寒蝉全圆体](https://chinese-font.netlify.app/zh-cn/fonts/hcqyt/ChillRoundFRegular) —— 正文字体

## 许可

本仓库基于 astro-koharu，沿用其 **[AGPL-3.0](./LICENSE)** 许可。
