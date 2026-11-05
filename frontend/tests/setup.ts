import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, vi } from 'vitest';

afterEach(cleanup);
// VKUI's press highlight schedules a 600 ms reset without cancelling it on unmount.
// Let that library timer finish before Vitest removes the browser environment.
afterAll(() => new Promise(resolve => setTimeout(resolve, 650)));
beforeEach(() => { history.replaceState(null, '', '/'); localStorage.setItem('avacha:welcome', '1'); });

// jsdom has no layout engine; provide browser APIs used by the real VKUI.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })),
});
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom has no viewport scrolling; VKUI restores it when modals close.
window.scrollTo = vi.fn();
