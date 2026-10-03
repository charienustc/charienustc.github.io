# Charien 的小窝

个人博客，记录科研、代码与生活。

- **线上地址**：<https://charienustc.github.io>
- **建站年份**：2026
- **时区**：Asia/Shanghai

## 技术栈

| 部分 | 说明 |
| --- | --- |
| 框架 | [Astro](https://astro.build/) 6.x，静态输出 |
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
- 分类可以写成 `'笔记'` 或 `['笔记', '前端']` 两种形式

### 碎碎念

放在 `src/content/moments/`，短内容，**没有标题**——正文就是内容：

```markdown
---
date: 2026-10-03 15:30:00
tags: ['日常']
---

随手写的一句话。
```

- 文件名用 `YYYY-MM-DD-HHmmss.md`，日期前缀保证按时间排序
- 编辑过的条目会多一个 `updated` 字段，页面上显示「改于 X」；没编辑过则不显示
- 站点页面：<https://charienustc.github.io/moments>

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

- 看所有文章和碎碎念，按分类/标签/状态筛选
- 新建文章、新建碎碎念；**编辑碎碎念**（保存前旧版自动留一份到 `backups/versions/`）
- 删除任何内容——**不会真删**，会移到 `backups/deleted/` 带时间戳保留
- 一键提交并推送到 GitHub（会先跑代码检查）

> CMS 只监听本机。它没有登录鉴权，**不要暴露到公网**。

### 删除与版本保留

`backups/` 目录（已加入 gitignore）里有两块：

| 目录 | 来源 |
| --- | --- |
| `backups/deleted/` | 删除的内容，文件名带毫秒时间戳 |
| `backups/versions/` | 编辑碎碎念时留下的旧版本 |

**这两处都不会自动清理**，需要时手动删：

```bash
rm -rf backups/deleted/* backups/versions/*
```

注意这只是本地的安全网 —— 它不在 Git 里，所以**从版本控制的角度看，删除仍是一次删除**。想真正保住内容，先提交。

## 部署

推送到 `main` 即自动部署到 GitHub Pages，工作流在 `.github/workflows/deploy.yml`。

不用手动构建，也不用配 Vercel / Netlify / Docker —— 这个站就是纯静态托管。

> 主题自带的「碎碎念」动态归档功能（从 Telegram 频道拉数据）**在本站未启用**，它需要 Node 按请求渲染的服务端，与静态托管不兼容。本站的碎碎念是上面那套自建方案，纯静态、可离线、无外部依赖。

## 配置

主要改 `config/site.yaml`：

- `site` —— 站点标题、副标题、作者、头像、URL、关键词
- `navigation` —— 顶部导航栏，支持子菜单
- `comment` —— 评论系统，当前用 giscus
- `moments` / `bangumi` / `featuredSeries` 等各功能开关

改完 YAML **需要重启开发服务器或重新构建**，配置在构建期被缓存。

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
