#!/usr/bin/env node
// tailwind-tokens checker
//
// 两种用法：
//   1. Hook 模式（无参数）：从 stdin 读取 Claude Code PostToolUse 的 JSON，
//      只报告这次 Edit / Write / MultiEdit **新引入**的问题（被替换的旧内容里本来
//      就有的不报）。发现问题时 exit 2，把问题写到 stderr，Claude 会看到并修正。
//   2. 审计模式：node check-tokens.mjs --audit [目录]
//      扫描整个目录，按文件列出问题并汇总。有问题时 exit 1，可用于 CI / lint-staged。
//      检测到 shadcn/ui（components.json）时，默认跳过它的组件目录。
//
// 项目配置（可选）：<项目根>/.claude/tailwind-tokens.json
//   {
//     "disabled": false,            // true 时完全关闭检查
//     "allowPaletteColors": false,  // true 时允许 bg-blue-500 这类原始色板类名
//     "auditShadcnUi": false,       // true 时审计也包含 shadcn 的 components/ui
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

// 返回 { root, pkgRoot }：
//   root    配置文件所在的目录，ignore 的 glob 和输出路径都相对它。
//           一直往上找到仓库边界（.git）为止，所以 monorepo 里对子包跑审计时，
//           仓库根的 .claude/tailwind-tokens.json 也能读到。没有配置文件时等于 pkgRoot。
//   pkgRoot 离起点最近的 package.json / .git 所在目录（子包自己的根）。
function findProjectRoot(start) {
  const from = path.resolve(start);
  let pkgRoot = null;
  let dir = from;
  for (;;) {
    const isRepoRoot = fs.existsSync(path.join(dir, '.git'));
    if (!pkgRoot && (isRepoRoot || fs.existsSync(path.join(dir, 'package.json')))) pkgRoot = dir;
    if (fs.existsSync(path.join(dir, '.claude', 'tailwind-tokens.json'))) {
      return { root: dir, pkgRoot: pkgRoot || dir };
    }
    const parent = path.dirname(dir);
    if (isRepoRoot || parent === dir) break;
    dir = parent;
  }
  return { root: pkgRoot || from, pkgRoot: pkgRoot || from };
}

// 读取 shadcn/ui 的 components.json，返回组件目录（如 "components/ui"）
function detectShadcnUi(root) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'components.json'), 'utf8'));
    const alias = cfg.aliases?.ui || (cfg.aliases?.components ? `${cfg.aliases.components}/ui` : '@/components/ui');
    // "@/components/ui"、"~/components/ui"、"$lib/components/ui" → "components/ui"
    const dir = alias.replace(/^[@~$][^/]*\//, '').replace(/^\.?\//, '').replace(/\/+$/, '');
    return dir || null;
  } catch {
    return null;
  }
}

function loadConfig(root, pkgRoot = root) {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'tailwind-tokens.json'), 'utf8'));
  } catch { /* 没有配置文件就用默认值 */ }
  // components.json 通常在子包里，先看子包，再看配置所在的根
  const shadcnUiDir = detectShadcnUi(pkgRoot) || (pkgRoot !== root ? detectShadcnUi(root) : null);
  return {
    disabled: !!raw.disabled,
    allowPaletteColors: !!raw.allowPaletteColors,
    auditShadcnUi: !!raw.auditShadcnUi,
    ignore: (raw.ignore || []).map(globToRegExp),
    shadcnUiDir,
    shadcnUi: shadcnUiDir ? globToRegExp(`**/${shadcnUiDir}/**`) : null,
  };
}

function shouldCheck(file, root, cfg, mode) {
  if (!STYLE_EXTS.has(path.extname(file).toLowerCase())) return false;
  const rel = toPosix(path.relative(root, file));
  if (SKIP_FILE.test(rel)) return false;
  if (rel.split('/').some((seg) => SKIP_DIRS.has(seg))) return false;
  if (cfg.ignore.some((re) => re.test(rel))) return false;
  // shadcn 组件是上游代码：审计时默认跳过；hook 仍然检查，但只报新引入的问题
  if (mode === 'audit' && cfg.shadcnUi && !cfg.auditShadcnUi && cfg.shadcnUi.test(rel)) return false;
  return true;
}

