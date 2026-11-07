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
| 비율 | 신고 건수 집계(톤수 아님). `reports`는 신고 행 수(한 신고에 업체가 k곳이면 1/k씩) |

## 진단 흐름

```
GET  /api/chips                       품목 칩, 선택지
POST /api/diagnoses                   { chip_id } → { id, anon_token }
GET  /api/factories/search?q=         (선택) 우리 공장 찾기
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

`q` 2자 이상. 사업장명 또는 주소 부분 일치, 최대 10개.
```json
{ "factories": [{ "id": "F0001", "name": "주식회사 디와이코스메틱", "address": "…", "dong": "성곡동",
                  "waste_groups": ["폐합성수지류"], "coord_verified": true }] }
```

### POST /api/diagnoses → 201

요청 `{ "chip_id": "C01" }` → 응답 `{ "id": "uuid", "anon_token": "…" }`

### PATCH /api/diagnoses/:id (x-anon-token)

보낼 수 있는 필드만(나머지는 400). 여러 번 나눠 보내도 된다. 완료된 진단은 409.

| 필드 | 값 |
|---|---|
| `weight_kg_per_month` | 0보다 큰 kg. **완료에 필수** |
| `weight_source` | `계량표`, `올바로 인계서`, `기타` |
| `current_method` | `소각`, `매립`, `에너지회수`, `모름`. **완료에 필수** |
| `current_cost_won_per_month` | 청구서 처리비(원, 0 이상 정수). 선택 |
| `factory_id` | 공장 찾기에서 고른 id. 선택 |
| `lat`, `lng` | 함께 보내야 함. 선택 |
| `location_source` | `주소`, `현재위치`, `신고공장` |
| `volume_option_id` | 용기 개수 선택(참고 정보). 선택 |

응답은 저장된 진단 행.

### POST /api/diagnoses/:id/complete (x-anon-token)

본문 없음. 한 번만 가능(두 번째는 409, 그 뒤로는 GET 사용). 응답 예(실제 데이터, F0001, 폐합성수지):

```json
{
  "diagnosis_id": "uuid", "status": "completed", "completed_at": "…", "data_version": "demo-4d8c270",
  "waste_group": "폐합성수지류",
  "user_input": {
    "chip": { "id": "C01", "label": "폐합성수지", "display_text": "…" },
    "volume_option": { "id": "V2", "label": "2~4개" },
    "weight_kg_per_month": 2000, "weight_source": "계량표", "current_method": "소각",
    "current_cost_won_per_month": 550000, "factory_id": "F0001", "lat": null, "lng": null, "location_source": "신고공장"
  },
  "current_route": {
    "total_reports": 1326,
    "by_method": [{ "method": "소각", "reports": 518.2, "pct": 39.1 },
                  { "method": "중간가공(R10)", "reports": 272.7, "pct": 20.6 },
                  { "method": "물질재활용", "reports": 178.5, "pct": 13.5 }],
    "by_region": [{ "region": "경기 기타", "reports": 454.5, "pct": 34.3 },
                  { "region": "안산", "reports": 421.5, "pct": 31.8 },
                  { "region": "경기 밖", "reports": 210.5, "pct": 15.9 }],
    "basis": "신고 건수 집계(톤수 아님). …"
  },
  "neighbors": { "recycling": 139, "burning": 486, "burning_methods": ["소각", "에너지회수"], "basis": "…" },
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
      "note": "방치폐기물 처리이행보증보험금 산출용 단가. 실제 위탁 거래가가 아님", "…": "unit_prices 원문 열 전부" }
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
- `candidates`는 최대 3개, 0개일 수 있음(의료폐기물, "그 밖의 폐기물", 근거 경로 없음). `neighbors`는 "이웃 공장 N곳이 이 업체에 재활용으로 보냄"(사회적 증거). `note` 문구 필수
- `source`: `fit_candidates`(신고 공장을 골랐고 근거 목록이 있음) 또는 `computed`(같은 규칙으로 서버 계산)
- `ranking.inferred_from_reports = true`면 사용자가 "모름"을 골라서 신고 경로에서 가장 많은 방식으로 순위를 매긴 것
- `reference_prices`는 표로 원문 그대로. **입력한 무게와 곱해서 금액을 보여 주지 말 것**
- `current_cost_won_per_month`는 사용자가 넣은 값을 되돌려 줄 뿐 계산에 쓰지 않음

### GET /api/diagnoses/:id

완료된 진단만(아니면 404). `x-anon-token`이 맞으면 위와 같은 전체 응답, 없거나 틀리면 **공유 링크용**: `user_input`에서 `factory_id`, `lat`, `lng`, `location_source`, `current_cost_won_per_month`를 뺀다. 카톡 공유 링크는 토큰 없이 이 주소를 연다.

### POST /api/requests → 201 (x-anon-token)

```json
{ "diagnosis_id": "uuid", "candidate_id": 1, "contact_name": "홍길동", "contact_phone": "010-1234-5678",
  "join_group": true, "kakao_notify": true }
```
`candidate_id`는 complete 응답의 `candidates[].candidate_id`. `join_group`, `kakao_notify` 기본값 true(공동 수거 옵트아웃). 같은 후보에 진행 중 요청이 있으면 409.
응답: `{ id, diagnosis_id, candidate_id, processor_id, status: "requested", join_group, kakao_notify, sla_due_at, created_at, labels }` (연락처는 응답에 넣지 않음. 운영자와 해당 처리업체만 조회)

### POST /api/requests/:id/cancel (x-anon-token)

`requested`, `contacted`, `sample` 상태만 취소 가능(그 외 409). 응답 `{ id, status: "cancelled" }`

### PATCH /api/admin/requests/:id (운영자)

`Authorization: Bearer <운영자 access_token>` (`profiles.role = 'operator'`). 본문 `{ "status": "contacted", "note": "선택, 500자" }`.
status: `requested`, `contacted`, `sample`, `contracted`, `first_pickup`, `cancelled`, `rejected`. 변경은 `request_events`에 기록(내 공장 타임라인).

운영자 계정 만들기: Supabase Auth에서 사용자 생성 후 SQL Editor에서
`update profiles set role = 'operator' where id = '<user id>';`

## 지도: GET /api/map

| 요청 | 응답 |
|---|---|
| `?layer=factories` | 확인 좌표 공장 1,123곳 GeoJSON Point. properties: id, name, dong, waste_groups |
| `?layer=processors` | 확인 좌표 처리업체 32곳 Point + `unlocated`: 좌표 없는 771곳을 `{ sido, sigungu, count, processors: [...] }` 목록으로(많은 순) |
| `?layer=flows` | 공장→처리업체 LineString(양쪽 좌표 확인된 신고만). properties: factory_id, processor_id, method, reports. `coverage`: `{ total_reports: 4575, drawn_reports: 652, drawn_pct: 14.3 }` |
| `&group=폐유` | 세 레이어 모두 폐기물군으로 거르기 |

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
npm run test:api     # 순위 규칙, 경로 집계, 영업일 계산, 서류 자동 입력(검사, 환산, 이름 연결)
npm run test:db      # 마이그레이션 + RLS (PGlite, Docker 불필요)
```
`.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`(서버 전용, 커밋 금지), `ANTHROPIC_API_KEY`(서버 전용, 커밋 금지. 없으면 서류 자동 입력만 503).
선택: `ANTHROPIC_OCR_MODEL`(기본 `claude-haiku-5-5`), `OCR_PROVIDER`(기본 `anthropic`). Vercel 프로젝트 환경변수에도 같은 이름으로 넣는다.
