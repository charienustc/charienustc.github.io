# 文档导航

核对日期：2026-10-15。本文档面向 Charien's Yard 当前分支；本站是对 astro-koharu 的定制，不能将上游示例直接视为本站配置。

## 使用与维护

| 任务 | 文档 |
| --- | --- |
| 项目介绍、常用命令和发布 | [根 README](../README.md) |
| 从克隆到本地写作 | [快速开始](../GETTING-STARTED.md) |
| 站点配置与主题功能 | [主题使用手册](theme-usage.md) |
| Markdown 与 Shoka 语法 | [语法参考](syntax-reference.md) |
| CMS 编辑、版本历史、备份和发布 | [CMS 指南](features/cms.md) |
| 公告发布、到期与已读行为 | [公告指南](features/announcements.md) |
| 本站静态碎碎念与首页动态 | [静态碎碎念](features/static-moments.md) |
| 友链分组 | [友链指南](features/friend-link-groups.md) |
| 链接卡片与嵌入 | [链接嵌入](features/link-embedding.md) |

## 开发与智能体入口

- [项目总览](overview/00-overview.md) 与 [架构](overview/01-architecture.md)：前台、配置、CMS 的边界。
- `overview/02` 至 `overview/10`：内容、路由、组件、状态、主题、动画、样式和 Markdown；其中教学代码是简化示例，实际导出和实现以源文件为准。
- [部署说明](overview/11-deployment-adapters.md)：本站 GitHub Pages 发布门禁，以及保留的可选 Docker/Node 部署。
- [AGENTS.md](../AGENTS.md)：仓库协作规则、验证命令、内容与备份保护要求。
- [CLAUDE.md](../CLAUDE.md)：面向 Claude Code 的入口，遵循相同的仓库规则。
- [.claude/skills/blog-writer](../.claude/skills/blog-writer/SKILL.md)：文章创建、frontmatter 与分类规则。
- [.claude/skills/infographic-creator](../.claude/skills/infographic-creator/SKILL.md) 和 [语法生成](../.claude/skills/infographic-syntax-creator/SKILL.md)：博客信息图内容；其余 item/structure/template 技能为条件适用的 AntV 库开发参考，不是本站目录说明。

## 当前实现边界

- 前台使用 Astro 7、React 19、Tailwind CSS 4；`package.json` 的 `version: 6.3.0` 是保留的包版本，不代表 Astro 版本或已完整升级至上游 v7。
- GitHub Pages 只部署静态 `dist/`。本地 CMS 不会随前台部署到公网。
- `src/content.config.ts` 定义 `blog` 与静态 `moments` 两个集合，内容直接来自本仓库。
- `moments.enabled: false` 控制的是模板的动态 suite 集成；不影响本站静态 `/moments`。
- 前台 `pnpm check` 与 CMS 的 `tsc --noEmit` 均要求零错误。旧的 6 个类型错误已在 `2d69e5d` 修复。
- 发布工作流使用各自锁文件安装两套依赖，然后检查前台类型、CMS 类型、完整测试和生产构建，全部通过才部署。
- 最新功能包含首页最新动态、按需水合、延迟评论与 Mermaid、CMS 文章版本历史。性能摘取范围见历史对照文档 K.5，未摘取项目不能当作已实现。

## 保留的参考与历史资料

以下文档有其独立场景，不是本站日常部署或写作的默认步骤：

- [动态 Moments 中文](features/moments.md)、[English](features/moments.en.md)、[日本語](features/moments.ja.md)：koharu-suite 按请求归档；本站未启用。不能直接用同名 `/moments` 路径覆盖静态页面。
- [双服务部署样例](../deploy/koharu-stack/README.md)：面向 VPS、suite 和数据库的可选方案。
- [G2.7 设计](design/g2.7-moments-integration.md)：原始集成设计与验收记录。
- [Astro 7 升级](overview/12-astro-7-upgrade.md)：历史升级说明。
- [上游 v7 对照](overview/13-upstream-v7-upgrade-comparison.md)：固定比较区间、采纳决定和已落地提交，不代表实时上游最新状态。
- [系列 patch 指南](../tests/series-test-patches/README.md)：历史测试夹具，应用前先 `git apply --check`。

修改文档时先核对代码，更新对应的使用指南和智能体约束；不要把计划功能写成已完成，也不要为更新日期改写历史结论。文章、个人简介和内容正文不是开发说明，更新项目文档时不应自动改写。
