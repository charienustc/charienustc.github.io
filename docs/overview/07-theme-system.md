# 主题系统实现

## 概述

astro-koharu 实现了完整的深色/浅色主题切换功能，包括：

1. **FOUC 防护**：防止页面加载时的主题闪烁
2. **localStorage 持久化**：记住用户偏好
3. **系统主题跟随**：默认跟随系统设置
4. **View Transitions 动画**：主题切换的圆形扩散动画
5. **Astro 页面过渡兼容**：确保主题在页面切换后保持

---

## 主题切换原理

### 整体流程

```plain
┌─────────────────────────────────────────────────────────────┐
│                    主题系统工作流程                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. 页面加载（HTML 解析阶段）                                │
│     - 内联脚本立即执行                                       │
│     - 检查 localStorage.theme                               │
│     - 检查 prefers-color-scheme                             │
│     - 设置 <html class="dark/light">                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. 页面渲染（hydration）                                    │
│     - CSS 变量根据 .dark 类生效                              │
│     - ThemeToggle（React 岛屿）hydrate                       │
│     - 图标状态与 <html class> 同步（isDark）                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. 用户切换主题                                             │
│     - 按钮点击，isDark 取反                                  │
│     - 写入 --theme-x/y/r 并添加 theme-transition 类          │
│     - View Transitions API 触发                             │
│     - 圆形扩散动画 + localStorage 更新                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Astro 页面过渡                                           │
│     - astro:before-swap / astro:after-swap（BootScripts）    │
│     - 向新文档重新应用主题                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## FOUC 防护

### 什么是 FOUC？

**FOUC**（Flash of Unstyled Content）是指页面加载时，由于主题状态未及时应用，导致页面短暂显示错误主题的现象。

### 解决方案：内联脚本

在 `BootScripts.astro`（由 `Layout.astro` 在 `<head>` 中引入）中使用 `is:inline` 脚本：

```astro
<!-- src/layouts/BootScripts.astro -->
<head>
  <!-- 立即执行，在 DOM 渲染前完成 -->
  <script is:inline>
    (function() {
      function getTheme() {
        // 优先级：1. 用户手动选择 > 2. 系统偏好
        if (localStorage.theme === 'dark') return 'dark';
        if (localStorage.theme === 'light') return 'light';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      function applyTheme(theme, target) {
        var root = target || document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        root.dataset.theme = theme; // For astro-mermaid autoTheme
      }

      // 立即应用主题
      applyTheme(getTheme());
      // 另含系统偏好 change 监听与 astro:before-swap / astro:after-swap 重应用
    })();
  </script>
</head>
```

### 为什么使用 `is:inline`？

| 特性 | 普通脚本 | `is:inline` 脚本 |
|------|---------|-----------------|
| 执行时机 | 延迟执行 | 立即执行 |
| 打包处理 | 会被打包 | 保持原样 |
| 阻塞渲染 | 否 | 是（短暂） |
| 适用场景 | 功能脚本 | 关键初始化 |

---

## ThemeToggle 组件

主题切换按钮是 React 组件（`src/components/theme/ThemeToggle.tsx`），作为 `Navigator` 岛屿的一部分以 `client:load` hydrate（见 `Header.astro`），因此不存在 Astro 页面过渡重执行脚本导致的重复绑定问题。

### 完整实现

```tsx
// src/components/theme/ThemeToggle.tsx（useTheme hook 与组件主体）

function useTheme() {
  // Starts false to match the server render; the effect below syncs it from <html class="dark">.
  const [isDark, setIsDark] = useState(false);

  // Sync with DOM changes (e.g., from other tabs or initial state)
  useEffect(() => {
    const rootElement = document.documentElement;

    // Initial sync
    setIsDark(rootElement.classList.contains('dark'));

    // Watch for class changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          setIsDark(rootElement.classList.contains('dark'));
        }
      }
    });

    observer.observe(rootElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const applyTheme = useCallback((dark: boolean) => {
    const root = document.documentElement;
    const theme = dark ? 'dark' : 'light';

    root.classList.toggle('dark', dark);
    root.dataset.theme = theme; // For astro-mermaid autoTheme
    localStorage.setItem('theme', theme);
  }, []);

  const toggle = useCallback(
    (origin: HTMLElement) => {
      const newIsDark = !isDark;
      const rootElement = document.documentElement;

      if (isMotionDisabled() || !document.startViewTransition) {
        applyTheme(newIsDark);
        setIsDark(newIsDark);
        return;
      }

      // The reveal circle starts at the button and must reach the farthest viewport corner.
      const rect = origin.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      rootElement.style.setProperty('--theme-x', `${x}px`);
      rootElement.style.setProperty('--theme-y', `${y}px`);
      rootElement.style.setProperty('--theme-r', `${radius}px`);
      rootElement.classList.add('theme-transition');

      const transition = document.startViewTransition(() => {
        applyTheme(newIsDark);
        setIsDark(newIsDark);
      });
      holdPetalBurst(transition);

      transition.finished.finally(() => {
        rootElement.classList.remove('theme-transition');
      });
    },
    [isDark, applyTheme],
  );

  return { isDark, toggle };
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { isDark, toggle } = useTheme();
  const isMounted = useIsMounted();
  const label = t('common.toggleTheme');

  return (
    <button
      className={cn('flex-center cursor-pointer transition duration-300 hover:scale-110', className)}
      aria-label={label}
      aria-pressed={isMounted ? isDark : undefined}
      title={label}
      type="button"
      onClick={(event) => toggle(event.currentTarget)}
    >
      <span className="inline-flex size-8 items-center justify-center">
        <Icon icon={isDark ? 'lucide:sun' : 'lucide:moon'} className="size-6" />
      </span>
    </button>
  );
}
```

### 关键代码解析

#### 1. 避免 hydration 不匹配

```typescript
const [isDark, setIsDark] = useState(false);    // 初始值与 SSR 输出一致
// ...
aria-pressed={isMounted ? isDark : undefined}  // 挂载前不输出客户端状态
```

真实主题在 `useEffect` 中从 `<html class="dark">` 同步，`useState(false)` 的初始值与服务端渲染保持一致；`aria-pressed` 在挂载前保持 `undefined`。

#### 2. MutationObserver 同步

```typescript
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.attributeName === 'class') {
      setIsDark(rootElement.classList.contains('dark'));
    }
  }
});
```

`<html>` 的 class 可能被其他来源改动（如 BootScripts 在页面过渡后重应用主题），MutationObserver 保证组件状态始终与 DOM 一致。

#### 3. View Transitions API 与降级

```typescript
if (isMotionDisabled() || !document.startViewTransition) {
  applyTheme(newIsDark);
  setIsDark(newIsDark);
  return;
}
```

- `isMotionDisabled()`（`src/lib/motion-level.ts`）：动效等级为 `reduced`（用户设置或 OS 偏好）时，直接切换主题，不播放过渡动画
- 浏览器不支持 View Transitions API 时同样直接降级
- 否则先写入 `--theme-x` / `--theme-y` / `--theme-r`（圆心为按钮中心，半径取按钮到视口最远角的距离）并添加 `theme-transition` 类，再启动圆形揭示动画；`holdPetalBurst(transition)` 会在过渡冻结页面期间暂停正在飞行的樱花花瓣，过渡开始播放后恢复（花瓣层保留独立的 `view-transition-name`，浮在揭示动画之上）

---

## 太阳/月亮图标

### 实现方式

切换按钮直接使用 lucide 图标，根据当前主题切换：

```tsx
<Icon icon={isDark ? 'lucide:sun' : 'lucide:moon'} className="size-6" />
```

- 浅色模式显示**月亮**（点击切换到深色）
- 深色模式显示**太阳**（点击切换到浅色）
- 按钮自带 `hover:scale-110` 放大反馈，图标颜色继承 `currentColor`

> 注：早期版本曾用纯 CSS（`box-shadow` 多重阴影）绘制太阳/月亮并做形变动画，该实现（`.toggle` 样式与 `--theme-toggle-color` 变量）已移除。

---

## View Transitions 圆形扩散动画

### CSS 配置

```css
/* src/styles/theme/theme-transition.css */

