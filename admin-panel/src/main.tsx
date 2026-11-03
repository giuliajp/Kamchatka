import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
export const appRoot = createRoot(document.getElementById('root')!);
appRoot.render(<StrictMode><App/></StrictMode>);
