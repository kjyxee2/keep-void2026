"""공공데이터 15170508의 '기본값 좌표'(서로 다른 주소가 똑같이 쓰는 좌표)를 찾고 지운다.

배경: 원본 2026-04-30판에서 사업장 37곳, 106행이 원시동 산단로68번길 도로 위의 한 점
(37.3050261, 126.7939087)을 같이 쓴다. 주소는 해안로, 시우로, 시화로 등으로 모두 다르다.
상호와 도로명주소가 맞는다는 이유로 이 값이 확인 좌표로 들어가면 지도에서 겹치고,
거리와 공동 수거 묶음이 틀어진다.

규칙: 소수점 6자리로 반올림한 같은 좌표를 서로 다른 '도로명+건물번호'가 --min개 이상
(기본 2) 쓰면 기본값으로 본다. 같은 건물에 입주한 사업장(주소가 같음)은 영향 없음.

사용:
  python3 -I scripts/placeholder_coords.py find  원본.csv              # 의심 좌표 목록
  python3 -I scripts/placeholder_coords.py clean 원본.csv 정제.csv     # 의심 좌표만 비운 원본 → 빌드 입력으로
  python3 -I scripts/placeholder_coords.py check factories.csv         # 빌드 결과 검사, 있으면 exit 1
  python3 -I scripts/placeholder_coords.py selftest
옵션: --min N (기본 2)
"""
import collections, csv, re, sys

RAW = ('위도', '경도', '소재지도로명주소')            # 15170508 원본 열
BUILT = ('lat', 'lng', 'address')                     # data/demo/factories.csv 열


def addr_key(a):
    """'경기도 … 시우로 92-19, 3층 (초지동)' → '경기도 … 시우로 92-19'"""
    return re.sub(r'\s+', ' ', re.split(r'[,(]', a or '')[0]).strip()


def coord(r, cols):
    try:
        return round(float(r[cols[0]]), 6), round(float(r[cols[1]]), 6)
    except (ValueError, TypeError):
        return None


def suspicious(rows, cols, min_addresses=2):
    """{좌표: 그 좌표를 쓰는 서로 다른 주소 집합} 중 min_addresses개 이상인 것"""
    by = collections.defaultdict(set)
    for r in rows:
        c = coord(r, cols)
        if c:
            by[c].add(addr_key(r[cols[2]]))
    return {c: a for c, a in by.items() if len(a) >= min_addresses}


def read(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def report(bad, rows, cols):
    for c, addrs in sorted(bad.items(), key=lambda x: -len(x[1])):
        n = sum(1 for r in rows if coord(r, cols) == c)
        print(f'{c[0]}, {c[1]}  서로 다른 주소 {len(addrs)}개, {n}행')
        for a in sorted(addrs)[:5]:
            print(f'    {a}')
        if len(addrs) > 5:
            print(f'    … 외 {len(addrs) - 5}개')


def main(argv):
    mn = 2
    if '--min' in argv:
        i = argv.index('--min')
        mn = int(argv[i + 1])
        del argv[i:i + 2]
    cmd, *args = argv or ['help']

    if cmd == 'find':
        rows = read(args[0])
        bad = suspicious(rows, RAW, mn)
        report(bad, rows, RAW)
        print(f'의심 좌표 {len(bad)}곳')
    elif cmd == 'clean':
        rows = read(args[0])
        bad = suspicious(rows, RAW, mn)
        cleared = 0
        for r in rows:
            if coord(r, RAW) in bad:
                r[RAW[0]] = r[RAW[1]] = ''
                cleared += 1
        with open(args[1], 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.DictWriter(f, fieldnames=rows[0].keys())
            w.writeheader()
            w.writerows(rows)
        print(f'의심 좌표 {len(bad)}곳, {cleared}행의 위도/경도를 비움 → {args[1]}')
    elif cmd == 'check':
        rows = [r for r in read(args[0]) if r.get('coord_verified', 'True') in ('True', 'true', '1')]
        bad = suspicious(rows, BUILT, mn)
        if bad:
            report(bad, rows, BUILT)
            print(f'FAIL: 확인 좌표 중 기본값 의심 {len(bad)}곳')
            return 1
        print('OK: 서로 다른 주소가 같은 확인 좌표를 쓰는 경우 없음')
    elif cmd == 'selftest':
        rows = [
            {'위도': '37.3050261', '경도': '126.7939087', '소재지도로명주소': '경기도 안산시 단원구 시우로 92-19 (초지동)'},
            {'위도': '37.30502606', '경도': '126.7939087', '소재지도로명주소': '경기도 안산시 단원구 해안로 121, 2층 (목내동)'},
            {'위도': '37.3200000', '경도': '126.7500000', '소재지도로명주소': '경기도 안산시 단원구 A로 1 (성곡동)'},
            {'위도': '37.3200000', '경도': '126.7500000', '소재지도로명주소': '경기도 안산시 단원구 A로 1, 101호 (성곡동)'},
            {'위도': '', '경도': '', '소재지도로명주소': '경기도 안산시 단원구 B로 2'},
        ]
        bad = suspicious(rows, RAW)
        assert list(bad) == [(37.305026, 126.793909)], bad          # 반올림하면 같은 점, 주소 2개
        assert (37.32, 126.75) not in bad                             # 같은 건물 입주는 정상
        assert addr_key('경기도 안산시 단원구 시우로 87 (초지동,12블럭 14롯트)') == '경기도 안산시 단원구 시우로 87'
        assert not suspicious(rows, RAW, 3)
        print('selftest OK')
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
