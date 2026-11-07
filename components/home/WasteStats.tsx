// 폐기물 칩과 지표 3개(Figma Quick Start 75:171, Proof 75:190, 칩 프레임 121:562, 121:610, 121:658).
// 서버가 첫 칩(폐합성수지) 값을 HTML에 그려 두고, 칩을 바꾸면 CountUp이 이전 값에서 새 값으로(사용자 반응, 자동 연출 아님).
'use client';
import { useState } from 'react';
import { CountUp } from '@/components/motion';
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
  const chip = chips.find((c) => c.chipId === selected);

  function choose(id: string) {
    setSelected(id);
    const next = chips.find((c) => c.chipId === id);
    if (next) setShown(next);
    setAnnounce(next ? `${next.name} 신고 자료 지표로 바꿨어요` : '');
  }

  return (
    <section className={styles.section} aria-labelledby="home-waste-title">
      <div className="container">
        <h2 id="home-waste-title" className={styles.title}>
          이름 대신 폐기물 종류로 찾아도 돼요.
        </h2>
        <fieldset className={styles.options}>
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

        {chip ? null : (
          <div className={styles.unknown}>
            <p className={styles.unknownText}>서류 사진을 올리면 폐기물 종류를 서류에서 읽어 드려요.</p>
            <Button href={photoHref} variant="secondary">
              서류 사진으로 시작
            </Button>
          </div>
        )}

        {shown && (
          <div className={styles.stats} hidden={!chip}>
            {shown.stats.map((s, i) => (
              <Stat
                key={i}
                // 단위(곳, %)가 같을 때만 이전 값에서 센다. 단위가 바뀌면 새 값을 바로 그린다(445곳에서 64.2%로 세지 않음)
                value={<CountUp key={s.unit} to={s.value} decimals={s.decimals} suffix={s.unit} />}
                label={s.label}
                basis="신고 건수"
                source={shown.source}
                className={styles.stat}
              />
            ))}
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
    </section>
  );
}
