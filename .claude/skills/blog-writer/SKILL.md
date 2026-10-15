---
name: blog-writer
description: 按 Charien's Yard 当前配置创建或整理文章草稿，维护合法 frontmatter、稳定链接、分类映射和本地预览。用于写博文、创建文章、new post；碎碎念、公告、项目代码和 Git 发布不属于默认写作动作。
---

# Blog Writer

核对日期：2026-10-15。先读取根 AGENTS.md 与 docs/README.md；用户本轮要求优先于示例格式。

## 开始前

1. 查看工作区状态和目标文件，保留已有内容及用户未提交改动。
2. 从 config/site.yaml 读取站点时区、categoryMap、featuredSeries 和启用语言，不使用硬编码的工具/周刊分类列表。
3. 缺少主题或关键事实时只问必要问题；用户已给出素材时直接组织内容，不编造实验、引用或个人经历。
4. 默认创建草稿，除非用户明确要求发布或将草稿改为公开。创建文章不等于授权 commit/push。

## Frontmatter

```yaml
---
title: 文章标题
link: stable-post-slug
date: 2026-10-15 10:00:00
description: 简洁、准确的内容说明。
tags: [主题标签]
categories:
  - [笔记]
draft: true
---
```

- title/date 必填，日期按站点时区；例中日期是格式示例，实际使用用户指定或当前时间。
- 单层分类写 `categories: [随笔]`，层级写 `categories: [[笔记, 前端]]`；不能写 `categories: 随笔`。
- 分类与 URL 映射来自 site.yaml 的 categoryMap，不再编辑旧 `_config.yml`。
- 例中的前端分类只有在映射确实存在时才使用。三级层级不会自动变成标签，分类和 tags 各自维护。
- link 可以省略，但新建文章建议指定稳定的小写连字符地址；已有 link 不改写，显式值不会被统一强制小写。
- catalog 默认 true，tocNumbering 默认 true；只有任务需要时才添加 math、quiz、password、colophon 等字段。
- 字段契约以 src/content.config.ts 为准，语法见 docs/syntax-reference.md。

## 文件与分类

文章写入 src/content/blog/。目录用于组织文件，不会自动创建分类；不要因为用了 note/ 目录就漏写 frontmatter。
可按已有目录惯例放置文章，文件名与 link 不必相同；不要覆盖同名文件。译文放在对应 locale 子目录并保持映射关系。

新增分类时先确认是否可复用已有分类，确需新分类则更新 site.yaml 的 categoryMap；只修改所需映射，保留其他 YAML 改动。
向用户说明新路径；配置变化后重启 Astro 开发服务器。

## 写作与图表

结构围绕内容组织，按需要使用背景、步骤、结果、限制等章节，不强制每篇文章都套引言/总结。
有数据或结构关系时可使用现有 Mermaid 或 infographic 围栏，不为装饰增加图表，也不默认创建独立 HTML 页面。
前台与 CMS 的语法支持并非完全一致，复杂扩展要在 Astro 页面预览。

## 保存、版本与验证

- 编辑已有文章前保留用户文字。手工写文件不会触发 CMS 自动备份，不要声称已生成历史版本。
- CMS Save 和历史恢复会备份文章到 backups/versions/posts/；该目录 gitignored，不要清理或作为正文提交。
- 根据任务运行 Markdown 检查、`pnpm dev` 预览和 `pnpm build`，确认日期、分类、链接和草稿状态。
- 内容资产按需生成；摘要需要可用的模型 API，相似度需要模型缓存。不要为小改动无条件调用模型。
- 提交前遵循 AGENTS.md 的检查要求；只有用户明确要求才 commit 或 push。

如果用户实际要写短内容，使用 src/content/moments/ 或 CMS Moments，参考 docs/features/static-moments.md；公告用 site.yaml 的 announcements，参考 docs/features/announcements.md，不能将两者写成文章。
