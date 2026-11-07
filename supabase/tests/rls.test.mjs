// 마이그레이션 + RLS 검증 (Docker 없이 PGlite). 실행: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const db = new PGlite();
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
// Supabase 환경 흉내: auth 스키마, anon/authenticated 역할
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
`);
// migrations/ 전체를 파일명 순서대로. PGlite에는 pgcrypto가 없어 그 줄만 건너뜀(gen_random_uuid는 내장)
const dir = new URL('../migrations/', import.meta.url);
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort())
  await db.exec(fs.readFileSync(new URL(f, dir), 'utf8').replace(/^create extension if not exists pgcrypto;$/m, ''));
await db.exec(`insert into factories (id,name) values ('F0001','f'); insert into processors (id,name) values ('P0001','p1'),('P0002','p2'); insert into group_fit (group_id) values ('G0001');`);
const A='00000000-0000-0000-0000-00000000000a', B='00000000-0000-0000-0000-00000000000b', P='00000000-0000-0000-0000-00000000000c';
await db.exec(`
insert into auth.users values ('${A}','{"name":"A"}'),('${B}','{}'),('${P}','{}');
update profiles set role='processor', processor_id='P0001' where id='${P}';
insert into waste_chips (id,label,waste_group) values ('plastic','폐합성수지','폐합성수지류');
insert into diagnoses (id,user_id,chip_id) values ('10000000-0000-0000-0000-000000000001','${A}','plastic'),('10000000-0000-0000-0000-000000000002','${B}','plastic');
insert into connection_requests (diagnosis_id,processor_id,user_id,contact_phone) values
 ('10000000-0000-0000-0000-000000000001','P0001','${A}','010'),('10000000-0000-0000-0000-000000000002','P0002','${B}','011');
`);
ok((await db.query(`select count(*)::int n from profiles`)).rows[0].n===3, 'signup trigger creates profiles');
const as = async (role, uid, sql) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid??''}',false); set role ${role};`); try { return (await db.query(sql)).rows; } finally { await db.exec('reset role'); } };
const fails = async (role, uid, sql) => { try { await as(role, uid, sql); return false; } catch { return true; } };
ok((await as('anon',null,`select * from waste_chips`)).length===1, 'anon reads chips');
ok((await as('anon',null,`select * from processors`)).length===2, 'anon reads reference tables');
ok((await as('anon',null,`update processors set name='x' returning id`)).length===0, 'anon cannot update reference tables');
ok(await fails('authenticated',A,`insert into factories (id,name) values ('F9','x')`), 'user cannot insert reference rows');
ok((await as('anon',null,`select * from diagnoses`)).length===0, 'anon sees no diagnoses');
ok((await as('anon',null,`select * from connection_requests`)).length===0, 'anon sees no requests');
ok((await as('authenticated',A,`select * from diagnoses`)).length===1, 'A sees only own diagnosis');
ok(await fails('authenticated',A,`update profiles set role='operator' where id='${A}'`), 'A cannot self-promote role');
ok((await as('authenticated',A,`update profiles set display_name='x' where id='${A}' returning id`)).length===1, 'A can edit display_name');
ok((await as('authenticated',A,`update profiles set display_name='x' where id='${B}' returning id`)).length===0, 'A cannot edit B profile');
ok((await as('authenticated',P,`select contact_phone from connection_requests`)).map(r=>r.contact_phone).join()==='010', 'processor sees only own requests');
ok((await as('authenticated',P,`update connection_requests set status='contacted' returning id`)).length===1, 'processor updates status of own');
ok(await fails('authenticated',P,`update connection_requests set contact_phone='x'`), 'processor cannot edit other columns');
ok((await as('authenticated',A,`update connection_requests set status='contracted' returning id`)).length===0, 'user cannot change own request status');
ok(await fails('authenticated',A,`insert into events (user_id,name) values ('${B}','x')`), 'cannot log events as other user');
ok((await as('authenticated',A,`update diagnoses set current_method='소각', lat=37.3, weight_kg_per_month=2000, weight_source='계량표' where id='10000000-0000-0000-0000-000000000001' returning id`)).length===1, 'A edits own diagnosis inputs');
for (const col of ["completed_at=now()", "status='completed'", "anon_token='x'", "user_id='${B}'", "waste_group='x'"])
  ok(await fails('authenticated',A,`update diagnoses set ${col} where id='10000000-0000-0000-0000-000000000001'`), `A cannot set diagnoses.${col.split('=')[0]}`);
ok((await as('authenticated',A,`insert into group_memberships (group_id,diagnosis_id,user_id) values ('G0001','10000000-0000-0000-0000-000000000001','${A}') returning id`)).length===1, 'A joins group with own diagnosis');
ok(await fails('authenticated',A,`insert into group_memberships (group_id,diagnosis_id,user_id) values ('G0001','10000000-0000-0000-0000-000000000002','${A}')`), 'A cannot join with B diagnosis');
ok(await fails('authenticated',A,`update group_memberships set diagnosis_id='10000000-0000-0000-0000-000000000002' where user_id='${A}'`), 'A cannot repoint membership to B diagnosis');
await db.exec(`update profiles set role='operator' where id='${B}'`);
ok((await as('authenticated',B,`select * from diagnoses`)).length===2, 'operator sees all diagnoses');
ok(Math.abs((await db.query(`select haversine_km(37.3234,126.7875,37.3108,126.8308) d`)).rows[0].d - 4.07) < 0.1, 'haversine ~4km');
