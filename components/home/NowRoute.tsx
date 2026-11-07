// 지금 가는 길(Figma 홈 v2 Section / 지금 가는 길 279:3945 PC, 279:4078 모바일).
// 사진 오프너 → 한 문장 → 실제 /map 화면 캡처 띠 → 폐기물 칩 5칸(선택 상태 유지) → 큰 숫자 3개(home-stats 원값, CountUp) + 명사구.
// 서버가 첫 칩(폐합성수지) 값을 HTML에 그려 두고, 구역에 들어오면 문장, 띠, 칩, 숫자 순으로 나타난다(Reveal). 숫자는 0에서 한 번 센다.
// 칩을 바꾸면 CountUp이 이전 값에서 새 값으로(사용자 반응). 단위가 바뀌어 새로 그릴 때는 바로 최종 값.
'use client';
import { useState } from 'react';
import { ChipRow, MediaBand, PhotoOpener, Stat } from '@/components/editorial';
import { CountUp, Reveal } from '@/components/motion';
import { UnknownIcon, WasteIcon } from '@/components/brand/Icon';
import { Button } from '@/components/ui/Button';
import { Option } from '@/components/ui/Option';
import type { HomeChipView } from '@/lib/home-stats';
import aerial from '@/public/photos/sections/s13_aerial.jpg';
import mapStrip from '@/public/photos/strips/map.jpg';
import styles from './NowRoute.module.css';

const UNKNOWN = 'unknown';

export function NowRoute({ chips, photoHref }: { chips: HomeChipView[]; photoHref: string }) {
  const [selected, setSelected] = useState<string>(chips[0]?.chipId ?? UNKNOWN);
  const [shown, setShown] = useState<HomeChipView | undefined>(chips[0]);
  // 숫자가 세어지는 동안 읽지 않도록, 바뀐 칩 이름만 따로 알린다
  const [announce, setAnnounce] = useState('');
  // 사용자가 칩을 고른 뒤에 새로 그리는 숫자는 0에서 세지 않는다
  const [touched, setTouched] = useState(false);
  const chip = chips.find((c) => c.chipId === selected);

  function choose(id: string) {
    setTouched(true);
    setSelected(id);
    const next = chips.find((c) => c.chipId === id);
    if (next) setShown(next);
    setAnnounce(next ? `${next.name} 신고 자료 지표로 바꿨어요` : '');
  }

  return (
    <section className={styles.section} aria-labelledby="home-route-title">
      <PhotoOpener
        src={aerial}
        alt="해 질 녘 안산 반월시화 산업단지를 위에서 내려다본 사진. 공장 지붕과 굴뚝, 도로가 바다까지 이어진다."
        label="지금 가는 길"
        id="home-route-title"
        headline={
          <>
            지금 폐기물은
            <br />
            어디로 갈까요?
          </>
        }
      />
      <div className={`editorial-container ${styles.content}`}>
        <Reveal index={0}>
          <p className={styles.sentence}>종류를 고르면 안산 공장들이 보내는 곳이 나옵니다.</p>
        </Reveal>
        <Reveal index={1}>
          <MediaBand
            src={mapStrip}
            alt="이웃 공장 지도 화면의 지도 부분. 안산 반월시화 일대 배출 공장 1,123곳이 처리 방식별 모양과 색으로 찍혀 있고, 가까운 공장은 숫자 원으로 묶여 있다."
            ratio="wide"
            // 지도 영역만 1200x400으로 잘라 둔 캡처(strips/map.jpg)라 띠 비율과 같다. 가운데 기준으로 두면 폭이 달라져도 지도 중심이 남는다
            position="center"
          />
        </Reveal>
        <div className={styles.data}>
          <Reveal index={2}>
            <ChipRow legend="폐기물 종류">
              {chips.map((c) => (
                <Option
                  key={c.chipId}
                  name="home-waste"
                  value={c.chipId}
                  checked={selected === c.chipId}
                  onChange={() => choose(c.chipId)}
                  icon={<WasteIcon type={c.name} size="sm" />}
                >
                  {c.name}
                </Option>
              ))}
              <Option
                name="home-waste"
                value={UNKNOWN}
                checked={selected === UNKNOWN}
                onChange={() => choose(UNKNOWN)}
                icon={<UnknownIcon size="sm" />}
              >
                잘 모르겠어요
              </Option>
            </ChipRow>
          </Reveal>

          {chip ? null : (
            <div className={styles.unknown}>
              <p className={styles.unknownText}>서류 사진을 올리면 폐기물 종류를 서류에서 읽어 드려요.</p>
              <Button href={photoHref} variant="secondary">
                서류 사진으로 시작
              </Button>
            </div>
          )}

          {shown && (
            <Reveal index={3} className={styles.numbers}>
              <div className={styles.numberGrid} hidden={!chip}>
                {shown.stats.map((s) => (
                  <Stat
                    key={s.key}
                    size="numeral"
                    tone="primary"
                    rule="top"
                    // 단위(곳, %)가 같을 때만 이전 값에서 센다. 단위가 바뀌면 새 값을 바로 그린다(445곳에서 64.2%로 세지 않음)
                    value={<CountUp key={s.unit} to={s.value} decimals={s.decimals} suffix={s.unit} fromZero={!touched} />}
                    caption={s.label}
                  />
                ))}
              </div>
            </Reveal>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
    </section>
  );
}
