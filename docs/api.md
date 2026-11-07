# RE:FIT API (P0)

Next.js Route Handler(`app/api/`). 모든 응답은 JSON. 데이터 기준: 데모 데이터 `demo-4d8c270` (`data/demo/README.md`).

**원칙**: 공개 자료 원값, 신고 건수 집계, 사용자가 입력한 값만 보여 준다. 서버는 금액(절감액, 처리비 추정)을 만들지 않는다. 응답의 `labels`를 화면에 그대로 붙인다.

## 공통

| 항목 | 내용 |
|---|---|
| 비회원 인증 | `POST /api/diagnoses` 응답의 `anon_token`을 브라우저에 저장(localStorage 등). 그 진단과 요청에 대한 호출마다 헤더 `x-anon-token: <anon_token>`. **토큰은 이때 한 번만 내려 준다**(DB에는 해시만 저장) |
| 로그인 사용자 | `Authorization: Bearer <Supabase access_token>` (선택. 운영자 API는 필수) |
| 오류 | `{ "error": "메시지" }`. 400 입력 오류, 403 권한 없음, 404 없음, 409 상태 충돌, 422 완료에 필요한 입력 없음, 500 DB 오류 |
| 거리 | 공장과 처리업체 좌표가 **모두 건물 위치로 확인된 경우만** 숫자. 아니면 `null` → 화면은 "거리 정보 없음" |
| 캐시 | `GET /api/map`, `/api/chips`, `/api/home-stats`, `/api/dashboard`의 성공 응답은 `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`(Vercel CDN 1시간, 그 뒤 하루는 옛 값을 주며 갱신). 대시보드 `app` 집계도 최대 1시간 늦을 수 있다. 오류 응답과 진단, 요청 API는 캐시하지 않는다 |
| 비율 | 신고 건수 집계(톤수 아님). `reports`는 신고 행 수(한 신고에 업체가 k곳이면 1/k씩) |
| 칩 집계 기준 | 결과의 `current_route`, `neighbors`는 칩의 **신고 원 표기**(`waste_chips.waste_types`)로 센다. 홈 칩 통계(`GET /api/home-stats`)와 같은 숫자. C01 폐합성수지 `폐합성수지류(폐염화비닐수지류는 제외한다)`, C02 `폐수처리오니`, C03 `폐활성탄`, 나머지 칩은 그 폐기물군의 원 표기 전부(폐유 = 폐유 묶음 전체). 추천 후보(`candidates`)는 README fit_score 규칙대로 **폐기물군** 신고 경로로 계산(`fit_candidates`와 같은 기준) |

## 진단 흐름

```
GET  /api/chips                       품목 칩, 선택지
POST /api/diagnoses                   { chip_id } → { id, anon_token }
GET  /api/home-stats                  홈 칩 4개 통계
GET  /api/factories/search?q=         (선택) 우리 공장 찾기
GET  /api/groups?factory_id=|diagnosis_id=   같이 맡기기 묶음
PATCH /api/diagnoses/:id              단계마다 입력 저장
POST /api/diagnoses/:id/complete      결과 계산, 저장, 반환
GET  /api/diagnoses/:id               결과 다시 보기 / 공유 링크
POST /api/requests                    추천 업체에 연결 요청
POST /api/requests/:id/cancel         요청 취소
```

### GET /api/chips

```json
{
  "chips": [{ "id": "C01", "label": "폐합성수지", "waste_group": "폐합성수지류",
              "waste_types": ["폐합성수지류(폐염화비닐수지류는 제외한다)"],
              "container": "PP 마대(KS 규격 없음)", "unit_kg": null, "basis": "공식 환산 근거 없음",
              "display_text": "PP 마대 개수로는 무게를 계산하지 않아요. …", "source": "…", "source_url": "…" }],
  "volume_options": [{ "id": "V1", "label": "1개", "min_count": 1, "max_count": 1, "representative_count": 1, "note": "…" }],
  "weight_sources": ["계량표", "올바로 인계서", "기타"],
  "current_methods": ["소각", "매립", "에너지회수", "모름"],
  "labels": { "volume_options": "용기 개수는 참고 정보. 공식 환산 근거가 없어 무게로 바꾸지 않음" }
}
```
칩 17개. 무게 입력 안내는 `display_text`를 **그대로** 보여 준다.

