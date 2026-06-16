import './styles.css';
import { CameraRhythmSaberApp } from './app/App';
import { builtInChart } from './domain/chart';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Missing #app root');
}

const app = new CameraRhythmSaberApp(root, builtInChart);
app.start();

window.addEventListener('beforeunload', () => app.dispose());
