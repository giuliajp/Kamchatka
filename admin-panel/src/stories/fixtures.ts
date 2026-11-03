// Captured from a dedicated local test database. Never imported by the production app.
import captured from './api-fixtures.json';
import type { Entry, Monitoring, ProtocolDetail, Race, Stage, Tracker } from '../types';
export const race = captured['/admin/races'][0] as Race;
export const stage = captured['/admin/races/1/stages'][0] as Stage;
export const entry = captured['/admin/races/1/participants'][0] as Entry;
export const monitoring = captured['/admin/stages/1/monitoring'] as Monitoring;
export const protocol = captured['/admin/protocols/2'] as ProtocolDetail;
export const tracker = captured['/admin/trackers'][0] as Tracker;
export function fixtureData(path: string): unknown {
  const fixtures: Record<string,unknown> = captured;
  if (path === '/admin/login') return {token:'storybook-session',expires_at:'2099-01-01T00:00Z',admin:captured['/admin/me']};
  return fixtures[path] ?? fixtures[Object.keys(fixtures).find(key=>key.split('?')[0]===path.split('?')[0]) ?? ''];
}
export function installApi(override?: (path:string) => unknown) {
  const original=globalThis.fetch;
  globalThis.fetch=async input=>{
    const url=new URL(String(input),'http://localhost');const path=url.pathname.replace(/^\/api/,'')+url.search;
    const data=override?.(path) ?? fixtureData(path);
    return new Response(JSON.stringify(data===undefined?{data:null,error:{code:'unavailable',message:'В этом примере сервис недоступен',details:null}}:{data,error:null}),{status:data===undefined?503:200});
  };
  return ()=>{globalThis.fetch=original;};
}
