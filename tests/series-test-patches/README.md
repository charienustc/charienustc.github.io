# 多系列功能测试指南

核对日期：2026-10-15。目录中的 patch 是以旧 weekly 配置为基线的历史夹具，当前本站使用 `/series`。
它们适合作为测试场景参考，不保证能直接应用到现有 site.yaml。

## 自动检查优先

```bash
pnpm test:config
pnpm test:content
```

配置归一化测试包括系列数组、slug 唯一性与保留路由冲突；内容测试覆盖索引与分组。
界面行为仍需启动 `pnpm dev` 检查。

## 手工验收场景

在独立、可丢弃的 checkout 中按当前配置添加合成内容，不要在有未提交内容的工作区批量还原。

| 场景 | 操作 | 预期 |
| --- | --- | --- |
| 两个系列 | categoryMap 加入书摘，featuredSeries 增加 reading，创建带分类/日期/稳定 link 的测试文章 | `/series` 与 `/reading` 均存在，按规则显示高亮 |
| 禁用系列 | 将某项 enabled 设为 false | 对应专栏路由和入口不再生成，普通文章是否出现由内容查询规则决定 |
| 保留名冲突 | 将系列 slug 改成已有保留路径 | 构建明确报配置错误 |
| 关闭首页高亮 | 设置 highlightOnHome: false | 系列页仍可访问，首页不再把它作为系列高亮 |
| 语言镜像 | 检查默认语言与 `/en/` 的系列入口 | URL 和页面 locale 一致，内容回退符合预期 |

每次修改 site.yaml 后重启 dev。结束前运行 `pnpm check` 和 `pnpm build`。

## 历史 patch

| 文件 | 原始场景 |
| --- | --- |
| `01-add-reading-series.patch` | 增加第二个系列 |
| `02-disable-weekly.patch` | 禁用 weekly |
| `03-test-reserved-slug-error.patch` | 触发保留名错误 |
| `04-test-highlight-off.patch` | 关闭 weekly 首页高亮 |

先确认工作区状态，再做只读应用检查：

```bash
git status --short
git apply --check tests/series-test-patches/01-add-reading-series.patch
```

检查失败时按当前配置手工复现场景，不要强制应用或用整目录 checkout 清理。
若已在隔离 checkout 中应用 patch，可用 `git apply --reverse --check <patch>` 核对后反向应用；新增夹具文件只删除本轮明确创建的文件。
不要使用 `git checkout -- .`、`git clean -fd` 或整目录递归删除来还原测试，这会丢失不相关改动。

系列用法见 [内容系统](../../docs/overview/02-content-system.md)，开发和发布要求见 [AGENTS.md](../../AGENTS.md)。
