import { useEffect, useState } from 'react';
import { Button, ModalCard, Title } from '@vkontakte/vkui';
import { asset, demoNow, photos, raceTime, report, type DemoStage } from './demo';

export function Countdown({ startAt, now = demoNow }: { startAt: string; now?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const duration = Date.parse(startAt) - now;
    if (duration <= 0) return;
    const origin = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - origin;
      setElapsed(elapsed);
      if (elapsed >= duration) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [startAt, now]);
  const seconds = Math.max(0, Math.ceil((Date.parse(startAt) - now - elapsed) / 1000));
  const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  return <><div className="stage-countdown" aria-label="До старта" role="timer">{values.map((v, i) =>
    <div key={i}><strong>{String(v).padStart(2, '0')}</strong><span>{['дней', 'часов', 'минут', 'секунд'][i]}</span></div>)}</div>
    {seconds === 0 && <p>Ожидаем подтверждение старта организаторами.</p>}</>;
}
interface StageContentProps { stage: DemoStage; now?: number; galleryExpanded?: boolean; onLive: () => void; onUnavailable: () => void }
export function StageContent({ stage, now, galleryExpanded = false, onLive, onUnavailable }: StageContentProps) {
  const [expanded, setExpanded] = useState(galleryExpanded);
  const [photo, setPhoto] = useState<string | null>(null);
  const planned = stage.status === 'planned';
  return <div className="stage-content">
    <section className="stage-hero" data-planned={planned}>
      <img src={asset('268b2.png')} alt="" className="stage-hero__base" />
      <div className="stage-hero__image"><img src={asset('b5483.png')} alt="Каюр и собачья упряжка на гонке Авача" /></div>
      <img className="stage-hero__logo" src={asset('5b9db.svg')} width={115.006} height={50.0002} alt="Берингия. Авача" />
      <div className="stage-hero__copy"><h2>Этап {stage.number} {planned ? 'начнётся' : 'завершён'}</h2>
        {planned ? <><p>через</p><Countdown startAt={stage.start_at} now={now} /></> : <dl>
          <div><dt>Старт</dt><dd>{new Date(stage.start_at).toLocaleDateString('ru-RU', { timeZone: 'Asia/Kamchatka', day: '2-digit', month: '2-digit' })} {raceTime(stage.start_at)}</dd></div>
          <div><dt>Финиш</dt><dd>{raceTime(stage.finish_at!)}</dd></div>
        </dl>}
      </div>
      <Button size="l" className="stage-hero__action" onClick={planned ? onLive : onUnavailable}>{planned ? 'Смотреть 3 этап live' : 'Результаты'}</Button>
    </section>
    {!planned && <div className="stage-report">
      <p>{stage.number === 2 ? report : 'Этап завершён. Подробный отчёт будет опубликован организаторами.'}</p>
      {[{ label: 'Старт', src: 'd6d50.png' }, { label: 'Финиш', src: '9eae6.png' }].map(video => <section key={video.label}>
        <Title level="2" Component="h2">{video.label}</Title>
        <button className="stage-video" aria-label={'Смотреть видео: ' + video.label} onClick={onUnavailable}>
          <img src={asset(video.src)} alt={video.label + ' гонки'} /><img className="stage-video__play" src={asset('e8332.svg')} width={36} height={36} alt="" />
        </button>
      </section>)}
      <section className="stage-gallery"><Title level="2" Component="h2">Фото {stage.number} этапа</Title>
        <button className="stage-gallery__main" aria-label="Открыть главное фото" onClick={() => setPhoto("c053b.png")}><img src={asset('c053b.png')} alt="Участница гонки в зимней экипировке" /></button>
        <div className="stage-gallery__grid">{photos.slice(0, expanded ? photos.length : 10).map((src, i) =>
          <button key={i} aria-label={'Открыть фото ' + (i + 1)} onClick={() => setPhoto(src)}><img src={asset(src)} alt={'Фото этапа ' + (i + 1)} loading="lazy" /></button>)}
          <Button mode="tertiary" size="s" aria-label={expanded ? "Свернуть фото" : "Все " + photos.length + " фото"} onClick={() => setExpanded(!expanded)}>{expanded ? "Свернуть" : "+15 фото"}</Button>
        </div>
      </section>
      <section><Title level="2" Component="h2">Маршрут {stage.number} этапа</Title><p>{report}</p>
        <div className="stage-route"><img className="stage-route__base" src={asset('268b2.png')} alt="" /><img className="stage-route__track" src={asset('75f68.png')} alt="Схема завершённого этапа с контрольными пунктами" /></div>
      </section>
    </div>}
    <ModalCard open={photo !== null} onClose={() => setPhoto(null)} title="Фото этапа" aria-label="Фото этапа" dismissLabel="Закрыть фото">
      {photo && <img className="stage-photo" src={asset(photo)} alt="Фотография с этапа гонки" />}
    </ModalCard>
  </div>;
}
