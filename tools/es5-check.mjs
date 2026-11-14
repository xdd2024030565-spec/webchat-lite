/* ============================================================
   tools/es5-check.mjs — 静态门禁：源码里不能出现 ES6+ 语法/API
   导出 checkSource(src) -> [{ token, line }]
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const BANNED_WORDS = ['let', 'const', 'class', 'yield'];
const BANNED_PATTERNS = [
  { token: 'async function', re: /\basync\s+function\b/ },
  { token: 'await', re: /\bawait\b/ },
  { token: '=>', re: /=>/ },
  { token: '`', re: /`/ },
  { token: '...', re: /\.\.\./ },
  { token: 'Promise', re: /\bPromise\b/ },
  { token: 'fetch(', re: /\bfetch\s*\(/ },
  { token: 'Object.assign', re: /\bObject\s*\.\s*assign\b/ },
  { token: 'Array.from', re: /\bArray\s*\.\s*from\b/ },
  { token: 'includes(', re: /\.includes\s*\(/ },
  { token: 'startsWith(', re: /\.startsWith\s*\(/ },
  { token: 'endsWith(', re: /\.endsWith\s*\(/ },
  { token: 'padStart(', re: /\.padStart\s*\(/ }
];

// 把注释/字符串/正则字面量替换成等长空白（保留换行），避免误报
export function strip(src) {
  const s = String(src);
  const n = s.length;
  let out = '';
  let i = 0;
  const blank = (ch) => (ch === '\n' ? '\n' : ' ');
  const runBlank = (from, to) => {
    for (let k = from; k < to; k++) out += blank(s[k]);
  };
  while (i < n) {
    const c = s[i];
    const d = s[i + 1];
    if (c === '/' && d === '*') {
      let j = s.indexOf('*/', i + 2);
      j = j < 0 ? n : j + 2;
      runBlank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && d === '/') {
      let j = s.indexOf('\n', i);
      j = j < 0 ? n : j;
      runBlank(i, j);
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && s[j] !== c) {
        if (s[j] === '\\') j++;
        j++;
      }
      runBlank(i, Math.min(j + 1, n));
      i = Math.min(j + 1, n);
      continue;
    }
    if (c === '/') {
      // 判定是否正则起始：看前一个非空字符
      let k = out.length - 1;
      while (k >= 0 && /\s/.test(out[k])) k--;
      const prev = k >= 0 ? out[k] : '';
      if (prev === '' || '(,=:[!&|?{};+-*%<>'.indexOf(prev) >= 0) {
        let j = i + 1;
        let inClass = false;
        while (j < n) {
          const ch = s[j];
          if (ch === '\\') { j += 2; continue; }
          if (ch === '[') inClass = true;
          else if (ch === ']') inClass = false;
          else if (ch === '/' && !inClass) { j++; break; }
          else if (ch === '\n') break;
          j++;
        }
        runBlank(i, j);
        i = j;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

export function checkSource(src) {
  const stripped = strip(src);
  const hits = [];
  for (const word of BANNED_WORDS) {
    const re = new RegExp('(^|[^\\w$])' + word + '(?=[^\\w$]|$)', 'g');
    let m;
    while ((m = re.exec(stripped))) {
      const at = m.index + m[1].length;
      hits.push({ token: word, line: lineOf(stripped, at) });
    }
  }
  for (const { token, re } of BANNED_PATTERNS) {
    const g = new RegExp(re.source, 'g');
    let m;
    while ((m = g.exec(stripped))) {
      hits.push({ token, line: lineOf(stripped, m.index) });
    }
  }
  hits.sort((a, b) => a.line - b.line);
  return hits;
}

export function checkFiles(files) {
  const bad = [];
  for (const f of files) {
    const hits = checkSource(fs.readFileSync(f, 'utf8'));
    for (const h of hits) bad.push({ file: f, ...h });
  }
  return bad;
}

export function walkJs(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkJs(p, out);
    else if (/\.js$/.test(name)) out.push(p);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('es5-check.mjs')) {
  const root = process.cwd();
  const files = walkJs(path.join(root, 'assets'));
  const bad = checkFiles(files);
  if (bad.length) {
    for (const b of bad) console.error(`${b.file}:${b.line}  ${b.token}`);
    console.error(`\n${bad.length} 处 ES6+ 语法`);
    process.exit(1);
  }
  console.log(`ok: ${files.length} 个文件全部通过 ES5 门禁`);
}
