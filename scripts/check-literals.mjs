// 토큰 밖 리터럴 검사: styles/tokens.css 말고는 hex 색과 px 글자 크기를 쓰지 않는다.
// 실행: npm run check:literals (위반이 있으면 종료 코드 1)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const DIRS = ['app', 'components', 'lib', 'styles'];
const EXT = /\.(css|tsx?|jsx?|mjs)$/;
const SKIP = new Set(['styles/tokens.css']);

const HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const FONT_PX = [
  /font-size\s*:\s*[\d.]+px/gi, // CSS
  /fontSize\s*:\s*['"`]?[\d.]+(px)?['"`]?\s*[,}]/g, // style={{ fontSize: 16 }} 또는 '16px'
  /font\s*:[^;{}]*\b[\d.]+px/gi, // font 단축 속성
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

const problems = [];
for (const d of DIRS) {
  for (const file of walk(join(root, d))) {
    const rel = relative(root, file).split(sep).join('/');
    if (SKIP.has(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(HEX)) problems.push(`${rel}:${i + 1} hex 색 ${m[0]}`);
      for (const re of FONT_PX) for (const m of line.matchAll(re)) problems.push(`${rel}:${i + 1} px 글자 크기 "${m[0].trim()}"`);
    });
  }
}

if (problems.length) {
  console.error(`토큰 밖 리터럴 ${problems.length}개 (styles/tokens.css의 변수를 쓰세요)`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('리터럴 검사 통과: hex 색 0, px 글자 크기 0 (styles/tokens.css 제외)');
