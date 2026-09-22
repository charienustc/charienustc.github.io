---
title: 'Hello World:用 Astro 搭建个人主页'
description: '博客的第一篇:为什么选 Astro,这个站点包含什么,以及接下来的打算。'
pubDate: '2026-07-19'
updatedDate: '2026-09-22'
tags:
  - astro
  - 随笔
draft: false
---
欢迎来到我的博客!这是第一篇文章。

这个站点断断续续折腾了一阵——中间换过终端风、液态玻璃风,最后停在现在的极简编辑风。折腾的过程比结果有意思,所以第一篇就聊聊它是怎么来的。

## 为什么选 Astro

个人主页的核心诉求很简单:**打开快、好维护、写着爽**。Astro 正好三点全中:静态优先、默认零 JavaScript,Markdown 内容还有类型校验,frontmatter 写错了构建期就会报错。技术栈最终定格为 Astro + Tailwind CSS,部署在 GitHub Pages,推送即上线。

## 这个站点包含什么

- **主页**:个人简介、精选项目与最近文章
- **项目**:做过的一些东西,附 Demo 与源码链接
- **博客**:你正在看的文章列表,支持标签与归档
- **链接**:各平台社交链接聚合

写作方式很朴素:在 `src/content/blog/` 下新建一个 Markdown 文件,填好标题、日期、标签,保存后文章就会自动出现在列表里。此外还有一个只在本机运行的内容管理后台,不碰文件也能发文。

## 现在的样子

视觉上是暖纸底 + 衬线标题 + 细线分隔的列表,亮色为默认,右上角可以切换暗色。动效刻意压得很低,只留了滚动入场和轻微的页面转场。文章页的代码块做成了 macOS 窗口的样子,带语言标签和复制按钮,顺手试一下:

```python
def hello(name: str) -> str:
    return f"Hello, {name}!"
```

```c
#include <stdio.h>

int main(void) {
    printf("Hello, World!\n");
    return 0;
}
```

## 接下来

想做的事还有不少:RSS 订阅、文章搜索、OG 图自动生成。慢慢来吧——个人站点的好处,就是永远不需要 deadline。
