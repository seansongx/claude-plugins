#!/usr/bin/env node
// tailwind-tokens checker
//
// 两种用法：
//   1. Hook 模式（无参数）：从 stdin 读取 Claude Code PostToolUse 的 JSON，
//      只检查这次 Edit / Write / MultiEdit 新写入的内容。发现问题时 exit 2，
//      把问题写到 stderr，Claude 会看到并修正。
//   2. 审计模式：node check-tokens.mjs --audit [目录]
//      扫描整个目录，按文件列出问题并汇总。有问题时 exit 1，可用于 CI / lint-staged。
//
// 项目配置（可选）：<项目根>/.claude/tailwind-tokens.json
//   {
//     "disabled": false,            // true 时完全关闭检查
//     "allowPaletteColors": false,  // true 时允许 bg-blue-500 这类原始色板类名
//     "ignore": ["src/legacy/**", "**/*.stories.tsx"]
//   }
//
// 单行豁免：在该行任意位置写 token-ignore（如注释 /* token-ignore */）。

import fs from 'node:fs';
import path from 'node:path';

const STYLE_EXTS = new Set([
  '.css', '.scss', '.sass', '.less', '.pcss', '.postcss',
  '.html', '.htm', '.jsx', '.tsx', '.js', '.ts', '.mjs', '.cjs', '.mts', '.cts',
  '.vue', '.svelte', '.astro', '.mdx',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.output',
  '.svelte-kit', '.astro', '.vercel', '.turbo', 'coverage', '.cache',
]);

// 定义 token 的文件本身不检查
const SKIP_FILE = /(^|\/)(tailwind\.config\.[cm]?[jt]s|postcss\.config\.[cm]?[jt]s)$/;

// ---- 规则 -------------------------------------------------------------------

// 会带颜色的 Tailwind 工具类前缀
const COLOR_UTILS =
  '(?:bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|' +
  'shadow|inset-shadow|inset-ring|drop-shadow|decoration|divide|placeholder|caret|accent)';

const PALETTE =
  '(?:slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|' +
  'emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';

const COLOR_LITERAL = '(?:#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\\()';

// 设计系统相关的尺寸（间距、字号、圆角、行高、字距）。
// 宽高、定位这类一次性的布局尺寸（w-[320px]、h-[100dvh]）不检查。
const SIZE_UTILS =
  '(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|text|rounded(?:-[a-z]{1,2})?|leading|tracking|indent)';

const CSS_COLOR_PROPS =
  '(?:color|background(?:-color)?|backgroundColor|border(?:-(?:top|right|bottom|left))?(?:-color)?|' +
  'border(?:Top|Right|Bottom|Left)?Color|outline(?:-color)?|outlineColor|fill|stroke|' +
  'box-shadow|boxShadow|text-shadow|textShadow|caret-color|caretColor|accent-color|accentColor|' +
  'text-decoration-color|textDecorationColor)';

const RULES = [
  {
    id: 'arbitrary-color',
    re: new RegExp(`(?<![\\w-])${COLOR_UTILS}-\\[(?:color:)?${COLOR_LITERAL}[^\\]]*\\]`, 'g'),
    hint: '任意颜色值 → 改用语义颜色类（如 bg-primary、text-muted-foreground）；没有合适的先在 token 文件里加',
  },
  {
    id: 'arbitrary-size',
    re: new RegExp(`(?<![\\w-])-?${SIZE_UTILS}-\\[-?[\\d.]+(?:px|rem|em)\\]`, 'g'),
    hint: '任意尺寸 → 先就近用现有刻度（p-3、text-sm、rounded-md）；确实需要新档位，先在 @theme 里加 token（如 --radius-card）再用 rounded-card',
  },
  {
    id: 'palette-color',
    re: new RegExp(`(?<![\\w-])${COLOR_UTILS}-${PALETTE}-(?:50|[1-9]00|950)(?![\\w-])`, 'g'),
    hint: '原始色板类名 → 组件里只用语义颜色（bg-primary、text-foreground、border-border）',
    palette: true,
  },
  {
    id: 'hardcoded-style-color',
    re: new RegExp(`(?<![\\w-])${CSS_COLOR_PROPS}\\s*[:=]\\s*[^;\\n}]*?${COLOR_LITERAL}`, 'g'),
    hint: '写死的色值 → 改用 var(--xxx) 或 Tailwind 语义类；SVG 图标用 currentColor',
  },
];

// ---- 工具函数 ---------------------------------------------------------------

const toPosix = (p) => p.split(path.sep).join('/');

function globToRegExp(glob) {
  let g = toPosix(glob).replace(/^\.\//, '');
  if (g.endsWith('/')) g += '**';
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') { i++; re += '(?:.*/)?'; } else { re += '.*'; }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

function findProjectRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.claude', 'tailwind-tokens.json'))) return dir;
    if (fs.existsSync(path.join(dir, 'package.json')) || fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

function loadConfig(root) {
  const file = path.join(root, '.claude', 'tailwind-tokens.json');
  try {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      disabled: !!cfg.disabled,
      allowPaletteColors: !!cfg.allowPaletteColors,
      ignore: (cfg.ignore || []).map(globToRegExp),
    };
  } catch {
    return { disabled: false, allowPaletteColors: false, ignore: [] };
  }
}

function shouldCheck(file, root, cfg) {
  if (!STYLE_EXTS.has(path.extname(file).toLowerCase())) return false;
  const rel = toPosix(path.relative(root, file));
  if (SKIP_FILE.test(rel)) return false;
  if (rel.split('/').some((seg) => SKIP_DIRS.has(seg))) return false;
  if (cfg.ignore.some((re) => re.test(rel))) return false;
  return true;
}

// 扫描一段文本，lineOffset 是这段文本第一行在文件里的行号
function scan(text, lineOffset, cfg) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes('token-ignore')) return;
    for (const rule of RULES) {
      if (rule.palette && cfg.allowPaletteColors) continue;
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line))) {
        findings.push({ line: lineOffset + i, rule: rule.id, match: m[0].trim(), hint: rule.hint });
      }
    }
  });
  return findings;
}

