"""칩별 집계 기준(waste_types)과 홈 칩 통계를 demo CSV에서 다시 만든다.

사용:
  unzip -q data/refit_demo_data.zip -d /tmp/refit   # → /tmp/refit/demo
  python3 -I scripts/home_waste_stats.py /tmp/refit/demo data/

출력(저장소에 커밋, scripts/seed.py가 읽음):
  data/chip_waste_types.json  칩 17개 → 신고 원 표기(flows.waste_type) 목록
  data/home_waste_stats.json  홈 칩 4개 통계(research/waste/demo/home_waste_stats.json과 같은 값)

집계 기준: C01~C03은 신고 원 표기 한 종류, 나머지 칩은 그 폐기물군의 원 표기 전부(폐유 = 폐유 묶음 전체).
값은 신고 건수 집계만. 추정, 환산 없음.
"""
import csv, json, pathlib, sys

PERIOD = '2026-07'
EXACT = {  # 홈 칩과 결과 화면이 같은 숫자를 쓰도록 원 표기 한 종류로 고정
    'C01': '폐합성수지류(폐염화비닐수지류는 제외한다)',
    'C02': '폐수처리오니',
    'C03': '폐활성탄',
}
HOME = {'폐합성수지': 'C01', '폐수처리오니': 'C02', '폐활성탄': 'C03', '폐유': 'C04'}  # 홈 칩 이름 → chip_id
BASIS = ('신고 건수 집계, 안산시 폐기물 배출자 신고현황 2026-07. 폐유는 폐유 묶음 전체, 나머지는 신고 원 표기 한 종류. '
         '공장 수는 해당 처리방식 링크가 하나라도 있는 고유 factory_id. '
         '비율(_pct)은 링크 weight(신고 1건에 처리업체 k곳이면 1/k) 합을 그 칩의 전체 신고 수(weight 총합, region 미확인 포함)로 나눈 값. '
         'in_ansan_pct는 in_ansan=True, outside_gyeonggi_pct는 region=경기 밖, recycle_pct는 method=물질재활용(다른 폐기물군 허가 포함), burn_pct는 method가 소각 또는 에너지회수. '
         '복수 허가, 미확인 방식은 어느 쪽에도 넣지 않음')


def read(path):
    return list(csv.DictReader(open(path, encoding='utf-8-sig', newline='')))


def chip_waste_types(flows, chips):
    out = {}
    for c in chips:
        group_types = sorted({r['waste_type'] for r in flows if r['waste_group'] == c['waste_group'] and r['waste_type']})
        if c['id'] in EXACT:
            assert EXACT[c['id']] in group_types, (c['id'], 'exact type not in group')
            out[c['id']] = [EXACT[c['id']]]
        else:
            assert group_types, (c['id'], 'no flows for group')
            out[c['id']] = group_types
    return out


def home_stats(flows, types):
    def share(rs, pred, total):
        return round(100 * sum(float(r['weight']) for r in rs if pred(r)) / total, 1)
    out = {}
    for name, cid in HOME.items():
        allowed = set(types[cid])
        rs = [r for r in flows if r['waste_type'] in allowed]
        burn = {r['factory_id'] for r in rs if r['method'] in ('소각', '에너지회수')}
        rec = {r['factory_id'] for r in rs if r['method'] == '물질재활용'}
        n = len({r['flow_id'] for r in rs})
        W = sum(float(r['weight']) for r in rs)
        assert abs(W - n) < 1e-3
        out[name] = {'reports': n, 'burn_factories': len(burn), 'recycle_factories': len(rec),
                     'both_factories': len(burn & rec),
                     'in_ansan_pct': share(rs, lambda r: r['in_ansan'] == 'True', W),
                     'outside_gyeonggi_pct': share(rs, lambda r: r['region'] == '경기 밖', W),
                     'region_unknown_pct': share(rs, lambda r: r['region'] == '미확인', W),
                     'recycle_pct': share(rs, lambda r: r['method'] == '물질재활용', W),
                     'burn_pct': share(rs, lambda r: r['method'] in ('소각', '에너지회수'), W),
                     'basis': BASIS}
    return out


def main(src, out):
    src, out = pathlib.Path(src), pathlib.Path(out)
    flows = [r for r in read(src / 'flows.csv') if r['period'] == PERIOD]
    types = chip_waste_types(flows, read(src / 'waste_chips.csv'))
    json.dump(types, open(out / 'chip_waste_types.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(home_stats(flows, types), open(out / 'home_waste_stats.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in types.items()})


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
