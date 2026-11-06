import { RaceApp } from '../app/RaceApp';
import { userEvent, within } from 'storybook/test';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgramScreen } from '../screens/Content/ProgramScreen';
import { MoreScreen } from '../screens/Content/MoreScreen';
import { ProfileScreen } from '../screens/Content/ProfileScreen';
import { ResultsScreen } from '../screens/Results/ResultsScreen';
import { TrackScreen } from '../screens/Content/TrackScreen';
import { Onboarding } from '../components/Onboarding';
import { fixtureResponse, race, stage, participant } from './fixtures';
import { programEvent, spectatorLocation } from './contentFixtures';
import '../app/content.css';
import '../screens/Map/map.css';
const image = `${window.location.origin}/figma/352-8418/b9ffe.png`;
const place = {...spectatorLocation,location_type:'finish',image_urls:[image,image]};
const event = {...programEvent,event_type:'master_class',title:'Мастер-класс для детей',image_urls:[image,image],location:place};
const meta = { title:'Приложение/Обновление дизайна',parameters:{docs:{story:{inline:false}}},beforeEach:context=>{
  const original=fetch;const fragment=location.hash;
  history.replaceState(null,'','#'+(context.parameters.route || 'section=program&day=2026-11-03'));
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input),location.origin);const path=url.pathname.replace(/^\/api/,'');
    let data:unknown;
    if(path==='/program') data=[event,{...event,id:2,event_type:'meeting',title:'Встреча с каюрами',start_at:'2026-11-03T03:00Z',end_at:'2026-11-03T04:00Z'}];
    else if(path==='/locations') data=[place];
    else if(path==='/me') data={vk_user_id:42,participant_id:501,race_entries:[{race_id:10,race_participant_id:9001,start_number:14}]};
    else if(path==='/me/bookmarks') data=[{kind:'protocol',item_id:'stage:103',title:'Протокол третьего этапа',url:'https://example.org/protocol.pdf',image_url:null,created_at:stage.start_at}];
    else if(path==='/stages/103') data={...stage,protocol_pdf_url:'https://example.org/protocol.pdf'};
    else if(path==='/races') data=[race,{...race,id:11,year:2025,name:'Авача 2025',status:'finished'}];
    else if(path==='/photos/albums') data={items:[{id:1,title:'Авача 2025',size:20,url:'https://vk.com/album-1_1',cover_url:image}],stale:false};
    else if(path.endsWith('/arrival-estimate')) data={stage_id:103,generated_at:stage.start_at,tracking_interval_minutes:20,first:{from:'2026-11-03T02:00Z',to:'2026-11-03T02:30Z'},leaders:[],note:'Оценка по GPS-трекерам, время может измениться'};
    else if(path==='/guest-info') data={how_to_get_there:[{id:1,title:'На автомобиле',text:'Информация о проезде от организаторов.'}],what_to_bring:[{id:2,title:null,text:'Тёплая одежда и термос.'}],safety:[{id:3,title:null,text:'Не выходите на трассу.'}]};
    else if(path==='/races/10/participants') data=[{...participant,photo_url:image,dog_breed:'Ездовые лайки'}];
    else data=fixtureResponse(String(input));
    void init;return new Response(JSON.stringify({data,error:null}));
  };
  return()=>{globalThis.fetch=original;history.replaceState(null,'',fragment || location.pathname+location.search);};
} } satisfies Meta;
export default meta;
type Story=StoryObj<typeof meta>;
export const Program:Story={render:()=> <ProgramScreen raceId={10}/>};
export const EmptyDay:Story={parameters:{route:'section=program&day=2026-11-04'},render:Program.render};
export const EventCompact:Story={parameters:{route:'section=program&day=2026-11-03&event=1'},render:Program.render};
export const EventExpanded:Story={parameters:{route:'section=program&day=2026-11-03&event=1&expanded=1'},render:Program.render};
export const VenueReminders:Story={parameters:{route:'section=program&view=watch&day=2026-11-03&location=1&expanded=1&reminders=1'},render:Program.render};
export const More:Story={parameters:{route:'section=more'},render:()=> <MoreScreen race={race}/>};
export const Profile:Story={parameters:{route:'section=more&page=profile'},render:()=> <ProfileScreen raceId={10}/>};
const renderResults=()=> <ResultsScreen race={race} raceId={10} stageId={103} stageNumber={3} discipline="sled_8" onSelect={()=>undefined}/>;
export const OwnResult:Story={parameters:{route:'section=results'},render:renderResults};
export const Protocol:Story={parameters:{route:'section=results&view=protocol'},render:renderResults};
export const Archive:Story={parameters:{route:'section=results&view=archive'},render:renderResults};
export const OwnTrack:Story={render:()=> <TrackScreen race={race} stageId={103} entryId={9001}/>};
function Welcome(){const [done,setDone]=useState(false);return done?<p>Знакомство завершено.</p>:<Onboarding onFinish={()=>setDone(true)}/>;}
export const WelcomeAndSevenSteps:Story={render:()=> <Welcome/>};

export const AllVenueEvents:Story={parameters:{route:'section=program&day=2026-11-03&location=1&allEvents=1'},render:Program.render};
export const SelectDayAndReturn:Story={...Program,play:async({canvasElement})=>{const canvas=within(canvasElement);await userEvent.click(await canvas.findByRole('button',{name:/Мастер-класс для детей/}));await userEvent.click(await within(document.body).findByRole('button',{name:'Закрыть карточку'}));}};

// Full app frames reuse production components. The decorative VK chrome exists only here.
function AppFrame(){return <><RaceApp/><div aria-hidden style={{position:'fixed',top:40,right:12,zIndex:1000,width:70,height:28,display:'flex',alignItems:'center',justifyContent:'space-evenly',borderRadius:8,background:'#0002',color:'#fff',font:'18px Arial',pointerEvents:'none'}}>··· <span>×</span></div></>;}
const frame={parameters:{canvasPadding:0,fullScreen:true},render:()=> <AppFrame/>};
export const ProgramFrame:Story={...frame,parameters:{...frame.parameters,route:'race=10&section=program&day=2026-11-03'}};
export const ParticipantsFrame:Story={...frame,parameters:{...frame.parameters,route:'race=10&section=participants&stage=103'}};
export const ResultsFrame:Story={...frame,parameters:{...frame.parameters,route:'race=10&section=results&stage=103'}};
export const MoreFrame:Story={...frame,parameters:{...frame.parameters,route:'race=10&section=more'}};
export const ProfileFrame:Story={...frame,parameters:{...frame.parameters,route:'race=10&section=more&page=profile'}};
export const VenueEventsFrame:Story={...frame,parameters:{...frame.parameters,route:'race=10&section=program&location=1&allEvents=1&day=2026-11-03'}};
export const VenueCompact:Story={...frame,parameters:{...frame.parameters,route:'race=10&section=program&location=1&day=2026-11-03'}};
export const VenueExpanded:Story={...frame,parameters:{...frame.parameters,route:'race=10&section=program&location=1&expanded=1&day=2026-11-03'}};
