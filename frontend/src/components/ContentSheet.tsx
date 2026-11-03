import { useRef, type ReactNode } from 'react';
import { Button, ModalPage } from '@vkontakte/vkui';
import { externalUrl } from '../api/links';

export function ContentSheet({ title, expanded, onExpand, onClose, children }: { title: string; expanded: boolean; onExpand: () => void; onClose: () => void; children: ReactNode }) {
  const start = useRef(0);
  return <ModalPage open hideCloseButton aria-label={title} height={expanded ? '92dvh' : '65dvh'} settlingHeight={100} onClose={onClose}>
    <div className="content-sheet">
      <div className="content-sheet__handle" aria-hidden onPointerDown={e => { start.current = e.clientY; e.currentTarget.setPointerCapture?.(e.pointerId); }} onPointerUp={e => { if (e.clientY - start.current > 80) onClose(); }} />
      <button className="sheet-dismiss" aria-label="Закрыть карточку" onClick={onClose}>×</button>
      {children}
      <Button mode="tertiary" onClick={onExpand}>{expanded ? 'Свернуть' : 'Подробнее'}</Button>
    </div>
  </ModalPage>;
}

export function PhotoCarousel({ urls, title }: { urls: string[]; title: string }) {
  return <div className="content-carousel" role="region" aria-label={`Фотографии: ${title}`} tabIndex={0}>
    {urls.filter(url => externalUrl(url)).map((url, i) => <a href={externalUrl(url)} target="_blank" rel="noreferrer" key={i} aria-label={`Открыть фото ${i + 1}`}><img src={externalUrl(url)} alt={`${title}, фото ${i + 1}`} loading="lazy" /></a>)}
  </div>;
}
