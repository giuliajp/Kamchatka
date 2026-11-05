import { useEffect, useLayoutEffect, useState } from 'react';
import { Button } from '@vkontakte/vkui';
import { readRaceLink, updateRoute } from '../api/navigation';

const targets=['.race-screen__footer [aria-label=Карта]','.race-screen__header header > div:nth-child(2),.race-screen__header [role=tablist]','.map-marker .race-map-marker','.race-screen__footer [aria-label=Участники]','.race-screen__footer [aria-label=Программа]','.race-screen__footer [aria-label=Ещё]','.race-screen__footer [aria-label=Результаты]'];
const steps = [
  ['map', 'В разделе «Карта» можно посмотреть маршрут и последние подтверждённые положения участников гонки.'],
  ['map', 'В верхнем разделе выбирайте нужный этап и дисциплину.'],
  ['map', 'Нажмите на метку участника, чтобы открыть карточку, узнать о каюре и начать болеть за него.'],
  ['participants', 'В разделе «Участники» найдите спортсмена по имени или номеру. Во вкладке «Мои» находятся те, за кого вы болеете.'],
  ['program', 'В разделе «Программа» смотрите расписание и зрительские площадки, выбирайте события для напоминаний.'],
  ['more', 'В разделе «Ещё» находятся информация для гостей, профиль и настройки уведомлений.'],
  ['results', 'В разделе «Результаты» смотрите официальные итоги, протоколы и архив прошлых лет.'],
] as const;
export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(-1);
  const [initial] = useState(readRaceLink);
  const [anchor,setAnchor]=useState({left:16,top:160,width:328,height:48});
  useLayoutEffect(()=>{
    if(step<0)return;
    const measure=()=>{
      const nodes=[...document.querySelectorAll<HTMLElement>(targets[step])];
      const bounds=nodes.map(node=>node.getBoundingClientRect()).filter(rect=>rect.width>0 && rect.height>0);
      if(!bounds.length)return;
      const left=Math.min(...bounds.map(rect=>rect.left)),top=Math.min(...bounds.map(rect=>rect.top));
      const next={left,top,width:Math.max(...bounds.map(rect=>rect.right))-left,height:Math.max(...bounds.map(rect=>rect.bottom))-top};
      setAnchor(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
    };
    measure();const observer=new MutationObserver(measure);observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
  },[step]);
  const finish = () => { const current = readRaceLink(); updateRoute(Object.fromEntries(Object.keys(current).map(key => [key, undefined])), true); updateRoute(initial, true); onFinish(); };
  useEffect(() => {
    if (step < 0) return;
    updateRoute({ section: steps[step][0], view: undefined, page: undefined, eventId: undefined, locationId: undefined, entryId: undefined, participantId: undefined }, true);
  }, [step]);
  if (step === -1) return <div className="onboarding-splash" role="dialog" aria-modal="true" aria-label="Первый запуск" onKeyDown={event=>{if(event.key==='Escape')finish();if(event.key==='Tab'){const buttons=event.currentTarget.querySelectorAll('button');if(event.shiftKey&&event.target===buttons[0]){event.preventDefault();buttons[1].focus();}else if(!event.shiftKey&&event.target===buttons[1]){event.preventDefault();buttons[0].focus();}}}}>
    <button className="onboarding-splash__close" aria-label="Закрыть знакомство" onClick={finish}>×</button>
    <div className="onboarding-splash__image"><img src="/figma/map-screen/b5483.png" alt=""/><img className="onboarding-splash__logo" src="/figma/map-screen/5b9db.svg" width={180} height={78} alt="Берингия. Авача"/></div><div className="onboarding-splash__copy"><h2>Авача — ваша гонка<br/>на расстоянии</h2><p>Трасса, участники и результаты гонки<br/>на собачьих упряжках — в реальном<br/>времени, в одном приложении.</p><Button autoFocus size="l" stretched onClick={() => setStep(0)}>Начать</Button></div>
  </div>;
  const above=anchor.top>window.innerHeight/2;
  const width=Math.min(264,window.innerWidth-32),left=Math.max(16,Math.min(anchor.left,window.innerWidth-width-16));
  return <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Знакомство с приложением" onKeyDown={event => { if (event.key === 'Escape') finish();
      if (event.key === 'Tab') {
        const buttons = event.currentTarget.querySelectorAll('button');
        if (event.shiftKey && event.target === buttons[0]) { event.preventDefault(); buttons[1].focus(); }
        else if (!event.shiftKey && event.target === buttons[1]) { event.preventDefault(); buttons[0].focus(); }
      } }}>
    <div className="onboarding-highlight" aria-hidden style={anchor}/><button className="onboarding-skip" onClick={finish}>Пропустить</button><div className="onboarding-tip" data-above={above} style={{position:'fixed',width,left,...(above?{bottom:Math.max(16,window.innerHeight-anchor.top+12)}:{top:Math.min(window.innerHeight-180,anchor.top+anchor.height+12)}),['--tip-arrow' as string]:`${Math.max(16,Math.min(width-20,anchor.left+anchor.width/2-left))}px`}}><p>{steps[step][1]}</p><span>{step + 1}/7</span><Button autoFocus size="s" onClick={() => step === 6 ? finish() : setStep(step + 1)}>{step === 6 ? 'Готово' : 'Далее'}</Button></div>
  </div>;
}
