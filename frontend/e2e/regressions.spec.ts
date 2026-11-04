import {test,expect} from '@playwright/test';
import {admin,front,adminApi,publicApi,ready,noOverflow,textScale,accessibility} from './fixtures';

for(const [width,height] of [[320,568],[390,844],[768,1024],[1280,900],[844,390]]){
 for(const theme of ['light','dark'] as const)for(const scale of [1,2]){
  test(`map ${width}x${height} ${theme} text${scale}`,async({page},testInfo)=>{
   await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme,reducedMotion:scale===2?'reduce':'no-preference'});
   await publicApi(page);await ready(page);
   await expect(page.locator('.race-screen__map .leaflet-container')).toBeVisible();
   if(scale===2)await textScale(page);
   await noOverflow(page);
   const timestamp=page.locator('.map-time');await timestamp.scrollIntoViewIfNeeded();await expect(timestamp).toBeVisible();
   const timeBox=await timestamp.boundingBox(),footer=await page.locator('.race-screen__footer').boundingBox();
   expect(timeBox!.y+timeBox!.height).toBeLessThanOrEqual(footer!.y+1);
   for(const button of await page.locator('.map-controls button').all()){
    await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();
    const box=await button.boundingBox(),nav=await page.locator('.race-screen__footer').boundingBox();
    expect(box!.y+box!.height).toBeLessThanOrEqual(nav!.y+1);
   }
   await accessibility(page,testInfo);
  });
  test(`admin ${width}x${height} ${theme} text${scale}`,async({page},testInfo)=>{
   await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:scale===2?'reduce':'no-preference'});
   await page.addInitScript(theme=>localStorage.setItem('avacha:admin-theme',theme),theme);
   await adminApi(page);await ready(page,admin);
   await expect(page.getByRole('heading',{name:'Быстрый ввод отметки'})).toBeVisible();
   if(scale===2)await textScale(page);
   await noOverflow(page);await page.getByLabel('Примечание судьи').scrollIntoViewIfNeeded();
   await expect(page.getByLabel('Примечание судьи')).toBeInViewport();
   await accessibility(page,testInfo);
  });
 }
}

test('checkpoint draft survives polling, preserves microseconds and resolves a conflict explicitly',async({page})=>{
 const api=await adminApi(page);const original=structuredClone(api.pass);await ready(page,admin);
 await expect(page.getByLabel('Прибытие · Камчатка')).toHaveValue('2026-11-03T12:01:23');
 await page.getByLabel('Примечание судьи').fill('my draft');
 Object.assign(api.pass,{note:'other judge',departed_at:'2026-11-03T00:30:45.654321Z',updated_at:'2026-11-04T10:00:00Z'});
 await page.getByRole('button',{name:'Обновить мониторинг',exact:true}).click();
 await page.getByRole('button',{name:'Исправить отметку',exact:true}).click();
 await expect(page.getByRole('region',{name:'Актуальная отметка'})).toContainText('other judge');
 await expect(page.getByLabel('Примечание судьи')).toHaveValue('my draft');
 await expect(page.getByRole('button',{name:'Исправить отметку',exact:true})).toBeDisabled();
 expect(api.writes[0].body).toEqual({expected_updated_at:original.updated_at,note:'my draft'});
 await page.getByRole('button',{name:'Применить мой черновик к новой версии'}).click();
 await page.getByRole('button',{name:'Исправить отметку',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
 await expect(page.getByText('Сохранено',{exact:true})).toBeVisible();expect(api.writes).toHaveLength(2);
 expect(api.writes[1].body).toEqual({expected_updated_at:'2026-11-04T10:00:00Z',note:'my draft'});
 expect(api.pass.arrived_at).toBe(original.arrived_at);expect(api.pass.departed_at).toBe('2026-11-03T00:30:45.654321Z');
});

test('expired session preserves the draft through the same organizer login',async({page})=>{
 let expired=true;
 const api=await adminApi(page,{intercept:async(request,path)=>{
  if(expired&&request.method()==='PATCH'&&path.includes('/checkpoint-passes/'))return {status:401,error:{code:'unauthorized',message:'Сессия истекла'}};
 }});
 await ready(page,admin);await page.getByLabel('Примечание судьи').fill('draft after login');
 await page.getByRole('button',{name:'Исправить отметку',exact:true}).click();
 await page.getByLabel('Логин').fill('judge');await page.getByLabel('Пароль').fill('fixture-password');expired=false;
 await page.getByRole('button',{name:'Войти',exact:true}).click();
 await expect(page.getByLabel('Примечание судьи')).toHaveValue('draft after login');
 await page.getByRole('button',{name:'Исправить отметку',exact:true}).click();await expect(page.getByText('Сохранено',{exact:true})).toBeVisible();
 expect(api.writes.at(-1)).toMatchObject({token:'Bearer session-two',body:{note:'draft after login'}});
});

test('blocked storage leaves login, theme and logout usable',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await adminApi(page,{storage:true});
 await page.addInitScript(()=>{for(const name of ['localStorage','sessionStorage'])Object.defineProperty(window,name,{get(){throw new DOMException('Blocked','SecurityError');}});});
 await ready(page,admin);await page.getByLabel('Логин').fill('judge');await page.getByLabel('Пароль').fill('fixture-password');
 await page.getByRole('button',{name:'Войти',exact:true}).click();
 await expect(page.getByText(/После обновления страницы потребуется войти снова/)).toBeVisible();
 await page.getByRole('combobox',{name:'Тема',exact:true}).selectOption('dark');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'Выйти',exact:true}).click();await expect(page.getByLabel('Логин')).toBeVisible();expect(errors).toEqual([]);
});

