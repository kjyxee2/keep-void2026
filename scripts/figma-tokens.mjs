// Figma 변수와 스타일 JSON(design/tokens.figma.json)을 styles/tokens.css로 바꾼다.
// 실행: node scripts/figma-tokens.mjs [입력 JSON] [출력 CSS]
// 이름 규칙: 변수 이름의 "/"를 "-"로 바꾸고 컬렉션별 접두사를 붙인다.
//   Primitives  ink/900      -> --primitive-ink-900
//   Color       text/primary -> --color-text-primary (원시 색은 var()로 연결)
//   Layout      font/h1      -> --font-size-h1, 나머지는 이름 그대로(--space-21, --radius-md)
//   Motion      duration/base -> --duration-base
// Layout의 Mobile 375 값은 @media (max-width: 767px) 안에 넣는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const input = resolve(process.argv[2] ?? 'design/tokens.figma.json');
const output = resolve(process.argv[3] ?? 'styles/tokens.css');
const src = JSON.parse(readFileSync(input, 'utf8'));
const C = src.collections;

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const px = (n) => `${+Number(n).toFixed(2)}px`;

const PRIM = 'RE:FIT v3 Primitives';
const COLOR = 'RE:FIT v3 Color';
const LAYOUT = 'RE:FIT v3 Layout';
const MOTION = 'RE:FIT v3 Motion';
for (const k of [PRIM, COLOR, LAYOUT, MOTION]) if (!C[k]) throw new Error(`컬렉션 없음: ${k}`);

const primName = (n) => `--primitive-${slug(n)}`;
const layoutName = (n) => (n.startsWith('font/') ? `--font-size-${slug(n.slice(5))}` : `--${slug(n)}`);

const lines = [];
const counts = {};
const add = (group, line) => {
  lines.push(line);
  counts[group] = (counts[group] ?? 0) + 1;
};

// 1) 원시 색
const prim = C[PRIM].variables;
for (const [n, v] of Object.entries(prim)) add(PRIM, `  ${primName(n)}: ${v.values[C[PRIM].modes[0]]};`);

// 2) 의미 색 (별칭이면 원시 변수로 연결, 아니면 값)
const colorMode = C[COLOR].modes[0];
for (const [n, v] of Object.entries(C[COLOR].variables)) {
  const value = v.alias && prim[v.alias] ? `var(${primName(v.alias)})` : v.values[colorMode];
  add(COLOR, `  --color-${slug(n)}: ${value}; /* ${v.values[colorMode]} */`);
}

// 3) 레이아웃 (데스크톱 기본, 모바일은 미디어 쿼리)
const [desk, mob] = C[LAYOUT].modes;
const mobileLines = [];
for (const [n, v] of Object.entries(C[LAYOUT].variables)) {
  add(LAYOUT, `  ${layoutName(n)}: ${px(v.values[desk])};`);
  if (v.values[mob] !== v.values[desk]) mobileLines.push(`    ${layoutName(n)}: ${px(v.values[mob])};`);
}

// 4) 모션
for (const [n, v] of Object.entries(C[MOTION].variables)) add(MOTION, `  --${slug(n)}: ${v.values[C[MOTION].modes[0]]}ms;`);

// 5) 스타일: 그림자, 블러, 그라디언트
const styleLines = [];
const styleCount = { text: 0, shadow: 0, blur: 0, gradient: 0 };
for (const e of src.styles.effect) {
  const key = slug(e.name.replace('RE:FIT v3/', ''));
  if (e.shadows) {
    styleLines.push(`  --${key}: ${e.shadows.map(([x, y, b, s, c]) => `${px(x)} ${px(y)} ${px(b)} ${px(s)} ${c}`).join(', ')};`);
    styleCount.shadow++;
  } else if (e.blur != null) {
    styleLines.push(`  --${key}: ${px(e.blur)};`);
    styleCount.blur++;
  }
}
for (const p of src.styles.paint) {
  const key = slug(p.name.replace('RE:FIT v3/', ''));
  const stops = p.stops.map(([pos, c]) => `${c} ${+(pos * 100).toFixed(1)}%`).join(', ');
  styleLines.push(`  --${key}: linear-gradient(${p.direction}, ${stops});`);
  styleCount.gradient++;
}

