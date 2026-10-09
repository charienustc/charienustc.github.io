# 状态管理（Nanostores）

## 为什么选择 Nanostores？

astro-koharu 使用 **Nanostores** 进行全局状态管理，而非更流行的 Redux 或 Zustand。原因如下：

| 特性 | Nanostores | Redux | Zustand |
|------|-----------|-------|---------|
| 体积 | ~1KB | ~7KB | ~3KB |
| 框架无关 | 是 | 否 | 否 |
| Astro 支持 | 原生 | 需要适配 | 需要适配 |
| 学习曲线 | 极低 | 高 | 中 |
| 样板代码 | 几乎没有 | 大量 | 少量 |

### 核心优势

1. **极轻量**：压缩后不到 1KB
2. **框架无关**：在 Astro 和 React 中都能使用
3. **简单 API**：只需 `atom` 和 `useStore`
4. **无 Provider**：不需要包裹根组件
5. **TypeScript 友好**：完整的类型推导

---

## 基础概念

### Atom（原子状态）

Atom 是最基础的状态单元，存储单个值：

```typescript
import { atom } from 'nanostores';

// 创建一个 atom
const count = atom<number>(0);

// 读取值
console.log(count.get());  // 0

// 设置值
count.set(1);

// 订阅变化
const unsubscribe = count.subscribe((value) => {
  console.log('新值:', value);
});

// 取消订阅
unsubscribe();
```

### 在 React 中使用

```tsx
import { useStore } from '@nanostores/react';
import { count } from './store';

function Counter() {
  // useStore 会在 atom 变化时触发重渲染
  const value = useStore(count);

  return (
    <div>
      <p>计数: {value}</p>
      <button onClick={() => count.set(value + 1)}>+1</button>
    </div>
  );
}
```

---

## 项目中的状态架构

```plain
src/store/
├── announcement.ts        # 公告系统（已读状态、未读计数，localStorage 持久化）
├── app.ts                 # 应用状态（侧边栏分段类型）
├── bgm.ts                 # BGM 音乐面板开关（独立于模态框，播放不中断）
├── christmas.ts           # 圣诞特效开关（localStorage 持久化）
├── locale.ts              # 当前语言（从 URL 派生，随 astro:page-load 更新）
├── modal.ts               # 统一模态框状态（抽屉/搜索/全屏/灯箱/设置）
├── player.ts              # 全局播放器状态（同时只允许一个实例播放）
├── settings.ts            # 阅读器与通用偏好（字号/行高/动效等级等）
└── settings-constants.ts  # 设置默认值与 localStorage 键（无 nanostores 依赖）
```

> 历史：早期版本只有一个 `ui.ts` 存放所有 UI 开关（`drawerOpen`、`searchOpen` 等独立 atom）。随着模态框类型增多，它已拆分演进为按域划分的模块——UI 遮蔽层状态并入 `modal.ts`（单 atom + computed 派生），音乐面板独立为 `bgm.ts`，公告系统独立为 `announcement.ts`。

### 架构图

```plain
┌─────────────────────────────────────────────────────────────┐
│                     Nanostores 状态层                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   app.ts                      modal.ts                      │
│   ┌─────────────────────┐     ┌───────────────────────────┐ │
│   │ homeSiderSegmentType│     │ $activeModal (ModalState) │ │
│   └─────────────────────┘     │ $isDrawerOpen  (computed) │ │
│                               │ $isSearchOpen  (computed) │ │
│                               │ $isAnyModalOpen(computed) │ │
│                               │ openModal()/closeModal()/ │ │
│                               │ toggleModal()             │ │
│                               └───────────────────────────┘ │
│   （另有 announcement/bgm/christmas/locale/player/settings）│
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   React 组件                    Astro 组件                  │
│   ┌─────────────────────┐       ┌─────────────────────┐    │
│   │ MenuIcon.tsx        │       │ MobileDrawer.astro  │    │
│   │ SearchDialog.tsx    │       │ SearchPortal.astro  │    │
│   │ ModalLayer.tsx      │       │                     │    │
│   └─────────────────────┘       └─────────────────────┘    │
│          │                              │                   │
│          │  useStore()                  │  subscribe()      │
│          └──────────────────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## UI 状态详解

### `src/store/modal.ts`（统一模态框状态）

`modal.ts` 把所有模态框/抽屉/弹窗状态收敛进单个 atom，取代早期 `ui.ts` 中分散的布尔 atom：

```typescript
/**
 * Unified Modal State Management
 *
 * Consolidates all modal/drawer/dialog state into a single store.
 * This replaces the scattered state in ui.ts for better state coordination.
 *
 * Features:
 * - Single active modal at a time (prevents stacking conflicts)
 * - Automatic body scroll lock
 * - Computed helpers for convenience
 * - Type-safe modal data
 */

