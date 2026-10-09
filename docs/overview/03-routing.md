# 路由系统详解

## Astro 文件路由基础

Astro 使用**文件系统路由**，`src/pages/` 目录下的文件会自动映射为 URL 路径：

```plain
src/pages/
├── index.astro          →  /
├── about.md             →  /about
├── archives.astro       →  /archives
├── friends.astro        →  /friends
├── moments.astro        →  /moments
├── bangumi.astro        →  /bangumi
├── 404.astro            →  /404
├── [seriesSlug].astro   →  /weekly 等精选系列页
├── rss.xml.ts           →  /rss.xml
├── rss/
│   └── feed.xsl.ts      →  /rss/cos-feed.xsl（RSS 样式表）
├── post/
│   └── [...slug].astro  →  /post/*
├── posts/
│   └── [...page].astro  →  /posts/*, /posts/2, /posts/3
├── categories/
│   ├── index.astro      →  /categories
│   └── [...slug].astro  →  /categories/*
├── tags/
│   ├── index.astro      →  /tags
│   └── [tag].astro      →  /tags/*
└── [lang]/              →  非默认语言的镜像路由（如 /en/about）
    ├── index.astro      →  /en/
    ├── about.astro      →  /en/about
    └── ...（与根目录基本一一对应）
```

> 精选系列页由 `[seriesSlug].astro` 动态路由承担，`slug` 来自 `config/site.yaml` 的 `featuredSeries` 配置，无需为每个系列新建页面。
>
> `[lang]/` 目录是 i18n 镜像：默认语言不加坡前缀，其他语言在 `src/pages/[lang]/` 下放置对应镜像页（由 `getLocaleStaticPaths()` 生成静态路径）。

### 路由类型

| 类型      | 语法              | 示例                          | 说明     |
| --------- | ----------------- | ----------------------------- | -------- |
| 静态路由  | `page.astro`      | `about.md` → `/about`         | 固定 URL |
| 动态路由  | `[param].astro`   | `[tag].astro` → `/tags/react` | 单级参数 |
| Rest 参数 | `[...slug].astro` | `[...slug].astro` → `/a/b/c`  | 多级参数 |

---

## 动态路由实现

### 1. 文章详情页 `post/[...slug].astro`

文章详情页使用 rest 参数 `[...slug]` 来匹配文章 URL：

```astro
---
// src/pages/post/[...slug].astro

import { render } from 'astro:content';
import { getPostById, getPostSlug, getSortedPosts } from '@lib/content';

// getStaticPaths：告诉 Astro 需要生成哪些页面
export async function getStaticPaths() {
  const postCollections = await getSortedPosts();

  return postCollections.map((post) => ({
    params: { slug: getPostSlug(post) },
    props: { postId: post.id },
  }));
}

const { postId } = Astro.props;
const post = await getPostById(postId);
if (!post) throw new Error(`Post not found: ${postId}`);
const { Content } = await render(post);
---

<Layout title={post.data.title}>
  <article class="prose">
    <Content />
  </article>
</Layout>
```

**生成的页面示例**：

```plain
文章文件: src/content/blog/note/front-end/react-hooks.md
frontmatter: { link: 'react-hooks-guide' }

生成 URL: /post/react-hooks-guide

如果没有 link 字段:
生成 URL: /post/note/front-end/react-hooks
```

### 2. 分类页面 `categories/[...slug].astro`

分类页面支持多级分类路径：

```astro
---
// src/pages/categories/[...slug].astro

import { getCategoryByLink, getCategoryLinks, getCategoryList } from '@lib/content';

export async function getStaticPaths() {
  // 1. 获取所有分类
  const { categories } = await getCategoryList();

  // 2. 生成所有分类的 URL 链接
  const links = getCategoryLinks(categories, '');
  // links = ['life', 'note', 'note/front-end', 'note/front-end/react', ...]

  // 3. 为每个链接生成页面
  return links.map((link) => {
    const category = getCategoryByLink(categories, link);
    return {
      params: { slug: link },
      props: { category },
    };
  });
}

const { category } = Astro.props;
---

<Layout title={`分类 - ${category?.name}`}>
  <CategoryPostList category={category} />
</Layout>
```

