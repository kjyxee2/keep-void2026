"""data/demo CSV와 summary.json을 참고 테이블 INSERT SQL로 만든다(명세 2-7).

사용:
  python3 -I scripts/seed.py data/demo out_dir/ [--reset]
  for f in out_dir/*.sql; do supabase db query --remote --yes -f "$f"; done   # 파일 이름 순 = FK 순

저장소 data/의 파생 파일도 함께 넣는다(scripts/home_waste_stats.py로 다시 만듦):
  data/chip_waste_types.json  → waste_chips.waste_types(칩 집계 기준, 신고 원 표기 목록)
  data/home_waste_stats.json  → home_waste_stats(홈 칩 통계 4행)

--reset: 데모 데이터를 새 버전으로 바꿀 때. 0_reset.sql이 참고 테이블을 비운다.
         앱 테이블(진단, 요청 등)에 행이 하나라도 있으면 예외를 내고 아무것도 지우지 않는다.

빈 칸은 NULL. 'True'/'False', JSON 문자열은 Postgres가 열 타입으로 변환한다.
테이블에 이미 행이 있으면 그 파일은 예외를 내고 아무것도 넣지 않는다(중복 시드 방지).
"""
import csv, json, pathlib, sys

DATA = pathlib.Path(__file__).resolve().parent.parent / 'data'

TABLES = ['factories', 'processors', 'flows', 'fit_candidates', 'group_fit', 'unit_prices',
          'waste_chips', 'volume_options']  # FK 순서(README 3절)
APP_TABLES = ['profiles', 'diagnoses', 'diagnosis_results', 'diagnosis_candidates', 'connection_requests',
              'request_events', 'group_memberships', 'demand_listings', 'events']
BATCH = 500
HOME_CHIPS = {'폐합성수지': 'C01', '폐수처리오니': 'C02', '폐활성탄': 'C03', '폐유': 'C04'}  # scripts/home_waste_stats.py HOME
HOME_COLS = ['reports', 'burn_factories', 'recycle_factories', 'both_factories', 'in_ansan_pct',
             'outside_gyeonggi_pct', 'region_unknown_pct', 'recycle_pct', 'burn_pct', 'basis']


def lit(v):
    return 'NULL' if v == '' else "'" + v.replace("'", "''") + "'"


def guard(t):
    return (f"do $$ begin if exists (select 1 from {t}) then "
            f"raise exception '{t} already seeded'; end if; end $$;\n")


def text_array(xs):
    return 'ARRAY[' + ','.join(lit(x) for x in xs) + ']::text[]'


def chip_types_sql(chip_ids):
    types = json.load(open(DATA / 'chip_waste_types.json', encoding='utf-8'))
    missing = set(chip_ids) ^ set(types)
    if missing:
        raise SystemExit(f'chip_waste_types.json과 waste_chips.csv의 칩이 다름: {sorted(missing)}')
    return ''.join(f"update waste_chips set waste_types = {text_array(types[c])} where id = {lit(c)};\n"
                   for c in chip_ids)


def home_stats_sql():
    stats = json.load(open(DATA / 'home_waste_stats.json', encoding='utf-8'))
    if set(stats) != set(HOME_CHIPS):
        raise SystemExit(f'home_waste_stats.json 칩 이름이 다름: {sorted(stats)}')
    vals = ',\n'.join('(' + ','.join([lit(HOME_CHIPS[name]), lit(name)] + [lit(str(v[c])) for c in HOME_COLS]) + ')'
                       for name, v in stats.items())
    return (f"begin;\n{guard('home_waste_stats')}"
            f"insert into home_waste_stats (chip_id,name,{','.join(HOME_COLS)}) values\n{vals};\ncommit;\n")


def reset_sql():
    checks = ' or '.join(f'exists (select 1 from {t})' for t in APP_TABLES)
    # 앱 테이블이 비었음을 확인했으므로 cascade는 참고 테이블만 비운다
    return (f"begin;\ndo $$ begin if {checks} then "
            f"raise exception 'app tables have rows; refusing to reset reference data'; end if; end $$;\n"
            f"truncate {', '.join(TABLES)}, home_waste_stats, app_summary cascade;\ncommit;\n")


def main(src, out, reset=False):
    src, out = pathlib.Path(src), pathlib.Path(out)
    out.mkdir(parents=True, exist_ok=True)
    if reset:
        (out / '00_reset.sql').write_text(reset_sql(), encoding='utf-8')
    for i, t in enumerate(TABLES, 1):
        rows = list(csv.reader(open(src / f'{t}.csv', encoding='utf-8-sig', newline='')))
        cols, body = rows[0], rows[1:]
        sql = ['begin;\n', guard(t)]
        for s in range(0, len(body), BATCH):
            vals = ',\n'.join('(' + ','.join(map(lit, r)) + ')' for r in body[s:s + BATCH])
            sql.append(f"insert into {t} ({','.join(cols)}) values\n{vals};\n")
        if t == 'waste_chips':
            sql.append(chip_types_sql([r[cols.index('id')] for r in body]))
        sql.append('commit;\n')
        (out / f'{i:02d}_{t}.sql').write_text(''.join(sql), encoding='utf-8')
        print(f'{t}: {len(body)} rows')
    (out / f'{len(TABLES) + 1:02d}_home_waste_stats.sql').write_text(home_stats_sql(), encoding='utf-8')
    print('home_waste_stats: 4 rows')
    summary = json.dumps(json.load(open(src / 'summary.json', encoding='utf-8')), ensure_ascii=False)
    (out / f'{len(TABLES) + 2:02d}_app_summary.sql').write_text(
        f"insert into app_summary (id, data) values (1, {lit(summary)}::jsonb)\n"
        f"on conflict (id) do update set data = excluded.data;\n", encoding='utf-8')
    print('app_summary: 1 row')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], '--reset' in sys.argv[3:])
