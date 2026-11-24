---
description: 审计项目里没有使用设计 token 的样式，并给出统一方案
argument-hint: "[目录，默认 src]"
---

审计这个项目的样式是否统一使用了设计 token。

1. 运行：

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/tailwind-tokens/scripts/check-tokens.mjs" --audit $ARGUMENTS
   ```

   没有传目录时，如果存在 `src` 就用 `src`，否则用 `.`。

2. 读取项目现有的 token 文件（Tailwind v4 是含 `@theme` 的 CSS 文件，v3 是 `tailwind.config.*`）。

3. 向用户汇报：
   - 问题总数，以及问题最集中的文件
   - 把审计结果里"出现最多的颜色"归并成语义 token 的方案，用映射表列出（原值 → token 名 → 对应类名）
   - 还缺哪些 token（如 `success`、`warning`、`chart-*`）

4. **先停下来等用户确认方案**，不要直接改代码。用户确认后，按 tailwind-tokens skill 里"审计和迁移已有项目"的步骤分批迁移。
