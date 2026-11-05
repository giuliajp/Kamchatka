export interface StoryCard { heading: string; title: string; lines: string[]; action: string }
export interface StoryImages { background: string; sticker: string }

export function wrapStoryText(text: string, measure: (text: string) => number, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().slice(0, 1500).split(/\s+/)) {
    if (line && measure(`${line} ${word}`) <= width) { line += ` ${word}`; continue; }
    if (line) lines.push(line);
    line = '';
    for (const letter of Array.from(word)) {
      if (line && measure(line + letter) > width) { lines.push(line); line = ''; }
      line += letter;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = Array.from(lines[maxLines - 1]);
    while (last.length && measure(last.join('') + '…') > width) last = last.slice(0, -1);
    lines[maxLines - 1] = last.join('').trimEnd() + '…';
  }
  return lines;
}

function canvas(width: number, height: number) {
  const element = document.createElement('canvas'); element.width = width; element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('Не удалось подготовить изображение истории. Повторите попытку.');
  return {element, context};
}
async function image(url: string): Promise<HTMLImageElement | undefined> {
  const value = new Image(); value.src = url;
  try { await value.decode(); return value; } catch { return; }
}

export async function createStoryImages(card: StoryCard): Promise<StoryImages> {
  const [cover, logo, font] = await Promise.all([
    image('/figma/map-screen/b5483.png'), image('/figma/map-screen/5b9db.svg'),
    Promise.all([document.fonts.load('700 72px "VK Sans Display"'), document.fonts.load('400 38px "VK Sans Display"')]).then(() => '"VK Sans Display", sans-serif').catch(() => 'system-ui, sans-serif'),
  ]);
  const {element, context: ctx} = canvas(1080, 1920);
  ctx.fillStyle = '#0c4388'; ctx.fillRect(0, 0, 1080, 1920);
  if (cover) {
    const scale = Math.max(1080 / cover.naturalWidth, 1920 / cover.naturalHeight);
    const width = cover.naturalWidth * scale, height = cover.naturalHeight * scale;
    ctx.drawImage(cover, (1080 - width) / 2, (1920 - height) / 2, width, height);
  }
  ctx.fillStyle = 'rgba(8, 32, 62, 0.86)'; ctx.fillRect(0, 0, 1080, 1920);
  ctx.textBaseline = 'top'; ctx.fillStyle = '#ffffff';
  const text = (value: string, y: number, size: number, maxLines: number, bold = false) => {
    ctx.font = `${bold ? 700 : 400} ${size}px ${font}`;
    const lines = wrapStoryText(value, value => ctx.measureText(value).width, 936, maxLines);
    lines.forEach((line, index) => ctx.fillText(line, 72, y + index * size * 1.25));
  };
  if (logo) ctx.drawImage(logo, 72, 220, 345, 150);
  else text('Берингия · Авача', 240, 48, 1, true);
  text(card.heading, 430, 42, 2);
  text(card.title, 600, 72, 4, true);
  card.lines.slice(0, 3).forEach((line, index) => text(line, 1060 + index * 130, 38, 2));
  const sticker = canvas(720, 128);
  sticker.context.fillStyle = '#ffffff'; sticker.context.beginPath(); sticker.context.roundRect(0, 0, 720, 128, 24); sticker.context.fill();
  sticker.context.fillStyle = '#0c4388'; sticker.context.font = `700 36px ${font}`; sticker.context.textAlign = 'center'; sticker.context.textBaseline = 'middle';
  sticker.context.fillText(card.action, 360, 64, 640);
  return {background: element.toDataURL('image/png'), sticker: sticker.element.toDataURL('image/png')};
}