### GET /api/factories/search?q=디와이

`q` 2자 이상(50자까지). 사업장명 또는 주소 부분 일치, 이름순 최대 10개. `(주)`, `㈜`, 괄호, 점, 쉼표가 든 입력도 글자 그대로 찾는다(`(주)`와 `㈜`는 서로 바꿔서도 찾음). `%`, `_`는 와일드카드가 아니라 글자로 찾고 `*`는 지운다.
```json
{ "factories": [{ "id": "F0001", "name": "주식회사 디와이코스메틱", "address": "…", "dong": "성곡동",
                  "waste_groups": ["폐합성수지류"], "n_waste_types": 1, "coord_verified": null }] }
```
`n_waste_types`는 그 공장이 신고한 폐기물 종류(원 표기) 수. 화면은 "신고 종류 N개"로 그대로 쓴다.

### POST /api/diagnoses → 201

요청 `{ "chip_id": "C01" }` → 응답 `{ "id": "uuid", "anon_token": "…" }`

### PATCH /api/diagnoses/:id (x-anon-token)

보낼 수 있는 필드만(나머지는 400). 여러 번 나눠 보내도 된다. **draft 진단만** 수정되고 완료된 진단은 409(수정 도중 완료된 경우도 409). DB 정책도 같다: 로그인 사용자의 직접 수정(RLS `own_update`)은 `status = 'draft'`일 때만.

| 필드 | 값 |
|---|---|
| `weight_kg_per_month` | 0보다 큰 kg. **완료에 필수** |
| `weight_source` | `계량표`, `올바로 인계서`, `기타` |
| `current_method` | `소각`, `매립`, `에너지회수`, `모름`. **완료에 필수** |
| `current_cost_won_per_month` | 청구서 처리비(원, 0 이상 정수). 선택 |
| `current_price_won_per_ton` | 지금 내는 톤당 처리 단가(원/톤, 0 이상 10억 이하 정수). 선택. 공개 단가 옆에 그대로 보여 주기만 하고 계산에 쓰지 않음 |
| `factory_id` | 공장 찾기에서 고른 id. 선택 |
| `lat`, `lng` | 함께 보내야 함. 선택 |
| `location_source` | `주소`, `현재위치`, `신고공장` |
| `volume_option_id` | 용기 개수 선택(참고 정보). 선택 |

응답은 저장된 진단 행.

### POST /api/diagnoses/:id/complete (x-anon-token)

본문 없음. 한 번만 가능(두 번째는 409, 그 뒤로는 GET 사용). 중간에 실패해 다시 부르면 이전 시도의 후보를 지우고 새로 넣는다. 응답 예(실제 데이터, F0001, 폐합성수지):

