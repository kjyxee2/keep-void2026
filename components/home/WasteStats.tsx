// 폐기물 칩과 지표 3개(Figma Quick Start 75:171, Proof 75:190, 칩 프레임 121:562, 121:610, 121:658).
// 서버가 첫 칩(폐합성수지) 값을 HTML에 그려 두고, 구역에 들어오면 제목, 칩, 지표 순으로 나타나며(Reveal) 지표는 0에서 한 번 센다.
// 칩을 바꾸면 CountUp이 이전 값에서 새 값으로(사용자 반응). 단위가 바뀌어 새로 그릴 때는 바로 최종 값.
'use client';
import { useState } from 'react';
import { CountUp, Reveal } from '@/components/motion';
import { WasteIcon } from '@/components/brand/Icon';
import { Button } from '@/components/ui/Button';
import { Option } from '@/components/ui/Option';
import { Stat } from '@/components/ui/Stat';
import type { HomeChipView } from '@/lib/home-stats';
import styles from './WasteStats.module.css';

const UNKNOWN = 'unknown';

export function WasteStats({ chips, photoHref }: { chips: HomeChipView[]; photoHref: string }) {
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
    <section className={styles.section} aria-labelledby="home-waste-title">
      <div className="container">
        <Reveal index={0}>
          <h2 id="home-waste-title" className={styles.title}>
            이름 대신 폐기물 종류로 찾아도 돼요.
          </h2>
        </Reveal>
        <Reveal index={1} className={styles.options}>
          <fieldset className={styles.fieldset}>
            <legend className="sr-only">폐기물 종류</legend>
            {chips.map((c) => (
              <Option
                key={c.chipId}
                name="home-waste"
                value={c.chipId}
                checked={selected === c.chipId}
                onChange={() => choose(c.chipId)}
                icon={<WasteIcon type={c.name} size="sm" />}
                className={styles.option}
              >
                {c.name}
              </Option>
            ))}
            <Option
              name="home-waste"
              value={UNKNOWN}
              checked={selected === UNKNOWN}
              onChange={() => choose(UNKNOWN)}
              className={styles.option}
            >
              잘 모르겠어요
            </Option>
          </fieldset>
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
          <Reveal index={2} className={styles.stats}>
            <div className={styles.statsGrid} hidden={!chip}>
              {shown.stats.map((s, i) => (
                <Stat
                  key={i}
                  // 단위(곳, %)가 같을 때만 이전 값에서 센다. 단위가 바뀌면 새 값을 바로 그린다(445곳에서 64.2%로 세지 않음)
                  value={<CountUp key={s.unit} to={s.value} decimals={s.decimals} suffix={s.unit} fromZero={!touched} />}
                  label={s.label}
                  basis="신고 건수"
                  source={shown.source}
                  className={styles.stat}
                />
              ))}
            </div>
          </Reveal>
        )}
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
    </section>
  );
}
