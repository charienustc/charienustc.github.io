---
title: 使用Tailscale和Outline在Vlab虚拟机平台上搭建私有笔记平台
link: explore/shi-yong-tailscalehe-outlinezai-vlabxu-ni-ji-ping-tai-shang-da-jian-si-you-bi-ji-ping-tai
draft: false
sticky: false
tocNumbering: true
excludeFromSummary: false
math: false
quiz: false
date: 2026-10-10 14:11:52
updated: 2026-10-10 16:14:03
categories:
  - [探索]
tags:
  - outline
  - tailscale
  - 笔记软件
  - 私有化部署
description: 记录一下自部署Outline实现多端访问的私有化笔记工具
---
## Outline 是什么

[Outline](https://www.getoutline.com/) 是一个开源的团队知识库 / 文档协作工具——就是一个可以自部署的 Notion 平替。

它的核心特点包括：

* **支持原生 Markdown ;**。作为笔记软件，它支持原生 markdown，编辑体验是所见即所得，但数据层存的是结构化的富文本（ProseMirror 文档树），不是裸 md 文件。

* **采用层级化的 collection + document**。collection 相当于笔记本 / 空间，下面挂文档，文档还能再挂子文档，形成树。

* **具有完整的团队能力**：支持权限管理（包括 read / read_write / admin）、评论、`@` 提及、模板、全文搜索、版本历史、生成链接进行分享。

* **包含丰富的集成**：Slack、OIDC/OAuth SSO、S3 附件存储等。

* **技术栈**：Node.js（Koa + React/ProseMirror 前端）+ PostgreSQL（主数据）+ Redis（缓存 / 队列），可选 S3 兼容对象存储。官方提供 Docker 镜像，一条 compose 就能起。

它不是笔记软件里最“个人向”的那类（比如 Obsidian 走纯本地文件、Joplin 走端到端加密），而是**团队知识库**的路线——这也决定了它的登录、权限体系天生是"多用户 + SSO"的。

## **我为什么想自部署 Outline**

在笔记这一块，我主要有以下需求：

| 需求          | 说明                                                     |
| ----------- | ------------------------------------------------------ |
| 免费          | 单纯不想花钱                                                 |
| 数据在自己手里     | 不想把笔记交给第三方 SaaS，且要有可执行的备份方案                            |
| 多端同步可用      | 手上有 Windows、Android、HarmonyOS 等多种操作系统的设备，需要能够支持多端同步且方便使用 |
| Markdown 友好 | 写作习惯是 Markdown                                         |
| 支持接入 Agent   | 支持通过 MCP 等方式接入 Claude Code 或 Codex 使用                  |
| 网络上便于访问     | 懂得都懂                                                   |
| 简约舒适的 UI     | UI 舒服笔记写起来也很顺畅                                         |

有了这些需求之后，我对比了很多的方案，但是都不尽如人意：

|              |                                                            |
| ------------ | ---------------------------------------------------------- |
| 考虑的方案        | 问题                                                         |
| Obsidian+Git | Obsidian 官方的同步服务很贵，平替的方案如结合 Git+Github 的方案又比较麻烦，移动端也不方便 Git 操作 |
| 思源笔记         | u1s1，思源笔记移动端的 UI 不好看                                         |
| Notion       | 太重了，很多功能用不到，且访问需要魔法                                        |
| Ima          | 本来是免费的，现在算力不足了要收费                                          |
| 语雀           | 本来可以学生认证获得一年专业版权限，现在不知道能不能弄了                               |

于是就找了一下开源的自部署方案，最终决定尝试捣鼓一下 Outline。

## 不想买服务器？

计算机学院的 [Vlab](https://vlab.ustc.edu.cn/) 是个很好的选择，每个人默认有 2 核心 CPU、6 GB 内存与 16 GB 存储空间够用了，不够可以申请增加存储空间。因为虚拟机在内网环境，可以用 Tailscale 来做，把服务绑在 `127.0.0.1`，只用 tailscale 暴露给 tailnet，不会暴露任何端口到公网。

## 怎么搭？

### 部署架构

实现架构如下：

```mermaid
flowchart TD
    subgraph tailnet["tailnet（私网，公网不可见）"]
        TS1["Tailscale Serve :443"]
        TS2["Tailscale Serve :8443"]
    end

    TS1 -->|"127.0.0.1:3000"| outline["outline<br/>(outlinewiki/outline:latest)"]
    outline --> postgres["postgres<br/>(postgres:16, 内网)"]
    outline --> redis["redis<br/>(redis:7, 内网)"]

    TS2 -->|"127.0.0.1:1411"| pocketid["pocket-id<br/>(pocketid/pocket-id:v2, passkey OIDC)"]
    pocketid -. OIDC登录 .-> outline
```

需要跑四个容器：

| 服务         | 镜像                                   | 端口             | 说明                     |
| ---------- | ------------------------------------ | -------------- | ---------------------- |
| Outline    | `outlinewiki/outline:latest`（1.10.1） | 127.0.0.1:3000 | 主应用                    |
| PostgreSQL | `postgres:16`                        | 仅容器内网          | 主数据库                   |
| Redis      | `redis:7`                            | 仅容器内网          | 缓存 / 队列                |
| Pocket ID  | `pocketid/pocket-id:v2`（2.16.0）      | 127.0.0.1:1411 | 自建 OIDC 身份源，passkey 登录 |

所有服务的端口都绑 `127.0.0.1`，不绑 `0.0.0.0`。对外只通过 Tailscale Serve 暴露成 tailnet 内的 HTTPS 域名。这样服务本身只在 loopback 上监听，唯一入口是 tailnet。

### 部署步骤

> 后面的部分是 AI Agent 帮我操作的，也是 AI 帮我写的

1. 装 Docker 和 Tailscale Serve。

2. &#x5199;**&#x20;**`docker-compose.yml`**。** 4 个 service：postgres（带 healthcheck）、redis、pocket-id、outline（`depends_on` postgres 健康 + redis 启动）。数据落在 3 个 named volume：`outline_pg_data` / `outline_data` / `pocket_id_data`。

3. 写配置，全&#x90E8;**&#x20;**`chmod 600`**。** 三个文件都在 `/root/outline/`，权限收紧：

* `.env`（Outline 主配置）：

  * `NODE_ENV=production`、`URL=https://your-machine.ts.net`、`PORT=3000`

  * `SECRET_KEY` / `UTILS_SECRET`：随机生成

  * `DATABASE_URL=postgres://outline:...@postgres:5432/outline`（走容器内网主机名 `postgres`）

  * `REDIS_URL=redis://redis:6379`

  * `FILE_STORAGE=local` + `FILE_STORAGE_LOCAL_ROOT_DIR=/var/lib/outline/data`（附件存本地卷，不上 S3）

  * `FORCE_HTTPS=true`、`PROXY_HEADERS_TRUSTED=true`（因为在 Serve 后面，要信任反代的 `X-Forwarded-*`）

  * `DEFAULT_LANGUAGE=zh_CN`

  * OIDC 四项：`OIDC_ISSUER_URL` / `OIDC_DISPLAY_NAME` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET`

* `pocket-id.env`：Pocket ID 自身配置。

* `docker-compose.yml` 里 postgres 的密码等。

4. 配置 Tailscale Serv&#x65;**。** 两条映射，都是 tailnet-only：

```bash
tailscale serve --bg --https 443  http://127.0.0.1:3000   # Outline
tailscale serve --bg --https 8443 http://127.0.0.1:1411   # Pocket ID
```

对应域名：

* `https://your-machine.ts.net` → Outline

* `https://your-machine.ts.net:8443` → Pocket ID

（这需要 tailnet 开了 MagicDNS，后缀 `your-tailnet.ts.net`，把 `your-machine` 解析到虚拟机 IP。）

5. **起服务 & 初始化。**

* `docker compose up -d`，等 postgres healthy。

* Pocket ID 初始化：访问 `/signup/setup` 创建管理员、注册第一个 passkey。

* 在 Pocket ID 里建 OIDC client：填好回调地址，拿到 client id / secret 填回 Outline 的 `.env`。

* 在 Outline 里用 OIDC 登录，账号自然带上 `is_admin`。

6. 配 MC&#x50;**。** Outline 官方自带 MCP 端点`/mcp`（Streamable HTTP，POST only）。在 Claude Code 里注册：

```bash
claude mcp add --transport http outline https://your-machine.ts.net/mcp \
  --header "Authorization: Bearer ol_api_..."
```

于是就有了 19 个工具（文档 / collection / 评论 / 模板 / 附件 / 用户），可以用 agent 管理内容了。

> 总结一下，AI 还是太好用了，几分钟就帮我部署好了

## 后续配置

写了两个 cron 任务，分别执行数据备份和定时发送邮件报告系统状态。

## 小结

这套方案可能看起来也挺折腾，但是这不是有~~免费的~~ AI 劳动力吗，有手就行（zhen），主要是免费好玩（手动狗头）。
