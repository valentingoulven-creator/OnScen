import { GlobeSettingsProvider } from './context/GlobeSettingsContext';
import { GlobeExperience } from './components/GlobeExperience';

export default function App() {
  return (
    <GlobeSettingsProvider>
      <GlobeExperience />
    </GlobeSettingsProvider>
  );
}