**生成的页面**：

```plain
/categories/life           → 随笔分类
/categories/note           → 笔记分类
/categories/note/front-end → 笔记 > 前端分类
/categories/note/front-end/react → 笔记 > 前端 > React 分类
```

### 3. 文章列表分页 `posts/[...page].astro`

使用 Astro 内置的 `paginate` 函数实现分页：

```astro
---
// src/pages/posts/[...page].astro

import { getNonFeaturedPosts } from '@lib/content';
import type { PaginateFunction } from 'astro';

export async function getStaticPaths({ paginate }: { paginate: PaginateFunction }) {
  // 获取所有非系列文章
  const postCollections = await getNonFeaturedPosts();

  // paginate 自动生成分页路由
  return paginate(postCollections, { pageSize: 10 });
}

// page 对象包含分页信息
const { page } = Astro.props;
---

<Layout>
  <PostList posts={page.data} page={page} />
</Layout>
```

**`page` 对象结构**：

```typescript
interface Page<T> {
  data: T[];           // 当前页的数据
  start: number;       // 起始索引
  end: number;         // 结束索引
  size: number;        // 每页大小
  total: number;       // 总条目数
  currentPage: number; // 当前页码
  lastPage: number;    // 最后一页
  url: {
    current: string;   // 当前页 URL
    prev?: string;     // 上一页 URL
    next?: string;     // 下一页 URL
    first: string;     // 第一页 URL
    last: string;      // 最后一页 URL
  };
}
```

**生成的页面**：

```plain
/posts/1  → 第 1 页（10 篇文章）
/posts/2  → 第 2 页（10 篇文章）
/posts/3  → 第 3 页（10 篇文章）
...
```

---

## 首页路由 `index.astro`

首页是特殊的静态页面，手动构造分页数据：

```astro
---
// src/pages/index.astro

import { PAGINATION } from '@constants/layout';
import { getHomePagePosts } from '@lib/content';
import { toPostCardDataList } from '@lib/content/transforms';

// 1. 单次查询获取所有首页数据（系列高亮 + 置顶 + 普通文章）
const { highlightedPosts, stickyPosts: normalStickyPosts, regularPosts } = await getHomePagePosts(locale);

// 2. 系列高亮文章放在置顶列表开头（转换为卡片数据）
const stickyPosts = toPostCardDataList([...highlightedPosts, ...normalStickyPosts], locale);

// 3. 首页显示前 pageSize 篇普通文章（不含系列文章）
const { pageSize } = PAGINATION;
const regularPostsSlice = regularPosts.slice(0, pageSize);
const posts = toPostCardDataList(regularPostsSlice, locale);

// 4. 手动构造 Page 对象（用于分页组件）
const page: Page<BlogPost> = {
  data: regularPostsSlice,
  start: 0,
  end: Math.min(pageSize - 1, regularPostsSlice.length - 1),
  size: pageSize,
  total: regularPosts.length,
  currentPage: 1,
  lastPage: Math.ceil(regularPosts.length / pageSize),
  url: {
    current: '/',
    prev: undefined,
    next: regularPosts.length > pageSize ? '/posts/2' : undefined,
    first: '/',
    last: `/posts/${Math.ceil(regularPosts.length / pageSize)}`,
  },
};
---

<Layout>
  <!-- 置顶文章区域 -->
  <Divider>置顶文章</Divider>
  <PostList posts={stickyPosts} showPaginator={false} />

  <!-- 普通文章列表 -->
  <Divider>文章列表</Divider>
  <PostList posts={posts} page={page} baseUrl="/posts" />

  <!-- 精选分类 -->
  <Divider>精选分类</Divider>
  <CategoryCards />
</Layout>
```

---

## RSS 源生成 `rss.xml.ts`

RSS 使用 TypeScript 端点（`.ts` 文件）生成 XML：

