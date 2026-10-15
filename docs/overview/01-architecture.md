# 架构设计与技术栈

核对日期：2026-10-15。本文描述本站实际边界，通用示例不替代源代码。参见 [项目总览](00-overview.md)。

## 三条独立链路

```plain
site.yaml + Git 内容 → Astro 构建 → dist/ → GitHub Pages → 访客浏览器
                             ↑
本地 CMS → Hono 文件 API → src/content/ + public/ + backups/
                             ↑
Koharu CLI → 迁移、资产生成、备份、上游更新
```

前台默认静态输出，React 只承担交互。CMS 是本地开发服务，直接管理仓库文件；线上没有 CMS Node 服务、数据库或公网登录系统。
动态 suite 集成是保留的可选能力，当前关闭，不参与日常 GitHub Pages 构建。

## 技术栈与安装边界

前台使用 Astro 7、Vite 8、React 19、Tailwind CSS 4、Nanostores、Motion、Pagefind。
CMS 使用自己的 React/Vite、Hono、BlockNote、marked 和锁文件，部分渲染依赖版本与前台不同。
根 `pnpm-workspace.yaml` 仅包含根包；不能假定 `pnpm install` 同时安装 CMS，也不能假定前台类型检查覆盖 CMS。

精确版本以两个 package.json 和各自 lockfile 为准。更新依赖时核对两侧，不要把 package.version 误当框架版本。

## 配置流

1. 用户编辑 `config/site.yaml`。
2. `src/lib/config/site.ts` 通过各 `normalize*` 函数提供归一化值。
3. `src/constants/site-config.ts` 装配导航、评论、统计、BGM 等组件配置。
4. `astro.config.mjs` 在 Vite 初始化前独立读取 YAML，配置 Markdown、集成和构建。

`src/lib/**` 只能依赖配置底层，不能反向导入 `@constants/site-config` 形成循环。
CMS 的类别映射也来自同一个 site.yaml；两套运行时不是共享全局状态。
YAML 是构建期输入，改动后重启 dev 或重建。

## 页面外壳

| 文件 | 职责 |
| --- | --- |
| `src/layouts/Layout.astro` | HTML 文档、ClientRouter、全局样式、主布局组合 |
| `src/layouts/page-meta.ts` | 元数据契约 |
| `src/layouts/HeadMeta.astro` | SEO 与 head 输出 |
| `src/layouts/BootScripts.astro` | 首屏主题、语言等启动脚本 |
| `src/layouts/AppShell.astro` | Header、main、抽屉、播放器、搜索、查看器和公告 |
| `src/layouts/TwoColumnLayout.astro` | cover、sider、主内容槽位 |

普通页面负责查询和转换内容，静态 Astro 组件生成 HTML；需要浏览器状态时使用 React islands。
不要把整篇正文作为 island props 传到客户端，优先传卡片所需的最小派生字段。

## 水合与资源加载

| 场景 | 当前策略 |
| --- | --- |
| BGM 面板、公告列表 | `client:panel`，打开面板后激活 |
| ContentEnhancer | `client:content`，接近正文时激活 |
| 桌面目录 | `client:media="(min-width: 993px)"` |
| 抽屉目录 | `client:visible` + `isDrawer`，保留移动端和打开状态门控 |
| 搜索 | SearchDialog idle；Pagefind bundle 首次打开时动态导入 |
| 评论 SDK | 接近评论区域后加载 |
| Mermaid | `lazyMermaid` 包装集成，接近图表后渲染 |
| 图片/代码/图表全屏查看器 | 仍使用 `client:idle` |

`client:panel` 和 `client:content` 在 astro.config.mjs 中通过 `addClientDirective` 注册。
实现分别位于 `src/lib/client-panel.ts` 与 `src/lib/markdown/client-content.ts`。
不要用上游 ArticleViewers 等尚未移植的设计描述本站现状。已落地范围见 [移植记录 K.5](13-upstream-v7-upgrade-comparison.md)。

前台构建还保留客户端共享 chunk 分组和较小 CSS 内联策略，具体规则以 astro.config.mjs 为准；不是所有资源都会内联或延迟。

## 内容编译

`src/content.config.ts` 使用 glob loader 定义文章与静态碎碎念。日期按站点时区转换，生产过滤草稿。
Astro 配置使用 `unified({ gfm, remarkPlugins, rehypePlugins })`，按 content 开关组装插件。
Shoka 预处理、数学、属性、链接嵌入和加密的顺序有依赖，不要直接照搬旧版 `markdown.rehypePlugins` 简化片段覆盖配置。

正文由 `CustomContent.astro` 输出，原生 DOM 增强与 React 工具栏分工。前者会遍历全部 `.custom-content`；后者的扫描边界仍需按组件源码核对。

## CMS 存储

文件 API 位于 `cms/src/api/`；逻辑和测试在 `cms/src/lib/`。文章编辑由 PostEditor、Header、Canvas 和 Sidebar 等组件组合。
历史版本由 `post-versions.ts` 管理，旧版写入 `backups/versions/posts/`；恢复前备份当前文件，并验证版本归属、路径和符号链接。
碎碎念保留旧路径，图片位于被跟踪的 public 目录。详见 [CMS 指南](../features/cms.md)。

CMS 发布操作对整个仓库执行 stage/lint-staged/commit/push，而非只提交当前编辑文件。
备份在本机且 gitignored，不能替代远程内容备份。

## 生命周期与状态

Nanostores 用于多个岛之间的主题、弹窗、BGM、公告状态，React hooks 管理局部编辑状态。
DOM 增强应处理初次加载、`astro:page-load` 和页面 swap 清理，避免重复监听和旧 DOM 引用。
切换页面后保留的播放器与窗口状态不代表正文节点也能直接复用。

## 发布与验证

GitHub Actions 使用前台与 CMS 各自的 frozen lockfile 安装依赖，执行两套类型检查、完整测试和生产构建，再上传 Pages artifact。
任何门禁失败都不会部署新页面。前台和 CMS 类型检查均要求零错误。

本地可用 `pnpm dev` / `pnpm cms` 进行交互验证，`pnpm preview` 检查静态产物。
Windows tar、CRLF、符号链接和文件权限与 Linux runner 存在差异，测试数据必须使用平台无关路径。
