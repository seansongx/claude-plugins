---
name: tailwind-tokens
description: 在用 Tailwind 的项目里写或改任何样式之前使用。新项目先建立设计 token，已有项目先读 token 文件，所有组件只引用 token，不硬编码颜色、尺寸，不直接用原始色板。触发场景：新建项目或页面、写组件、改样式/配色/间距/字号/圆角/阴影、做暗色模式、"UI 调一下"、"改好看点"、清理或统一样式。
---

# Tailwind 设计 token 规范

目标：**先定 token，再写样式；组件里只引用 token。** 换主题、调品牌色、做暗色模式时，只改 token 文件一处。

## 第一步：写任何样式前，先找到 token

1. 看 `package.json` 里的 `tailwindcss` 版本。
2. 找 token 所在位置：
   - **Tailwind v4**：导入了 `@import "tailwindcss"` 的那个 CSS 文件（常见于 `src/app/globals.css`、`src/index.css`、`src/styles/*.css`），token 在 `:root`、`.dark` 和 `@theme` 里。
   - **Tailwind v3**：`tailwind.config.*` 的 `theme` / `theme.extend`，加上全局 CSS 里的 `:root` 变量。
3. **找到了**：完整读一遍，记住有哪些颜色、字号、圆角、阴影 token，再开始写。
4. **没找到 / 只有默认配置**：先按下面的结构建立 token，跟用户确认主色和整体风格后，再写组件。

## Token 结构（Tailwind v4）

分三层：原始值 → 语义变量 → 注册给 Tailwind。组件只碰第三层生成的类名。

