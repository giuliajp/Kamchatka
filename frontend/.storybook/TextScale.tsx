import { useLayoutEffect } from 'react';

/** Storybook-only text enlargement; does not zoom the canvas or its images. */
export function TextScale({ scale }: { scale: number }) {
  useLayoutEffect(() => {
    if (scale === 1) return;
    const html = document.documentElement;
    const oldFontSize = html.style.fontSize;
    const restores: (() => void)[] = [];
    for (const root of document.querySelectorAll<HTMLElement>('.ui-root')) {
      const computed = getComputedStyle(root);
      const changes = Array.from(computed).filter((name) => /^--vkui--font_.*--(font_size|line_height)--/.test(name))
        .map((name) => [name, computed.getPropertyValue(name)] as const);
      for (const [name, value] of changes) {
        if (!/^\s*\d+(\.\d+)?px\s*$/.test(value)) continue;
        const oldValue = root.style.getPropertyValue(name);
        root.style.setProperty(name, `${parseFloat(value) * scale}px`);
        restores.push(() => { if (oldValue) root.style.setProperty(name, oldValue); else root.style.removeProperty(name); });
      }
    }
    html.style.fontSize = `${parseFloat(getComputedStyle(html).fontSize) * scale}px`;
    return () => { html.style.fontSize = oldFontSize; restores.forEach((restore) => restore()); };
  }, [scale]);
  return null;
}
