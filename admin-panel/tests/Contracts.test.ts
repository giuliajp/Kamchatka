import { expect, it } from 'vitest';
import fixtures from '../src/stories/api-fixtures.json';
import { validResponse } from '../src/validate';
it.each(Object.entries(fixtures).filter(([path])=>path.startsWith('/')))('accepts the unchanged backend contract %s',(path,data)=>{
  expect(validResponse(path,data,path==='/me/visit'?'POST':path==='/me/notifications'?'PUT':'GET')).toBe(true);
});
it('rejects incomplete editable stages, disciplines, athlete cards, penalties and polling results',()=>{
 expect(validResponse('/admin/races/1/stages',[{id:1,number:1,name:null,status:'planned'}])).toBe(false);
 expect(validResponse('/admin/disciplines',[{id:1,code:'sled',name:'Нарта'}])).toBe(false);
 expect(validResponse('/admin/participants/1',{id:1},'PATCH')).toBe(false);
 expect(validResponse('/admin/race-participants/1/penalties',[{id:1}])).toBe(false);
 expect(validResponse('/admin/trackers/poll',{summary:'ok'},'POST')).toBe(false);
});