import { atom, computed } from 'nanostores';

/**
 * Code fullscreen data
 */
export interface CodeBlockData {
  code: string;
  codeHTML: string;
  language: string;
  preClassName: string;
  preStyle: string;
  codeClassName: string;
}

/**
 * Unified diagram fullscreen data (mermaid + infographic)
 */
export interface DiagramFullscreenData {
  diagramType: 'mermaid' | 'infographic';
  svg: string;
  source: string;
}

/**
 * Image lightbox data
 */
export interface ImageLightboxData {
  src: string;
  alt: string;
  images: { src: string; alt: string; origin?: LightboxOrigin }[];
  currentIndex: number;
}

export type ModalType = 'drawer' | 'search' | 'codeFullscreen' | 'diagramFullscreen' | 'imageLightbox' | 'settings' | null;

export interface ModalState {
  type: ModalType;
  data?: CodeBlockData | DiagramFullscreenData | ImageLightboxData | null;
}

/**
 * Single source of truth for modal state
 */
export const $activeModal = atom<ModalState>({ type: null });

// Computed helpers for convenience
export const $isDrawerOpen = computed($activeModal, (m) => m.type === 'drawer');
export const $isSearchOpen = computed($activeModal, (m) => m.type === 'search');
export const $codeFullscreenData = computed($activeModal, (m) =>
  m.type === 'codeFullscreen' ? (m.data as CodeBlockData) : null,
);
export const $diagramFullscreenData = computed($activeModal, (m) =>
  m.type === 'diagramFullscreen' ? (m.data as DiagramFullscreenData) : null,
);
export const $imageLightboxData = computed($activeModal, (m) =>
  m.type === 'imageLightbox' ? (m.data as ImageLightboxData) : null,
);
export const $isAnyModalOpen = computed($activeModal, (m) => m.type !== null);
export const $isSettingsOpen = computed($activeModal, (m) => m.type === 'settings');

/**
 * Open a modal with optional data
 */
export function openModal<T extends ModalType>(
  type: T,
  data?: T extends 'codeFullscreen'
    ? CodeBlockData
    : T extends 'diagramFullscreen'
      ? DiagramFullscreenData
      : T extends 'imageLightbox'
        ? ImageLightboxData
        : never,
): void {
  $activeModal.set({ type, data });
  // Settings stays non-modal, so switching from another modal must release its scroll lock.
  if (typeof document !== 'undefined') {
    document.body.style.overflow = type && type !== 'settings' ? 'hidden' : '';
  }
}

/**
 * Close the currently active modal
 */
export function closeModal(): void {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
  $activeModal.set({ type: null });
}

/**
 * Toggle a modal (open if closed, close if open)
 */
export function toggleModal(type: ModalType): void {
  if ($activeModal.get().type === type) {
    closeModal();
  } else {
    openModal(type);
  }
}

// Convenience functions for specific modals
/** @deprecated Use `openModal('drawer')`. */
export const openDrawer = () => openModal('drawer');
export const closeDrawer = () => closeModal();
export const toggleDrawer = () => toggleModal('drawer');

/** @deprecated Use `openModal('search')`. */
export const openSearch = () => openModal('search');
/** @deprecated Use `closeModal()`. */
export const closeSearch = () => closeModal();
/** @deprecated Use `toggleModal('search')`. */
export const toggleSearch = () => toggleModal('search');

export const toggleSettings = () => toggleModal('settings');

/** @deprecated Use `openModal('codeFullscreen', data)`. */
export const openCodeFullscreen = (data: CodeBlockData) => openModal('codeFullscreen', data);
/** @deprecated Use `closeModal()`. */
export const closeCodeFullscreen = () => closeModal();

/**
 * Navigate between images in the lightbox without re-triggering scroll lock.
 * Directly mutates the atom to avoid openModal/closeModal side effects.
 */
export function navigateImage(direction: 1 | -1): boolean {
  const modal = $activeModal.get();
  if (modal.type !== 'imageLightbox') return false;
  const data = modal.data as ImageLightboxData;
  const newIndex = data.currentIndex + direction;
  if (newIndex < 0 || newIndex >= data.images.length) return false;
  const target = data.images[newIndex];
  $activeModal.set({
    type: 'imageLightbox',
    data: { ...data, src: target.src, alt: target.alt, currentIndex: newIndex },
  });
  return true;
}
```

### 状态说明

| 状态 | 类型 | 用途 |
|------|------|------|
| `$activeModal` | `ModalState` | 当前激活的模态框（`type` + 可选 `data`），唯一事实来源 |
| `$isDrawerOpen` / `$isSearchOpen` / `$isSettingsOpen` | `boolean`（computed） | 各模态框是否激活 |
| `$isAnyModalOpen` | `boolean`（computed） | 是否有任意模态框激活 |
| `$codeFullscreenData` / `$diagramFullscreenData` / `$imageLightboxData` | data 或 `null`（computed） | 各模态框携带的数据 |

### 设计要点

1. **同时只允许一个模态框**：所有遮蔽层共享 `$activeModal`，打开新的会自动替换旧的，避免堆叠冲突
2. **自动滚动锁定**：`openModal` / `closeModal` 自动设置 `document.body.style.overflow`（`settings` 面板例外，它是非模态的）
3. **computed 派生**：消费者直接订阅 `$isDrawerOpen` 等派生 store，无需自己比较 `type`
4. **便捷函数兼容**：`toggleDrawer()` / `openSearch()` 等旧 API 保留为薄封装（标注 `@deprecated`），内部走 `openModal` / `toggleModal`

---

## 应用状态详解

### `src/store/app.ts`

```typescript
import { HomeSiderSegmentType } from '@constants/enum';
import { atom } from 'nanostores';

