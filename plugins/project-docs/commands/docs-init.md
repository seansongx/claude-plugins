---
description: 在当前项目启用文档规范：建目录、写配置、往 CLAUDE.md 写入规则、放入检查脚本
---

在当前项目启用 project-docs 文档规范。

1. 先看项目现状：有没有 `docs/` 目录、里面有什么，根目录有没有 `CLAUDE.md` / `AGENTS.md`，有没有已有的文档规范（例如 `docs/CONVENTIONS.md`），`scripts/check-docs.mjs` 是否已被别的脚本占用。

   项目已有自己的文档规范时，**先停下来告诉用户两套规范会冲突**，问清楚是替换还是放弃启用，不要直接初始化。

2. 运行初始化：

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/project-docs/scripts/check-docs.mjs" --init
   ```

   它会：新建 `.claude/project-docs.json`；建好 `docs/specs/`、`docs/plans/`、`docs/decisions/`；把文档规则写进 `CLAUDE.md`（只有 `AGENTS.md` 的项目写进 `AGENTS.md`）；把检查脚本复制到 `scripts/check-docs.mjs`；生成 `docs/README.md` 索引。重复运行是安全的，会更新规则和脚本，不会覆盖配置。

3. 项目有 `package.json` 时，加上脚本（已有同名脚本就先问用户）：

   ```json
   "docs:check": "node scripts/check-docs.mjs --check",
   "docs:index": "node scripts/check-docs.mjs --index"
   ```

4. 运行一次 `node scripts/check-docs.mjs --audit`，向用户汇报：
   - 初始化做了哪些事
   - 现有文档里有多少个位置不合规
   - 哪些看起来是工具或测试按固定路径读取的文件，建议加进配置的 `allow` 或 `ignore`（列出来让用户确认，不要自己加）

5. 有不合规的文档时，建议接着运行 `/project-docs:docs-audit` 整理，不要在这一步移动或删除任何文件。

6. 提醒用户把 `node scripts/check-docs.mjs --check` 接入 CI 或提交前检查；不要自己改 CI 配置，除非用户要求。
