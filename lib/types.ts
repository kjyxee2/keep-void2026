// API 응답 타입. 근거: docs/api.md 응답 예. 서버가 주는 값을 그대로 쓰고 화면에서 계산하지 않는다.

export type Method = '소각' | '매립' | '에너지회수' | '모름';
export type WeightSource = '계량표' | '올바로 인계서' | '기타';
export type LocationSource = '주소' | '현재위치' | '신고공장';
export type Labels = Record<string, string>;

// GET /api/chips
export type Chip = {
  id: string;
  label: string;
  waste_group: string;
  container: string | null;
  unit_kg: number | null;
  basis: string | null;
  /** 무게 입력 안내. 화면에 그대로 보여 준다 */
  display_text: string;
  source: string | null;
  source_url: string | null;
};
export type VolumeOption = {
  id: string;
  label: string;
  min_count: number;
  max_count: number | null;
  representative_count: number;
  note: string | null;
};
export type ChipsResponse = {
  chips: Chip[];
  volume_options: VolumeOption[];
  weight_sources: WeightSource[];
  current_methods: Method[];
  labels: Labels;
};

// GET /api/factories/search?q=
export type FactorySearchItem = {
  id: string;
  name: string;
  address: string;
  dong: string | null;
  waste_groups: string[];
  coord_verified: boolean;
  /** 신고된 폐기물 종류 수. 백엔드 P0 브랜치에서 추가 */
  n_waste_types?: number;
};
export type FactorySearchResponse = { factories: FactorySearchItem[] };

// GET /api/factories/:id (공개 열만, 주소와 좌표 없음)
export type FactoryPublic = {
  id: string;
  name: string;
  dong: string | null;
  waste_groups: string[];
  coord_verified: boolean;
  n_waste_types: number | null;
};

// POST /api/diagnoses
export type CreateDiagnosisResponse = { id: string; anon_token: string };

// PATCH /api/diagnoses/:id 본문(보낼 수 있는 필드만)
export type DiagnosisPatch = Partial<{
  weight_kg_per_month: number;
  weight_source: WeightSource;
  current_method: Method;
  current_cost_won_per_month: number;
  /** 톤당 단가(원). 비교 표시용, 계산에 쓰지 않음. 백엔드 P0 브랜치에서 추가 */
  current_price_won_per_ton: number | null;
  factory_id: string;
  /** 지금 맡기는 처리업체(processors.id). 없는 id는 400 */
  current_processor_id: string | null;
  /** 지금 맡기는 처리업체 이름 원문(100자 이하). 목록과 맞춰지지 않은 값 */
  current_processor_name_raw: string | null;
  lat: number;
  lng: number;
  location_source: LocationSource;
  volume_option_id: string;
}>;

/** PATCH 응답: 저장된 진단 행 */
export type DiagnosisRow = {
  id: string;
  status: 'draft' | 'completed';
  chip_id: string;
  created_at?: string;
  completed_at?: string | null;
} & DiagnosisPatch &
  Record<string, unknown>;

export type RouteShare<K extends string> = { reports: number; pct: number } & Record<K, string>;

/** 추천 이유(화면 설명 전용, 순위에 쓰지 않음). 실제 신고 집계로 서버가 만든 문구 */
export type CandidateReason = {
  type: 'neighbors_same_group' | 'same_dong' | 'transporter_link' | 'in_ansan';
  /** neighbors_same_group, same_dong만 */
  count?: number;
  /** 화면에 그대로 보여 줄 문구 */
  text: string;
  /** "신고 건수 집계 2026-07" */
  basis: string;
};

export type Candidate = {
  candidate_id: number;
  rank: number;
  processor_id: string;
  name: string;
  sigungu: string | null;
  fit_score: number;
  neighbors: number;
  distance_km: number | null;
  distance_quality: string | null;
  confirmed: boolean;
  confirm_status: string;
  source: 'fit_candidates' | 'computed';
  /** 화면에 반드시 보여 줄 문구 */
  note: string;
  /** 추천 이유(순위에 쓰지 않음). 오래된 응답에는 없을 수 있다 */
  reasons?: CandidateReason[];
};

/** 안산 안 후보. rank 0이면 추천 3곳 밖(already_in_top false), 아니면 상위 후보 그 자체(already_in_top true) */
export type AnsanCandidate = Candidate & { already_in_top: boolean };

/** unit_prices 원문 열 전부 */
export type ReferencePrice = {
  id: string;
  category: string;
  item: string;
  method: string;
  price_won: number;
  unit: string;
  year: number;
  note: string | null;
  /** 서버가 붙이는 연도 표시(고시 "2022 적용", "2027 시행", 나머지 "2024년") */
  year_label?: string | null;
  /** 원문 출처 */
  source?: string | null;
} & Record<string, unknown>;

