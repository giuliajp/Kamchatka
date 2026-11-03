import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {Participants} from '../src/pages/Participants';
import {entry} from '../src/stories/fixtures';
import {backend} from './backend';
afterEach(()=>vi.unstubAllGlobals());
const fill=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label,{exact:true}),{target:{value}});
const click=(name:string)=>userEvent.click(screen.getByRole('button',{name}));
it('creates a new athlete and an entry with region and dogs, then reuses a historical athlete',async()=>{
 const {writes}=backend({['/admin/participants?q='+encodeURIComponent('Тест')]:[entry.participant,{...entry.participant,id:99,birth_year:null}]},()=>entry);render(<Participants raceId={1}/>);await screen.findByRole('button',{name:entry.participant.full_name});fill('Фамилия','Новая');fill('Имя','Анна');fill('Стартовый номер','99');await userEvent.selectOptions(screen.getByLabelText('Дисциплина заявки'),String(entry.discipline.id));fill('Регион','Камчатка');fill('Количество собак','8');await click('Сохранить заявку');await screen.findByText('Сохранено');expect(writes[0]).toMatchObject({method:'POST',path:'/admin/races/1/participants',body:{last_name:'Новая',first_name:'Анна',start_number:99,region:'Камчатка',dogs_count:8}});
 fill('Спортсмены прошлых лет','Тест');await screen.findByRole('option',{name:/год не указан/});await userEvent.selectOptions(screen.getByLabelText('Найденный спортсмен'),String(entry.participant.id));expect(screen.queryByLabelText('Фамилия')).not.toBeInTheDocument();await click('Сохранить заявку');await waitFor(()=>expect(writes).toHaveLength(2));expect(writes[1].body).toHaveProperty('participant_id',entry.participant.id);expect(writes[1].body).not.toHaveProperty('last_name');
});
it('edits registration separately from athlete photo and biography, searches and deletes erroneous entries',async()=>{
 const {writes}=backend({},path=>path.includes('/admin/participants/')?entry.participant:entry);vi.spyOn(window,'confirm').mockReturnValue(true);render(<Participants raceId={1}/>);await userEvent.click(await screen.findByRole('button',{name:entry.participant.full_name}));await screen.findByLabelText('Статус участника');expect(screen.getByLabelText('Дисциплина заявки')).toHaveValue(String(entry.discipline.id));await userEvent.selectOptions(screen.getByLabelText('Статус участника'),'dnf');fill('Регион','Новый регион');await click('Сохранить заявку');await waitFor(()=>expect(writes).toHaveLength(1));expect(writes[0]).toMatchObject({method:'PATCH',path:'/admin/race-participants/1',body:{status:'dnf',region:'Новый регион'}});
 await userEvent.click(screen.getByText('Карточка спортсмена'));fill('Ссылка на фотографию','https://example.org/athlete.jpg');fill('Биография','Биография спортсмена');await click('Сохранить карточку');await waitFor(()=>expect(writes).toHaveLength(2));expect(writes[1]).toMatchObject({path:'/admin/participants/1',body:{photo_url:'https://example.org/athlete.jpg',bio:'Биография спортсмена'}});
 fill('Поиск в заявках','Нет такого имени');expect(screen.getByText('Заявок не найдено.')).toBeVisible();fill('Поиск в заявках','14');expect(screen.getByRole('button',{name:entry.participant.full_name})).toBeVisible();await click('Удалить заявку');await waitFor(()=>expect(writes).toHaveLength(3));expect(writes[2]).toMatchObject({method:'DELETE',path:'/admin/race-participants/1'});await screen.findByLabelText('Спортсмены прошлых лет');await click('Новая заявка');
});