/* 新主题从按钮位置圆形扩散 */
html.theme-transition::view-transition-new(root) {
  animation: theme-reveal 640ms var(--ease-in-out-quart) both;
  z-index: 1;
  height: 100%;
  object-fit: cover;
  object-position: left top;
}

@keyframes theme-reveal {
  from {
    clip-path: circle(0 at var(--theme-x, 50%) var(--theme-y, 0));
  }
  to {
    clip-path: circle(var(--theme-r, 150vmax) at var(--theme-x, 50%) var(--theme-y, 0));
  }
}
```

该文件中的其余规则：

- `--theme-x` / `--theme-y` / `--theme-r` 由 ThemeToggle 在启动过渡前写入 `:root`，分别是揭示圆心的坐标与半径（默认值 `50%` / `0` / `150vmax`）
- `::view-transition-group(root)` 与 `::view-transition-image-pair(root)` 固定为 `100dvh` 并 `overflow: clip`，避免长页面把过渡组撑得过高而掉帧
- 旧视图 `::view-transition-old(root)` 不播放动画、`z-index: 0`，保持不动；新视图盖在其上扩散
- `html.theme-transition *:not(.petal-burst-layer) { view-transition-name: none !important; }`：切换期间把所有具名元素（header 胶囊、文章标题等）并入 root 快照，使圆形揭示均匀；只有樱花花瓣层保留独立命名，浮在揭示动画之上
- `@media (prefers-reduced-motion: reduce)` 下新旧视图均不播放动画
- 文件末尾的无条件规则 `::view-transition-new(root) { z-index: 1 }` / `::view-transition-old(root) { z-index: 0 }` 是未加 `theme-transition` 类时的默认层叠，保留普通页面过渡、不套用特殊效果

### 动画原理

```plain
1. 点击切换按钮
   ┌─────────────────────┐
   │                     │
   │         ●          │  ← 按钮中心 (--theme-x, --theme-y)
   │                     │
   └─────────────────────┘

