export class ImpactLedger {
  constructor(physics) {
    this.physics = physics;
    this.entries = new Map();
  }

  record(handleA, handleB, impulse) {
    this.note(handleA, handleB, impulse);
    this.note(handleB, handleA, impulse);
  }

  note(own, other, impulse) {
    const body = this.physics.bodyOf(own);
    const fragment = body && body.userData;
    if (!fragment) return;
    const entry = this.entries.get(fragment);
    if (!entry) {
      this.entries.set(fragment, { impulse, peak: impulse, own, other });
      return;
    }
    entry.impulse += impulse;
    if (impulse > entry.peak) Object.assign(entry, { peak: impulse, own, other });
  }

  drain() {
    const impacts = [...this.entries].map(([fragment, entry]) => ({ fragment, ...entry }));
    this.entries.clear();
    return impacts;
  }
}
