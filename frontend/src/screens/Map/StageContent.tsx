import { useEffect, useState } from 'react';
import { Button } from '@vkontakte/vkui';
import type { Stage } from '../../types/api';
import { raceDate, raceTime, stageStatus } from '../../api/format';
import { mockFeaturesEnabled } from '../../mocks/extras';
import { StageMedia } from './StageMedia';

export function Countdown({ startAt }: { startAt: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((Date.parse(startAt) - now) / 1000));
  const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  return <><p className="stage-countdown-label">через</p><div className="stage-countdown" aria-label="До старта" role="timer">{values.map((value, index) =>
    <div key={index}><strong>{String(value).padStart(2, '0')}</strong><span>{['дней', 'часов', 'минут', 'секунд'][index]}</span></div>)}</div>
    {seconds === 0 && <p>Ожидаем подтверждение старта организаторами.</p>}</>;
}
export function StageContent({ stage, liveStage, onStage, onResults }: {
  stage: Stage; liveStage?: Stage; onStage: (id: number) => void; onResults: () => void;
}) {
  return <><section className="stage-hero" data-planned={stage.status === 'planned'}>
    <div className="stage-hero__image"><img src="/figma/map-screen/b5483.png" alt="" /></div>
    <img className="stage-hero__logo" src="/figma/map-screen/5b9db.svg" width={115.006} height={50.0002} alt="Берингия. Авача" />
    <div className="stage-hero__copy"><h2>Этап {stage.number} {stage.status === 'planned' ? 'начнётся' : stageStatus[stage.status]}</h2>
      {stage.status === 'planned' && (stage.start_at ? <Countdown startAt={stage.start_at} /> : <p>Дата старта пока не объявлена</p>)}
      {stage.status === 'finished' && (stage.start_at || stage.finish_at) && <dl>
        {stage.start_at && <div><dt>Старт</dt><dd>{raceDate(stage.start_at)} {raceTime(stage.start_at)}</dd></div>}
        {stage.finish_at && <div><dt>Финиш</dt><dd>{raceDate(stage.finish_at)} {raceTime(stage.finish_at)}</dd></div>}
      </dl>}
    </div>
    {stage.status === 'finished' && <Button size="l" className="stage-hero__action" onClick={onResults}>Результаты этапа</Button>}
    {stage.status === 'planned' && liveStage && <Button size="l" className="stage-hero__action" onClick={() => onStage(liveStage.id)}>Смотреть {liveStage.number} этап live</Button>}
  </section>{stage.status === 'finished' && mockFeaturesEnabled() && <StageMedia key={stage.id} number={stage.number} />}</>;
}
