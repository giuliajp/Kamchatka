import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgramScreen } from '../screens/Content/ProgramScreen';
import { MoreScreen } from '../screens/Content/MoreScreen';
import { ProfileScreen } from '../screens/Content/ProfileScreen';
import { MediaScreen } from '../screens/Content/MediaScreen';
import { LocationsScreen } from '../screens/Content/LocationsScreen';
import { RouteScreen } from '../screens/Content/RouteScreen';
import { fixtureResponse, race } from './fixtures';
const location={id:1,race_id:10,stage_id:103,location_type:'start',name:'Зрительская зона',description:'Тестовый пример опубликованной локации.',latitude:53.1,longitude:158.4,address:null,how_to_get_there:null,image_urls:[],sort_order:0};
const meta={title:'Приложение/Новые разделы',parameters:{docs:{story:{inline:false}}},beforeEach:()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async input=>{const path=String(input).split('?')[0]; const data=path.endsWith('/program')?[{id:1,race_id:10,stage_id:103,event_type:'stage_start',title:'Старт этапа',description:'Событие из тестового расписания.',start_at:'2026-11-03T01:00:00Z',end_at:null,location,image_urls:[],sort_order:0}]:path.endsWith('/locations')?[location]:path.endsWith('/news')?{items:[{id:'-1_1',owner_id:-1,post_id:1,date:'2026-11-03T01:00Z',title:'Новости гонки',preview:'Пример анонса опубликованной записи VK.',cover_url:null,url:'https://vk.com/wall-1_1'}],total:1,stale:true}:path.endsWith('/photos')?{days:[{date:'2026-11-03',photos:[{id:'p1',date:'2026-11-03T01:00Z',text:'Фото гонки — пример для Storybook',url:`${locationOrigin()}/figma/map-screen/b5483.png`,vk_url:'https://vk.com/photo-1_1'}]}],stale:false}:fixtureResponse(String(input));return new Response(JSON.stringify({data,error:null}));};
  return()=>{globalThis.fetch=original;};
}} satisfies Meta;
function locationOrigin(){return window.location.origin;}
export default meta;
type Story=StoryObj<typeof meta>;
export const Program:Story={render:()=> <ProgramScreen raceId={10}/>};
export const More:Story={render:()=> <MoreScreen race={race}/>};
export const Profile:Story={render:()=> <ProfileScreen raceId={10}/>};
export const Media:Story={render:()=> <MediaScreen/>};
export const SpectatorLocations:Story={render:()=> <LocationsScreen raceId={10}/>};
export const RouteAndElevation:Story={render:()=> <RouteScreen race={race}/>};
