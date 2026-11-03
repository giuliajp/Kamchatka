import { validApiData } from '../../frontend/src/api/validate';
type Check = (value: unknown) => boolean;
const text: Check = v => typeof v === 'string';
const num: Check = v => typeof v === 'number' && Number.isFinite(v);
const bool: Check = v => typeof v === 'boolean';
const nullable = (check: Check): Check => v => v === null || check(v);
const list = (check: Check): Check => v => Array.isArray(v) && v.every(check);
const object = (fields: Record<string, Check>): Check => v => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.entries(fields).every(([key,check]) => check((v as Record<string,unknown>)[key]));
const nt = nullable(text), nn = nullable(num);
const admin = object({id:num,login:text,full_name:text});
const discipline = object({id:num,code:text,name:text});
const stage = object({id:num,number:num,name:nt,status:text});
const editableDiscipline = object({id:num,code:text,name:text,equipment:text,dogs_min:num,dogs_max:nn,sort_order:num,is_active:bool});
const editableStage = object({id:num,race_id:num,number:num,name:nt,status:text,description:nt,distance_km:nn,start_at:nt,finish_at:nt,tracking_interval_minutes:nn,stale_after_minutes:nn,route_source_filename:nt,route_updated_at:nt,route_length_km:nn});
const race = object({id:num,name:text,year:num,status:text,is_current:bool,start_date:nt,end_date:nt,location:nt,tracking_interval_minutes:num,stale_after_minutes:num});
const person = object({id:num,full_name:text,last_name:text,first_name:text,middle_name:nt,birth_year:nn,photo_url:nt,bio:nt});
const entry = object({id:num,race_id:num,start_number:num,status:text,region:nt,dogs_count:nn,discipline,participant:person});
const checkpoint = object({id:num,name:text,description:nt,latitude:num,longitude:num,elevation_m:nn});
const stageCp = object({id:num,stage_id:num,checkpoint_id:num,order_index:num,role:text,label:nt,km_from_start:nn,required_rest_minutes:num});
const pass = object({id:num,race_participant_id:num,stage_checkpoint_id:num,arrived_at:text,departed_at:nt,entered_by:nt,note:nt,updated_at:text});
const alert = object({id:num,race_participant_id:nn,start_number:nn,full_name:nt,imei:text,type:text,occurred_at:text,latitude:nn,longitude:nn,acknowledged_at:nt,acknowledged_by:nt,note:nt});
const result = object({id:num,race_participant_id:num,start_number:num,full_name:text,region:nt,status:text,time:nt,time_seconds:nn,dogs_at_start:nn,dogs_at_finish:nn,place:nn,note:nt,is_corrected_after_final:bool});
const protocolFields = {id:num,stage,discipline,status:text,published_at:nt,finalized_at:nt,finalized_by:nt,weather:nt,chief_judge:nt,chief_secretary:nt,source_filename:nt,results_count:nn};
const protocol = object(protocolFields);
const tracker = object({id:num,imei:text,name:nt,is_active:bool,assigned_to:nullable(object({assignment_id:num,race_participant_id:num,race_id:num,start_number:num,full_name:text,stage_id:nn,valid_from:text}))});
const push = object({id:num,segment:text,message:text,fragment:nt,trigger:nt,recipients:num,delivered:num,error:nt,created_by:nt,created_at:text});
const records = list(object({id:num}));
const rules: [RegExp, Check, Check?][] = [
  [/\/admin\/login$/,object({token:text,expires_at:text,admin})], [/\/admin\/me$/,admin],
  [/\/admin\/races$/,list(race),race], [/\/admin\/races\/\d+$/,race],
  [/\/admin\/disciplines$/,list(editableDiscipline),editableDiscipline], [/\/admin\/disciplines\/\d+$/,editableDiscipline],
  [/\/admin\/races\/\d+\/stages$/,list(editableStage),editableStage], [/\/admin\/stages\/\d+(\/route)?$/,editableStage],
  [/\/admin\/checkpoints$/,list(checkpoint),checkpoint], [/\/admin\/checkpoints\/\d+$/,checkpoint],
  [/\/admin\/stages\/\d+\/checkpoints$/,list(stageCp),stageCp], [/\/admin\/stage-checkpoints\/\d+$/,stageCp],
  [/\/admin\/races\/\d+\/participants$/,list(entry),entry], [/\/admin\/race-participants\/\d+$/,entry],
  [/\/admin\/participants$/,list(object({id:num,full_name:text,birth_year:nn}))],
  [/\/admin\/participants\/\d+$/,person],
  [/\/admin\/trackers$/,list(tracker),tracker], [/\/admin\/trackers\/\d+(\/assign|\/unassign)?$/,tracker],
  [/\/admin\/trackers\/poll$/,object({summary:text,errors:list(text),points_saved:num,devices_seen:num,skipped:bool})],
  [/\/admin\/checkpoint-passes(\/\d+)?$/,pass], [/\/admin\/races\/\d+\/alerts$/,list(alert)], [/\/admin\/alerts\/\d+\/acknowledge$/,alert],
  [/\/admin\/stages\/\d+\/monitoring$/,object({stage,race_id:num,generated_at:text,tracking_interval_minutes:num,stale_after_minutes:num,checkpoints:list(object({stage_checkpoint_id:num,order_index:num,role:text,label:nt,name:text})),summary:object({total:num,sos:num,overdue:num,no_tracker:num,ok:num}),rows:list(object({race_participant_id:num,start_number:num,full_name:text,discipline,status:text,tracker:nullable(object({imei:text,name:nt})),last_position:nullable(object({position_at:text,latitude:num,longitude:num,battery_percent:nn})),minutes_since_last:nn,is_overdue:bool,active_alerts:list(alert),passes:list(pass)}))})],
  [/\/admin\/races\/\d+\/protocols$/,list(protocol)], [/\/admin\/protocols\/\d+$/,object({...protocolFields,results:list(result),without_result:list(object({race_participant_id:num,start_number:num,full_name:text}))}),protocol],
  [/\/admin\/protocols\/\d+\/(publish|finalize)$/,protocol], [/\/admin\/protocols\/\d+\/results$/,result], [/\/admin\/stage-results\/\d+(\/post-final-correction)?$/,result],
  [/\/admin\/race-participants\/\d+\/penalties$/,list(object({id:num,race_participant_id:num,seconds:num,time:text,rule_reference:nt,reason:nt})),object({id:num,race_participant_id:num,seconds:num,time:text,rule_reference:nt,reason:nt})],
  [/\/admin\/penalties\/\d+$/,object({id:num,race_participant_id:num,seconds:num,time:text,rule_reference:nt,reason:nt})],
  [/\/admin\/races\/\d+\/protocol-import$/,object({rows:num,participants_created:num,results_created:num,results_updated:num,results_unchanged:num,penalties_changed:num,protocols_created:num,warnings:list(text),saved:bool})],
  [/\/admin\/push$/,list(push),push], [/\/changes$|\/checkpoint-passes\/log$/,records],
  [/\/support-rating$/,list(object({rank:num,race_participant_id:num,start_number:num,full_name:text,photo_url:nt,discipline,supporters_count:num,change_24h:num}))],
];
export function validResponse(path: string, data: unknown, method = 'GET') {
  if (!path.startsWith('/admin/')) return validApiData(path, data, method);
  const rule = rules.find(([pattern]) => pattern.test(path.split('?')[0]));
  return rule ? (method !== 'GET' && rule[2] ? rule[2] : rule[1])(data) : typeof data === 'object' && data !== null;
}
