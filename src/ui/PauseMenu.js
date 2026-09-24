import { byId } from './dom.js';

export class PauseMenu {
  constructor({ onResume, onRestart, onReset, onQuit }) {
    this.root = byId('pause');
    this.resumeButton = byId('resumeButton');
    this.quitButton = byId('quitButton');
    this.resumeButton.addEventListener('click', onResume);
    byId('restartButton').addEventListener('click', onRestart);
    byId('resetButton').addEventListener('click', onReset);
    this.quitButton.addEventListener('click', onQuit);
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) onResume();
    });
  }

  get open() {
    return !this.root.hidden;
  }

  present(canQuit) {
    this.quitButton.disabled = !canQuit;
    this.root.hidden = false;
    this.resumeButton.focus({ preventScroll: true });
  }

  close() {
    this.root.hidden = true;
  }
}
