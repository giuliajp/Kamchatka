import { afterEach, expect, it, vi } from 'vitest';
import captures from '../src/stories/design-api-fixtures.json';
import { validApiData } from '../src/api/validate';
import { validResponse } from '../../admin-panel/src/validate';
import { readRaceLink, updateRoute, closeRoute, viewLink } from '../src/api/navigation';
import { readCache, apiBase } from '../src/api/client';
import { programEvent, spectatorLocation } from '../src/stories/contentFixtures';
afterEach(()=>{history.replaceState(null,'','/');localStorage.clear();vi.restoreAllMocks();});
it.each(Object.entries(captures))('accepts the live isolated backend response %s', (path, data) => {expect(validResponse(path,data)).toBe(true);});
it('accepts all new event types and nested checkpoint venues and rejects broken photos and enums',()=>{
 for(const event_type of ['stage_start','stage_finish','festival','master_class','meeting'])expect(validApiData('/program',[{...programEvent,event_type,location:{...spectatorLocation,location_type:'checkpoint'}}])).toBe(true);
 expect(validApiData('/program',[{...programEvent,event_type:'bad'}])).toBe(false);expect(validApiData('/locations',[{...spectatorLocation,image_urls:null}])).toBe(false);
 expect(validApiData('/me/bookmarks',[{kind:'protocol',item_id:'stage:1',title:null,url:'https://example.org/protocol.pdf',image_url:null,created_at:'2026-11-03T00:00Z'}])).toBe(true);
 expect(validApiData('/program/1/reminder',{program_event_id:1,reminder:true},'PUT')).toBe(true);expect(validApiData('/program/1/reminder',{program_event_id:1,reminder:false},'DELETE')).toBe(true);
});
it('keeps signed launch parameters, validates calendar dates and restores nested routes',()=>{
 history.replaceState(null,'','/?vk_user_id=42&sign=a%2Bb#section=program&race=1&day=2027-02-05&event=5&expanded=1');
 expect(readRaceLink()).toMatchObject({section:'program',raceId:1,day:'2027-02-05',eventId:5,expanded:true});
 updateRoute({eventId:undefined,locationId:3,allEvents:true,reminders:true,mine:false,discipline:''});expect(location.search).toBe('?vk_user_id=42&sign=a%2Bb');expect(readRaceLink()).toMatchObject({locationId:3,allEvents:true,reminders:true});
 const back=vi.spyOn(history,'back').mockImplementation(()=>{});closeRoute({locationId:undefined});expect(back).toHaveBeenCalledOnce();
 history.replaceState(null,'','/#location=3&view=watch');closeRoute({locationId:undefined});expect(readRaceLink().locationId).toBeUndefined();
 for(const day of ['not-a-date','2027-99-99','2027-02-30']){history.replaceState(null,'','/#day='+day);expect(readRaceLink().day).toBeUndefined();}
 history.replaceState(null,'','/#section=bad&location=-1&archiveRace=2');expect(readRaceLink()).toMatchObject({archiveRaceId:2});expect(readRaceLink().section).toBeUndefined();
 expect(viewLink({raceId:1,stageId:2,participantId:3,entryId:4})).toContain('view=track');
});
it('ignores old public snapshots without touching persistent onboarding choices',()=>{
 localStorage.setItem('avacha:welcome','1');localStorage.setItem(`avacha-api-v1:${apiBase}/program`,JSON.stringify({data:[programEvent],savedAt:new Date().toISOString()}));expect(readCache('/program')).toBeUndefined();expect(localStorage.getItem('avacha:welcome')).toBe('1');
});

it('closes a direct venue-events link in two steps without inventing a previous browser entry',()=>{
 history.replaceState(null,'','/?vk_user_id=42&sign=kept#section=program&location=3&allEvents=1');
 const back=vi.spyOn(history,'back').mockImplementation(()=>{});closeRoute({allEvents:undefined});expect(readRaceLink().locationId).toBe(3);closeRoute({locationId:undefined});expect(readRaceLink().locationId).toBeUndefined();expect(back).not.toHaveBeenCalled();expect(location.search).toBe('?vk_user_id=42&sign=kept');
});
