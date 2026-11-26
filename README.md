# claude-plugins

我的 Claude Code 插件合集。

## 安装

先添加这个插件市场（每台电脑只需一次）：

```
/plugin marketplace add seansongx/claude-plugins
```

再按需安装插件：

```
/plugin install <插件名>@seansongx
```

更新：

```
/plugin marketplace update seansongx
```

## 插件列表

| 插件 | 说明 |
|---|---|
| [tailwind-tokens](plugins/tailwind-tokens) | 让 AI 先定义设计 token 再统一使用：禁止硬编码颜色、任意值和原始色板类名，改完样式自动检查 |
| [project-docs](plugins/project-docs) | 给项目定一套文档规范并强制执行：功能、需求、计划、决策各有唯一位置，AI 不能到处新建 `.md`，计划做完就删 |

## 新增插件

1. 在 `plugins/` 下新建文件夹，里面放 `.claude-plugin/plugin.json`，以及 `skills/`、`commands/`、`hooks/` 等。
2. 在 `.claude-plugin/marketplace.json` 的 `plugins` 里加一项，`name` 要和 `plugin.json` 里的一致。

## License

MIT
