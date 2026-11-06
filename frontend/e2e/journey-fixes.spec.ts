import {test,expect,type Page} from '@playwright/test';
import {front,publicApi,ready,noOverflow} from './fixtures';
import {race,participant,positions} from '../src/stories/fixtures';

// Unlike root font-size scaling, this doubles every rendered text size once.
async function actualTextScale(page:Page,selector:string){
 await page.locator(selector).evaluate(root=>{
  const nodes=[root,...root.querySelectorAll<HTMLElement>('*')].map(el=>{
   const css=getComputedStyle(el);return {el:el as HTMLElement,font:parseFloat(css.fontSize),line:parseFloat(css.lineHeight)};
  });
  for(const {el,font,line} of nodes){el.style.fontSize=font*2+'px';if(Number.isFinite(line))el.style.lineHeight=line*2+'px';}
 });
}

test('BUG-08: real Leaflet route survives refresh, navigation, venue clicks and reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await publicApi(page);
 await ready(page,front+'/#race=10&stage=103&section=program&view=watch&day=2099-01-01');
 for(let i=0;i<2;i++){
  const marker=page.locator('.content-map path.leaflet-interactive');
  await expect(marker).toHaveCount(1);await marker.click();
  await expect(page.getByRole('dialog')).toContainText('Зрительская зона');
  await expect(page.getByRole('button',{name:'Закрыть карточку'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect(marker).toBeVisible();
  await page.getByRole('button',{name:'Расписание',exact:true}).first().click();
  await page.getByRole('button',{name:'Где смотреть',exact:true}).first().click();
  await expect(marker).toBeVisible();await page.reload();
 }
 expect(errors).toEqual([]);
});

test('BUG-02: protocol notice resolves discipline names and hides unknown codes',async({page})=>{
 await publicApi(page,{intercept:async(_r,path)=>path.endsWith('/positions')?{data:{...positions,official_protocol_disciplines:['ski_2','unknown_internal']}}:undefined});
 await ready(page);await expect(page.locator('.protocol-notice')).toContainText('Лыжи, 2 собаки');
 await expect(page.locator('.protocol-notice')).not.toContainText('ski_2');
 await expect(page.locator('.protocol-notice')).not.toContainText('unknown_internal');
});

test('BUG-01: long discipline keeps Mine alongside the filter and compact rows',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 const discipline={...participant.discipline,name:'Лыжи — длинная дистанция, 2 собаки'};
 await publicApi(page,{intercept:async(_r,path)=>path==='/races/10'?{data:{...race,disciplines:[{...discipline,participants_count:1}]}}:path==='/races/10/participants'?{data:[{...participant,discipline}]}:undefined});
 await ready(page,front+'/#race=10&section=participants');
 const row=page.locator('.participant-row').first();await expect(row).toBeVisible();
 const tabs=page.getByRole('tablist',{name:'Фильтр участников'}).getByRole('tab');
 const a=await tabs.nth(0).boundingBox(),b=await tabs.nth(1).boundingBox();
 expect(Math.abs(a!.y-b!.y)).toBeLessThanOrEqual(4);expect((await row.boundingBox())!.height).toBeLessThanOrEqual(82);
 await tabs.first().click();await expect(page.getByRole('radio',{name:discipline.name})).toBeVisible();
 await page.keyboard.press('Escape');await actualTextScale(page,'.race-screen');await noOverflow(page);
});

for(const width of [320,360,390,768,1280])for(const theme of ['light','dark'] as const){
 test(`BUG-06: participant focus ${width} ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:900});await page.emulateMedia({colorScheme:theme});
 await publicApi(page);await ready(page,front+'/#race=10&section=participants');
 const opener=page.getByRole('button',{name:'Открыть карточку Алиса Иванова'});
 for(let attempt=0;attempt<2;attempt++){
  await opener.click();await page.getByRole('dialog',{name:'Карточка участника'}).waitFor();
  expect(await page.locator('[data-focus-guard]').count()).toBe(2);
  await page.getByText('История выступлений',{exact:true}).waitFor();
  if(attempt===1)await actualTextScale(page,'[role=dialog]');
  await page.getByRole('button',{name:'Свернуть',exact:true}).focus();
  for(const key of ['Tab','Shift+Tab'])for(let i=0;i<18;i++){
   await page.keyboard.press(key);
   expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('[role=dialog]')))).toBe(true);
  }
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(opener).toBeFocused();
 }
});
}

for(const width of [320,360,390,768,1280])for(const theme of ['light','dark'] as const){
 test(`BUG-07: notification text200 ${width} ${theme}`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:width===320?568:900});await page.emulateMedia({colorScheme:theme});
  const index=await (await page.request.get('http://127.0.0.1:5187/index.json')).json();
  const story=Object.values(index.entries).find((v:unknown)=>(v as {title:string;name:string}).title.endsWith('/Modal card')&&(v as {name:string}).name==='Предложение подписки') as {id:string};
  await page.goto(`http://127.0.0.1:5187/iframe.html?id=${story.id}&viewMode=story&globals=appearance:${theme}`);
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await page.locator('[data-focus-guard]').first().waitFor();
  await page.evaluate(()=>document.fonts.ready);await actualTextScale(page,'[role=dialog]');
  const box=await dialog.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);
  for(const name of ['Позже','Да, уведомлять']){
   const button=page.getByRole('button',{name,exact:true});await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();
   expect(await button.locator('.vkuiButton__content').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  }
  await noOverflow(page);const screenshot=testInfo.outputPath('text200.png');await page.screenshot({path:screenshot});
  await testInfo.attach('text200',{path:screenshot,contentType:'image/png'});
  await page.getByRole('button',{name:'Позже',exact:true}).click();await expect(dialog).toHaveCount(0);
 });
}