```json
{
  "diagnosis_id": "uuid", "status": "completed", "completed_at": "…", "data_version": "demo-4d8c270",
  "waste_group": "폐합성수지류",
  "user_input": {
    "chip": { "id": "C01", "label": "폐합성수지", "display_text": "…" },
    "volume_option": { "id": "V2", "label": "2~4개" },
    "weight_kg_per_month": 2000, "weight_source": "계량표", "current_method": "소각",
    "current_cost_won_per_month": 550000, "current_price_won_per_ton": 260000, "factory_id": "F0001", "lat": null, "lng": null, "location_source": "신고공장"
  },
  "current_route": {
    "total_reports": 1209,
    "by_method": [{ "method": "소각", "reports": 460.3, "pct": 38.1 },
                  { "method": "중간가공(R10)", "reports": 262.3, "pct": 21.7 },
                  { "method": "물질재활용", "reports": 163.5, "pct": 13.5 }],
    "by_region": [{ "region": "경기 기타", "reports": 430.5, "pct": 35.6 },
                  { "region": "안산", "reports": 378.5, "pct": 31.3 },
                  { "region": "경기 밖", "reports": 193.0, "pct": 16.0 }],
    "basis": "신고 건수 집계(톤수 아님). 칩의 신고 원 표기 기준(홈 칩 통계와 같음). …"
  },
  "neighbors": { "recycling": 125, "burning": 445, "burning_methods": ["소각", "에너지회수"], "basis": "…" },
  "candidates": [
    { "candidate_id": 1, "rank": 1, "processor_id": "P0025", "name": "(주)거단산업", "sigungu": "평택시",
      "fit_score": 67.6, "neighbors": 28, "distance_km": null, "distance_quality": null,
      "confirmed": true, "confirm_status": "확인(2023 전국 처리업체 현황)",
      "source": "fit_candidates", "note": "업체 확인 필요" }
  ],
  "ranking": { "current_method_used": "소각", "inferred_from_reports": false, "rule": "data/demo/README.md fit_score" },
  "reference_prices": [
    { "id": "U035", "category": "고시 처리단가", "item": "폐합성수지", "method": "재활용업자",
      "price_won": 269000, "unit": "원/톤", "year": 2022,
      "note": "방치폐기물 처리이행보증보험금 산출용 단가. 실제 위탁 거래가가 아님", "year_label": "2022 적용",
      "…": "unit_prices 원문 열 전부" }
  ],
  "labels": {
    "route": "신고 건수 집계(톤수 아님). 신고 계약 기준이며 실제 운반량이 아님",
    "neighbors": "같은 폐기물군을 신고한 안산 공장 수(신고 건수 기준)",
    "candidates": "신고 경로 근거 추천, 실제 처리 가능 여부는 업체 확인 필요",
    "distance": "양쪽 좌표가 건물 위치로 확인된 경우만 직선거리, 아니면 null",
    "reference_prices": "원문 단가 그대로. 실제 계약가 아님, 무게와 곱하지 않음. 부가세와 운반비 별도"
  }
}
```
(배열은 앞 3개만 보임)