export const homeSiderSegmentType = atom<HomeSiderSegmentType>(HomeSiderSegmentType.INFO);
```

`app.ts` 目前只剩一个 atom：侧边栏分段类型（信息/目录/系列）。侧边栏整体模式（首页/文章页/无）不再由全局状态管理——`HomeSiderType` 枚举仍用于组件 Props，由页面（如 `MobileDrawer.astro`）以 prop 传入。

### 枚举定义

```typescript
// src/constants/enum.ts

export enum HomeSiderType {
  HOME = 'home',
  POST = 'post', // 有目录
  NONE = 'none',
}

export enum HomeSiderSegmentType {
  INFO = 'info',
  DIRECTORY = 'directory',
  SERIES = 'series',
}
```

---

## 在 React 组件中使用

### MenuIcon 组件示例

```tsx
// src/components/ui/MenuIcon.tsx（节选）
'use client';

import { useStore } from '@nanostores/react';
import { $isDrawerOpen, toggleDrawer } from '@store/modal';
import type { Variants } from 'motion/react';
import { m } from 'motion/react';

const lineVariants: Variants = {
  closed: { rotate: 0, y: 0, opacity: 1 },
  opened: (lineIndex: number) => {
    switch (lineIndex) {
      case 1:
        return { rotate: 45, y: 6, opacity: 1 };
      case 2:
        return { rotate: 0, y: 0, opacity: 0 };
      case 3:
        return { rotate: -45, y: -6, opacity: 1 };
      default:
        return { rotate: 0, y: 0, opacity: 1 };
    }
  },
};

const MenuIcon = ({ className, id }: MenuIconProps) => {
  // 1. 订阅派生状态
  const isOpen = useStore($isDrawerOpen);

  return (
    <button
      onClick={toggleDrawer}
      aria-label={isOpen ? '关闭菜单' : '打开菜单'}
      aria-expanded={isOpen}
      type="button"
    >
      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <m.g variants={lineVariants} initial={false} animate={isOpen ? 'opened' : 'closed'} custom={1}>
          <line x1="3" y1="6" x2="21" y2="6" />
        </m.g>
        {/* 第 2、3 条线同理... */}
      </svg>
    </button>
  );
};
```

### 关键点

1. **`useStore`**：自动订阅 atom 变化，状态更新时组件重渲染（这里订阅的是 computed 派生的 `$isDrawerOpen`）
2. **`toggleDrawer()`**：使用便捷函数而非直接 `set`（内部等价于 `toggleModal('drawer')`）
3. **双向绑定**：UI 反映状态，点击改变状态

---

## 在 Astro 组件中使用

### 使用 `<script>` 标签

```astro
<!-- src/components/layout/MobileDrawer.astro（节选） -->
<script>
  import { $isDrawerOpen, closeDrawer } from '@store/modal';

  // 订阅状态变化，切换抽屉/遮罩的显示与位移类
  $isDrawerOpen.subscribe((isOpen) => {
    if (isOpen) {
      // 移除 -translate-x-full，显示遮罩，锁定滚动，移入焦点
    } else {
      // 添加 -translate-x-full，隐藏遮罩，恢复滚动
    }
  });

  // 页面导航前关闭抽屉，防止过渡后残留
  document.addEventListener('astro:before-preparation', () => {
    closeDrawer();
  });
</script>
```

实际的 `MobileDrawer.astro` 用一个 `DrawerController` 类封装了元素查询、事件绑定（Escape / 遮罩点击）、订阅与销毁，并在 `astro:page-load` 时重建。

### 使用 React 岛屿

```astro
<!-- src/components/layout/HomeSider.astro（节选） -->
---
import HomeSiderSegmented from '@components/ui/segmented/HomeSiderSegmented';
---

