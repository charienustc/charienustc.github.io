# 上游 v7.7.1 功能差异对比与升级决策

本文逐项对比本仓库（astro-koharu **v6.3.0**）与上游 [cosZone/astro-koharu](https://github.com/cosZone/astro-koharu) **v7.7.1** 的功能差异，供决策哪些合并、哪些不做。

- 本地仓库：`F:\myhomepage`（`charienustc/charienustc.github.io`）
- 对比日期：2026-10-07
- 对比依据：`v6.3.0 → v7.7.1` **全量 git diff 逐项核对**（非发布说明转述）
- 「你的现状」一列由读取本地 `config/site.yaml`、`package.json` 及文件系统实际清点得出

> **规模**：落后 9 个版本（v7.0.0 / v7.1.0 / v7.2.0 / v7.3.0 / v7.4.0 / v7.5.0 / v7.6.0 / v7.7.0 / v7.7.1），共 **119 个 commit、462 个文件变更、+38845 / −14840 行**。

## 图例

| 记号 | 含义 |
|---|---|
| **有** | 你已有等价功能 |
| **无** | 你完全没有 |
| **旧** | 有，但是旧的实现 / 旧版行为 |
| **冲突面** | 小 = 文件独立可整体覆盖；中 = 需按 hunk 合并；高 = 双方改了同一段逻辑，必须二选一 |
| **优先级** | P0 = 建议立刻做；P1 = 建议做；P2 = 看需求；P3 = 可选 |
| **最终解决方案** | 每项的**落地状态与去向**，五种取值：**✅ 已做**（附 commit）/ **⛔ 不做**（附理由）/ **🛡️ 已受保护**（无需动作，本地写法已免疫）/ **— 无影响**（本仓库不涉及）/ 待做 |

> **「⛔ 不做」vs「保留自研」**：两处取舍不同，别混。
> **B2 部分采用**：头部导航 pill 保留本地自研（CSS 过渡方案），但菜单内滑动高亮已采用上游 `useGlideIndicator` + `NavMenu`（B12）。其余「⛔ 不做」（C1 / C12 / D4 / E4）是**功能上真的不做**。B11 已把宿主胶囊的动效编排与上游对齐。

---

## A. Bug 修复 —— 直接命中你的坑

这一组不是「新特性」，是你会实际踩到的问题。**A1、A2 是本次对比中收益最高、风险最低的两项。**

| 编号 | 功能 / 变更 | 你的现状 | 涉及文件 | 冲突面 | 优先级 | 最终解决方案 |
| --- | --- | --- | --- | --- | --- | --- |
| **A1** | 生产构建 CSS 压缩器把 `animation-timeline` 折进 `animation` 简写 → 头图 / 目录滚动动画全部失效。需加 `build.cssTarget`（**预防性配置**：与上游滚动动画同一 commit 落地，你目前无此类动画，见 I 节实测） | 无此配置 | `astro.config.mjs` | 小 | **P0** | **✅ 已做** `1550b06` |
| **A2** | KaTeX 浏览器端渲染需要的 Vite alias（`hast-util-from-html-isomorphic` / `decode-named-character-reference`）。**本仓库实测为潜在隐患**：两个包无 alias 时 `require.resolve` 均 `MODULE_NOT_FOUND`，但当前客户端图中无人 import，故配置前后产物**逐字节相同**（见 I 节） | 无 | `astro.config.mjs` | 小 | **P0** | **✅ 已做** `739b9df` |
| A3 | 同一行多段注音的 `^` 被上标预处理跨表达式错配（假名错位、残留花括号） | 旧实现 | `src/lib/markdown/` | 小 | P1 | **✅ 已做** `e3388db` |
| A4 | Mermaid 渲染失败提示 + 源码回退误把已渲染 SVG 内部 CSS 当成源码 | 旧实现 | `content-enhancer-utils.ts` | 小 | P1 | **✅ 已做** `9a20439`（仅摘 `readMermaidSource` 源码判读守卫；读者侧失败提示 UI 属于工具栏重写，未摘） |
| A5 | 代码全屏弹层入场动画结束时闪烁（需 `motion` 钉到 12.43.0） | `motion ^11.18.2` | `package.json` | 中 | P1 | 待做 |
| A6 | 移动端目录展开时闪回关闭状态（同 A5 依赖 motion 12.43.0） | 旧实现 | 目录组件 | 中 | P1 | 待做 |
| A7 | 移动端改用稳定小视口高度，修手机地址栏伸缩导致文章位置跳动 | 无 | 布局层 | 中 | P2 | 待做 |
| A8 | 移动端代码全屏：短内容被撑满屏 → 改为随内容增高的底部面板 | 旧实现 | `src/components/markdown/` | 小 | P2 | 待做 |
| A9 | 图片灯箱：点空白关闭、拖动后不误关闭、双指跟随触点、下滑关闭 | 旧实现 | 灯箱组件 | 中 | P2 | 待做 |
| A10 | 侧栏社交图标掉行 / 头像问候气泡被裁 / 长简介行首出现斜杠 | 旧实现 | `Social.astro` | 小 | P3 | 待做 |
| A11 | 不同父分类下的同名子分类显示错误的文章 | 旧实现 | `src/lib/content/` | 小 | P2 | 待做 |
| A12 | 日 / 韩文案缺失，非中文页友链申请表水合不一致 | 只开 zh + en | `config/i18n-content.yaml` | 小 | P3 | 待做 |

> **A1 出处**（v7.0.0 Bug Fixes 原文）：「为 CSS 压缩配置明确浏览器目标，避免滚动时间线被合并进无效的动画简写，导致头图与目录动效失效。」

上游给出的修复是一行配置：

```js
build: {
  cssTarget: ['chrome111', 'edge111', 'firefox128', 'safari16.4'],
}
```

`astro.config.mjs` 的注释说明了原因：Astro 以 `esnext` 构建，lightningcss 拿不到浏览器目标，于是把 `animation-timeline` 折进 `animation` 简写，浏览器直接拒绝解析，**所有 scroll-driven 动画静默消失**。

---

## B. 核心新特性

| 编号 | 功能 / 变更 | 你的现状 | 涉及文件 | 冲突面 | 优先级 | 最终解决方案 |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | 三档动效强度（灵动 / 克制 / 减弱）+ 系统 `prefers-reduced-motion` 优先 | 无 | `lib/motion-level.ts` 等 | 中 | P1 | ✅ 5907e24 |
| **B2** | 滑动指示器上游实现 `useGlideIndicator` + `lib/glide.ts` | **自研** `nav-indicator` | `Navigator.tsx` / `DropdownNav.tsx` | **高·二选一** | P1 | **部分采用**：头部 pill 保留自研（CSS 过渡方案）；菜单内滑动高亮已采用上游 `useGlideIndicator` + `NavMenu`（见 B12） |
| B3 | 丝线阅读目录：编号沿丝线排列，花瓣表示当前小节进度 | 旧 ToC | `lib/toc-ribbon.ts` + 14 文件 | 高 | P2 | ✅ eab30be |
| B4 | 图表按内容自然尺寸呈现，支持拖拽与键盘缩放 | 无 | `lib/diagram-sizing.ts` | 低 | P1 | ✅ 36404f4 |
| B5 | 图表全屏增强：滚轮 / 双指缩放、拖动平移、双击放大、键盘快捷键 | 旧全屏 | `lib/zoom-pan.ts` | 低 | P1 | ✅ 36404f4 |
| B6 | 图表 PNG 导出（按当前主题；浏览器不支持时存 SVG） | 无 | `lib/diagram-export.ts` | 低 | P2 | ✅ 36404f4 |
| B7 | 樱花视觉系统：头图樱花飘落 + 点击迸出花瓣 | 无 | `lib/sakura/`（3 文件） | 低 | P2 | ✅ 6324152 |
| B8 | 页面入场编排 + 滚动浮现 + 共享元素过渡 | 部分 | `lib/scroll-reveal.ts` 等 | 中 | P2 | ✅ 9da22d3；后续修复：嵌套 slug 含 `/` 使 `view-transition-name` 非法被 CSS 解析丢弃（`postTitleMorphName` 现 sanitize 非 ident 字符），且本地 React 卡片标题名字只在内联样式、上游「配对成功即清空内联」逻辑会把它清掉（改为显式写回名字） |
| B9 | 图标包按需打包 `BUNDLED_ICON_SETS` | 硬编码 4 套 | `lib/config/icon-sets.ts` | 小 | P3 | ✅ 49ee9a2（含 lucide 扩展） |
| B10 | Shiki 主题抽常量 + 代码高亮改 **Catppuccin Latte / Mocha** | `github-light` / `github-dark` | `lib/markdown/shiki-themes.ts` | 小 | P2 | ✅ b0d7b87（常量已移植，主题保留 github 对，未切 Catppuccin） |
| B11 | 顶部导航条胶囊动效编排（header.css 重写：hide/reveal 非对称、blur 随滚动态淡入、内容下沉、view-transition 连续命名 + `header-continuity.ts`） | 自研 `header-capsule.css` | `styles/components/header-capsule.css` / `theme-transition.css` | 中 | P2 | ✅ 0ad8e3c（动效对齐上游 v7；**命名只给胶囊**——被命名元素是 backdrop root，会把本地子元素玻璃（图标药丸）截成平色，故 `#site-header` / `.header-content` 不命名；移动端保留本地方案，不引入上游 `::before` 整栏毛玻璃条） |
| B12 | 导航下拉菜单重做：`NavMenu` 滑动高亮（`useGlideIndicator` y 轴）、`nav-popover` 玻璃面板、Popover 重写（键盘焦点进出、transform-origin、reduced-motion 感知）、菜单间互斥 | 旧 v6 下拉（静态高亮、自包 state） | `NavMenu.tsx` / `ui/popover.tsx` / `DropdownNav.tsx` / `LanguageSwitcher.tsx` / `Navigator.tsx` | 中 | P2 | ✅ 本次提交（`glide.ts` 及测试本就已同步上游；`LanguageSwitcher` 按钮外观保留本地 lucide 图标，内容对齐 `NavMenu`；面板配色走本地变量） |

### 按上游版本看新特性

| 版本 | 主要新特性 |
|---|---|
| **v7.0.0**「樱花新章」 | 三档动效强度；丝线阅读目录；图表自然尺寸 + 拖拽缩放；统一交互动效 |
| v7.1.0 | 公开写作室 `/editor/`（CodeMirror 6） |
| v7.2.0 | 移动导航抽屉重做；系列阅读进度尺；图表全屏缩放/平移/导出；代码高亮换 Catppuccin |
| v7.3.0 | 写作室视觉统一、移动端更紧凑 |
| v7.4.0 | 归档/分类/标签/系列页统一樱花视觉；写作日历；友链横排名片；追番海报书架 |
| v7.5.0 | 友链分组；`koharu new` 可选分组 |
| v7.6.0 | 期刊目录页重设计 + 期数自动解析；系列头图共用视觉 |
| v7.7.0 | 文章落款 colophon；复制 Markdown / 下载 .md / 在写作室打开；新增 10 篇示例文章 |
| v7.7.1 | 目录上移动画、折叠引导线、短页面滚动稳定 |

---

## C. 页面 / 视觉重做

> ⚠️ 这一组会**覆盖你在这些页面上的配色定制**，做之前需先确认是否接受视觉变化。

| 编号 | 功能 / 变更 | 你的现状 | 涉及文件 | 冲突面 | 优先级 | 最终解决方案 |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | 归档 / 分类 / 标签 / 系列页统一换成首页樱花视觉（紧凑封面 + 文字页签） | 旧样式（你改过配色） | 多个页面 | 高 | P2 | **⛔ 不做**（护住蓝色主题） |
| C2 | 写作日历：归档页按月展示发文量，对数分档，点击跳转年月 | 无 | `archives.astro` | 中 | P2 | ✅ d288d9e（共享 PostYears/PostRow + archive-navigation；index-groups 随 C6 落地） |
| C3 | 分类首页改书本目录式列表，详情页用文字页签切换子分类 | 旧样式 | `category/` 系列 | 中 | P2 | ✅ b97b929（index-categories 全前缀匹配；旧 CategoryTitle/SubCategory 删除；子分类需有 categoryMap 条目，否则空 slug 是上游同款限制） |
| C4 | 标签改纯文字标签云 + 本地过滤 | 旧 `CollapsibleTags` / `TagItem` | `lib/tag-filter.ts` | 中 | P2 | ✅ 1acf03f（共享 PageIntro + index-pages.css 随本项落地；旧 pill 版 TagItem.tsx/CollapsibleTags.tsx 删除） |
| C5 | 友链改静态横排名片，配置色体现在头像外圈与悬停反馈 | 旧卡片 | `friends/FriendCard.tsx` | 中 | P2 | ✅ 82640f7（静态 .astro 网格 + friends-interactions；FriendCard.tsx 磁吸版保留给 markdown FriendLinksGrid） |
| C6 | 期刊目录页重设计 + 期数从标题自动解析（`Vol.35` / `No.3` / `#12` / `第 1 期`） | 旧系列页 | `lib/series-issue.ts` | 中 | P2 | ✅ 349eaf4（index-groups 同时落地；系列页改 index-surface + PageIntro 期数/年份统计） |
| C7 | 系列头图共用遮罩 / 樱花 / 入场动画 / 滚动视差，链接改磨砂胶囊按钮 | 旧 | 系列页 | 中 | P2 | 待做 |
| C8 | 系列阅读进度尺（悬停或触摸拖动预览并跳转）+ 上下篇改翻页卡片 | 旧 `SeriesNavigation` | `lib/series-rail.ts` | 中 | P2 | 待做 |
| C9 | 碎碎念：同一作者连续消息合并，操作按钮收进悬停工具条 | 旧 | `moments/` | 中 | P3 | 待做 |
| C10 | 追番改海报书架，只用粉色角标标出「在看」 | 旧 | `bangumi/` | 中 | P3 | 待做 |
| C11 | 移动导航抽屉重做：跟手拖动关闭、焦点约束与返回、背景交互隔离、安全区 | 旧 `MobileDrawer` | `lib/drawer-gesture.ts` | 中 | P2 | 待做 |
| C12 | 侧栏 / 顶栏同步收起、按访客当地时间显示问候、头像挥手 | 部分 | 布局层 | 中 | P3 | **⛔ 不做**（仅问候语，见 08 文档） |

---

## D. 需要你做产品决策的功能

| 编号 | 功能 / 变更 | 你的现状 | 涉及文件 | 冲突面 | 建议 | 最终解决方案 |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | 友链分组 `friends.groups` + `group` 字段，页签本页切换 | 平铺 1 条友链 | friends 组件 | 低 | 建议做 | ✅ b9cb4be（本地 React 改造，无分组时零变化） |
| D2 | 文章落款 colophon：手写 / 与 AI 合写 / AI 主笔 / 含剧透等标记，归档可按 `?mark=` 筛选 | 无 | `lib/content/post-colophon.ts` | 中 | 看意愿 | ✅ 49ee9a2（site.yaml 未加配置，能力就位、默认零变化） |
| D3 | 复制 Markdown / 下载 `.md` / 在写作室打开（`postActions` 段） | 无 | 面包屑右侧 | 低 | 建议做 | ✅ 0ec8045（不含「在写作室打开」，随 D4 排除；EditButton 并入本地下拉菜单） |
| D4 | 公开写作室 `/editor/`：CodeMirror 6 + 语法手册 + 浏览器草稿 | 无（你有 loopback CMS） | +62 文件，+8 依赖 | 高 | 不建议 | **⛔ 不做**（与 loopback CMS 职责重叠） |
| D5 | 原文 URL：`<文章地址>.md` 可直接访问 | 无 | `postActions` 关联 | 低 | 看意愿 | ✅ 0225d16（已实测产出 `.md`；本站唯一示例文含 `:::encrypted` 演示被上游安全谓词合法排除） |
| D6 | `catalog` 字段语义更正（决定是否计入分类树，旧文档写成「显示目录」） | 旧文档 | 文档 | 无 | 仅文档 | ✅ a1b64b7 + 1660110 |

### D2 的代价

`colophon.defaults` 默认会给**所有没标注的文章补上「手写」标记**——也就是说你现有全部文章在升级后都会自动带标。不想显示需要逐篇写 `colophon: []`，或在配置里删掉 `defaults`。

### D4 的代价

新增 `editorIntegration()`、6 个 codemirror 包、`dompurify`、`undici`，并要求 `/api/editor/og` 反代。它与你已有的 **loopback-only CMS 职责重叠**——公开站上的 `/editor/` 只写浏览器草稿、不读写服务器文件，但要不要开是产品决策。

---

## E. Breaking Changes —— 升级前必须处理

| 编号 | 变更 | 你的现状 | 涉及文件 | 冲突面 | 处理 | 最终解决方案 |
| --- | --- | --- | --- | --- | --- | --- |
| **E1** | `masterMotionEnabled` / `setMasterMotionEnabled(bool)` → `motionLevel` / `setMotionLevel('lively'\|'subtle'\|'reduced')` | 自研 hooks | 自定义动效组件 | 高 | **必须改** | 待做 |
| E2 | `site.showLogo` 默认 `true` → `false`（默认显示站点名而非图形 logo） | 已显式写 `showLogo: true` | `config/site.yaml` | 低 | 受保护 | **🛡️ 已受保护**（`showLogo: true` 已显式写死） |
| E3 | 系列页卡片移除 `isSimple` / `hideCover` / `showTags` 属性 | 未使用 | 系列页 | 低 | 无影响 | **— 无影响**（本仓库未使用） |
| E4 | `cms:install` 改 `--filter`；主站与 CMS 合并到根 `pnpm-workspace.yaml`；`pnpm install` 现在会装 CMS 依赖 | `cms/` 改动很多 | `package.json` / workspace | 高 | **高风险** | **⛔ 不做** |
| E5 | `motion` `^11.18.2` → 钉死 **12.43.0** | `^11.18.2` | `package.json` | 中 | 需回归 | 待做 |
| E6 | `@blocknote/*` 全部移除，改用 CodeMirror 6 全家桶 | 仅影响 CMS / 编辑器 | `package.json` | 中 | 随 D4 | 待做 |
| E7 | 上游删除 `CLAUDE.md`、`src/components/tag/*`、`category/CategoryTitle.astro`、`SubCategory.astro`、`control/ButtonLink.astro`、`friends/FriendsGrid.tsx` | 这些文件你也有 | 多处 | 中 | 注意连带 | 待做 |

> **E2 说明**：你已在 `config/site.yaml` 里显式写死 `showLogo: true`，所以不受上游改默认值的影响。但注意你的 logo 渲染方式已被本地优化过（`?react` 内联 → `<img>`），升级时**不要被上游版本覆盖回去**。

### E1 的影响面（需逐个核对）

随 v7.0.0 一起落地的动效接口重构。以下是本仓库中所有动效相关文件，升级前需逐一确认没有 import 旧接口：

- `src/hooks/useMagneticTilt.ts`（自研）
- 任何直接读写 `store/settings.ts` 的组件

```ts
// 旧（v6）
setMasterMotionEnabled(true);   // 关
setMasterMotionEnabled(false);  // 开
// 新（v7）
setMotionLevel('reduced');
setMotionLevel('lively');
```

---

## F. 架构 / 性能改进

| 编号 | 内容 | 你的现状 | 涉及文件 | 冲突面 | 优先级 | 最终解决方案 |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Vite `worker: { format: 'es' }` 配置 | 无 | `astro.config.mjs` | 小 | P2 | 待做 |
| **F2** | 隐藏的桌面目录、关闭的抽屉**停止跟踪滚动**；缓存目录节点状态，减少重绘与逐帧 DOM 读取 | 无 | 目录 / 抽屉组件 | 中 | P1 | 待做 |
| F3 | 停止隐藏装饰的计算，限制雪花绘制频率与画布尺寸，减少无效弹簧与指针追踪 | 无 | 动效层 | 中 | P2 | 待做 |
| F4 | 测试从本地 6 组扩到 117 编辑器 + 32 Markdown + 11 图表 + 25 动效 + 灯箱 / TOC / 设置 / BGM 浏览器回归 | 本地 6 组 | `tests/` + `*.test.ts` | 小 | P3 | 待做 |
| F5 | 41 个新 lib 模块，全部带 `.test.ts`（`zoom-pan` / `glide` / `toc-ribbon` / `lightbox-flip` / `motion-level` ……） | 无 | `src/lib/` | — | — | — 上游有、本地无，随对应项落地时一并摘 |

> F2 与本文档相关的背景：本仓库此前做过一轮首页性能优化（logo `<img>` 化 + pagefind 懒加载，commit `18c3965`）。上游的 F2/F3 是**同一方向**但作用在不同模块上的优化，可叠加。

---

## G. 合并成本分析

### G.1 你独占、上游未动的文件（合并时不受影响）

好消息：你的绝大部分定制**不在上游的改动面上**。

- `src/components/layout/SearchPortal.astro` —— pagefind 懒加载
- `src/styles/components/header-capsule.css` —— 导航胶囊 / 指示器样式
- `src/components/layout/Footer.astro`
- `src/hooks/useMagneticTilt.ts`
- `src/pages/moments.astro` / `music.md` / `about.md` / `404.astro`
- `src/styles/theme/shoka-containers.css`
- `src/assets/`（`logo.svg`、`lqips.json`、`summaries.json`、`similarities.json`）
- 全部 `src/content/` 文章与碎碎念

### G.2 双方都改过的文件 —— 54 个，需要手动合并

| 编号 | 文件 / 模块 | 冲突性质 | 位置 | 严重度 | 最终解决方案 |
| --- | --- | --- | --- | --- | --- |
| H1 | `Navigator.tsx` + `DropdownNav.tsx` | 自研 `nav-indicator` vs 上游 `useGlideIndicator` | `src/components/layout/` | **最高·二选一** | **部分采用**（B12：菜单互斥与 `NavMenu` 已对齐，头部 pill 仍自研） |
| H2 | `Header.astro` + `post.css` | logo `?react` → `<img>` 优化 | `layout` / `styles` | 高 | 待做 |
| H3 | `theme/index.css` + `global/utils.css` | 蓝色主题定制 vs 上游樱花配色 | `styles/` | 高 | 待做 |
| H4 | `InfographicToolbar.tsx` | 刚加的 emitter 错误捕获 vs 上游缩放/导出重写 | `components/markdown/` | 高 | 待做 |
| H5 | `SearchDialog.tsx` | pagefind 懒加载事件 | `components/layout/` | 中 | 待做 |
| H6 | `package.json` / `pnpm-lock.yaml` | motion 版本 + 依赖集 | 根目录 | 高 | 待做 |
| H7 | `config/site.yaml` + `i18n-content.yaml` | 你的站点配置 | `config/` | 中 | 待做 |
| H8 | `cms/` 整块（`server.ts`、`App.tsx`、各 api 与组件） | 你有大量 CMS 改动 | `cms/` | **最高·与 E4 叠加** | 待做 |

其余 46 个文件为常规 hunk 级冲突，包括 `announcement/`、`friends/`、`i18n/translations/*`、`styles/components/*` 等。

### G.3 内容目录冲突

上游 v7.7.0 同样新增了 **10 篇示例文章和 2 篇英文翻译**。你手上也有一批同源的示例文件：

- `src/content/blog/tools/getting-started.md`
- `src/content/blog/weekly/weekly-example-1.md`
- `src/content/blog/note/markdown-features.md` / `shoka-features.md` / `toc-no-numbering.md`
- `src/content/blog/tools/astro-koharu-guide.md`
- `src/content/blog/sample/markdown-syntax-demo.md`

两边同源但已不同步，**合并内容目录时会大面积冲突**。建议合并时对 `src/content/` 采用「保留本地」策略，只挑上游新增的、你确实想要的文章单独引入。

---

## H. 建议的取舍方案

**总体结论：不要整体 merge / rebase 到 v7.7.1，改为按需摘取（cherry-pick 单点）。**

119 个 commit / 462 个文件里真正对你有价值的是少数几项，全量合并会把导航胶囊、蓝色主题、pagefind 懒加载、信息图修复全部推回冲突状态。

> ✅ **本决策已确认落地**：A1 + A2 已按此方案摘取完成（`1550b06` + `739b9df`），未做任何整体 merge。各表的「最终解决方案」列记录了逐项去向。

### 值得做

- **A1 + A2** —— 两个 `astro.config.mjs` 的小改，修的是你正在踩的坑，且**不依赖 v7 任何新架构**
- **A3 + A4 + A5** —— 注音错配、Mermaid 源码回退、代码全屏闪烁
- **B2** —— 用上游 glide 替换自研指示器，以后好跟上游演进
- **B4 + B5 + B6** —— 图表缩放 / 全屏增强 / PNG 导出，纯增量功能
- **D1 + D3** —— 友链分组、复制与下载 Markdown，零风险 ✅（b9cb4be / 0ec8045）

### 想清楚再做

- **B1 + B7 + B8** —— 动效系统会重编排整站观感
- **B3** —— 丝线目录会替换你现有 ToC
- **C 组** —— 会覆盖你调过的配色
- **D2** —— 会给所有现存文章打上标记 ✅（49ee9a2 已落地，site.yaml 未配 defaults 故零标记零变化；启用前想清楚）

### 建议不做

- **D4** 公开写作室 —— 与 loopback CMS 职责重叠
- **E4** CMS workspace 重构 —— 你 `cms/` 改动太多，冲突面最大而收益最小

---

## I. 落地顺序建议

按依赖关系拆成独立 commit，**禁止批量乱改**：

| 步骤 | 内容 | 依赖关系 | 涉及文件 | 冲突面 | 优先级 | 最终解决方案 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 先落地 **A1 + A2**（`astro.config.mjs` 两处小改） | 独立，不依赖 v7 | `astro.config.mjs` | 小 | **P0** | **✅ 已完成**（`1550b06` + `739b9df`） |
| 2 | **A3 + A4**（markdown 解析层修复） | 独立 | `src/lib/markdown/` | 小 | P1 | **A3 ✅ 已做** `e3388db`；**A4 ✅ 已做** `9a20439` |
| 3 | **B4 + B5 + B6**（图表能力） | 独立，纯增量 | 新 lib 模块 | 低 | P1 | ✅ 36404f4 |
| 4 | **B2**（滑动指示器） | 需先确认视觉一致 | `Navigator.tsx` | 高 | P1 | **部分采用**（B12：菜单内高亮已对齐，头部 pill 保留自研） |
| 5 | **A5 + E5**（motion 升级到 12.43.0） | 需全站动效回归 | `package.json` | 中 | P1 | 待做 |
| 6 | **D1 + D3**（低风险增量功能） | 独立 | friends / 面包屑 | 低 | P2 | **✅ D1** b9cb4be；**✅ D3** 0ec8045；**D2** 49ee9a2、**D5** 0225d16、**D6** a1b64b7 一并落地 |
| 7 | **B1 + B7 + B8**（动效系统） | 会改变整站观感，最后做 | 多文件 | 中 | P2 | ✅ 5907e24 / 6324152 / 9da22d3 |

### 复查 A1 是否已修复

先用 **source 侧**确认你这棵树到底有没有需要保护的滚动动画（2026-10-07 实测：**没有**，全仓除 `node_modules`/`dist` 外 `animation-timeline` 零命中；上游的 `src/styles/components/cover.css`、`toc.css` 在本仓库不存在，`src/styles/global/motion.css` 只有 32 行且无 `@supports` 块）：

```bash
grep -rn "animation-timeline\|view-timeline\|scroll-timeline" src/
```

**这一步的结论决定下面怎么读产物**：

- **source 无命中** → 产物里 `grep` 不到是**正常**的，不是修复失败。`cssTarget` 此时是「哨兵」：等以后引入带滚动动画的上游组件时生效。
- **source 有命中** → 此时才能用产物判断，且必须这样测（**不能只看源码，要看产物**）：

```bash
pnpm build
# 必须 grep 产物 CSS；本项目 dist/_astro/ 下无独立 css 文件，CSS 内联在 HTML 里
grep -o "animation-timeline:[^;}]*" dist/**/*.html dist/_astro/*.css 2>/dev/null | head
```

若 source 有命中而此处无输出，才说明仍被压缩器吃掉、`cssTarget` 未生效。

> ⚠️ 上游 `cssTarget` 与滚动动画是**同一个 commit（`6123d83` v7.0.0）**一起落地的：该 commit 同时新增 `cssTarget`（+4 行）与 `cover.css`/`toc.css`/`motion.css` 里的 `animation-timeline` 用法（合计 +521 行）。也就是说它是为**新引入的**滚动动画服务的**预防性配置**，不是修复你现有页面上的既有失效。

---

## J. 拉取上游与核查方法

本环境 **HTTPS 443 到 github.com 连不上**，但 **SSH 443 可用**。所以拉取上游要用带 scheme 的 SSH 形式：

```bash
# 一次性：把上游 tag 拉到本地（不添加 remote、不影响工作区）
git fetch --no-tags ssh://git@ssh.github.com:443/cosZone/astro-koharu.git \
  '+refs/tags/v6.3.0:refs/tags/up/v6.3.0' \
  '+refs/tags/v7.7.1:refs/tags/up/v7.7.1'

# 核对本文档中任意一项
git diff up/v6.3.0 up/v7.7.1 -- astro.config.mjs
git diff --stat  up/v6.3.0 up/v7.7.1
git rev-list --count up/v6.3.0..up/v7.7.1
```

> 注意：`git push/fetch git@ssh.github.com:...`（不带 `ssh://` scheme）会失败——**scheme 是必需的**，否则端口 443 无法传递。

清理这两个临时 tag：

```bash
git tag -d up/v6.3.0 up/v7.7.1
```

---

## 相关文档

- [Astro 7 升级说明](./12-astro-7-upgrade.md) —— 本仓库已经完成的 Astro 7 / Vite 8 升级
- [主题使用手册](../theme-usage.md) —— 完整配置与命令参考
