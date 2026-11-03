import type { Contact, Faq, Location, News, Photos, ProgramEvent } from '../types/content';
export const spectatorLocation:Location={id:1,race_id:10,stage_id:103,location_type:'start',name:'Зрительская зона',description:'Тестовое описание локации.',latitude:53.1,longitude:158.4,address:'Тестовый адрес',how_to_get_there:'Тестовый маршрут проезда.',sort_order:0};
export const programEvent:ProgramEvent={id:1,race_id:10,stage_id:103,event_type:'stage_start',title:'Старт этапа',description:'Событие из тестового расписания.',start_at:'2026-11-03T01:00:00Z',end_at:'2026-11-03T02:00:00Z',location:spectatorLocation,sort_order:0};
export const faq:Faq={id:1,question:'Где смотреть результаты?',answer:'В разделе «Результаты».',sort_order:0};
export const contact:Contact={id:1,title:'Организатор',name:'Тестовый организатор',phone:'+7 (000) 000-00-00',email:'organizer@example.org',url:'https://example.org',sort_order:0};
export const news:News={items:[{id:'-1_1',owner_id:-1,post_id:1,date:'2026-11-03T01:00Z',title:'Новости гонки',preview:'Пример анонса опубликованной записи VK.',cover_url:'https://example.org/cover.jpg',url:'https://vk.com/wall-1_1'}],total:1,stale:true};
export const photos:Photos={days:[{date:'2026-11-03',photos:[{id:'p1',date:'2026-11-03T01:00Z',text:'Фото гонки',url:'https://example.org/photo.jpg',vk_url:'https://vk.com/photo-1_1'}]}],stale:false};
