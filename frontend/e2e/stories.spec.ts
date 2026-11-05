import {writeFile,readFile,readdir} from 'node:fs/promises';
import {test,expect,type Page} from '@playwright/test';
import type {ShowStoryBoxOptions} from '@vkontakte/vk-bridge';
import {participant} from '../src/stories/fixtures';
import {front,publicApi,noOverflow,textScale,accessibility} from './fixtures';

// Exercise the installed Bridge transport. Only the native host boundary is simulated.
async function vkHost(page:Page){
 await page.addInitScript(()=>{
  Reflect.set(window,'__stories',[]);
  const reply=(method:string,raw:string)=>{
   const params=JSON.parse(raw);
   if(method==='VKWebAppShowStoryBox')Reflect.get(window,'__stories').push(params);
   queueMicrotask(()=>window.dispatchEvent(new CustomEvent('VKWebAppEvent',{detail:{type:method+'Result',data:{result:true,request_id:params.request_id}}})));
  };
  Reflect.set(window,'AndroidBridge',Object.fromEntries(['VKWebAppInit','VKWebAppShowStoryBox'].map(method=>[method,(raw:string)=>reply(method,raw)])));
 });
}
const destinations={
 participant:{route:'race=10&section=map&stage=103&person=501&participant=9001',link:'https://vk.com/app12345#race=10&person=501&participant=9001&stage=103'},
 result:{route:'race=10&section=results&view=track&stage=103&person=501&participant=9001',link:'https://vk.com/app12345#race=10&person=501&participant=9001&stage=103&section=results&view=track'},
 news:{route:'race=10&section=more&page=media',link:'https://vk.com/wall-1_1'},
};
for(const [name,target] of Object.entries(destinations)){
 test(`real Canvas ${name} story and clean clickable destination`,async({page},testInfo)=>{
  await publicApi(page);await vkHost(page);await page.goto(front+'/?vk_app_id=12345&sign=private-sign#'+target.route);
  const button=page.getByRole('button',{name:'В историю VK',exact:true});await button.evaluate(el=>el.scrollIntoView({block:'center'}));

  await button.click();
  await expect(page.getByRole('status').filter({hasText:'История передана в VK'})).toBeVisible();
  const stories=await page.evaluate(()=>Reflect.get(window,'__stories') as ShowStoryBoxOptions[]);expect(stories).toHaveLength(1);
  const options=stories[0];expect(options.background_type).toBe('image');expect(JSON.stringify(options)).not.toContain('private-sign');
  const sticker=options.stickers![0];expect(sticker.sticker_type).toBe('renderable');
  if(sticker.sticker_type!=='renderable')throw new Error('Expected a clickable image sticker');
  expect(sticker.sticker.clickable_zones).toEqual([{action_type:'link',action:{link:target.link,tooltip_text_key:name==='news'?'tooltip_open_post':'tooltip_open_page'},clickable_area:[{x:0,y:0},{x:720,y:0},{x:720,y:128},{x:0,y:128}]}]);
  const background=options.blob!;expect(background).toMatch(/^data:image\/png;base64,/);expect(background.length).toBeGreaterThan(10000);
  const png=await page.evaluate(async({background,sticker})=>{
   const photo=new Image();photo.src=background;await photo.decode();
   const c=document.createElement('canvas');c.width=photo.width;c.height=photo.height;
   const ctx=c.getContext('2d')!;ctx.drawImage(photo,0,0);
   const colors=new Set<string>();const data=ctx.getImageData(0,0,c.width,c.height).data;
   for(let i=0;i<data.length;i+=400)colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
   const badge=new Image();badge.src=sticker;await badge.decode();ctx.drawImage(badge,108,1459,864,154);
   return {width:c.width,height:c.height,colors:colors.size,stickerWidth:badge.width,stickerHeight:badge.height,composite:c.toDataURL('image/png')};
  },{background,sticker:'blob' in sticker.sticker?sticker.sticker.blob:''});
  expect(png.width).toBe(1080);expect(png.height).toBe(1920);expect(png.colors).toBeGreaterThan(10);expect([png.stickerWidth,png.stickerHeight]).toEqual([720,128]);
  const path=testInfo.outputPath(`${name}-story.png`);await writeFile(path,Buffer.from(png.composite.split(',')[1],'base64'));
  await testInfo.attach(`${name}-story.png`,{path,contentType:'image/png'});
 });
}
for(const width of [320,390,768,1280])for(const theme of ['light','dark'] as const){
 test(`story actions ${width}px ${theme} enlarged text`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:844});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await publicApi(page);await vkHost(page);
  for(const target of Object.values(destinations)){
   await page.goto(front+'/?vk_app_id=12345#'+target.route);await expect(page.getByRole('button',{name:'В историю VK',exact:true})).toBeVisible();await textScale(page);
   const button=page.getByRole('button',{name:'В историю VK',exact:true});await button.evaluate(el=>el.scrollIntoView({block:'center'}));await expect(button).toBeInViewport();await noOverflow(page);
   await button.focus();await expect(button).toBeFocused();
   expect(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
   await button.press('Enter');await expect(page.getByRole('status').filter({hasText:'История передана в VK'})).toBeVisible();await accessibility(page,testInfo);
  }
 });
}
test('Canvas still creates a usable card when decoration and fonts fail',async({page},testInfo)=>{
 await publicApi(page);await vkHost(page);await page.route('**/figma/map-screen/**',r=>r.abort());await page.route('**/fonts/**',r=>r.abort());
 await page.goto(front+'/?vk_app_id=12345#'+destinations.news.route);await page.getByRole('button',{name:'В историю VK'}).click();await expect(page.getByText(/История передана в VK/)).toBeVisible();
 const options=await page.evaluate(()=>Reflect.get(window,'__stories')[0] as ShowStoryBoxOptions);await testInfo.attach('fallback-story.png',{body:Buffer.from(options.blob!.split(',')[1],'base64'),contentType:'image/png'});
});

