---
title: "Hello World:用 Astro 搭建个人主页"
description: "记录用 Astro 5 + GitHub Pages 从零搭建个人主页的过程,包括内容集合、主题切换与自动部署。"
pubDate: 2026-07-19
tags: ["astro", "随笔"]
draft: false
---

欢迎来到我的博客!这是第一篇文章。

## 为什么选 Astro

Astro 是一个静态优先的站点框架,默认零 JavaScript,加载快、SEO 友好。它的 **Content Collections** 让 Markdown 内容有类型安全保障,非常适合博客和作品集。

## 这个站点包含什么

- **关于**:个人简介与联系方式
- **作品**:项目展示
- **博客**:你正在看的文章列表,支持标签与归档
- **链接**:各平台社交链接聚合

## 写作方式

在 `src/content/blog/` 下新建 `.md` 文件,填写 frontmatter 即可:

```markdown
---
title: "文章标题"
description: "一句话摘要"
pubDate: 2026-07-19
tags: ["标签1", "标签2"]
---

正文内容……
```

保存后刷新页面,文章会自动出现在列表里。就这么多,开始写吧。