test('40 media cards use one shared GET and one refresh after a save',async({page})=>{
 const api=await publicApi(page,{cards:40});await ready(page,front+'/?vk_are_notifications_enabled=1#race=10&section=more&page=media');
 await expect(page.getByRole('button',{name:'Сохранить',exact:true})).toHaveCount(40);
 await expect(page.getByRole('button',{name:'Сохранить',exact:true}).first()).toBeEnabled();
 expect(api.gets.get('/me/bookmarks')).toBe(1);const baseline=new Map(api.gets);
 await page.getByRole('button',{name:'Сохранить',exact:true}).first().click();await expect(page.getByRole('button',{name:'Убрать из сохранённого'})).toBeVisible();
 expect(api.gets.get('/me/bookmarks')).toBe(2);
 for(const [path,count] of baseline)if(path!=='/me/bookmarks')expect(api.gets.get(path),path).toBe(count);
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.includes('/me/')))).toEqual([]);
});

test('40 reminders share one resource and invalidate only reminders',async({page})=>{
 const api=await publicApi(page,{cards:40});
 await ready(page,front+'/?vk_are_notifications_enabled=1#race=10&stage=103&section=program&view=watch&location=1&allEvents=1&reminders=1&day=2099-01-01');
 await expect(page.getByRole('button',{name:'Напомнить о событии'})).toHaveCount(40);
 await expect(page.getByRole('button',{name:'Напомнить о событии'}).first()).toBeEnabled();
 expect(api.gets.get('/me/reminders')).toBe(1);const baseline=new Map(api.gets);
 await page.getByRole('button',{name:'Напомнить о событии'}).first().click();await expect(page.getByRole('button',{name:'Отменить напоминание'})).toBeVisible();
 expect(api.gets.get('/me/reminders')).toBe(2);
 for(const [path,count] of baseline)if(path!=='/me/reminders')expect(api.gets.get(path),path).toBe(count);
});

test('real Leaflet survives corrupt routes and retains venue navigation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await publicApi(page,{brokenRoute:true});await ready(page,front+'/#race=10&stage=103&section=program&view=watch&day=2099-01-01');
 await expect(page.getByText(/Маршрут недоступен/)).toBeVisible();
 const marker=page.locator('.content-map .leaflet-interactive').first();await expect(marker).toBeVisible();await marker.click();
 await expect(page.getByRole('dialog')).toContainText('Зрительская зона');
 await expect(page.getByRole('button',{name:'Закрыть карточку'})).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Расписание',exact:true}).click();expect(errors).toEqual([]);
});

test('offline then reconnect keeps the map and reloads the live resources',async({page,context})=>{
 const api=await publicApi(page);await ready(page);await expect(page.locator('.leaflet-container')).toBeVisible();
 const before=api.gets.get('/races/10/positions')??0;
 await context.setOffline(true);await expect(page.getByText('Нет соединения',{exact:true}).first()).toBeVisible();
 await context.setOffline(false);await expect.poll(()=>api.gets.get('/races/10/positions')??0).toBeGreaterThan(before);
 await expect(page.getByText('Нет соединения',{exact:true})).toHaveCount(0);await expect(page.locator('.leaflet-container')).toBeVisible();
});

test('late search responses cannot replace the newer filter, and API errors retain confirmed rows',async({page})=>{
 let release!:()=>void;let delayed=false,released=false,fail=false;
 await publicApi(page,{intercept:async(request,path)=>{
  if(path!=='/races/10/participants')return;
  const q=new URL(request.url()).searchParams.get('q');
  if(fail)return {status:503,error:{code:'unavailable',message:'Попробуйте позднее'}};
  if(q==='Алиса'){
   delayed=true;await new Promise<void>(resolve=>{release=resolve;});released=true;
  }
 }});
 await ready(page,front+'/#race=10&section=participants');
 const person=page.getByRole('button',{name:'Открыть карточку Алиса Иванова'});
 await expect(person).toBeVisible();
 const search=page.getByLabel('Поиск участника',{exact:true});
 await search.fill('Алиса');await expect.poll(()=>delayed).toBe(true);
 await search.fill('Nobody');await expect(person).toHaveCount(0);
 release();await expect.poll(()=>released).toBe(true);await expect(person).toHaveCount(0);
 await search.fill('');await expect(person).toBeVisible();fail=true;
 // Reconnect refreshes the same resource, so the last confirmed rows remain visible on 503.
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.getByText('Не удалось обновить данные',{exact:true})).toBeVisible();await expect(person).toBeVisible();
 fail=false;await page.getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.getByText('Не удалось обновить данные',{exact:true})).toHaveCount(0);
});