test('long Russian names and missing official results fit a real PNG',async({page},testInfo)=>{
 await publicApi(page,{intercept:async(_request,path)=>path==='/races/10/participants'?{data:[{...participant,full_name:'Александра Константинопольская Александровна Оченьдлиннаяфамилияучастникагонки',place:null,total_time:null}]}:undefined});await vkHost(page);
 await page.goto(front+'/?vk_app_id=12345#'+destinations.result.route);await page.getByRole('button',{name:'В историю VK'}).click();await expect(page.getByText(/История передана в VK/)).toBeVisible();
 const options=await page.evaluate(()=>Reflect.get(window,'__stories')[0] as ShowStoryBoxOptions);const path=testInfo.outputPath('long-name-missing-results.png');await writeFile(path,Buffer.from(options.blob!.split(',')[1],'base64'));await testInfo.attach('long-name-missing-results.png',{path,contentType:'image/png'});
});

test('retained Figma assets exist and decode in production and Storybook',async({page})=>{
 const source=new URL('../public/figma/',import.meta.url);
 const paths=(await readdir(source,{recursive:true})).filter(path=>/\.(png|svg)$/.test(path)).sort();expect(paths).toHaveLength(33);
 expect(paths.filter(path=>path.startsWith('map-screen/'))).toEqual(['map-screen/5b9db.svg','map-screen/b5483.png']);
 for(const build of ['dist','storybook-static'])for(const path of paths){
  expect(await readFile(new URL(`../${build}/figma/${path}`,import.meta.url))).toEqual(await readFile(new URL(path,source)));
 }
 for(const origin of [front,'http://127.0.0.1:5187']){
  await page.goto(origin);
  const decoded=await page.evaluate(async paths=>Promise.all(paths.map(async path=>{const image=new Image();image.src='/figma/'+path;await image.decode();return image.naturalWidth>0&&image.naturalHeight>0;})),paths);
  expect(decoded).toEqual(paths.map(()=>true));
 }
});
