"""data/demo CSV와 summary.json을 참고 테이블 INSERT SQL로 만든다(명세 2-7).

사용:
  python3 -I scripts/seed.py data/demo out_dir/ [--reset]
  for f in out_dir/*.sql; do supabase db query --remote --yes -f "$f"; done   # 파일 이름 순 = FK 순

--reset: 데모 데이터를 새 버전으로 바꿀 때. 0_reset.sql이 참고 테이블을 비운다.
         앱 테이블(진단, 요청 등)에 행이 하나라도 있으면 예외를 내고 아무것도 지우지 않는다.

빈 칸은 NULL. 'True'/'False', JSON 문자열은 Postgres가 열 타입으로 변환한다.
테이블에 이미 행이 있으면 그 파일은 예외를 내고 아무것도 넣지 않는다(중복 시드 방지).
"""
import csv, json, pathlib, sys

TABLES = ['factories', 'processors', 'flows', 'fit_candidates', 'group_fit', 'unit_prices',
          'waste_chips', 'volume_options']  # FK 순서(README 3절)
APP_TABLES = ['profiles', 'diagnoses', 'diagnosis_results', 'diagnosis_candidates', 'connection_requests',
              'request_events', 'group_memberships', 'demand_listings', 'events']
BATCH = 500


def lit(v):
    return 'NULL' if v == '' else "'" + v.replace("'", "''") + "'"


def guard(t):
    return (f"do $$ begin if exists (select 1 from {t}) then "
            f"raise exception '{t} already seeded'; end if; end $$;\n")


def reset_sql():
    checks = ' or '.join(f'exists (select 1 from {t})' for t in APP_TABLES)
    # 앱 테이블이 비었음을 확인했으므로 cascade는 참고 테이블만 비운다
    return (f"begin;\ndo $$ begin if {checks} then "
            f"raise exception 'app tables have rows; refusing to reset reference data'; end if; end $$;\n"
            f"truncate {', '.join(TABLES)}, app_summary cascade;\ncommit;\n")


def main(src, out, reset=False):
    src, out = pathlib.Path(src), pathlib.Path(out)
    out.mkdir(parents=True, exist_ok=True)
    if reset:
        (out / '0_reset.sql').write_text(reset_sql(), encoding='utf-8')
    for i, t in enumerate(TABLES, 1):
        rows = list(csv.reader(open(src / f'{t}.csv', encoding='utf-8-sig', newline='')))
        cols, body = rows[0], rows[1:]
        sql = ['begin;\n', guard(t)]
        for s in range(0, len(body), BATCH):
            vals = ',\n'.join('(' + ','.join(map(lit, r)) + ')' for r in body[s:s + BATCH])
            sql.append(f"insert into {t} ({','.join(cols)}) values\n{vals};\n")
        sql.append('commit;\n')
        (out / f'{i}_{t}.sql').write_text(''.join(sql), encoding='utf-8')
        print(f'{t}: {len(body)} rows')
    summary = json.dumps(json.load(open(src / 'summary.json', encoding='utf-8')), ensure_ascii=False)
    (out / f'{len(TABLES) + 1}_app_summary.sql').write_text(
        f"insert into app_summary (id, data) values (1, {lit(summary)}::jsonb)\n"
        f"on conflict (id) do update set data = excluded.data;\n", encoding='utf-8')
    print('app_summary: 1 row')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], '--reset' in sys.argv[3:])
