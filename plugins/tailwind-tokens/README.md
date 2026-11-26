# tailwind-tokens

让 AI 写 Tailwind 时**先定义设计 token，再在全项目统一使用**，不再到处写 `bg-blue-500`、`text-[15px]`、`#3b82f6`。

## 包含什么

| 组成 | 作用 |
|---|---|
| **Skill** `tailwind-tokens` | 写样式前先找到或建立 token（`:root` 语义变量 + `@theme`）；组件只用语义类名；新值先加 token 再用 |
| **Hook**（PostToolUse） | AI 每次改完样式文件，自动检查，**只报这次改动新引入的硬编码**（原本就有的不报），把问题反馈给 AI，让它当场改掉 |
| **命令** `/tailwind-tokens:tokens-audit` | 给已有项目做一次体检，统计硬编码的位置和最常见的颜色，给出归并成 token 的方案 |

## 安装

```
/plugin marketplace add seansongx/claude-plugins
/plugin install tailwind-tokens@seansongx
```

需要本机有 Node.js（Tailwind 项目一般都有）。

## 检查哪些写法

| 规则 | 例子 | 应改为 |
|---|---|---|
| `arbitrary-color` | `bg-[#3b82f6]` | `bg-primary` |
| `arbitrary-size` | `p-[13px]`、`text-[15px]`、`rounded-[6px]` | 就近用 `p-3`、`text-sm`、`rounded-md`；确实需要新档位就先加 token，如 `rounded-card` |
| `palette-color` | `bg-blue-500`、`text-gray-600` | `bg-primary`、`text-muted-foreground` |
| `hardcoded-style-color` | `color: #333`、`style={{ color: '#333' }}`、`fill="#333"` | `var(--foreground)`、`currentColor` |

缺少的尺寸、圆角、字号、颜色，规则是**先就近对齐现有刻度；确实需要新档位，就先在 token 文件里加（按用途命名，如 `rounded-card`、`text-display`），再使用**。详见 [SKILL.md](skills/tailwind-tokens/SKILL.md)。

不检查：
- 一次性的布局尺寸，如 `w-[320px]`、`h-[100dvh]`
- token 定义本身：CSS 自定义属性 `--xxx: #fff`、`tailwind.config.*`
- `node_modules`、`dist`、`.next` 等构建目录
- 注释行，以及选择器里的属性值，如 `[&_.dot[stroke='#fff']]:…`、`.dot[stroke='#fff']`

单行豁免：在该行写 `token-ignore`（例如 `/* token-ignore */`）。

## shadcn/ui 项目

检测到 `components.json` 时：
- **审计默认跳过 shadcn 组件目录**（`aliases.ui`，通常是 `components/ui/`）。这是上游代码，像 checkbox 的 `rounded-[4px]` 这类有意调的细节，不应该为了过检查去改，改了以后用 `npx shadcn diff` 更新时还会冲突。
- **hook 仍然检查这个目录，但只报新写的内容**。定制 shadcn 组件时，新加的样式仍然要用 token。

Monorepo：每个子包按自己的 `components.json` 识别组件目录，从仓库根审计整个仓库时也一样，各子包的组件目录都会被跳过。

## 项目配置（可选）

`.claude/tailwind-tokens.json`：

```json
{
  "disabled": false,
  "allowPaletteColors": false,
  "auditShadcnUi": false,
  "ignore": ["src/legacy/**", "**/*.stories.tsx"]
}
```

- `allowPaletteColors`：老项目暂时不想管色板类名时设为 `true`
- `auditShadcnUi`：审计时也检查 shadcn 组件目录
- `ignore`：跳过的路径（glob，相对配置文件所在的项目根）

Monorepo：配置放在仓库根的 `.claude/` 即可，对子包跑审计或在子包里改文件时也会读到；`ignore` 的路径相对仓库根，例如 `packages/web/scripts/**` 或 `**/scripts/**`。子包自己有 `.claude/tailwind-tokens.json` 时用子包的。

## 更新记录

- **0.2.2**：从仓库根审计 monorepo 时，识别各子包自己的 `components.json`
- **0.2.1**：monorepo 里对子包跑审计时，也能读到仓库根的配置
- **0.2.0**：hook 只报新引入的问题；自动识别 shadcn/ui，审计时跳过组件目录；不再误报注释和选择器
- **0.1.1**：缺少的尺寸、圆角、字号先就近对齐，确实需要再新增 token
- **0.1.0**：首个版本

## 在 CI 里用

检查脚本也可以单独运行，有问题时退出码为 1：

```bash
node path/to/check-tokens.mjs --audit src
```
