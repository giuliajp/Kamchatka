import { vi } from 'vitest';
import { createFixtureApi } from '../src/stories/fixtures';
export * from '../src/stories/fixtures';
export function mockApi(override?: (url: string) => unknown) {
  const respond = createFixtureApi();
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify({ data: override ? override(String(input)) : respond(String(input), init), error: null })));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
