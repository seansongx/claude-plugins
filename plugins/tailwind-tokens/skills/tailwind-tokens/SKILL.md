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
| 间距 | 4px 网格刻度 `p-4 gap-6 mt-18`，或自定义的 `h-header` | `p-[13px]`、`mt-[18px]` |
| 字号 | `text-sm`、`text-2xl`、自定义的 `text-display` | `text-[15px]` |
| 圆角 | `rounded-md`、`rounded-lg`、自定义的 `rounded-card` | `rounded-[6px]` |
| 阴影 | `shadow-sm`、自定义的 `shadow-card` | `shadow-[0_2px_8px_rgba(0,0,0,.1)]` |
| 内联样式 / CSS | `color: var(--foreground)`、`style={{ color: 'var(--primary)' }}` | `color: #333`、`style={{ color: '#333' }}` |
| SVG 图标 | `fill="currentColor"` + 外层文字颜色类 | `fill="#333"` |

允许的例外（检查脚本不会报）：
- 一次性的布局尺寸：`w-[320px]`、`max-w-[1200px]`、`h-[100dvh]`、`grid-cols-[200px_1fr]`。如果同一个值在多处出现，就该提成 token（v4 用 `--container-*`、`--spacing-*`）。
- `bg-white`、`bg-black`、`bg-transparent`、`text-current`。不过能用语义颜色时优先用语义颜色，否则暗色模式会出问题。

## 需要一个现有 token 里没有的值时

适用于颜色、间距、尺寸、圆角、字号、行高、字距、阴影。

**原则：组件里永远不写任意值。缺什么，先加到 token 文件，再引用。** 但加之前先做下面的判断，否则 token 会越加越多，失去约束的意义。

### 1. 先对齐现有刻度

- **间距**：Tailwind v4 的间距按 `--spacing`（默认 0.25rem，也就是 4px）的倍数生成，`p-13`、`mt-18`、`gap-4.5` 这类写法不用加 token 就能用。设计稿上的 13px、18px 就近对齐到 4px 网格：12px（`p-3`）、16px（`p-4`）、20px（`p-5`）。
- **圆角、字号、阴影、行高**：先看默认档位和已有 token。差 1–2px 的，直接用最近的一档。
- **颜色**：先在已有语义颜色里找。两个几乎一样的灰色，用已有的那个。

### 2. 确实需要新档位，才新增

满足任一条件才值得加：
- 设计里反复出现，而且和现有档位差别明显
- 代表一个固定的用途，比如卡片圆角、页头高度、大标题字号、侧栏宽度
- 一次性的布局尺寸（如 `w-[320px]`）在两处以上出现

### 3. 加到对应的命名空间，Tailwind 会自动生成类名

| 要加的 | Tailwind v4（写在 `@theme` 里） | 生成的类 |
|---|---|---|
| 圆角 | `--radius-card: 0.875rem;` | `rounded-card` |
| 字号 | `--text-display: 3rem;`<br>`--text-display--line-height: 1.1;` | `text-display` |
| 命名的间距/尺寸 | `--spacing-header: 4.5rem;` | `h-header`、`pt-header`、`gap-header` |
| 容器宽度 | `--container-page: 75rem;` | `max-w-page` |
| 阴影 | `--shadow-card: 0 1px 3px oklch(0 0 0 / 0.08);` | `shadow-card` |
| 行高 | `--leading-body: 1.75;` | `leading-body` |
| 字距 | `--tracking-title: -0.02em;` | `tracking-title` |
| 颜色 | `:root` 里加 `--success: …;`，`.dark` 里给暗色值，<br>`@theme inline` 里加 `--color-success: var(--success);` | `bg-success`、`text-success` |

Tailwind v3 写在 `tailwind.config.*` 的 `theme.extend` 里，对应的键是 `borderRadius`、`fontSize`、`spacing`、`maxWidth`、`boxShadow`、`lineHeight`、`letterSpacing`、`colors`。

### 4. 命名规则

- **按用途或档位命名，不按数值、不按外观**：用 `rounded-card`、`text-display`、`h-header`、`bg-success`；不要用 `rounded-14`、`text-15px`、`bg-green`。
- 通用档位接着已有档位命名，特定用途按用途命名。
- 同一个值不要定义两个名字；新值和已有 token 很接近时，用已有的。
- 项目里已有命名习惯（例如 shadcn/ui），就沿用它。

### 5. 告诉用户

在回复里列出新增了哪些 token、值是多少、为什么现有的不够用。

**不要先写死、以后再提取。**

## 第三方库、图表、Canvas

需要传具体色值的地方（图表库、Canvas、邮件模板），从 CSS 变量读取，不要另写一份色值：

```ts
const css = getComputedStyle(document.documentElement);
const primary = css.getPropertyValue('--primary').trim();
```

图表配色可以加一组 `--chart-1` … `--chart-5` token。实在只能写死的（例如邮件模板不支持 CSS 变量），在该行加注释 `token-ignore`，并告诉用户原因。

## shadcn/ui 项目

项目根目录有 `components.json` 就是 shadcn/ui 项目。它的组件目录（`components.json` 里 `aliases.ui` 指向的位置，通常是 `components/ui/`）是从上游拷进来的代码，本身已经在用 `bg-primary`、`border-input`、`text-muted-foreground` 这套语义 token。

- **token 沿用 shadcn 的命名和位置**：在 `globals.css` 的 `:root`、`.dark`、`@theme inline` 里改值或新增，不要另起一套。换主题就是改这里的变量。
- **添加组件用 CLI**：`npx shadcn@latest add button`，不要手写，也不要从文档复制粘贴。
- **不为了过检查去改 shadcn 原有的值**：比如 checkbox 的 `rounded-[4px]`、chart 组件里匹配 recharts 的选择器。这些是上游有意调的细节，改了会跟官方版本走样，以后用 `npx shadcn@latest diff` 更新时还会冲突。
- **定制组件时，新写的样式必须用 token**：比如给 Button 加一个 `success` 变体，先确认 `--success`、`--success-foreground` 已经存在（没有就先加），再写 `bg-success text-success-foreground`；不要写 `bg-green-600`。
- **业务代码里优先用组件的变体**（`variant`、`size`），不要在外面用 `className` 覆盖一堆颜色。

检查行为：审计默认跳过 shadcn 组件目录；hook 仍然检查这个目录，但只报这次新写的内容，原有的写法不报。

## 自动检查

这个插件带一个 hook：每次 Write / Edit 样式相关的文件后，只报告这次改动**新引入**的问题。被替换掉的旧内容里本来就有的不报，注释行也不检查。检查的内容包括：
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
  "auditShadcnUi": false,
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
