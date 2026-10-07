(function (root, factory) {
  const GameStateMachine = factory();
  if (typeof module === 'object' && module.exports) module.exports = GameStateMachine;
  if (root) root.PODA_GameStateMachine = GameStateMachine;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const transitions = Object.freeze({
    attract: ['play', 'garage'],
    play: ['paused', 'over', 'complete'],
    paused: ['play', 'over'],
    over: ['play', 'garage'],
    complete: ['play', 'garage'],
    garage: ['play', 'attract', 'over', 'complete'],
  });
  return class GameStateMachine {
    constructor(initial = 'attract') { this.current = initial; }
    transition(next) {
      if (!transitions[this.current]?.includes(next)) {
        throw new Error(`Invalid game state transition: ${this.current} → ${next}`);
      }
      this.current = next;
      return next;
    }
  };
});