화면 규칙:
- `current_route.total_reports`와 `neighbors`는 홈 칩 통계와 같은 숫자다(폐합성수지 1,209건, 소각 445곳, 재활용 125곳). `neighbors`는 **본인 공장을 포함**한 안산 공장 수(홈 칩 통계와 같은 기준). 칩의 신고가 있는 공장 수이므로 본인 공장이 그 방식으로 신고했다면 본인도 들어 있다
- `candidates`는 최대 3개, 0개일 수 있음(의료폐기물, "그 밖의 폐기물", 근거 경로 없음). `neighbors`는 "이웃 공장 N곳이 이 업체에 재활용으로 보냄"(사회적 증거). `note` 문구 필수
- 후보 업체의 처리 방식(`processors.method`)이 `에너지회수`, `소각`, `매립`, `복수 허가`, `미확인`이면 넣지 않는다(원료 재활용 업체만 추천)
- `source`: `fit_candidates`(신고 공장을 골랐고 근거 목록이 있음) 또는 `computed`(같은 규칙으로 서버 계산)
- `ranking.inferred_from_reports = true`면 사용자가 "모름"을 골라서 신고 경로에서 가장 많은 방식으로 순위를 매긴 것
- `reference_prices`는 표로 원문 그대로. **입력한 무게와 곱해서 금액을 보여 주지 말 것**
- `reference_prices` 고르는 규칙(`lib/fit.ts` `referencePriceIds`, `NOTICE_ITEMS`, id 순):
  - **고시 처리단가는 칩 폐기물을 가리키는 행을 모두 넣는다.** 칩마다 `unit_prices.item` 원문을 아래 표로 고정하고 문자열이 완전히 같은 `고시 처리단가` 행만 고른다(부분 일치, 유사 일치 없음). 같은 item이 2022 적용분과 2027-01-01 시행분(기후에너지환경부고시 제2026-67호)에 모두 있어 두 해가 함께 나온다
  - 공제조합 소각처리단가(일반, 지정, 건설): 칩 폐기물군과 `waste_group`이 같은 행 전부. C01만 결정 3대로 U161(2021 일반) 하나
  - 공제조합 소각 행이 하나라도 있으면(소각 비교) U176(민간 소각 평균)을 더한다. U177(민간 매립 평균), 지정 공공처리시설 반입수수료, 운반비는 넣지 않는다
  - 각 행에 `year_label`을 붙인다: 고시 2022 → `"2022 적용"`, 고시 2027 → `"2027 시행"`, 나머지 → `"2021년"`처럼 연도. 화면은 고시 두 해를 이 값으로 나눠 보여 줄 것(2027 값은 아직 시행 전)

  | 칩 | 고시 item 원문(`unit_prices.item`) | 나오는 id |
  | --- | --- | --- |
  | C01 폐합성수지 | 폐유, 폐유기용제(비할로겐족), 폐합성수지, 폐합성고무 / 폐합성수지 | U001, U035, U060, U096, U161, U176 |
  | C02 폐수처리오니 | 소각대상 오니류, 기타 소각대상 사업장일반폐기물 / 무기성 (폐수처리)오니 / 유기성 (폐수처리)오니 / 유기성오니 | U009, U022, U023, U058, U068, U083, U084, U119, U170, U171, U176 |
  | C03 폐활성탄 | 폐흡수재, 폐흡착재 | U047, U108, U172, U173, U176 |
  | C04 폐유 | 폐유, 폐유기용제(비할로겐족), 폐합성수지, 폐합성고무 / 폐윤활유 / 폐오일필터 / 폐유(폐윤활유가 혼합된 경우 포함) | U001, U018, U026, U039, U060, U077, U087, U100, U148, U149, U150, U151, U176 |
  | C05 폐유기용제 | 폐유, 폐유기용제(비할로겐족), 폐합성수지, 폐합성고무 / 폐유기용제(할로겐족) / 폐유기용제(기타) | U001, U002, U016, U017, U060, U061, U075, U076, U152~U155, U176 |
  | C06 분진 | 분진(일반) / 분진(지정) | U033, U034, U094, U095 |
  | C07 소각재 | 소각잔재물, 연소재(일반) / 소각잔재물, 연소재(지정) | U040, U041, U101, U102 |
  | C08 폐목재 | 폐목재 / 폐유리, 폐목재중 톱밥 | U024, U052, U085, U113, U164, U165, U176 |
  | C09 폐내화물, 도자기편 | 폐내화물, 도자기편류 | U042, U103 |
  | C10 동식물성 잔재물 | 동물성잔재물 / 식물성잔재물 / 폐식용유 / 음식물류폐기물 / 폐가죽류(가죽스크랩) / 폐가죽류(피혁가공잔재물) | U014, U015, U037, U049, U050, U053, U055~U057, U073, U074, U098, U110, U111, U114, U116~U118, U166~U169, U176 |
  | C11 폐페인트, 폐락카 | 폐페인트 및 폐락카 / 폐페인트 | U003, U030, U062, U091, U158, U159, U176 |
  | C12 폐유리 | 폐유리, 폐목재중 톱밥 | U024, U085 |
  | C13 광재 | 폐광재(지정폐기물) / 광재(일반) / 광재(지정) / 철강슬래그 | U008, U031, U032, U045, U067, U092, U093, U106 |
  | C14 폐토사 | 없음(해당 고시 행 없음) | 없음 |
  | C15 폐주물사, 폐사 | 폐주물사, 폐사 | U046, U107 |
  | C16 폐산, 폐알칼리 | 폐산, 폐알칼리 | U007, U021, U066, U082 |
  | C17 폐섬유 | 폐합성섬유 / 폐섬유류 | U036, U048, U097, U109 |

  넣지 않은 고시 행: 폐플라스틱 용기(U028, U089, item에 폐합성수지가 없음), 폐지, 고철, 폐포장재(합성수지류 제외)(U059, U120), 매립대상 사업장일반폐기물(U010, U069), 건설폐기물 등 칩과 이어지지 않는 행
- `current_cost_won_per_month`, `current_price_won_per_ton`은 사용자가 넣은 값을 되돌려 줄 뿐 계산에 쓰지 않음(톤당 단가는 `reference_prices`의 `price_won`과 같은 단위 원/톤이라 나란히 비교만)

