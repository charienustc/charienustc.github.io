# 本站静态碎碎念与最新动态

核对日期：2026-10-15。本站使用 Git 中的短文本集合，不依赖 Telegram 或 koharu-suite。

## 创建与编辑

在 CMS 切换 Moments，可新建、编辑或删除；也可手工在 `src/content/moments/` 新建文件：

```markdown
---
date: 2026-10-15 10:30:00
tags: ['日常']
draft: true
---

随手记下一句话。
```

文件名采用 `YYYY-MM-DD-HHmmss.md`，内容没有 `title` 字段。实际排序按 `date`，不依赖文件名排序。
日期按照 `config/site.yaml` 的站点时区解析；草稿在开发环境可见，生产构建过滤。

CMS 编辑保留原始 `date`，写入 `updated` 并备份旧文件到 `backups/versions/`。
页面仅在确有更新时间时展示「改于」；修改不会因更新时间而调整发布时间顺序。
图片写入 `public/img/moments/`，支持选图、粘贴或拖入，随仓库发布。

## 页面与首页

- `/moments` 按年份展示全部可见内容，没有独立详情页、分页、专用 RSS 或专用搜索。
- 使用 `CustomContent.astro` 渲染 Markdown；原生 DOM 基础增强遍历同页多块内容。React 工具栏仍由 ContentEnhancer 的扫描范围控制，不能假设所有文章增强都适用于整条 feed。
- 首页最新动态区块由 `LatestActivity.astro` 汇总一篇最新普通文章与最新可见碎碎念。
- 文章入口来自首页普通文章列表首项，不是所有置顶/系列文章的全局最近更新时间。
- 碎碎念入口跳转到当前语言的 `/moments`，文本摘要由 `momentExcerpt` 生成。
- 默认语言与 `[lang]` 镜像共用同一个碎碎念集合；不会自动生成碎碎念译文。

## 与动态 Moments 的边界

`config/site.yaml` 的 `moments.enabled` 管理模板保留的动态 suite 功能，当前为 false。它不是本站静态碎碎念的开关。
启用 suite 需要 Node 运行时和公开 suite origin，不能用现有 GitHub Pages 流程直接发布动态页面。
本站已有 `/moments` 和多语言镜像；迁移前必须处理路由保留名、碰撞和内容入口，不要直接照抄动态版 `path: moments`。

动态版参考：[中文](moments.md)、[English](moments.en.md)、[日本語](moments.ja.md)。
CMS 存储、恢复与删除留存见 [CMS 指南](cms.md)。

源码：`src/content.config.ts`、`src/pages/moments.astro`、`src/lib/content/moments.ts`、`src/components/home/LatestActivity.astro`。
