import { vi } from 'vitest';
import { fixtureResponse } from '../src/stories/fixtures';
export * from '../src/stories/fixtures';
export function mockApi(override?: (url: string) => unknown) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({ data: override ? override(String(input)) : fixtureResponse(String(input)), error: null })));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