### GET /api/diagnoses/:id

완료된 진단만(아니면 404). `x-anon-token`이 맞으면 위와 같은 전체 응답, 없거나 틀리면 **공유 링크용**: `user_input`에서 `factory_id`, `lat`, `lng`, `location_source`, `current_cost_won_per_month`, `current_price_won_per_ton`을 뺀다. 카톡 공유 링크는 토큰 없이 이 주소를 연다.

### POST /api/requests → 201 (x-anon-token)

```json
{ "diagnosis_id": "uuid", "candidate_id": 1, "contact_name": "홍길동", "contact_phone": "010-1234-5678",
  "join_group": true, "kakao_notify": true }
```
`candidate_id`는 complete 응답의 `candidates[].candidate_id`. `join_group`, `kakao_notify` 기본값 true(공동 수거 옵트아웃). 같은 후보에 진행 중 요청이 있으면 409(동시에 보내도 DB 부분 유니크 인덱스가 막아 409).
응답: `{ id, diagnosis_id, candidate_id, processor_id, status: "requested", join_group, kakao_notify, sla_due_at, created_at, labels }` (연락처는 응답에 넣지 않음. 운영자와 해당 처리업체만 조회)

### POST /api/requests/:id/cancel (x-anon-token)

`requested`, `contacted`, `sample` 상태만 취소 가능(그 외 409). 응답 `{ id, status: "cancelled" }`

### PATCH /api/admin/requests/:id (운영자)

`Authorization: Bearer <운영자 access_token>` (`profiles.role = 'operator'`). 본문 `{ "status": "contacted", "note": "선택, 500자" }`.
status: `requested`, `contacted`, `sample`, `contracted`, `first_pickup`, `cancelled`, `rejected`. 변경은 `request_events`에 기록(내 공장 타임라인).

운영자 계정 만들기: Supabase Auth에서 사용자 생성 후 SQL Editor에서
`update profiles set role = 'operator' where id = '<user id>';`

## 홈: GET /api/home-stats

홈 폐기물 칩 4개 통계(결정 2). 시드 테이블 `home_waste_stats` 원값(`data/home_waste_stats.json`, 생성 `scripts/home_waste_stats.py`). 캐시 헤더 있음.
```json
{
  "chips": [
    { "chip_id": "C01", "name": "폐합성수지", "reports": 1209, "burn_factories": 445, "recycle_factories": 125, "both_factories": 75,
      "in_ansan_pct": 31.3, "outside_gyeonggi_pct": 16.0, "region_unknown_pct": 8.1, "recycle_pct": 13.5, "burn_pct": 49.3,
      "basis": "신고 건수 집계, 안산시 폐기물 배출자 신고현황 2026-07. …" },
    { "chip_id": "C02", "name": "폐수처리오니", "reports": 511, "burn_factories": 20, "recycle_factories": 121, "both_factories": 3, "…": "…" },
    { "chip_id": "C03", "name": "폐활성탄", "reports": 301, "burn_factories": 2, "recycle_factories": 218, "both_factories": 2, "…": "…" },
    { "chip_id": "C04", "name": "폐유", "reports": 306, "burn_factories": 107, "recycle_factories": 10, "both_factories": 7, "…": "…" }
  ],
  "labels": { "stats": "…", "factories": "…" }
}
```
- 집계 기준은 결과 화면과 같다(칩 신고 원 표기, 폐유는 묶음 전체). `reports`는 신고 수, `*_factories`는 그 방식 신고가 하나라도 있는 고유 공장 수, `*_pct`는 1/k 가중 합을 그 칩 전체 신고 수(지역 미확인 포함)로 나눈 값
- `chip_id`로 진단 시작(`POST /api/diagnoses { chip_id }`)에 그대로 쓴다

## 같이 맡기기 묶음: GET /api/groups

