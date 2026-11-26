# project-docs

给项目定一套文档规范并强制执行，解决 AI 到处新建 `.md` 造成的重复、过时和混乱。

核心做法：**按生命周期把文档分成 4 类，每类只有一个位置；临时的计划做完就删；Bug 和任务不进仓库。**

```
docs/
  README.md        # 索引，脚本生成
  specs/           # 功能与需求：一个功能一个文件，长期保留
  architecture.md  # 架构现状
  plans/           # 进行中的计划，做完并入 spec 后删除
  decisions/       # 决策记录，NNNN-标题.md，写完不改
```

## 包含什么

| 组成 | 作用 |
|---|---|
| **Skill** `project-docs` | 写或改文档前触发：先搜后写、每类内容去哪、哪些内容不该写成文件 |
| **Hook**（PreToolUse） | 要在允许位置之外新建 `.md` 时直接拦截，并告诉 AI 该写到哪 |
| **命令** `/project-docs:docs-init` | 在项目里启用：建目录、写配置、往 `CLAUDE.md` 写入规则、放入检查脚本 |
| **命令** `/project-docs:docs-audit` | 盘点已有项目的散乱文档，给出整理清单，确认后再动 |
| **检查脚本** | 位置、spec 元信息、决策编号、死链、超期计划、索引是否最新；可接 CI |

## 安装

```
/plugin marketplace add seansongx/claude-plugins
/plugin install project-docs@seansongx
```

需要本机有 Node.js 22 或更高版本。

## 启用

插件装好后**不会影响任何项目**。在要用的项目里运行一次：

```
/project-docs:docs-init
```

之后项目根目录会有 `.claude/project-docs.json`，hook 只在有这个文件的项目里生效。

## 拦截规则

只拦截**新建**，修改已有文件不拦截。`docs/` 之外默认允许：

- 各级 `README.md`、`CHANGELOG.md`、`CLAUDE.md`、`AGENTS.md`
- 根目录的 `LICENSE.md`、`CONTRIBUTING.md`、`SECURITY.md`、`CODE_OF_CONDUCT.md`
- `.claude/`、`.github/` 下的文件

`node_modules`、`vendor`、`dist` 等依赖和构建目录不检查，项目之外的文件也不检查。

## 项目配置

`.claude/project-docs.json`：

```json
{
  "disabled": false,
  "docsDir": "docs",
  "allow": ["content/**", "apps/*/docs/fixtures/**"],
  "ignore": ["server/.github/**"],
  "planStaleDays": 30
}
```

- `allow`：额外允许放 `.md` 的位置（glob，相对项目根）
- `ignore`：完全不检查的位置
- `planStaleDays`：计划超过多少天没动就提醒

## 检查脚本

初始化时会复制到项目的 `scripts/check-docs.mjs`，CI 和没装插件的人也能运行：

```bash
node scripts/check-docs.mjs --check   # 检查，有错误时退出码为 1
node scripts/check-docs.mjs --index   # 重新生成 docs/README.md 里的索引
node scripts/check-docs.mjs --audit   # 列出所有 .md 及其位置是否合规
```

插件更新后，在项目里重新运行 `/project-docs:docs-init` 即可同步新的规则和脚本，配置不会被覆盖。

## 更新记录

- **0.1.0**：首个版本