export type DiagnosisUserInput = {
  chip: { id: string; label: string; display_text: string };
  volume_option: { id: string; label: string } | null;
  weight_kg_per_month: number;
  weight_source: WeightSource | null;
  current_method: Method;
  /** 공유 보기에서는 빠짐 */
  current_cost_won_per_month?: number | null;
  /** 백엔드 P0 브랜치에서 추가 */
  current_price_won_per_ton?: number | null;
  factory_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  location_source?: LocationSource | null;
  /** 본인 보기만. 고른 신고 공장(없으면 null) */
  factory?: { id: string; name: string; dong: string | null } | null;
  /** 본인 보기만. 지금 맡기는 처리업체(목록에서 맞춰진 경우만) */
  current_processor?: { id: string; name: string; sido: string | null; sigungu: string | null; method: string | null } | null;
  /** 본인 보기만. 목록과 맞춰지지 않은 이름 원문 */
  current_processor_name_raw?: string | null;
};

// POST /api/diagnoses/:id/complete, GET /api/diagnoses/:id
export type DiagnosisResult = {
  diagnosis_id: string;
  status: 'completed';
  completed_at: string;
  data_version: string;
  waste_group: string;
  user_input: DiagnosisUserInput;
  current_route: {
    total_reports: number;
    by_method: RouteShare<'method'>[];
    by_region: RouteShare<'region'>[];
    basis: string;
  };
  neighbors: { recycling: number; burning: number; burning_methods: string[]; basis: string };
  candidates: Candidate[];
  /** 안산 안 후보(없으면 null) */
  ansan_candidate: AnsanCandidate | null;
  ranking: { current_method_used: string; inferred_from_reports: boolean; rule: string };
  reference_prices: ReferencePrice[];
  labels: Labels;
};

// POST /api/requests
export type CreateRequestBody = {
  diagnosis_id: string;
  candidate_id: number;
  contact_name: string;
  contact_phone: string;
  join_group?: boolean;
  kakao_notify?: boolean;
};
export type RequestStatus = 'requested' | 'contacted' | 'sample' | 'contracted' | 'first_pickup' | 'cancelled' | 'rejected';
export type ConnectionRequest = {
  id: string;
  diagnosis_id: string;
  candidate_id: number;
  processor_id: string;
  status: RequestStatus;
  join_group: boolean;
  kakao_notify: boolean;
  sla_due_at: string;
  created_at: string;
  labels: Labels;
};
export type CancelRequestResponse = { id: string; status: 'cancelled' };

// GET /api/map (좌표는 [lng, lat])
export type MapLayer = 'factories' | 'processors' | 'flows';
export type PointFeature<P> = { type: 'Feature'; geometry: { type: 'Point'; coordinates: [number, number] }; properties: P };
export type LineFeature<P> = {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  properties: P;
};
export type FactoryPointProps = {
  id: string;
  name: string;
  dong: string | null;
  waste_groups: string[];
  coord_verified?: boolean | null;
  /** 공장별 신고가 가장 많은 처리 방식(재활용, 소각, 매립, 미확인) */
  method: string;
};
export type ProcessorPointProps = {
  id: string;
  name: string;
  sido: string | null;
  sigungu: string | null;
  method: string | null;
  confirmed?: boolean | null;
  coord_verified?: boolean | null;
};
export type FlowProps = { factory_id: string; processor_id: string; method: string; reports: number };
export type UnlocatedGroup = { sido: string; sigungu: string | null; count: number; processors: ProcessorPointProps[] };

export type MapFactoriesResponse = { type: 'FeatureCollection'; features: PointFeature<FactoryPointProps>[] } & Record<string, unknown>;
export type MapProcessorsResponse = {
  type: 'FeatureCollection';
  features: PointFeature<ProcessorPointProps>[];
  unlocated: UnlocatedGroup[];
} & Record<string, unknown>;
export type MapFlowsResponse = {
  type: 'FeatureCollection';
  features: LineFeature<FlowProps>[];
  coverage: { total_reports: number; drawn_reports: number; drawn_pct: number };
} & Record<string, unknown>;
export type MapResponseByLayer = {
  factories: MapFactoriesResponse;
  processors: MapProcessorsResponse;
  flows: MapFlowsResponse;
};

// GET /api/dashboard (summary는 data/demo/summary.json 그대로)
export type DashboardResponse = {
  summary: Record<string, unknown>;
  app: { diagnoses_completed: number; requests_active: number; routes_switched_to_recycling: number; basis: string };
  labels: Labels;
};

// GET /api/home-stats: home_waste_stats 행 배열 그대로(lib/home-stats.ts HomeStatRow와 같은 열)
export type HomeWasteStat = {
  chip_id: string;
  name: string;
  reports: number;
  burn_factories: number;
  recycle_factories: number;
  both_factories: number;
  in_ansan_pct: number | null;
  outside_gyeonggi_pct: number | null;
  region_unknown_pct: number | null;
  recycle_pct: number | null;
  burn_pct: number | null;
} & Record<string, unknown>;
export type HomeStatsResponse = { chips: HomeWasteStat[]; labels: Labels };

// GET /api/groups?factory_id= | ?diagnosis_id= (lib/groups.ts groupView)
export type GroupPoint = { coordinates: [number, number]; self: boolean };
export type GroupItem = {
  group_id: string;
  waste_group: string | null;
  match: 'member' | 'dong';
  /** [lng, lat] */
  center: [number, number];
  radius_km: number;
  n_factories: number;
  n_processors: number;
  /** 좌표가 확인된 같은 묶음 공장. 이름 없음, self는 진단 공장 */
  points: GroupPoint[];
  label: string;
};
export type GroupResponse = { groups: GroupItem[]; labels: Labels };