<div class="sider-container">
  <!-- React 组件处理交互 -->
  <HomeSiderSegmented
    client:only="react"
    defaultValue={defaultSegmentType}
  />

  <!-- 静态内容 -->
  <div class="sider-content">
    <slot />
  </div>
</div>
```

---

## 状态通信流程

### 场景：点击菜单图标打开抽屉

```plain
┌─────────────────────────────────────────────────────────────┐
│  1. 用户点击 MenuIcon                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. toggleDrawer() 被调用（内部 = toggleModal('drawer')）    │
│     $activeModal: { type: null } → { type: 'drawer' }       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. $activeModal 变化，所有派生 store 重新计算               │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ $isDrawerOpen   │  │ $isAnyModalOpen │                  │
│  │ false → true    │  │ false → true    │                  │
│  └────────┬────────┘  └─────────────────┘                  │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ MenuIcon.tsx    │  │ MobileDrawer    │                  │
│  │ useStore() 触发 │  │ subscribe() 触发│                  │
│  │ 重渲染          │  │ DOM 更新        │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. UI 更新                                                  │
│  - MenuIcon 动画切换到 X 形状                                │
│  - MobileDrawer 滑入显示                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 最佳实践

### 1. 状态粒度

每个 atom 只存储一个关注点：

```typescript
// ✅ 好：细粒度状态（src/store/settings.ts）
export const readerFontSize = atom<number>(READER_DEFAULTS.fontSize);
export const readerLineHeight = atom<number>(READER_DEFAULTS.lineHeight);

// ❌ 差：粗粒度状态
export const readerState = atom({
  fontSize: 16,
  lineHeight: 1.8,
  // 更多...
});
```

### 2. 便捷函数

为常用操作提供便捷函数：

```typescript
// ✅ 好：提供语义化函数（src/store/modal.ts）
export function toggleModal(type: ModalType): void {
  if ($activeModal.get().type === type) {
    closeModal();
  } else {
    openModal(type);
  }
}
export const toggleDrawer = () => toggleModal('drawer');

// 使用
toggleDrawer();

// ❌ 差：直接操作
$activeModal.set({ type: 'drawer' });
```

### 3. 类型安全

利用 TypeScript 泛型确保类型安全：

```typescript
// 带泛型的 atom（src/store/app.ts）
export const homeSiderSegmentType = atom<HomeSiderSegmentType>(HomeSiderSegmentType.INFO);

// 类型检查
homeSiderSegmentType.set(HomeSiderSegmentType.DIRECTORY);  // ✅
homeSiderSegmentType.set('invalid');                       // ❌ 类型错误
```

### 4. 组件解耦

状态逻辑与组件逻辑分离：

```typescript
// store/modal.ts - 状态定义
export const $activeModal = atom<ModalState>({ type: null });
export const $isDrawerOpen = computed($activeModal, (m) => m.type === 'drawer');
export const toggleDrawer = () => toggleModal('drawer');

// MenuIcon.tsx - 只关心 UI
const MenuIcon = () => {
  const isOpen = useStore($isDrawerOpen);
  return <button onClick={toggleDrawer}>...</button>;
};
```

---

## 与之前方案的对比

### CustomEvent 模式（旧）

```javascript
// 发送事件
window.dispatchEvent(new CustomEvent('drawer-toggle', { detail: true }));

// 监听事件
window.addEventListener('drawer-toggle', (e) => {
  const isOpen = e.detail;
  // 更新 UI
});
```

**问题**：
- 无类型安全
- 难以追踪状态
- 容易产生内存泄漏

### Nanostores 模式（新）

```typescript
// 更新状态
openModal('drawer');

// 订阅状态
const unsubscribe = $isDrawerOpen.subscribe((isOpen) => {
  // 更新 UI
});
```

**优势**：
- 完整类型推导
- 状态可追踪
- 自动清理订阅

---

## 学习要点

1. **Nanostores 基础**：`atom` 创建状态，`useStore` 订阅状态
2. **跨框架通信**：React 用 `useStore`，Astro 用 `subscribe`
3. **状态粒度**：每个 atom 只存一个值
4. **computed 派生**：用 `computed` 从单一事实来源派生常用视图（如 `$isDrawerOpen`）
5. **便捷函数**：封装常用操作，提高可读性
6. **类型安全**：利用泛型确保状态类型正确
7. **替代方案**：比 CustomEvent 更安全、更易维护

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/store/app.ts` | 应用状态 |
| `src/store/modal.ts` | 统一模态框状态（原 ui.ts 的演进） |
| `src/store/settings.ts` | 阅读器与通用偏好 |
| `src/store/settings-constants.ts` | 设置默认值与 localStorage 键 |
| `src/constants/enum.ts` | 状态枚举 |
| `src/components/ui/MenuIcon.tsx` | 使用状态的组件示例 |
| `src/components/layout/MobileDrawer.astro` | Astro 中使用状态 |
