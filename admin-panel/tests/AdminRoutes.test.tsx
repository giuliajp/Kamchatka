import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {App} from '../src/App';
import {readAdminRoute,updateAdminRoute} from '../src/navigation';
import {backend} from './backend';
afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
const login=()=>{backend();sessionStorage.setItem('avacha:admin-token','token');return render(<App/>);};
it('opens the linked child and folds the group without losing the selected form or draft',async()=>{
 history.replaceState(null,'','/?signed=keep#section=race&race=1');login();
 const group=await screen.findByRole('button',{name:'Гонка'});
 expect(group).toHaveAttribute('aria-expanded','true');
 expect(screen.getByRole('button',{name:'Этапы и маршрут'})).toHaveAttribute('aria-current','page');
 fireEvent.change(await screen.findByLabelText('Название',{exact:true}),{target:{value:'Этап с черновиком'}});
 group.focus();await userEvent.keyboard('{Enter}');
 expect(group).toHaveAttribute('aria-expanded','false');
 expect(screen.queryByRole('button',{name:'Этапы и маршрут'})).not.toBeInTheDocument();
 expect(screen.getByLabelText('Название',{exact:true})).toHaveValue('Этап с черновиком');
 expect(location.hash).toBe('#section=race&race=1');
 await userEvent.keyboard(' ');expect(group).toHaveAttribute('aria-expanded','true');
 await userEvent.click(screen.getByRole('button',{name:'Мониторинг оборудования'}));
 expect(location.search).toBe('?signed=keep');expect(readAdminRoute()).toMatchObject({section:'monitoring',raceId:1});
 expect(screen.getByRole('button',{name:'Мониторинг оборудования'})).toHaveAttribute('aria-current','page');
});
it('restores section, season and stage on history traversal and remount',async()=>{
 history.replaceState(null,'','#section=participants&race=2&stage=1');const app=login();
 await screen.findByText('Тестовый организатор');await waitFor(()=>expect(screen.getByLabelText('Сезон')).toHaveValue('2'));
 expect(screen.getByRole('button',{name:'Гонка'})).toHaveAttribute('aria-expanded','false');
 act(()=>updateAdminRoute({section:'monitoring',raceId:1,stageId:1}));
 await screen.findByLabelText('Этап мониторинга');await waitFor(()=>expect(screen.getByLabelText('Этап мониторинга')).toHaveValue('1'));
 fireEvent.change(screen.getByLabelText('Этап мониторинга'),{target:{value:'1'}});expect(readAdminRoute().stageId).toBe(1);
 act(()=>history.back());await waitFor(()=>expect(readAdminRoute().section).toBe('monitoring'));
 act(()=>history.back());await waitFor(()=>expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Участники'));
 act(()=>history.forward());await waitFor(()=>expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Мониторинг оборудования'));
 app.unmount();login();await screen.findByText('Тестовый организатор');await waitFor(()=>expect(screen.getByLabelText('Этап мониторинга')).toHaveValue('1'));
});
it('rejects unknown sections and invalid identifiers while accepting known fragment routes',()=>{
 for(const hash of ['#section=unknown&race=-1&stage=1.5','#section=toString&race=NaN&stage=Infinity','#race=0&stage=9007199254740992','']){
 history.replaceState(null,'',hash||'/');expect(readAdminRoute()).toEqual({section:'monitoring',raceId:undefined,stageId:undefined});
 }
 updateAdminRoute({section:'race',raceId:3,stageId:4});expect(location.hash).toBe('#section=race&race=3&stage=4');
 updateAdminRoute({raceId:undefined,stageId:undefined});expect(location.hash).toBe('#section=race');
});
