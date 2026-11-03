import { expect, it } from 'vitest';
import fixtures from '../../admin-panel/src/stories/api-fixtures.json';
import { validApiData } from '../src/api/validate';
it.each(Object.entries(fixtures).filter(([path])=>path.startsWith('/')&&!path.startsWith('/admin/')))('accepts current backend %s',(path,data)=>{
  expect(validApiData(path,data,path==='/me/visit'?'POST':path==='/me/notifications'?'PUT':'GET')).toBe(true);
});