// 6) 글자 스타일: 클래스 + 굵기 변수
const WEIGHT = { Regular: 400, Medium: 500, SemiBold: 600, Bold: 700 };
const textClasses = [];
for (const t of src.styles.text) {
  const key = slug(t.name.replace('RE:FIT v3/', ''));
  textClasses.push(
    `.text-${key} {\n  font-size: var(${layoutName(t.sizeVar)});\n  font-weight: ${WEIGHT[t.fontStyle] ?? 400};\n  line-height: ${+(t.lineHeight / 100).toFixed(2)};\n  letter-spacing: ${t.letterSpacing};${t.decoration === 'UNDERLINE' ? '\n  text-decoration: underline;' : ''}\n}`,
  );
  styleCount.text++;
}

const figmaTotal = [PRIM, COLOR, LAYOUT, MOTION].reduce((s, k) => s + Object.keys(C[k].variables).length, 0);
const cssTotal = Object.values(counts).reduce((a, b) => a + b, 0);

const css = `/*
 * RE:FIT 디자인 토큰. 손으로 고치지 말 것.
 * 생성: node scripts/figma-tokens.mjs (입력 design/tokens.figma.json, Figma ${src.source.fileKey})
 * Figma 변수 ${figmaTotal}개 = CSS 변수 ${cssTotal}개, 스타일: 글자 ${styleCount.text}, 그림자 ${styleCount.shadow}, 블러 ${styleCount.blur}, 그라디언트 ${styleCount.gradient}
 */

:root {
  /* ${PRIM} */
${lines.filter((l) => l.includes('--primitive-')).join('\n')}

  /* ${COLOR} (${colorMode}) */
${lines.filter((l) => l.includes('--color-')).join('\n')}

  /* ${LAYOUT} (${desk}) */
${lines.filter((l) => !l.includes('--primitive-') && !l.includes('--color-') && !/--(duration|stagger)-/.test(l)).join('\n')}

  /* ${MOTION} */
${lines.filter((l) => /--(duration|stagger)-/.test(l)).join('\n')}
  --ease-standard: ${src.motionExtra.ease};

  /* 스타일: 그림자, 블러, 그라디언트 */
${styleLines.join('\n')}

  /* 서체 (Pretendard 하나, next/font/local 변수 --font-pretendard) */
  --font-family-base: var(--font-pretendard), -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* 보조 토큰 (Figma 선 두께, 아이콘 크기, 터치 영역에서 옮김. Figma 변수 아님) */
  --border-width-1: 1px;
  --border-width-2: 2px;
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
  --icon-sm: 20px;
  --icon-md: 24px;
  --touch-min: 48px;
}

/* ${LAYOUT} (${mob}) */
@media (max-width: 767px) {
  :root {
${mobileLines.join('\n')}
  }
}

/* 글자 스타일 (RE:FIT v3/*) */
${textClasses.join('\n\n')}
`;

writeFileSync(output, css);
console.log(`Figma 변수 ${figmaTotal}개 -> CSS 변수 ${cssTotal}개 (${Object.entries(counts).map(([k, v]) => `${k.replace('RE:FIT v3 ', '')} ${v}`).join(', ')})`);
console.log(`모바일 재정의 ${mobileLines.length}개, 글자 스타일 ${styleCount.text}, 그림자 ${styleCount.shadow}, 블러 ${styleCount.blur}, 그라디언트 ${styleCount.gradient}`);
if (figmaTotal !== cssTotal) {
  console.error('토큰 수가 다름');
  process.exit(1);
}
