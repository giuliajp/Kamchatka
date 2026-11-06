import {useEffect, useRef, useState} from 'react';
import {Button} from '@vkontakte/vkui';
import {sendStory, storyLink, supportsStories, withDeadline} from '../api/story';
import {createStoryImages, type StoryCard} from '../api/storyImage';

export function StoryShareButton({card, link}: {card: StoryCard; link: string}) {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const running = useRef<AbortController | null>(null);
  const destination = storyLink(link);
  useEffect(() => {
    running.current = null; setBusy(false); setMessage(''); setError(''); setSupported(false);
    const controller = new AbortController();
    void supportsStories(controller.signal).then(value => { if (!controller.signal.aborted) setSupported(value); });
    return () => { controller.abort(); running.current?.abort(); };
  }, [destination]);
  if (!supported || !destination) return null;
  const share = async () => {
    if (running.current) return;
    const controller = new AbortController(); running.current = controller;
    setBusy(true); setError(''); setMessage('');
    try {
      const images = await withDeadline(createStoryImages(card), 10000, controller.signal, 'Не удалось подготовить историю за 10 секунд. Повторите попытку.');
      const outcome = await sendStory(images, destination, controller.signal);
      if (!controller.signal.aborted && outcome === 'sent') setMessage('История передана в VK. Публикацию подтверждает пользователь в редакторе.');
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Не удалось открыть историю VK. Повторите попытку.');
    } finally {
      if (!controller.signal.aborted) { running.current = null; setBusy(false); }
    }
  };
  return <div className="story-share"><Button mode="secondary" size="m" disabled={busy} aria-busy={busy} onClick={() => void share()}>{busy ? 'Готовим историю…' : 'В историю VK'}</Button>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </div>;
}
