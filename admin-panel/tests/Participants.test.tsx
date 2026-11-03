import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {Participants} from '../src/pages/Participants';
afterEach(()=>vi.unstubAllGlobals());
it('searches earlier athletes before creating an entry',async()=>{
 const fetcher=vi.fn(async(url:string)=>new Response(JSON.stringify({data:url.includes('/participants?q=')?[{id:501,full_name:'Иванов Иван',birth_year:1980}]:[],error:null})));vi.stubGlobal('fetch',fetcher);
 render(<Participants raceId={10}/>);await userEvent.type(await screen.findByLabelText('Спортсмены прошлых лет'),'Иванов');
 expect(await screen.findByRole('option',{name:'Иванов Иван · 1980'})).toBeVisible();
 expect(fetcher).toHaveBeenCalledWith('/api/admin/participants?q=%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2',expect.anything());
});
