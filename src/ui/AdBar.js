import { AD } from '../config.js';
import { whenCompact } from '../core/display.js';
import { byId } from './dom.js';

const FAIL_HANDLER = 'collapseAdBar';

export class AdBar {
  constructor() {
    this.root = byId('adBar');
    if (!AD.unit) return;
    document.documentElement.style.setProperty('--ad-height', `${AD.height}px`);
    whenCompact(() => this.mount());
  }

  mount() {
    window[FAIL_HANDLER] = () => this.collapse();
    this.root.hidden = false;
    this.root.append(this.slot());
    document.head.append(this.loader());
  }

  slot() {
    const slot = document.createElement('ins');
    slot.className = 'kakao_ad_area';
    slot.style.display = 'none';
    Object.assign(slot.dataset, {
      adUnit: AD.unit,
      adWidth: String(AD.width),
      adHeight: String(AD.height),
      adOnfail: FAIL_HANDLER,
    });
    return slot;
  }

  loader() {
    const script = document.createElement('script');
    script.async = true;
    script.src = AD.script;
    script.addEventListener('error', () => this.collapse());
    return script;
  }

  collapse() {
    this.root.hidden = true;
  }
}
