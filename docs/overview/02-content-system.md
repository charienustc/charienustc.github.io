# 内容系统

核对日期：2026-10-15。集合契约以 `src/content.config.ts` 为准，内容查询与转换集中在 `src/lib/content/`。

## 两个静态集合

| 集合 | 来源 | 契约 |
| --- | --- | --- |
| blog | `src/content/blog/**/*.{md,mdx}` | 必须有 title、date，支持分类、标签和文章属性 |
| moments | `src/content/moments/**/*.md` | 必须有 date，不需要 title，支持 updated、draft、tags |

实际 loader 使用 `src/lib/content/glob.ts` 中的模式，排除下划线开头的文件及目录。
内容来自当前仓库，不需要额外的私有内容仓库。动态 suite Live Collection 是另一套可选功能，当前关闭。

文章示例：

```yaml
---
title: 一篇笔记
date: 2026-10-15 10:00:00
link: note/example
categories:
  - [笔记, 前端]
tags: [Astro]
draft: true
---
```

实际 frontmatter 的 categories 必须为数组或嵌套数组，不接受直接的 `categories: 笔记` 标量。

## 日期与草稿

集合 schema 允许日期字符串和 YAML 解析后的 Date，统一通过 `parseDateInSiteTimezone` / `reinterpretUtcAsTimezone` 处理。
站点时区来自 site.yaml；不要依赖构建机器的 UTC 或操作系统时区猜测日期。
生产查询过滤 `draft: true`；本地开发允许看到草稿。文件名只是标识，发布排序看 date。

碎碎念编辑保留 date，updated 用于显示修改时间，不改变发布时间顺序。

## URL 与语言

`getPostSlug` 优先使用 frontmatter 的 link，否则采用去语言前缀的集合 ID，并按配置选择是否转写非 ASCII 字符。
路由构造使用 `encodeSlug` 逐段编码并保留 `/`；不会统一将显式 link 强制转小写。
建议自己使用稳定的小写连字符地址，但不要为格式统一改掉旧链接。

翻译文章放在 `src/content/blog/<locale>/`。非默认语言页面显示对应译文和缺失译文时的默认语言回退。
`getSortedPosts(locale)`、`filterPostsByLocale` 和相关缓存负责语言筛选；不要直接 getCollection 后绕过草稿和语言策略。

## 常用文章字段

| 字段 | 用途 |
| --- | --- |
| description | 手写摘要与 SEO 描述 |
| updated | 修改日期 |
| cover | 封面路径 |
| categories / tags | 分类与标签 |
| sticky | 首页置顶 |
| catalog | 是否计入分类树和统计，默认 true |
| tocNumbering | 文章目录编号，默认 true |
| excludeFromSummary | 从摘要和相似度生成脚本排除 |
| math / quiz | 文章级数学/练习题控制 |
| password | 整篇加密，由对应内容开关支持 |
| keywords | SEO 关键词 |
| colophon | 文章附记标记，配置见 `src/lib/config/colophon.ts` |

描述优先级是手写 description、加密文章通用描述、已有 AI 摘要、正文文本提取。加密文章不要从正文推导公开摘要。

## 分类与标签

分类由 frontmatter 指定，不由磁盘目录自动推断。层级路径建议用 `categories: [[笔记, 前端]]`。
分类 URL 的英文映射配置在 `config/site.yaml` 的 `categoryMap`，由配置层归一化；不要修改旧 `_config.yml` 或虚构的 category.ts 常量。

主要入口：

- `categories.ts` / `category-path.ts` / `category-translate.ts`：分类树、路径与翻译。
- `index-categories.ts` / `index-tags.ts` / `index-groups.ts`：索引页面模型、前缀匹配和月份分组。
- `tags.ts`：标签查询。
- `transforms.ts`：转为最小卡片数据，避免序列化文章正文。

未知分类或层级的 URL 依赖映射规则，新增层级后同时检查实际分类页面与构建结果。

## 首页、列表和系列

`getHomePagePosts(locale)` 一次获取系列高亮、普通置顶和常规文章。首页普通文章限制为五篇，系列内容按配置独立处理。
LatestActivity 接收最新普通文章，并查询最新可见碎碎念；两者都不是按 updated 生成的全站修改日志。
`/posts` 用 `bucketPostsByMonth` 按站点时区分组；`/moments` 按年份呈现全部可见短内容。

精选系列使用 site.yaml 中的 featuredSeries 数组：

```yaml
featuredSeries:
  - slug: series
    categoryName: 系列文章
    label: 系列文章
    enabled: true
    highlightOnHome: true
```

slug 必须唯一且不与保留路由、语言和其他功能路径冲突，categoryName 应在 categoryMap 中存在。
系列在 `[seriesSlug].astro` 生成页面，无需新增固定 weekly 页面。

## 缓存与生成资产

`cache.ts` 提供构建期查询复用；posts.ts 还缓存阅读时间。不要原地排序 Astro 返回的集合数组。

| 资产 | 生成入口 | 说明 |
| --- | --- | --- |
| `src/assets/lqips.json` | `pnpm generate:lqips` | 图片占位数据 |
| `src/assets/summaries.json` | `pnpm generate:summaries` | 调用本地 OpenAI-compatible 服务，不是脚本自己下载摘要模型 |
| `src/assets/similarities.json` | `pnpm generate:similarities` | transformers.js 嵌入与相似度 |
| `.cache/og-data.json` | 链接嵌入构建 | 有意跟踪的 OG 元数据缓存 |

摘要服务地址、默认模型在 generateSummaries.ts；相似度模型在 generateSimilarities.ts，缓存位于 `.cache/transformers`。
脚本各自的 glob、草稿和语言过滤不应假设与集合 loader 完全相同，运行前按任务核对。
Koharu CLI 也提供 generate 包装；Windows 的 npx 子进程问题可用直接脚本命令排查。

## 本地 CMS 与历史版本

CMS 直接读写源文件。文章保存与恢复前，旧版放入 `backups/versions/posts/`；碎碎念编辑保留原有 `backups/versions/`。
这些是本机文件备份，不参与 Content Collections、Git 或公开站点输出。不要将它们放入内容目录或自动清理。

详见 [CMS](../features/cms.md)、[静态碎碎念](../features/static-moments.md) 与 [语法参考](../syntax-reference.md)。

## 验证

运行 `pnpm test:content`、`pnpm test:cms` 和相关配置测试；生产构建时检查草稿过滤、分类路径、语言回退与首页入口。
内容变更可能需要刷新生成资产；不必为纯文本改动无条件重新生成所有模型数据。