// 把选择器里的内容抹掉，避免误报：
//   Tailwind 任意变体  [&_.recharts-dot[stroke='#fff']]:stroke-transparent
//   CSS 属性选择器      .dot[stroke='#fff'] { … }
const VARIANT_SELECTOR = /\[(?:[^[\]]|\[[^[\]]*\])*\](?=:)/g;
const ATTR_SELECTOR = /\[\s*[\w-]+\s*[~|^$*]?=\s*(['"]).*?\1\s*\]/g;
const blank = (s) => ' '.repeat(s.length);

// 纯注释行（// …、/* …、 * …、<!-- …、{/* … */}）里的类名不是真正的样式
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*(?:\s|\/|$)(?!\s*\{)|<!--|\{\s*\/\*)/;
function stripSelectors(line) {
  return line.replace(VARIANT_SELECTOR, blank).replace(ATTR_SELECTOR, blank);
}

// 扫描一段文本，lineOffset 是这段文本第一行在文件里的行号
function scan(text, lineOffset, cfg) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, i) => {
    if (rawLine.includes('token-ignore')) return;
    if (COMMENT_LINE.test(rawLine)) return;
    const line = stripSelectors(rawLine);
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

  const { root, pkgRoot } = findProjectRoot(input.cwd || path.dirname(file));
  const cfg = loadConfig(root, pkgRoot);
  if (cfg.disabled || !shouldCheck(file, root, cfg)) return 0;

  let full = '';
  try { full = fs.readFileSync(file, 'utf8'); } catch { /* 文件读不到就按片段行号 */ }

  // 每一处改动是 [旧内容, 新内容]。只报新内容里新出现的问题：
  // 旧内容里本来就有的（例如 shadcn 原有的 rounded-[4px]、老代码里的 bg-blue-500）不报。
  let pairs;
  if (typeof ti.content === 'string') {
    const tr = input.tool_response || {};
    const original = typeof tr.originalFile === 'string' ? tr.originalFile : '';
    pairs = [[original, ti.content, 1]];
  } else if (Array.isArray(ti.edits)) {
    pairs = ti.edits.filter((e) => e.new_string).map((e) => [e.old_string || '', e.new_string]);
  } else if (typeof ti.new_string === 'string') {
    pairs = [[ti.old_string || '', ti.new_string]];
  } else {
    return 0;
  }

  const findings = [];
  for (const [oldText, newText, fixedStart] of pairs) {
    const start = fixedStart ?? lineOf(full, newText) ?? 1;
    const existing = new Map();
    for (const f of scan(oldText, 1, cfg)) {
      const k = `${f.rule}\u0000${f.match}`;
      existing.set(k, (existing.get(k) || 0) + 1);
    }
    for (const f of scan(newText, start, cfg)) {
      const k = `${f.rule}\u0000${f.match}`;
      const n = existing.get(k) || 0;
      if (n > 0) existing.set(k, n - 1);
      else findings.push(f);
    }
  }
  if (!findings.length) return 0;

  const rel = toPosix(path.relative(root, file)) || file;
  const { text, total } = formatFindings(new Map([[rel, findings]]), 30);
  process.stderr.write(
    `[tailwind-tokens] 这次改动新引入了 ${total} 处没有使用设计 token 的写法：\n\n${text}\n\n` +
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
    } else if (e.isFile() && shouldCheck(p, root, cfg, 'audit')) {
      files.push(p);
    }
  }
  return files;
}

function auditMode(target) {
  const dir = path.resolve(target || '.');
  const { root, pkgRoot } = findProjectRoot(dir);
  const cfg = loadConfig(root, pkgRoot);
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

  if (cfg.shadcnUi && !cfg.auditShadcnUi) {
    console.log(
      `[tailwind-tokens] 检测到 shadcn/ui，已跳过组件目录 ${cfg.shadcnUiDir}/` +
      '（上游代码，不为了过检查去改；要包含它，在 .claude/tailwind-tokens.json 设 "auditShadcnUi": true）\n',
    );
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