2. 圆形开始扩散
   ┌─────────────────────┐
   │      ╭────╮         │
   │     │  ●  │        │  ← circle(10%)
   │      ╰────╯         │
   └─────────────────────┘

3. 继续扩大
   ┌─────────────────────┐
   │ ╭──────────────╮    │
   │ │       ●      │    │  ← circle(50%)
   │ ╰──────────────╯    │
   └─────────────────────┘

4. 覆盖整个页面
   ┌─────────────────────┐
   │                     │
   │         ●          │  ← circle(150%)
   │                     │
   └─────────────────────┘
```

---

## Astro 页面过渡兼容

### 问题

Astro 的 View Transitions 不会触发完整页面刷新，导致：
- 主题状态可能不同步
- 事件监听器可能丢失

### 解决方案

主题脚本由 `BootScripts.astro` 在 `<head>` 中内联执行，并在页面过渡前后把主题写进目标文档：

```javascript
// BootScripts.astro

// 先写进新页面的 <html>：swap 会清空根元素属性，
// 期间若有样式计算（如恢复持久化元素的焦点）也能拿到正确主题
document.addEventListener('astro:before-swap', function(event) {
  applyTheme(getTheme(), event.newDocument.documentElement);
});

// View Transition 切换页面后重新应用主题（在 DOM 渲染前）
document.addEventListener('astro:after-swap', function() {
  applyTheme(getTheme());
});
```

同时监听系统主题偏好变化，仅当用户未明确选择主题时自动跟随切换：

```javascript
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
  if (!('theme' in localStorage)) {
    applyTheme(getTheme());
  }
});
```

---

## localStorage 持久化

### 存储结构

```javascript
// 键: 'theme'
// 值: 'dark' | 'light' | undefined

localStorage.setItem('theme', 'dark');   // 深色模式
localStorage.setItem('theme', 'light');  // 浅色模式
localStorage.removeItem('theme');         // 跟随系统
```

### 优先级

```javascript
// 检查顺序
if (localStorage.theme === 'dark') {
  // 1. 用户明确选择深色
} else if (localStorage.theme === 'light') {
  // 2. 用户明确选择浅色
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  // 3. 系统偏好深色
} else {
  // 4. 默认浅色
}
```

---

## CSS 变量系统

### 主题变量定义

```css
/* src/styles/theme/index.css */

/* 浅色模式变量 */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... 更多变量 */
}

/* 深色模式变量 */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  /* ... 更多变量 */
}
```

### 使用变量

```css
/* Tailwind CSS 中使用 */
.bg-background {
  background-color: hsl(var(--background));
}

.text-foreground {
  color: hsl(var(--foreground));
}

/* 自定义 CSS 中使用 */
.custom-element {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
}
```

---

## 无障碍支持

### ARIA 属性

```tsx
// src/components/theme/ThemeToggle.tsx
<button
  aria-label={label}                     // 本地化文案（common.toggleTheme）
  aria-pressed={isMounted ? isDark : undefined}
  title={label}
  type="button"
  onClick={(event) => toggle(event.currentTarget)}
>
```

- 使用原生 `<button>`，无需 `role="button"` / `tabindex`
- `aria-pressed` 表示当前是否为深色模式；挂载前保持 `undefined` 以避免 hydration 不匹配

### 键盘支持

原生 `<button>` 天然支持 Enter 和 Space 键触发点击，无需额外处理。

---

## 学习要点

1. **FOUC 防护**：使用 `is:inline` 脚本在渲染前设置主题
2. **View Transitions API**：实现圆形扩散动画效果
3. **localStorage**：持久化用户主题偏好
4. **系统主题跟随**：使用 `prefers-color-scheme` 媒体查询
5. **Astro 兼容**：`astro:before-swap` / `astro:after-swap` 时向新文档重应用主题
6. **降级策略**：动效等级为 reduced 或浏览器不支持 View Transitions 时直接切换
7. **CSS 变量**：实现主题色统一管理

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/components/theme/ThemeToggle.tsx` | 主题切换组件（React 岛屿） |
| `src/layouts/BootScripts.astro` | 主题初始化脚本（FOUC 防护） |
| `src/lib/motion-level.ts` | 动效等级判定（过渡降级依据） |
| `src/lib/sakura/petal-burst.ts` | 樱花花瓣爆发（过渡期间冻结/恢复） |
| `src/styles/theme/index.css` | 主题 CSS 变量 |
| `src/styles/theme/theme-transition.css` | 主题过渡动画 |
