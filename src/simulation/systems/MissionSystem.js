(function (root, factory) {
  const MissionSystem = factory();
  if (typeof module === 'object' && module.exports) module.exports = MissionSystem;
  if (root) root.PODA_MissionSystem = MissionSystem;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const MISSIONS = Object.freeze([
    { id: 'deliver-ten', label: 'Deliver 10 passengers', target: 10 },
    { id: 'perfect-five', label: 'Make 5 perfect stops', target: 5 },
    { id: 'finish-shift', label: 'Finish the FBC shift', target: 1 },
  ]);

  return class MissionSystem {
    constructor(events, storage) {
      this.storage = storage;
      try { this.progress = JSON.parse(storage.get('poda-missions') || '{}') || {}; }
      catch { this.progress = {}; }
      events.on('stop:served', ({ grade, passengersDropped }) => {
        this.add('deliver-ten', passengersDropped);
        if (grade === 'perfect') this.add('perfect-five', 1);
      });
      events.on('route:complete', () => this.add('finish-shift', 1));
    }
    add(id, amount) {
      const mission = MISSIONS.find(item => item.id === id);
      if (!mission || !Number.isFinite(amount) || amount <= 0) return;
      this.progress[id] = Math.min(mission.target, (this.progress[id] || 0) + amount);
      this.storage.set('poda-missions', JSON.stringify(this.progress));
    }
    status() {
      return MISSIONS.map(({ id, label, target }) => ({
        id, label, target, progress: Math.min(target, this.progress[id] || 0),
        complete: (this.progress[id] || 0) >= target,
      }));
    }
  };
});