| 요청 | 인증 | 뜻 |
|---|---|---|
| `?factory_id=F0036&group=폐합성수지류` | 공개 | 그 공장이 든 묶음. `group`(폐기물군)을 빼면 그 공장의 모든 폐기물군 묶음 |
| `?diagnosis_id=uuid` | `x-anon-token`(본인 진단만, 아니면 403) | 진단의 `factory_id`와 `waste_group`으로 찾음. 진단에 공장이 없으면 `groups: []` |

```json
{
  "groups": [{
    "group_id": "G0158", "waste_group": "폐합성수지류", "match": "member",
    "center": [126.756603, 37.314273], "radius_km": 0.2, "n_factories": 10, "n_processors": 20,
    "points": [{ "coordinates": [126.754407, 37.313889], "self": false }, "…"],
    "label": "이 공장이 들어 있는 묶음"
  }],
  "labels": { "groups": "…", "radius": "…", "points": "…" }
}
```
- 값은 `group_fit` 원값: `center` = 중심(`centroid_lng, centroid_lat`), `radius_km` = `max_dist_km`(중심에서 가장 먼 공장까지), `n_factories` = `n`, `n_processors` = `n_distinct_processors`
- `points`: 묶음 공장 중 좌표 확인된 곳만 `[lng, lat]`. **공장 이름과 id는 넣지 않는다.** `self: true`는 요청한 공장
- `match: "dong"`: 공장 좌표가 확인되지 않아 묶음에 들 수 없는 경우, 같은 폐기물군에서 같은 동(`dongs`)을 가진 묶음 중 공장 수가 가장 많은 것(같으면 group_id 앞). `label`에 "동 기준"과 동 이름이 들어가므로 그대로 보여 준다. 이때 `self` 점은 없다
- 좌표가 확인됐지만 어느 묶음에도 없는 공장, 진단에 공장이 없는 경우는 `groups: []`
- 사용자 위치로 반경 안 묶음 찾기(`/api/groups/nearby`)와 참여(`/join`)는 아직 없음

## 지도: GET /api/map

| 요청 | 응답 |
|---|---|
| `?layer=factories` | 확인 좌표 공장 1,123곳 GeoJSON Point. properties: id, name, dong, waste_groups, `method` |
| `?layer=processors` | 확인 좌표 처리업체 32곳 Point + `unlocated`: 좌표 없는 771곳을 `{ sido, sigungu, count, processors: [...] }` 목록으로(많은 순) |
| `?layer=flows` | 공장→처리업체 LineString(양쪽 좌표 확인된 신고만). properties: factory_id, processor_id, method, reports. `coverage`: `{ total_reports: 4575, drawn_reports: 652, drawn_pct: 14.3 }` |
| `&group=폐유` | 세 레이어 모두 폐기물군으로 거르기 |

`method`(공장 점 모양, Figma 지도 설명 규칙): 그 공장의 신고 중 weight 합이 가장 많은 방식 묶음. `물질재활용` → `재활용`, `소각`과 `에너지회수` → `소각`, `매립` → `매립`, 나머지(중간가공, 복수 허가, 미확인 등) → `미확인`. 동률이면 재활용, 소각, 매립, 미확인 순. `&group=`이 있으면 그 폐기물군 신고로만 정하고, 없으면 모든 폐기물군 신고로 정한다(칩을 바꾸면 `group`을 바꿔 다시 받는다). 화면은 원 재활용, 사각 소각, 삼각 매립, 빈 원 미확인.

좌표는 `[lng, lat]`(GeoJSON 순서). 좌표 없는 곳은 지어서 그리지 않는다. `coverage.drawn_pct`를 지도에 함께 표시("신고 경로 중 14.3%만 위치 확인").

## 시 대시보드: GET /api/dashboard

```json
{
  "summary": { "region_pct": { "안산": 16.8, "…": "…" }, "burn_vs_material": { "…": "…" }, "official_stats_2024_ansan_ton": { "…": "…" } },
  "app": { "diagnoses_completed": 0, "requests_active": 0, "routes_switched_to_recycling": 0, "basis": "앱 실제 집계" },
  "labels": { "summary": "신고 건수 집계(톤수 아님) 또는 공식 통계 원값. 각 값의 basis 참고" }
}
```
`summary`는 `data/demo/summary.json` 그대로(키 설명은 README 2절). `routes_switched_to_recycling`은 연결 요청이 `contracted` 또는 `first_pickup`이 된 수.

