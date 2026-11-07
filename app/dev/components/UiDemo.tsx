'use client';
import { useState } from 'react';
import { LogoLockup, LogoSymbol } from '@/components/brand/Logo';
import { MethodIcon, UnknownIcon, WasteIcon, type MethodType, type WasteType } from '@/components/brand/Icon';
import { AutocompleteList, type AutocompleteItem } from '@/components/ui/AutocompleteList';
import { Button } from '@/components/ui/Button';
import { CandidateCard } from '@/components/ui/CandidateCard';
import { Footnote, type FootnoteBasis } from '@/components/ui/Footnote';
import { Input } from '@/components/ui/Input';
import { Legend } from '@/components/ui/Legend';
import { Option } from '@/components/ui/Option';
import { Stat } from '@/components/ui/Stat';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { Tag } from '@/components/ui/Tag';
import styles from './dev.module.css';

const WASTES: WasteType[] = ['폐합성수지', '폐수처리오니', '폐활성탄', '폐유'];
const METHODS: MethodType[] = ['소각', '매립', '재활용', '에너지회수'];
const BASES: FootnoteBasis[] = ['신고 건수', '공식 원값', '직접 입력', '고시 단가'];
const SEARCH: AutocompleteItem[] = [
  { id: 'F0001', name: '주식회사 디와이코스메틱', dong: '성곡동', wasteTypeCount: 1 },
  { id: 'F0002', name: '(주)아미코스메틱', dong: '성곡동', wasteTypeCount: 1 },
  { id: 'F0003', name: '(주)리더스코스메틱 골판지 사업부', dong: '성곡동', wasteTypeCount: 4 },
];
const COLORS = [
  'text-primary',
  'text-secondary',
  'text-accent',
  'text-error',
  'text-warning',
  'bg-brand',
  'bg-brand-secondary',
  'bg-subtle',
  'bg-accent-soft',
  'bg-tint-4',
  'border-default',
  'border-control',
  'border-focus',
  'chart-recycle',
  'chart-burn',
  'chart-landfill',
  'chart-factory',
  'chart-unknown',
  'accent-lime',
  'accent-colon',
];
const TEXT_STYLES = [
  ['title-h1', 'Title/H1'],
  ['title-h2', 'Title/H2'],
  ['title-h4', 'Title/H4'],
  ['title-h7', 'Title/H7'],
  ['body-p1-bold', 'Body/P1 Bold'],
  ['body-p2-regular', 'Body/P2 Regular'],
  ['body-p3-regular', 'Body/P3 Regular'],
  ['body-p4-medium', 'Body/P4 Medium'],
  ['number-numeral', 'Number/Numeral'],
];

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.h2}>{title}</h2>
      {note && <p className={styles.note}>{note}</p>}
      {children}
    </section>
  );
}

