import { useRef, useState } from 'react';

export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: () => Promise<unknown>) => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError('');
    try { await action(); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Действие не выполнено. Повторите попытку.'); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  return { busy, error, run };
}