## 서류 사진 자동 입력: POST /api/ocr/document

계량표(계근표, 계량증명서)나 올바로 전자인계서, 폐기물 인계서 사진에서 **인쇄된 값만** 읽어 돌려준다. 진단을 저장하지 않는다. 화면은 값과 근거 글자를 보여 주고 사용자가 확인한 뒤 `PATCH /api/diagnoses/:id`로 저장한다(컴포넌트 `components/diagnose/DocumentScan.tsx`, `onApply({ weight_kg, chip_id, processor_id })`).

요청: `multipart/form-data`

| 필드 | 값 |
|---|---|
| `image` | 사진 파일. JPG, PNG, WEBP. 파일 앞부분 바이트로 판별(확장자 무시). HEIC는 415 |
| `diagnosis_id` | 선택. 보내면 본인 진단인지 확인(`x-anon-token` 또는 로그인). 값은 저장하지 않음 |

응답 200:
```json
{
  "document_type": "인계서",
  "weight_kg": 2480, "weight_unit_raw": "톤",
  "waste_type_raw": "폐유", "processor_name_raw": "견본리사이클(주)", "transporter_name_raw": "견본운수(주)",
  "date_raw": "2026년 10월 15일",
  "confidence": { "weight_kg": 0.97, "waste_type_raw": 0.97, "processor_name_raw": 0.96 },
  "evidence": { "weight_kg": "인계량 2.48 톤", "waste_type_raw": "폐유", "processor_name_raw": "견본리사이클(주)",
                "transporter_name_raw": "견본운수(주)", "date_raw": "2026년 10월 15일" },
  "mapped": { "chip_id": "C04", "chip_label": "폐유", "processor_id": null, "processor_name": null },
  "diagnosis_id": null,
  "provider": { "name": "anthropic", "model": "claude-haiku-5-5" },
  "labels": { "values": "…", "weight": "…", "mapping": "…", "privacy": "사진은 저장하지 않음" }
}
```
(시험용 견본 `tests/fixtures/sample-handover.png`의 실제 결과)

규칙:
- 서류에 없는 값, 흐린 값은 `null`. 추정, 계산 없음(총중량에서 공차중량을 빼지 않음). 금액은 읽지 않음
- `weight_kg`: 서류에 `kg`이면 그대로, `톤`/`t`/`ton`이면 1000을 곱함(단위 환산만). 단위가 없거나 다른 단위(㎥, 마대 등)면 `null`이고 `weight_unit_raw`에 원문을 남김. `evidence.weight_kg`에 그 숫자가 보이지 않으면 `null`
- **서류 한 장의 무게**다. 진단의 `weight_kg_per_month`(한 달 무게)와 다를 수 있어 화면에서 확인받는다
- `mapped.chip_id`: `waste_type_raw`가 칩 `label`, 칩 `waste_group`, 신고 자료(`flows.waste_type`) 원 표기 중 하나와 정규화 후 정확히 같을 때만. 정규화는 NFKC, 소문자, 공백과 문장부호 제거
- `mapped.processor_id`: `processors.name` 또는 `name_variants`와 정규화 후 정확히 같을 때만(법인 표기 (주), 주식회사 등은 무시). 부분 일치, 유사도 매칭 없음. 같은 키가 두 곳 이상이면 `null`. 못 찾아도 `*_raw`는 그대로
- `confidence`는 모델이 매긴 0~1 값(참고용). 화면 안내: 0.85 이상 "또렷하게 읽음", 0.6 이상 "한 번 더 확인", 그 아래 "흐릿함, 꼭 확인"

오류(`{ "error": "한국어 안내" }`):

