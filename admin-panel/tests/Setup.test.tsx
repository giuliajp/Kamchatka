import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {StageForm} from '../src/pages/RaceSetup';
afterEach(()=>vi.unstubAllGlobals());
it('sends Kamchatka dates with explicit timezone and retains values on a conflict',async()=>{
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({data:null,error:{code:'conflict',message:'Этап уже есть'}}),{status:409}));vi.stubGlobal('fetch',fetcher);
 render(<StageForm raceId={10}/>);await userEvent.type(screen.getByLabelText('Номер этапа'),'1');await userEvent.type(screen.getByLabelText('Название'),'Этап тест');
 const {fireEvent}=await import('@testing-library/react');fireEvent.change(screen.getByLabelText('Старт · Камчатка'),{target:{value:'2026-11-03T14:00'}});
 await userEvent.click(screen.getByRole('button',{name:'Сохранить этап'}));expect(await screen.findByRole('alert')).toHaveTextContent('Этап уже есть');expect(screen.getByLabelText('Название')).toHaveValue('Этап тест');
 expect(fetcher).toHaveBeenCalledWith('/api/admin/races/10/stages',expect.objectContaining({body:expect.stringContaining('2026-11-03T14:00+12:00')}));
});
