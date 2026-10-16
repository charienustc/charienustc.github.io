# 公告使用指南

核对日期：2026-10-15。公告从 `config/site.yaml` 的 `announcements` 数组读取，前台组件已接入，无需额外启用开关或后台服务。

## 发布公告

在现有数组中新增一项，不要再创建第二个同名 `announcements` 键：

```yaml
announcements:
  - id: site-update-20261015
    title: 小窝更新
    content: 新增了碎碎念，欢迎来看看。
    type: info
    priority: 10
    publishDate: '2026-10-15'
    startDate: '2026-10-15T00:00:00+08:00'
    endDate: '2026-10-31T23:59:59+08:00'
    link:
      url: /moments
      text: 查看碎碎念
      external: false
```

保存后重启 `pnpm dev` 查看。线上需提交并推送 `main`，等待检查与部署完成。

| 字段 | 说明 |
| --- | --- |
| `id` | 唯一且稳定；每条新公告使用新 ID |
| `title` / `content` | 标题和普通文字正文，不解析 Markdown 或 HTML |
| `type` | `info`、`success`、`warning`、`important`，默认 `info` |
| `priority` | 越大越靠前，默认 0 |
| `color` | 可选 CSS 颜色，覆盖默认颜色 |
| `publishDate` | 显示用日期；不控制是否到期或是否已发布 |
| `startDate` / `endDate` | 控制显示区间，不填则无对应限制；建议显式写时区 |
| `link` | 可选的单个链接；`external: true` 在新窗口打开 |

注意：配置中的旧注释写过 `error` 类型，但当前 `src/types/announcement.ts` 和实际样式使用的是 `important`。应使用上表的类型。

## 访客看到什么

- 未读且在显示区间内的公告，优先级最高的一条以页面顶部横幅展示（配色跟随公告颜色/类型色）。横幅 sticky 钉在视口最上方，固定导航栏自动下移让位，互不遮盖；关闭后导航栏回到页面顶部。
- 横幅右侧的「查看全部」打开完整公告列表，「关闭」（×）即视为「知道了」，会记录已读且不再弹出；其余未读公告仍从页脚铃铛入口查看。
- 页脚 `Announcements` 铃铛打开完整公告列表，并显示未读数量。有生效公告时才显示入口。
- 已读状态保存在当前浏览器的 localStorage：`announcement-read-ids:v1`，不跨设备同步。
- 点击列表中的公告，或点「全部已读」会记录已读；列表项点击后即读会导致对应横幅同步消失。

公告列表仍保留有效的已读公告。到期项会在后续页面初始化/状态重算时被过滤，页面长期停留时不是精确计时的实时下线。

## 新旧公告如何管理

可以同时保留多条，不用每次把旧的注释掉。临时通知设置 `endDate`；长期通知保留；不再需要时删除或注释对应条目。
新消息使用新 `id`。沿用旧 ID 修改正文，不会清除访客原有的已读记录。

本地测试若没有弹出，可先点页脚查看列表，检查时间范围；也可使用无痕窗口测试新的访客状态。

实现入口：`src/constants/announcements.ts`、`src/store/announcement.ts`、`src/components/announcement/`。
