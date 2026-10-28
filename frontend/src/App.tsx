import { AppProviders } from './app/AppProviders';
import { MapScreen } from './screens/Map/MapScreen';

export function App() {
  return <AppProviders fullScreen appearance={window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'}><MapScreen /></AppProviders>;
}