```css
@import "tailwindcss";

/* 用 .dark 类切换暗色模式 */
@custom-variant dark (&:where(.dark, .dark *));

/* 严格模式（新项目推荐）：去掉 Tailwind 默认色板，
   这样 bg-blue-500 这类类名根本不会生效，只能用语义颜色 */
@theme {
  --color-*: initial;
  --color-white: #fff;
  --color-black: #000;
}

/* 1. 语义变量：具体色值只出现在这里 */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.15 0 0);
  --surface: oklch(0.98 0 0);           /* 卡片、面板 */
  --surface-foreground: oklch(0.15 0 0);
  --primary: oklch(0.55 0.2 260);
  --primary-foreground: oklch(0.98 0 0);
  --secondary: oklch(0.95 0.01 260);
  --secondary-foreground: oklch(0.25 0 0);
  --muted: oklch(0.96 0 0);
  --muted-foreground: oklch(0.5 0 0);
  --accent: oklch(0.95 0.02 260);
  --accent-foreground: oklch(0.25 0 0);
  --destructive: oklch(0.58 0.22 27);
  --destructive-foreground: oklch(0.98 0 0);
  --success: oklch(0.6 0.15 150);
  --warning: oklch(0.75 0.15 80);
  --border: oklch(0.9 0 0);
  --input: oklch(0.9 0 0);
  --ring: oklch(0.55 0.2 260);
  --radius: 0.5rem;
}

.dark {
  --background: oklch(0.15 0 0);
  --foreground: oklch(0.97 0 0);
  /* …每个语义变量都给出暗色值 */
}

/* 2. 注册给 Tailwind，生成 bg-primary、text-muted-foreground、border-border 等类 */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-surface: var(--surface);
  --color-surface-foreground: var(--surface-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* 3. 字体、字号、阴影等也放在 @theme 里 */
@theme {
  --font-sans: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
  /* 需要默认之外的字号时再加，例如：
  --text-display: 3rem;
  --text-display--line-height: 1.1; */
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

已有项目如果已经在用 shadcn/ui 之类的结构，**沿用它的命名**，不要另起一套。

### Tailwind v3

语义变量同样写在全局 CSS 的 `:root` / `.dark` 里，然后在 `tailwind.config.*` 里注册：

```js
theme: {
  // 严格模式：写在 theme.colors（不是 extend）里，会替换掉默认色板
  colors: {
    transparent: 'transparent',
    current: 'currentColor',
    white: '#fff',
    black: '#000',
    background: 'var(--background)',
    foreground: 'var(--foreground)',
    primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
    // …其余语义颜色同上
  },
  extend: {
    borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
  },
},
```

注意：v3 里变量如果存的是 `oklch(...)` 完整色值，`bg-primary/50` 这类透明度修饰不会生效；需要透明度时改用 `color-mix()` 或 v4。

## 写组件时的规则

| 类别 | ✅ 这样写 | ❌ 不要这样写 |
|---|---|---|
| 颜色 | `bg-primary text-primary-foreground`、`text-muted-foreground`、`border-border`、`bg-primary/10` | `bg-blue-500`、`text-gray-600`、`bg-[#3b82f6]` |
| 间距 | 默认刻度 `p-4 gap-6 mt-8` | `p-[13px]`、`mt-[18px]` |
| 字号 | `text-sm`、`text-2xl`、自定义的 `text-display` | `text-[15px]` |
| 圆角 | `rounded-md`、`rounded-lg` | `rounded-[6px]` |
| 阴影 | `shadow-sm`、`@theme` 里定义的阴影 | `shadow-[0_2px_8px_rgba(0,0,0,.1)]` |
| 内联样式 / CSS | `color: var(--foreground)`、`style={{ color: 'var(--primary)' }}` | `color: #333`、`style={{ color: '#333' }}` |
| SVG 图标 | `fill="currentColor"` + 外层文字颜色类 | `fill="#333"` |

允许的例外（检查脚本不会报）：
- 一次性的布局尺寸：`w-[320px]`、`max-w-[1200px]`、`h-[100dvh]`、`grid-cols-[200px_1fr]`。如果同一个值在多处出现，就该提成 token（v4 用 `--container-*`、`--spacing-*`）。
- `bg-white`、`bg-black`、`bg-transparent`、`text-current`。不过能用语义颜色时优先用语义颜色，否则暗色模式会出问题。

## 需要一个新值时

1. **先复用**：在现有 token 里找最接近的。差别很小（比如 14px 和 15px、两个几乎一样的灰），直接用已有的。
2. **再新增**：确实需要新值，就先加到 token 文件，再在组件里引用。不要先写死、以后再提取。
3. **按用途命名，不按外观命名**：`--success`、`--surface-raised`，而不是 `--green`、`--gray-light`。
4. 加了颜色 token，就要同时给出 `.dark` 里的对应值。
5. 在回复里告诉用户新增了哪些 token。

## 第三方库、图表、Canvas

需要传具体色值的地方（图表库、Canvas、邮件模板），从 CSS 变量读取，不要另写一份色值：

```ts
const css = getComputedStyle(document.documentElement);
const primary = css.getPropertyValue('--primary').trim();
```

图表配色可以加一组 `--chart-1` … `--chart-5` token。实在只能写死的（例如邮件模板不支持 CSS 变量），在该行加注释 `token-ignore`，并告诉用户原因。

## 自动检查

这个插件带一个 hook：每次 Write / Edit 样式相关的文件后，会检查**这次新写入的内容**里有没有：
- 任意颜色值 `bg-[#xxx]`
- 间距、字号、圆角、行高、字距的任意尺寸 `p-[13px]`、`text-[15px]`
- 原始色板类名 `bg-blue-500`
- CSS / 内联样式 / SVG 属性里写死的色值

收到 `[tailwind-tokens]` 反馈时：**立刻按提示改掉，不要跳过，也不要给能改的地方加 `token-ignore`。**

项目可以在 `.claude/tailwind-tokens.json` 里调整：

```json
{
  "disabled": false,
  "allowPaletteColors": false,
  "ignore": ["src/legacy/**", "**/*.stories.tsx"]
}
```

## 审计和迁移已有项目

用户要求统一样式、清理硬编码，或者接手一个已有项目时：

1. 运行审计：
   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/check-tokens.mjs" --audit <源码目录，如 src>
   ```
   输出包括每处问题，以及"出现最多的颜色"统计。
2. 根据统计**提出一份 token 方案**：把相近的颜色归并成语义 token（例如 `#3b82f6`、`#2563eb`、`blue-500` 都归到 `primary`），列出映射表，**先给用户确认**。
3. 确认后先改 token 文件，再按目录或组件分批替换。每批改完重新跑一次审计。
4. 最后报告：新增了哪些 token、改了多少处、还剩哪些例外以及原因。

## 交付前自查

- [ ] 新增的颜色都有语义命名，`:root` 和 `.dark` 都有值
- [ ] 组件里没有 `bg-[#…]`、`text-[15px]`、`bg-blue-500`、`#xxx` 这类写法
- [ ] 改动涉及的页面在暗色模式下也正常（如果项目有暗色模式）
- [ ] 回复里说明了新增或修改了哪些 token
