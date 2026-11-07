// 시드 SQL을 마이그레이션 적용한 빈 DB(PGlite)에 넣어 본다. 실행: npm run test:db (python3, unzip 필요)
// 원격 DB에는 연결하지 않는다.
import { PGlite } from '@electric-sql/pglite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'refit-seed-'));
try {
  execFileSync('unzip', ['-q', path.join(root, 'data/refit_demo_data.zip'), '-d', tmp]);
  execFileSync('python3', ['-I', path.join(root, 'scripts/seed.py'), path.join(tmp, 'demo'), path.join(tmp, 'out'), '--reset'], { stdio: 'ignore' });

  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
  const mig = path.join(root, 'supabase/migrations');
  for (const f of fs.readdirSync(mig).filter(f => f.endsWith('.sql')).sort())
    await db.exec(fs.readFileSync(path.join(mig, f), 'utf8').replace(/^create extension if not exists pgcrypto;$/m, ''));
  for (const f of fs.readdirSync(path.join(tmp, 'out')).sort())
    await db.exec(fs.readFileSync(path.join(tmp, 'out', f), 'utf8'));

  const one = async sql => Object.values((await db.query(sql)).rows[0])[0];
  ok(await one(`select count(*)::int from factories`) === 1234, 'factories 1,234');
  ok(await one(`select round(sum(weight))::int from flows`) === 4575, 'flows weight 4,575');
  ok(await one(`select count(*)::int from waste_chips where waste_types is null`) === 0, 'every chip has waste_types');
  ok(await one(`select round(sum(f.weight))::int from flows f join waste_chips c on f.waste_type = any(c.waste_types) and f.waste_group = c.waste_group where c.id = 'C01'`) === 1209,
    'C01 reports by waste_types = 1,209');
  const hs = (await db.query(`select chip_id, name, reports, burn_factories, recycle_factories, both_factories, in_ansan_pct from home_waste_stats order by chip_id`)).rows;
  const truth = JSON.parse(fs.readFileSync(path.join(root, 'data/home_waste_stats.json'), 'utf8'));
  ok(hs.length === 4 && hs.map(r => r.chip_id).join() === 'C01,C02,C03,C04', 'home_waste_stats 4 chips');
  ok(hs.every(r => ['reports', 'burn_factories', 'recycle_factories', 'both_factories', 'in_ansan_pct'].every(k => truth[r.name][k] === r[k])),
    'home_waste_stats equals data/home_waste_stats.json');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