export function UiDemo() {
  const [waste, setWaste] = useState<WasteType>('폐합성수지');
  const [weight, setWeight] = useState('2,000');
  const [active, setActive] = useState<string | null>('F0002');
  const [loading, setLoading] = useState(false);

  return (
    <>
      <Section title="색 토큰" note="styles/tokens.css, Figma RE:FIT v3 Color">
        <div className={styles.swatches}>
          {COLORS.map((c) => (
            <div key={c} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(--color-${c})` }} />
              --color-{c}
            </div>
          ))}
        </div>
      </Section>

      <Section title="글자 스타일" note="Pretendard 가변, 767px 이하에서 모바일 크기">
        <div className={styles.stack}>
          {TEXT_STYLES.map(([cls, name]) => (
            <p key={cls} className={`text-${cls}`}>
              {name} 안산에서 나온 자원 1,209
            </p>
          ))}
        </div>
      </Section>

      <Section title="Button" note="Primary, Secondary, Text. PC는 내용 폭, Mobile은 줄 전체 폭. 마우스를 올리거나 누르거나 Tab으로 초점을 옮기면 상태가 바뀌어요">
        <div className={styles.row}>
          <Button>1분 진단 시작</Button>
          <Button disabled>1분 진단 시작</Button>
          <Button variant="secondary">1분 진단 시작</Button>
          <Button variant="secondary" disabled>
            1분 진단 시작
          </Button>
          <Button variant="text">1분 진단 시작</Button>
          <Button variant="text" disabled>
            1분 진단 시작
          </Button>
        </div>
        <div className={styles.row}>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1600);
            }}
          >
            누르면 불러오는 중
          </Button>
          <Button variant="secondary" loading>
            결과 계산 중
          </Button>
          <Button href="/dev/components">링크 버튼</Button>
        </div>
        <div className={`${styles.stack} ${styles.mobileFrame}`}>
          <p className={styles.caption}>Mobile</p>
          <Button size="mobile">1분 진단 시작</Button>
          <Button size="mobile" disabled>
            1분 진단 시작
          </Button>
          <Button size="mobile" variant="secondary">
            1분 진단 시작
          </Button>
          <Button size="mobile" variant="text">
            1분 진단 시작
          </Button>
        </div>
      </Section>

      <Section title="Option" note="radio 묶음이라 Tab으로 들어가 방향키로 고르고, 아이콘은 글자와 같이 써요">
        <fieldset className={styles.row} style={{ border: 0 }}>
          <legend className="sr-only">폐기물 종류</legend>
          {WASTES.map((w) => (
            <Option key={w} name="waste-demo" value={w} checked={waste === w} onChange={() => setWaste(w)} icon={<WasteIcon type={w} />}>
              {w}
            </Option>
          ))}
          <Option name="waste-demo" value="disabled" disabled icon={<UnknownIcon />}>
            잘 모르겠어요
          </Option>
        </fieldset>
        <div className={styles.row}>
          <Option type="checkbox" defaultChecked>
            폐합성수지
          </Option>
          <Option type="checkbox">폐합성수지</Option>
        </div>
      </Section>

      <Section title="Tag">
        <div className={styles.row}>
          <Tag tone="recommend">가장 추천</Tag>
          <Tag tone="basis">신고 건수 기준</Tag>
          <Tag tone="warning">업체 확인 필요</Tag>
          <Tag tone="confirmed">공식 목록 확인</Tag>
        </div>
      </Section>

      <Section title="Footnote">
        <div className={styles.grid2}>
          {BASES.map((b) => (
            <Footnote key={b} basis={b}>
              안산시 폐기물 배출자 신고현황 2026-07
            </Footnote>
          ))}
        </div>
      </Section>

      <Section title="Input" note="Default, Focus(눌러서 확인), Error, Disabled">
        <div className={styles.grid3}>
          <Input label="한 달 배출 무게" unit="kg" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} helper="계량표나 올바로 인계서에 적힌 무게를 넣어 주세요." />
          <Input label="한 달 배출 무게" unit="kg" inputMode="numeric" defaultValue="2,000kg" error="숫자만 넣어 주세요. 예: 2000" />
          <Input label="톤당 처리 단가" unit="원/톤" disabled defaultValue="" placeholder="입력 안 함" helper="선택 입력이에요." />
        </div>
      </Section>

      <Section title="Legend Item" note="처리 방식은 색과 모양, 글자를 같이 써요">
        <Legend types={['recycle', 'burn', 'landfill', 'factory', 'unknown']} />
      </Section>

      <Section title="Stat">
        <div className={styles.grid2}>
          <Stat value="80.9%" label="안산 밖으로 나가는 신고 경로" basis="신고 건수" source="안산시 폐기물 배출자 신고현황 2026-07" />
          <Stat surface="dark" value="80.9%" label="안산 밖으로 나가는 신고 경로" basis="신고 건수" source="안산시 폐기물 배출자 신고현황 2026-07" />
        </div>
      </Section>

      <Section title="Candidate Card" note="Recommended, Collapsed. 예시 값은 docs/api.md F0001 폐합성수지 응답">
        <div className={styles.grid2}>
          <CandidateCard
            rank={1}
            name="(주)거단산업"
            region="경기 평택시"
            neighbors={28}
            wasteLabel="폐합성수지"
            note="실제 처리 가능 여부는 업체 확인 필요"
            action={<Button size="pc">연결 요청</Button>}
          />
          <CandidateCard rank={2} name="(주)거단산업" region="경기 평택시" neighbors={28} wasteLabel="폐합성수지" note="업체 확인 필요" />
        </div>
      </Section>

      <Section title="Tabs" note="탭에 초점을 두고 좌우 화살표, Home, End로 옮겨요">
        <Tabs
          label="보고서 종류"
          items={[
            { id: 'factory', label: '우리 공장', content: <p className={styles.note}>이 브라우저의 마지막 완료 진단을 보여 줘요.</p> },
            { id: 'city', label: '안산시 지표', content: <p className={styles.note}>신고 건수 집계와 2024 공식 통계 원값이에요.</p> },
          ]}
        />
      </Section>

      <Section title="Search/Autocomplete" note="Default, Keyboard(선택 항목 배경), Empty, Error">
        <div className={styles.grid2}>
          <AutocompleteList id="ac-default" items={SEARCH} />
          <AutocompleteList id="ac-keyboard" items={SEARCH} activeId={active} onHover={(it) => setActive(it.id)} />
          <AutocompleteList id="ac-empty" items={[]} status="empty" />
          <AutocompleteList id="ac-error" items={[]} status="error" />
        </div>
      </Section>

      <Section title="Icon/Waste, Icon/Method">
        <div className={styles.row}>
          {WASTES.map((w) => (
            <span key={w} className={styles.row} style={{ gap: 'var(--space-7)' }}>
              <WasteIcon type={w} />
              {w}
            </span>
          ))}
        </div>
        <div className={styles.row}>
          {METHODS.map((m) => (
            <span key={m} className={styles.row} style={{ gap: 'var(--space-7)' }}>
              <MethodIcon type={m} />
              {m}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Logo/Symbol, Logo/Lockup">
        <div className={styles.row}>
          <LogoSymbol size="lg" />
          <LogoLockup size="lg" />
          <LogoLockup size="sm" />
        </div>
      </Section>

      <Section title="Skeleton, EmptyState, ErrorState">
        <div className={styles.grid3}>
          <Skeleton />
          <EmptyState title="아직 안산 공장이 원료로 보내는 기록이 없어요">고시 단가 비교와 같이 맡기기만 보여 드려요.</EmptyState>
          <ErrorState onRetry={() => undefined} />
        </div>
      </Section>
    </>
  );
}
