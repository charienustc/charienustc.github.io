# 快速开始

核对日期：2026-10-15。本文面向 Charien's Yard 当前仓库，完整文档见 [文档导航](docs/README.md)。

## 1. 安装并运行

需要 Node.js ≥ 22.20.0 和 pnpm 10.28.2。

```bash
git clone https://github.com/charienustc/charienustc.github.io.git
cd charienustc.github.io
pnpm install --frozen-lockfile
pnpm dev
```

访问 `http://localhost:4321`。`pnpm dev` 与 `pnpm build` 会先执行内容迁移检查。
若提示旧内容需要迁移，先阅读变更，再运行：

```bash
pnpm koharu migrate --dry-run
pnpm koharu migrate
```

迁移会先备份；已有 `link` 不应随意改写，改文章地址可能影响站内链接与评论匹配。

## 2. 用 CMS 写作

另开终端，在仓库根目录执行：

```bash
pnpm cms:install
pnpm cms
```

访问 `http://localhost:4322`。CMS 是独立依赖项目，不会因根目录 `pnpm install` 自动装好。

- 文章：新建草稿，编辑正文、属性和分类，Save 或 Ctrl/Cmd+S 保存。
- Preview：依赖已经运行的 Astro 开发服务器。
- 历史版本：查看保存前旧版，确认后恢复；恢复前也会备份当前文件，支持撤销。
- Moments：发布或编辑短内容，图片可选取、粘贴或拖入。
- Publish：提交并推送当前分支的全部工作区改动，操作前检查文件列表。

更多细节见 [CMS 指南](docs/features/cms.md)。CMS API 有本机 Host 校验和可选 API key，没有公网登录后台，不要公开 CMS 端口。

## 3. 手工写内容

文章放在 `src/content/blog/`，至少填写标题和日期：

```markdown
---
title: 我的第一篇文章
date: 2026-10-15 10:00:00
categories:
  - [笔记, 前端]
tags: [Astro]
draft: true
---

正文。
```

`draft: true` 在开发环境可见、生产构建隐藏。分类由 frontmatter 指定，文件夹主要用于组织文件。
层级分类使用嵌套数组，在 `config/site.yaml` 的 `categoryMap` 中维护分类到 URL 的映射。

碎碎念放在 `src/content/moments/`，只需 `date` 和正文，不需要标题。
见 [静态碎碎念](docs/features/static-moments.md) 与 [语法参考](docs/syntax-reference.md)。

## 4. 调整配置

编辑 `config/site.yaml`，修改后重启开发服务器：

| 配置 | 用途 |
| --- | --- |
| `site` | 名称、作者、时区、URL 和头像 |
| `navigation` | 导航栏 |
| `featuredSeries` | 多系列入口，数组各项需唯一 slug |
| `friends` | 友链和分组 |
| `announcements` | 多条公告，支持定时显示与已读状态 |
| `comment` | 评论，本站使用 giscus |
| `analytics.umami` | 访问统计与可选 PV 展示 |
| `content` / `motion` | 内容增强与动效 |

公告用法见 [公告指南](docs/features/announcements.md)。新公告新增唯一 ID 即可，旧公告可保留或设置到期时间。
`moments.enabled: false` 是动态 suite 功能开关，不影响本站静态 `/moments`。

## 5. 检查并部署

```bash
pnpm lint:fix
pnpm check
pnpm --dir cms exec tsc --noEmit
pnpm test
pnpm build
```

前台和 CMS 类型检查都要求零错误；Windows 上不具备 POSIX 权限或符号链接能力时，部分测试会说明原因后跳过。
涉及交互时还需用 `pnpm dev` / `pnpm cms` 验证，单元测试不能替代界面检查。

工作直接在 `main` 进行，确认改动后提交；只有明确要求推送时才执行 push。
推送 `main` 后，GitHub Actions 安装前台和 CMS 锁定依赖，依次检查两套类型、完整测试、生产构建，成功后发布 GitHub Pages。
本地 CMS 不会部署。失败日志可用 `gh run list` 和 `gh run view <run-id> --log-failed` 查看。

## 6. 内容生成与上游更新

文章或图片变化需要刷新相关生成资产时，使用：

```bash
pnpm koharu generate lqips
pnpm koharu generate summaries
pnpm koharu generate similarities
pnpm koharu generate all
```

按实际需要运行，摘要可能调用模型服务，相似度计算需要模型缓存；生成结果位于 `src/assets/`。
不要删除被跟踪的 `.cache/og-data.json`。

本站已深度定制。上游更新先查看 [版本对照和摘取记录](docs/overview/13-upstream-v7-upgrade-comparison.md)，不要直接用 clean 模式覆盖前台和 CMS。
Koharu CLI 保留备份、恢复、更新和预览能力：

```bash
pnpm koharu backup
pnpm koharu list
pnpm koharu restore --dry-run
pnpm koharu update --check
pnpm koharu update --dry-run
```

先阅读输出与备份范围，再决定实际迁移。Docker、Node 和 suite 方案仅作可选参考，见 [部署说明](docs/overview/11-deployment-adapters.md)。
