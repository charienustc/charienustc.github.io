# 项目总览

核对日期：2026-10-15。本站是 Charien's Yard，基于 astro-koharu 定制。完整导航见 [文档索引](../README.md)。

## 技术与部署

| 部分 | 当前实现 |
| --- | --- |
| 前台 | Astro 7 + React 19 + Tailwind CSS 4 |
| 状态 | Nanostores，按交互域拆分 |
| 内容 | `src/content.config.ts` 中的 blog 和静态 moments 集合 |
| 搜索 | Pagefind，首次打开搜索时下载组件 bundle |
| 评论 | 当前配置 giscus，接近评论区再加载 SDK |
| 写作 | 独立的本地 React/Vite + Hono CMS |
| 发布 | `main` → GitHub Actions 检查 → 静态 `dist/` → GitHub Pages |

`package.json` 的 6.3.0 是保留的包版本；Astro 版本、主题包版本和上游移植进度是三件不同的事。
内容直接位于本仓库，不需要额外 checkout 私有内容仓库。动态 suite 功能保留在源码中，但本站没有启用。

## 目录与职责

```plain
config/
  site.yaml                   # 用户配置
  i18n-content.yaml           # 分类、系列等内容名称译文
src/
  content.config.ts           # 两个静态内容集合、时区日期转换与 schema
  content/blog/               # 文章；译文在 locale 子目录
  content/moments/            # 无标题的短内容
  pages/                     # 路由与 [lang] 镜像、_shared 枚举
  layouts/                   # Layout、HeadMeta、BootScripts、AppShell
  components/                # 静态 Astro 和 React islands
  hooks/                     # 交互逻辑
  lib/config/                # 配置归一化
  lib/content/               # 查询、索引、分组、转换
  lib/markdown/              # 编译插件与正文增强工具
  store/                     # 主题、弹窗、音乐、公告等状态
  styles/                    # 主题、正文、组件样式
  scripts/                   # LQIP、摘要、相似度生成
cms/
  server.ts                  # Hono 文件 API + Vite 开发服务
  src/components/            # 仪表盘、文章编辑、历史弹窗、碎碎念编辑
  src/api/                   # 文件、图片、Git 与历史版本接口
  src/lib/                   # 校验、存储、序列化与测试
  pnpm-lock.yaml             # 独立依赖锁文件
scripts/koharu/              # 备份、迁移、更新等 CLI
.github/workflows/deploy.yml # 发布门禁与 Pages 部署
backups/                    # 本机保留，gitignored
```

`dist/`、`.astro/` 为生成输出。`.cache/og-data.json` 是有意跟踪的 OG 元数据缓存。
Tailwind 入口是 `src/styles/global/tailwind.css`，其中保留对 `tailwind.config.mjs` 的引用。
日期工具是 `src/lib/date.ts` 与 `timezone.ts`，不是旧文档中的 datetime.ts。

## 本地运行与验证

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm cms:install
pnpm cms
```

前台默认 4321，CMS 4322，通常分别占一个终端。环境要求 Node.js ≥ 22.20.0、pnpm 10.28.2。
前台配置改动后重启 dev；CMS Preview 依赖运行中的前台开发服务器。

```bash
pnpm lint:fix
pnpm check
pnpm --dir cms exec tsc --noEmit
pnpm test
pnpm build
```

两套类型检查均要求零错误。CI 使用各自锁文件安装依赖，先类型检查、测试、构建，全部通过才发布。
修改文档时核对内部链接与对应代码；修改交互时额外手动验证，不能仅靠单元测试。

## 内容与页面

- `/`：最新动态、系列高亮/置顶、最新五篇普通文章及分类入口。
- `/posts`：按月份组织的文章索引，没有 `/posts/2` 分页路由。
- `/post/<slug>`：文章详情；同路径 `.md` 端点提供文章源码。
- `/moments`：静态短内容按年份展示，没有详情页和专用 RSS。
- `/categories`、`/tags`、`/archives`、`/friends`、`/about`：分类、标签、归档、友链和个人介绍。
- `/<seriesSlug>`：按配置生成系列页，本站为 `/series`。
- `/rss.xml`：文章订阅；非默认语言在 `[lang]` 下有对应镜像。

文章至少有 title/date，碎碎念只有 date 和正文；生产过滤草稿，日期按站点时区处理。
分类来自 frontmatter，URL 映射来自 site.yaml。不要把文件夹名字当作自动分类规则。

## 配置与模块边界

配置从 `config/site.yaml` 进入 `src/lib/config/site.ts` 和各 `normalize*` 函数。
`src/constants/site-config.ts` 是装配/兼容层，底层 lib 不应反向导入它。
根别名 `@/` 指向 `src/`；CMS 别名指向自己的 `cms/src/`。

前台按需水合：BGM/公告列表用 `client:panel`，正文增强用 `client:content`，桌面目录用 media 指令，抽屉目录用 visible 指令并保留打开状态门控。
三个全屏查看器仍以 `client:idle` 挂载，不要将上游尚未摘取的懒加载方案写成当前实现。

## 继续阅读

- [架构](01-architecture.md)、[内容](02-content-system.md)、[路由](03-routing.md)。
- [组件模式](04-component-patterns.md)、[UI](05-ui-components.md)、[状态](06-state-management.md)。
- [主题](07-theme-system.md)、[动画](08-animation-system.md)、[样式](09-styling.md)、[Markdown](10-markdown-system.md)。
- [部署](11-deployment-adapters.md)、[Astro 7 升级记录](12-astro-7-upgrade.md)、[上游差异与摘取记录](13-upstream-v7-upgrade-comparison.md)。
- [CMS](../features/cms.md)、[公告](../features/announcements.md)、[静态碎碎念](../features/static-moments.md)。
