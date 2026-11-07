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
  /** 추천 이유. 백엔드 reasons 브랜치에서 추가 */
  reasons?: CandidateReason[];
};

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
  /** 공장별 신고가 가장 많은 처리 방식. 백엔드 P0 브랜치에서 추가 */
  method?: string;
};
export type ProcessorPointProps = { id: string; name: string } & Record<string, unknown>;
export type FlowProps = { factory_id: string; processor_id: string; method: string; reports: number };
export type UnlocatedGroup = { sido: string; sigungu: string; count: number; processors: Record<string, unknown>[] };

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

// GET /api/home-stats. 백엔드 P0 브랜치에서 추가(research/waste/demo/home_waste_stats.json과 같은 값)
export type HomeWasteStat = {
  reports: number;
  burn_factories: number;
  recycle_factories: number;
  both_factories: number;
} & Record<string, unknown>;
export type HomeStatsResponse = {
  chips: Record<string, HomeWasteStat>;
  region_pct?: Record<string, number>;
  basis: string;
} & Record<string, unknown>;

// GET /api/groups?factory_id= | ?diagnosis_id=. 백엔드 P0 브랜치에서 추가
export type GroupResponse = {
  waste_group: string;
  center: [number, number];
  radius_km: number;
  n_factories: number;
  n_processors: number;
  /** 같은 묶음 공장 좌표 [lng, lat]. 이름 없음 */
  points: [number, number][];
  /** 좌표 없는 공장이면 동 기준임을 알리는 문구 */
  label?: string;
} & Record<string, unknown>;
