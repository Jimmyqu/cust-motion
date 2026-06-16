import './styles.css';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Missing #app root');
}

root.innerHTML = `
  <main class="boot-screen">
    <p class="eyebrow">Cust Motion</p>
    <h1>Camera Rhythm Saber</h1>
    <p>Front-camera body tracking rhythm game loading...</p>
  </main>
`;
