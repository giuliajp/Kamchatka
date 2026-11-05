import bridge, {type ShowStoryBoxOptions} from '@vkontakte/vk-bridge';
import type {StoryImages} from './storyImage';

export function storyLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['vk.com', 'vk.ru'].includes(url.hostname) || url.username || url.password || url.port || !/^\/(app[1-9]\d*|wall-?\d+_\d+)$/.test(url.pathname)) return;
    url.search = '';
    return url.href;
  } catch { return; }
}

// The host can close its editor without settling the Bridge promise.
export function withDeadline<T>(work: Promise<T>, milliseconds: number, signal: AbortSignal, message: string): Promise<T> {
  let timer: number;
  let abort: () => void;
  const result = new Promise<T>((resolve, reject) => {
    abort = () => reject(new DOMException('Aborted', 'AbortError'));
    timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) abort();
    work.then(resolve, reject);
  });
  return result.finally(() => {
    window.clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  });
}

export async function supportsStories(signal: AbortSignal): Promise<boolean> {
  if (!bridge.isEmbedded()) return false;
  try { return await withDeadline(bridge.supportsAsync('VKWebAppShowStoryBox'), 5000, signal, 'VK недоступен'); }
  catch { return false; }
}

export async function sendStory(images: StoryImages, value: string, signal: AbortSignal): Promise<'sent' | 'cancelled'> {
  const link = storyLink(value);
  if (!link) throw new Error('Ссылка для истории недоступна. Откройте приложение в VK.');
  signal.throwIfAborted();
  const options: ShowStoryBoxOptions = {
    background_type: 'image', blob: images.background, locked: true,
    stickers: [{sticker_type: 'renderable', sticker: {
      content_type: 'image', blob: images.sticker, original_width: 720, original_height: 128, can_delete: false,
      transform: {relation_width: 0.8, translation_y: 0.6, gravity: 'center'},
      clickable_zones: [{action_type: 'link', action: {link, tooltip_text_key: link.includes('/wall') ? 'tooltip_open_post' : 'tooltip_open_page'},
        clickable_area: [{x: 0, y: 0}, {x: 720, y: 0}, {x: 720, y: 128}, {x: 0, y: 128}]}],
    }}],
  };
  try {
    const result = await withDeadline(bridge.send('VKWebAppShowStoryBox', options), 60000, signal, 'VK не подтвердил завершение. Проверьте историю перед повтором.');
    if (result.result !== true) throw new Error('VK не подтвердил открытие редактора. Повторите попытку.');
    return 'sent';
  } catch (error) {
    if ((error as {error_data?: {error_code?: number}} | null)?.error_data?.error_code === 4) return 'cancelled';
    throw error;
  }
}
