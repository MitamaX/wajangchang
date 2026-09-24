import './styles/app.css';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { Loader } from './ui/Loader.js';

const LOAD_SHARES = Object.freeze({ code: 1, engine: 8 });

async function launch() {
  const loader = new Loader(LOAD_SHARES);
  const [{ App }] = await Promise.all([
    loader.track('code', import('./app/App.js')),
    PhysicsWorld.load((fraction) => loader.update('engine', fraction)),
  ]);
  new App();
  loader.close();
}

launch();