| 상태 | 언제 |
|---|---|
| 400 | `image` 없음, 빈 파일, `diagnosis_id` 형식 오류 |
| 403, 404 | `diagnosis_id`가 남의 진단이거나 없음 |
| 413 | 7.5MB 초과 |
| 415 | HEIC, 그 밖의 형식 |
| 422 | 모델이 거절, 결과가 잘림, JSON 아님 |
| 429 | IP당 1분 6장 초과(`Retry-After` 헤더) |
| 502, 504 | 모델 API 오류, 20초 초과 |
| 503 | `ANTHROPIC_API_KEY` 없음, 모델 API 인증 실패나 혼잡 → 화면은 직접 입력으로 안내 |

제한:
- 크기 7.5MB: Claude API 이미지 한도가 base64 기준 10MB라서(원본 7.5MiB = base64 10MiB). Vercel 함수 요청 본문은 4.5MB까지이므로 컴포넌트가 보내기 전에 브라우저에서 긴 변 2576px JPEG로 줄인다(서버에는 이미지 처리 라이브러리를 쓰지 않음)
- 시간 20초(`maxRetries: 0`), 요청 제한은 서버 인스턴스 메모리 기준 **최선 노력**이다. 서버리스 인스턴스마다 따로 세고 재시작하면 초기화된다. 남용이 보이면 공유 저장소 기반 제한으로 바꿀 것

개인정보:
- 사진은 메모리에서만 처리하고 저장하지 않는다(DB, 파일, 로그 모두). 로그에는 오류 종류와 상태 코드만 남기고 사진 바이트, 읽은 값, 모델 응답 본문은 남기지 않는다
- 사진은 Anthropic API로 전송된다(외부 처리). 모델에게 사람 이름, 전화번호, 차량번호, 주소를 옮겨 적지 말라고 지시하며 응답 스키마에도 그런 칸이 없다
- 키(`ANTHROPIC_API_KEY`)는 서버 Route Handler에서만 읽는다. 클라이언트 번들에 들어가지 않는다(`NEXT_PUBLIC_` 아님)

모델과 비용:
- 기본 `claude-haiku-5-5`(가장 싸고 빠른 이미지 지원 모델), `ANTHROPIC_OCR_MODEL`로 바꿀 수 있음. 구조화 출력(`output_config.format` JSON 스키마), `effort: low`
- 공급자는 `OCR_PROVIDER`(기본 `anthropic`, 지금은 이것만 구현). 스키마 검사, 톤 환산, 이름 연결은 공급자 밖 공통 코드(`lib/ocr/normalize.ts`, `mapping.ts`)
- 요금(claude-api 요금표, 2026-10-06 기준): Haiku 5.5 입력 $0.10, 출력 $0.50 / 100만 토큰(프롬프트 10만 토큰 이하). 이미지 토큰은 `⌈가로/28⌉ × ⌈세로/28⌉`, Claude 4.7 이후 모델은 긴 변 2576px, 최대 4,784토큰
- 실측(견본 1080×900, 2장): 입력 3,730토큰(이미지 약 1,290 + 지시문과 스키마), 출력 약 220토큰, 장당 약 $0.00048. 휴대폰 사진(최대 4,784 이미지 토큰)은 입력 약 7,200토큰, 장당 약 $0.0009
- 실시간 시험: `node scripts/ocr-live-test.mjs`(키가 없으면 건너뜀, 시험용 견본 2장만 보냄)

## 개발

```
npm run dev          # http://localhost:3000/api/chips
npm run test:api     # 순위 규칙, 경로 집계, 단가 규칙, 검색 필터, 묶음, 지도 방식, 서류 자동 입력(검사, 환산, 이름 연결), 실제 데모 데이터 값(1,209/445/125 등, unzip 필요)
npm run test:db      # 마이그레이션 + RLS, 시드 SQL 적용 확인 (PGlite, Docker 불필요, python3과 unzip 필요)
```
`.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`(서버 전용, 커밋 금지), `ANTHROPIC_API_KEY`(서버 전용, 커밋 금지. 없으면 서류 자동 입력만 503).
선택: `ANTHROPIC_OCR_MODEL`(기본 `claude-haiku-5-5`), `OCR_PROVIDER`(기본 `anthropic`). Vercel 프로젝트 환경변수에도 같은 이름으로 넣는다.
