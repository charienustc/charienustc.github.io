# 本地 CMS 与文章版本历史

核对日期：2026-10-15。CMS 是独立的 React/Vite 应用，由 `cms/server.ts` 的 Hono 服务提供文件 API，不是公开站点的登录后台。

## 启动与预览

在仓库根目录执行：

```bash
pnpm cms:install
pnpm cms
```

访问 `http://localhost:4322`。文章的 Preview 链接使用 `http://localhost:4321`，需要另一个终端运行 `pnpm dev`。
CMS 有单独的 `cms/pnpm-lock.yaml`，不属于根 workspace 的依赖安装范围。前台 YAML 改动后需要重启开发服务器。

## 日常编辑

- 仪表盘查看文章、分类统计与最近更新；文章列表支持搜索和筛选。
- 文章使用 BlockNote 编辑正文，侧栏编辑属性、查看目录和 Markdown 渲染预览；支持 Save 和 Ctrl/Cmd+S。
- 属性面板的「Colophon」按 `config/site.yaml` 的 `colophon.marks` 渲染执笔标记：互斥组单选，其余组可多选；已保存的一次性落款会保留，清空全部选择可显式退出默认落款。修改 `site.yaml` 后需重启 CMS 才会刷新选项。
- 关闭有未保存改动的编辑器时，可取消、直接关闭或保存后关闭。
- 碎碎念使用独立的编辑界面，支持创建、编辑、删除、标签及图片上传。图片可选择、粘贴或拖入；正文可在「编辑 / 预览」之间切换，预览直接渲染 Markdown 和已上传的图片。
- 删除文章或碎碎念时保留文件到 `backups/deleted/`，而不是立即销毁内容。

## 文章版本历史

1. 打开文章，在编辑器顶部点「历史版本」。
2. 左侧按备份时间倒序排列，右侧查看原始 Markdown，包含 frontmatter 和正文。
3. 选择版本，点「恢复此版本」，再次确认。
4. 恢复前先备份当前已保存文件，然后原样写回选中版本，编辑器重新读取标题、属性和正文。
5. 如需撤销恢复，再打开历史记录，选择刚产生的恢复前备份。

时间表示旧内容被备份的时刻，采用 CMS 所在机器的本地时区，并显示到毫秒；不是该版本的原始发布日期。
空列表表示尚未通过 CMS 保存过旧内容，不会自动从 Git 历史导入版本。

有未保存改动时仍可浏览历史，但不能恢复；先关闭弹窗保存，再执行恢复。弹窗打开时保存快捷键不会触发后台保存。
恢复会还原旧版日期、草稿状态、链接等属性，不会自动将 `updated` 改成当前时间。已删除的文章不能通过该接口静默重建。

## 存储与保证

| 内容 | 本机路径 | 行为 |
| --- | --- | --- |
| 文章旧版 | `backups/versions/posts/<postId>.<YYYYMMDD-HHmmssSSS>.md` | CMS 保存前、恢复前备份 |
| 碎碎念旧版 | `backups/versions/<momentId>.<YYYYMMDD-HHmmssSSS>.md` | 编辑前备份；保留现有路径 |
| 已删除内容 | `backups/deleted/` | 删除留存，详情见删除工具 |

文章路径保留原有目录和 `.md`/`.mdx` 扩展名，例如 `note/a.mdx.20261015-103000123.md`。
文章备份采用排他创建，同毫秒碰撞会选择未占用的时间戳；备份失败时不继续覆盖当前文章。
接口校验路径边界、版本归属和符号链接，禁止用甲文章的版本恢复乙文章。

自动备份仅覆盖文章保存接口与历史恢复接口。手工改文件、Git 操作，以及单独的草稿/置顶切换接口不会自动生成文章版本。
碎碎念目前只有旧版文件留存，没有接入文章历史弹窗。此前试验代码可能留下的非 `posts/` 文章备份不会自动迁入，避免与碎碎念混淆。

`backups/` 被 Git 忽略，不会上线，也不是远程备份；版本和删除留存不会自动清理。清理前先确认需要保留的内容并另行备份。

## Git 发布

仪表盘与文章编辑器都可打开 Publish。编辑器有未保存改动时须先保存。

发布流程会展示当前分支和改动，执行 `git add -A`、`lint-staged`、commit、push；会包含整个工作区的可跟踪改动，不只当前文章。
若 push 失败，本地提交仍然存在，可重试推送。当前分支需要已设置 upstream；只有 `main` 的推送会触发本站 Pages 发布。

本地 lint-staged 不等于完整发布验证。远程工作流还会安装前台和 CMS 依赖，运行类型检查、完整测试与构建；失败时不会更新线上站点。

## API 与开发入口

| 方法 | 路径 | 参数 |
| --- | --- | --- |
| GET | `/api/cms/versions` | `postId` |
| GET | `/api/cms/versions/read` | `postId`、`version` |
| POST | `/api/cms/versions/restore` | JSON：`postId`、`version` |

- 文件逻辑：`cms/src/lib/post-versions.ts`；通用时间戳：`cms/src/lib/versions.ts`。
- 路由：`cms/src/api/versions.ts`；保存时备份：`cms/src/api/write.ts`。
- 界面：`cms/src/components/PostHistoryDialog.tsx`，由 `PostEditor.tsx` 接入。
- 测试：`cms/src/lib/post-versions.test.ts`，包含真实临时目录、恢复往返与错误分支。

```bash
pnpm --dir cms exec tsc --noEmit
pnpm test:cms
```

CMS API 校验 localhost Host，并支持可选 `CMS_API_KEY` Bearer 鉴权；没有面向公网的用户登录体系。不要将 CMS 端口反向代理到公网。
上传图片的类型按文件头校验，上限 5 MB；文件写入被 Git 跟踪的 `public/img/moments/`，发布前检查图片是否适合公开。
