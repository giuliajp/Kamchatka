import { useEffect, useState } from 'react';
import { Button, ModalCard } from '@vkontakte/vkui';
import { readRaceLink, updateRoute } from '../api/navigation';

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
  const finish = () => { const current = readRaceLink(); updateRoute(Object.fromEntries(Object.keys(current).map(key => [key, undefined])), true); updateRoute(initial, true); onFinish(); };
  useEffect(() => {
    if (step < 0) return;
    updateRoute({ section: steps[step][0], view: undefined, page: undefined, eventId: undefined, locationId: undefined, entryId: undefined, participantId: undefined }, true);
  }, [step]);
  if (step === -1) return <ModalCard className="onboarding-splash" open onClose={finish} title="Добро пожаловать в Авачу" aria-label="Первый запуск" dismissLabel="Закрыть знакомство" dismissButtonMode="inside">
    <div className="onboarding-splash__image"><img src="/figma/map-screen/b5483.png" alt=""/><img className="onboarding-splash__logo" src="/figma/map-screen/5b9db.svg" width={115.006} height={50.0002} alt="Берингия. Авача"/></div><h2>Авача — ваша гонка на расстоянии</h2><p>Следите за гонкой на карте, болейте за участников и смотрите официальные результаты.</p><Button size="l" stretched onClick={() => setStep(0)}>Начать</Button>
  </ModalCard>;
  return <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Знакомство с приложением" onKeyDown={event => { if (event.key === 'Escape') finish();
      if (event.key === 'Tab') {
        const buttons = event.currentTarget.querySelectorAll('button');
        if (event.shiftKey && event.target === buttons[0]) { event.preventDefault(); buttons[1].focus(); }
        else if (!event.shiftKey && event.target === buttons[1]) { event.preventDefault(); buttons[0].focus(); }
      } }}>
    <button className="onboarding-skip" onClick={finish}>Пропустить</button><div className="onboarding-tip"><p>{steps[step][1]}</p><span>{step + 1}/7</span><Button autoFocus size="s" onClick={() => step === 6 ? finish() : setStep(step + 1)}>{step === 6 ? 'Готово' : 'Далее'}</Button></div>
  </div>;
}
