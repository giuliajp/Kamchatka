import { vi } from 'vitest';
import { fixtureData } from '../src/stories/fixtures';
export function backend(overrides:Record<string,unknown>={},write?:(path:string,method:string,body:unknown)=>unknown) {
  const writes:{path:string;method:string;body:unknown}[]=[];
  const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const path=String(input).replace(/^\/api/,'');const method=init?.method ?? 'GET';
    let data;
    if(method!=='GET') {
      const body=init?.body instanceof FormData?init.body:init?.body?JSON.parse(String(init.body)):undefined;
      writes.push({path,method,body});data=write?.(path,method,body);
    } else data=path in overrides?overrides[path]:fixtureData(path);
    if(data instanceof Response)return data;
    return new Response(JSON.stringify({data:data??null,error:null}));
  });
  vi.stubGlobal('fetch',fetcher);return {fetcher,writes};
}