function lineOf(haystack, needle) {
  const idx = needle ? haystack.indexOf(needle) : -1;
  if (idx < 0) return null;
  return haystack.slice(0, idx).split('\n').length;
}

function truncate(s, n = 60) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function formatFindings(byFile, limit) {
  const out = [];
  let shown = 0;
  let total = 0;
  for (const [file, list] of byFile) {
    total += list.length;
    if (shown >= limit) continue;
    out.push(file);
    for (const f of list) {
      if (shown >= limit) break;
      out.push(`  ${String(f.line).padStart(4)}  ${truncate(f.match).padEnd(28)}  ${f.hint}`);
      shown++;
    }
  }
  if (total > shown) out.push(`  …还有 ${total - shown} 处未列出`);
  return { text: out.join('\n'), total };
}

// ---- Hook 模式 --------------------------------------------------------------

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function hookMode() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    return 0;
  }
  const ti = input.tool_input || {};
  const file = ti.file_path;
  if (!file) return 0;

  const root = findProjectRoot(input.cwd || path.dirname(file));
  const cfg = loadConfig(root);
  if (cfg.disabled || !shouldCheck(file, root, cfg)) return 0;

  let full = '';
  try { full = fs.readFileSync(file, 'utf8'); } catch { /* 文件读不到就按片段行号 */ }

  // 只检查这次新写入的内容，避免旧代码里的问题反复打扰
  let snippets;
  if (typeof ti.content === 'string') snippets = [ti.content];
  else if (Array.isArray(ti.edits)) snippets = ti.edits.map((e) => e.new_string).filter(Boolean);
  else if (typeof ti.new_string === 'string') snippets = [ti.new_string];
  else return 0;

  const findings = [];
  for (const s of snippets) {
    const start = typeof ti.content === 'string' ? 1 : lineOf(full, s) ?? 1;
    findings.push(...scan(s, start, cfg));
  }
  if (!findings.length) return 0;

  const rel = toPosix(path.relative(root, file)) || file;
  const { text, total } = formatFindings(new Map([[rel, findings]]), 30);
  process.stderr.write(
    `[tailwind-tokens] 刚写入的内容里有 ${total} 处没有使用设计 token：\n\n${text}\n\n` +
    '请改成 token：先在 token 文件（@theme / :root）里找已有的值，没有就先加一个语义命名的 token 再引用。\n' +
    '确实无法用 token 的（例如第三方库必须传色值），在该行加注释 token-ignore，并向用户说明原因。\n',
  );
  return 2;
}

// ---- 审计模式 ---------------------------------------------------------------

function walk(dir, root, cfg, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p, root, cfg, files);
    } else if (e.isFile() && shouldCheck(p, root, cfg)) {
      files.push(p);
    }
  }
  return files;
}

function auditMode(target) {
  const dir = path.resolve(target || '.');
  const root = findProjectRoot(dir);
  const cfg = loadConfig(root);
  if (cfg.disabled) {
    console.log('[tailwind-tokens] 检查已在 .claude/tailwind-tokens.json 中关闭。');
    return 0;
  }

  const byFile = new Map();
  const ruleCount = {};
  const colorCount = new Map();
  for (const file of walk(dir, root, cfg)) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const findings = scan(text, 1, cfg);
    if (!findings.length) continue;
    byFile.set(toPosix(path.relative(root, file)), findings);
    for (const f of findings) {
      ruleCount[f.rule] = (ruleCount[f.rule] || 0) + 1;
      const literal = f.match.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\([^)]*\)/);
      const key = literal ? literal[0].toLowerCase() : f.rule === 'palette-color' ? f.match.replace(/^.*?-(?=[a-z]+-\d+$)/, '') : null;
      if (key) colorCount.set(key, (colorCount.get(key) || 0) + 1);
    }
  }

  if (!byFile.size) {
    console.log('[tailwind-tokens] 没有发现问题，所有样式都在使用 token。');
    return 0;
  }

  const { text, total } = formatFindings(byFile, 500);
  console.log(`[tailwind-tokens] 共 ${byFile.size} 个文件、${total} 处问题：\n`);
  console.log(text);
  console.log('\n按规则统计：');
  for (const [rule, n] of Object.entries(ruleCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rule.padEnd(24)} ${n}`);
  }
  if (colorCount.size) {
    console.log('\n出现最多的颜色（用来归并成语义 token）：');
    [...colorCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
      .forEach(([c, n]) => console.log(`  ${c.padEnd(24)} ${n}`));
  }
  return 1;
}

// ---- 入口 -------------------------------------------------------------------

const args = process.argv.slice(2);
try {
  const code = args[0] === '--audit' ? auditMode(args[1]) : await hookMode();
  process.exit(code);
} catch (err) {
  // 检查器自身出错时绝不阻塞用户
  if (args[0] === '--audit') console.error(err);
  process.exit(0);
}