```typescript
// src/pages/rss.xml.ts

import rss from '@astrojs/rss';
import { siteConfig } from '@constants/site-config';
import { getSortedPosts } from '@lib/content';
import { getSanitizeHtml } from '@lib/sanitize';
import type { APIContext } from 'astro';
import sanitizeHtml from 'sanitize-html';

// 生成纯文本摘要
const generateTextSummary = (html?: string, length: number = 150): string => {
  const text = sanitizeHtml(html ?? '', {
    allowedTags: [],  // 移除所有 HTML 标签
    allowedAttributes: {},
  });

  if (text.length <= length) return text;
  return text.substring(0, length).replace(/\s+\S*$/, '');  // 不截断词语
};

// GET 端点 - 返回 RSS XML
export async function GET(context: APIContext) {
  const posts = await getSortedPosts();
  const { site } = context;

  if (!site) {
    throw new Error('Missing site metadata');
  }

  return rss({
    title: siteConfig.title,
    description: siteConfig.subtitle || 'No description',
    site,
    trailingSlash: false,
    stylesheet: '/rss/cos-feed.xsl',  // RSS 样式表

    // 只包含最新 20 篇文章
    items: posts
      .map((post) => ({
        title: post.data.title,
        pubDate: post.data.date,
        description: post.data?.description ?? generateTextSummary(post.rendered?.html),
        link: `/post/${getPostSlug(post)}`,
        content: getSanitizeHtml(post.rendered?.html ?? ''),
      }))
      .slice(0, 20),
  });
}
```

**RSS 输出示例**：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>余弦の博客</title>
    <link>https://blog.cosine.ren/</link>
    <description>WA 的一声就哭了</description>
    <item>
      <title>React Hooks 学习笔记</title>
      <link>https://blog.cosine.ren/post/react-hooks</link>
      <pubDate>Mon, 15 Jan 2024 00:00:00 GMT</pubDate>
      <description>深入理解 React Hooks...</description>
    </item>
    <!-- 更多文章... -->
  </channel>
</rss>
```

---

## 静态路径生成流程

### `getStaticPaths()` 工作原理

```plain
构建时执行
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│              getStaticPaths() 函数执行                       │
│                                                             │
│  1. 读取所有内容源（Content Collections）                     │
│  2. 计算需要生成的所有 URL                                    │
│  3. 返回 { params, props } 数组                              │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│              Astro 为每个路径生成页面                         │
│                                                             │
│  /post/react-hooks     → dist/post/react-hooks/index.html   │
│  /post/vue-basics      → dist/post/vue-basics/index.html    │
│  /categories/note      → dist/categories/note/index.html    │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│                    静态 HTML 文件                            │
│                   （可部署到 CDN）                            │
└─────────────────────────────────────────────────────────────┘
```

### 路由生成示例

假设有以下文章：

```plain
src/content/blog/
├── tools/git-tips.md           # categories: ['工具']
├── note/front-end/react.md     # categories: [['笔记', '前端', 'React']]
└── note/algorithm/sorting.md   # categories: [['笔记', '算法']]
```

**生成的路由**：

```plain
# 文章页面
/post/git-tips
/post/note/front-end/react (或自定义 link)
/post/note/algorithm/sorting

# 分类页面
/categories/tools
/categories/note
/categories/note/front-end
/categories/note/front-end/react
/categories/note/algorithm
```

---

## 面包屑导航实现

文章页面包含面包屑导航，显示分类层级：

```astro
---
// src/pages/post/[...slug].astro

const categoryArr = getCategoryArr(categories?.[0]);
// categoryArr = ['笔记', '前端', 'React']

// 生成面包屑数据
const breadcrumbCategories = [];
if (categoryArr?.length) {
  for (let i = 0; i < categoryArr.length; i++) {
    const partialCategories = categoryArr.slice(0, i + 1);
    const link = await buildCategoryPath(partialCategories);
    breadcrumbCategories.push({
      name: categoryArr[i],
      link: link,
    });
  }
}

// 结果:
// [
//   { name: '笔记', link: '/categories/note' },
//   { name: '前端', link: '/categories/note/front-end' },
//   { name: 'React', link: '/categories/note/front-end/react' }
// ]
---

<!-- 面包屑渲染 -->
<nav class="flex items-center gap-2 text-sm">
  <a href="/">首页</a>

  {
    breadcrumbCategories.map((category, index) => (
      <>
        <Icon name="ri:arrow-right-s-line" />
        <a href={category.link}>{category.name}</a>
      </>
    ))
  }
