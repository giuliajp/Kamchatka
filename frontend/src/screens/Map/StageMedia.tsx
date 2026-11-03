import { useState } from 'react';
import { Button, ModalCard } from '@vkontakte/vkui';
import { stageAsset, stagePhotos } from '../../mocks/extras';

export function StageMedia({ number }: { number: number }) {
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<{ image: string; title: string; video?: boolean } | null>(null);
  return <div className="stage-report">
    <small className="mock-note">Демонстрационные материалы этапа. Фотографии и превью из макета.</small>
    <p>Этап {number} завершён. Здесь появится отчёт организаторов: события на маршруте, история гонки и фотографии участников.</p>
    {[{ label: 'Старт', src: 'd6d50.png' }, { label: 'Финиш', src: '9eae6.png' }].map(video => <section key={video.label}>
      <h2>{video.label}</h2><button className="stage-video" aria-label={`Смотреть видео: ${video.label}`} onClick={() => setPreview({ image: video.src, title: video.label, video: true })}>
        <img src={stageAsset(video.src)} alt={`${video.label} гонки`} /><img className="stage-video__play" src={stageAsset('e8332.svg')} width={36} height={36} alt="" />
      </button>
    </section>)}
    <section className="stage-gallery"><h2>Фото {number} этапа</h2>
      <button className="stage-gallery__main" aria-label="Открыть главное фото" onClick={() => setPreview({ image: 'c053b.png', title: 'Фото этапа' })}><img src={stageAsset('c053b.png')} alt="Участница гонки в зимней экипировке" /></button>
      <div className="stage-gallery__grid">{stagePhotos.slice(0, expanded ? stagePhotos.length : 5).map((image, index) => <button key={image} aria-label={`Открыть фото ${index + 1}`} onClick={() => setPreview({ image, title: `Фото ${index + 1}` })}>
        <img src={stageAsset(image)} alt={`Фото этапа ${index + 1}`} loading="lazy" />
      </button>)}
        <Button mode="tertiary" size="s" onClick={() => setExpanded(!expanded)}>{expanded ? 'Свернуть фото' : `+${stagePhotos.length - 5} фото`}</Button>
      </div>
    </section>
    <ModalCard dismissButtonMode="inside" open={preview !== null} onClose={() => setPreview(null)} title={preview?.title} aria-label="Материалы этапа" dismissLabel="Закрыть материал">
      {preview && <><img className="stage-photo" src={stageAsset(preview.image)} alt={preview.title} />
        {preview.video && <p>Демонстрационное видеопревью. Полная запись появится после подключения медиасервиса.</p>}</>}
    </ModalCard>
  </div>;
}
