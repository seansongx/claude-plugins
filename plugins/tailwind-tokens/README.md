# tailwind-tokens

让 AI 写 Tailwind 时**先定义设计 token，再在全项目统一使用**，不再到处写 `bg-blue-500`、`text-[15px]`、`#3b82f6`。

## 包含什么

| 组成 | 作用 |
|---|---|
| **Skill** `tailwind-tokens` | 写样式前先找到或建立 token（`:root` 语义变量 + `@theme`）；组件只用语义类名；新值先加 token 再用 |
| **Hook**（PostToolUse） | AI 每次改完样式文件，自动检查**新写入的内容**，发现硬编码就把问题反馈给 AI，让它当场改掉 |
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
| `arbitrary-size` | `p-[13px]`、`text-[15px]`、`rounded-[6px]` | `p-3`、`text-sm`、`rounded-md` |
| `palette-color` | `bg-blue-500`、`text-gray-600` | `bg-primary`、`text-muted-foreground` |
| `hardcoded-style-color` | `color: #333`、`style={{ color: '#333' }}`、`fill="#333"` | `var(--foreground)`、`currentColor` |

不检查：
- 一次性的布局尺寸，如 `w-[320px]`、`h-[100dvh]`
- token 定义本身：CSS 自定义属性 `--xxx: #fff`、`tailwind.config.*`
- `node_modules`、`dist`、`.next` 等构建目录

单行豁免：在该行写 `token-ignore`（例如 `/* token-ignore */`）。

## 项目配置（可选）

`.claude/tailwind-tokens.json`：

```json
{
  "disabled": false,
  "allowPaletteColors": false,
  "ignore": ["src/legacy/**", "**/*.stories.tsx"]
}
```

- `allowPaletteColors`：老项目暂时不想管色板类名时设为 `true`
- `ignore`：跳过的路径（glob，相对项目根）

## 在 CI 里用

检查脚本也可以单独运行，有问题时退出码为 1：

```bash
node path/to/check-tokens.mjs --audit src
```
