import './styles/app.css';
import { fidelity } from './core/fidelity.js';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { Loader } from './ui/Loader.js';

const LOAD_SHARES = Object.freeze({ code: 1, engine: 8, benchmark: 1 });

async function calibrate(onProgress) {
  if (fidelity.settled) return;
  const { measure } = await import('./app/benchmark.js');
  fidelity.adopt(await measure(onProgress));
}

async function launch() {
  const loader = new Loader(LOAD_SHARES);
  const [{ App }] = await Promise.all([
    loader.track('code', import('./app/App.js')),
    PhysicsWorld.load((fraction) => loader.update('engine', fraction)),
  ]);
  await loader.track('benchmark', calibrate((fraction) => loader.update('benchmark', fraction)));
  new App();
  loader.close();
}

launch();