</nav>

<!-- 显示效果: 首页 > 笔记 > 前端 > React -->
```

---

## JSON-LD 结构化数据

文章页面包含 SEO 结构化数据：

```astro
---
// src/pages/post/[...slug].astro

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: title,
  description: description || post.body?.slice(0, 100),
  keywords: categories?.length ? tags.concat(categories[0]) : tags,
  author: {
    '@type': 'Person',
    name: siteConfig.author ?? siteConfig.name,
    url: Astro.site,
  },
  datePublished: parseDate(date, 'YYYY-MM-DD'),
};
---

<!-- 注入到 head -->
<script is:inline slot="head" type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
```

**输出的 JSON-LD**：

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "React Hooks 学习笔记",
  "description": "深入理解 React Hooks 的工作原理",
  "keywords": ["React", "Hooks", "前端", "笔记"],
  "author": {
    "@type": "Person",
    "name": "cos",
    "url": "https://blog.cosine.ren/"
  },
  "datePublished": "2024-01-15"
}
```

---

## 路由配置选项

### `trailingSlash` 配置

在 `astro.config.mjs` 中配置 URL 末尾斜杠处理：

```javascript
// astro.config.mjs
export default defineConfig({
  trailingSlash: 'ignore', // /about 和 /about/ 都有效
  // 'always' - 强制末尾有斜杠
  // 'never' - 强制末尾无斜杠
  // 'ignore' - 两者都接受
});
```

### 自定义 404 页面

创建 `src/pages/404.astro` 即可自定义 404 页面：

```astro
---
// src/pages/404.astro
import Layout from '@layouts/Layout.astro';
---

<Layout title="页面未找到">
  <div class="flex-center min-h-screen">
    <h1>404 - 页面未找到</h1>
    <a href="/">返回首页</a>
  </div>
</Layout>
```

---

## 路由系统流程图

```plain
┌─────────────────────────────────────────────────────────────┐
│                       用户请求                               │
│                    GET /post/react-hooks                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    路由匹配                                  │
│                                                             │
│  /post/react-hooks 匹配 src/pages/post/[...slug].astro     │
│  params = { slug: 'react-hooks' }                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 静态页面查找                                  │
│                                                             │
│  查找 dist/post/react-hooks/index.html                     │
│  （构建时已生成）                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    返回 HTML                                 │
│                                                             │
│  Content-Type: text/html                                    │
│  HTTP 200 OK                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 学习要点

1. **文件系统路由**：`src/pages/` 下的文件自动映射为 URL
2. **动态路由参数**：
   - `[param]` 匹配单级路径
   - `[...slug]` 匹配多级路径
3. **`getStaticPaths()`**：告诉 Astro 需要生成哪些静态页面
4. **`paginate()` 函数**：自动处理分页逻辑
5. **RSS 端点**：使用 `.ts` 文件生成非 HTML 内容
6. **SEO 优化**：JSON-LD 结构化数据提升搜索引擎理解

---

## 相关文件

| 文件                                   | 说明             |
| -------------------------------------- | ---------------- |
| `src/pages/index.astro`                | 首页             |
| `src/pages/post/[...slug].astro`       | 文章详情页       |
| `src/pages/posts/[...page].astro`      | 文章列表分页     |
| `src/pages/categories/[...slug].astro` | 分类页面         |
| `src/pages/categories/index.astro`     | 分类首页         |
| `src/pages/tags/[tag].astro`           | 标签页面         |
| `src/pages/rss.xml.ts`                 | RSS 源           |
| `src/pages/rss/feed.xsl.ts`            | RSS 样式表       |
| `src/pages/archives.astro`             | 归档页面         |
| `src/pages/[seriesSlug].astro`         | 精选系列页       |
| `src/pages/moments.astro`              | 碎碎念页面       |
| `src/pages/bangumi.astro`              | 追番页面         |
| `src/pages/friends.astro`              | 友链页面         |
| `src/pages/404.astro`                  | 404 页面         |
| `src/pages/[lang]/`                    | i18n 镜像路由    |
