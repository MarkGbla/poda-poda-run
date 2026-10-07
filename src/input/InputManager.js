(function (root, factory) {
  const InputManager = factory();
  if (typeof module === 'object' && module.exports) module.exports = InputManager;
  if (root) root.PODA_InputManager = InputManager;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  return class InputManager {
    constructor(actions) {
      this.actions = actions;
      this.state = { brake: false, brakePulse: 0, gas: false };
    }
    command(name, active = true) {
      if (name === 'BRAKE') this.state.brake = active;
      else if (name === 'ACCELERATE') this.state.gas = active;
      else if (name === 'BRAKE_PULSE' && active) this.state.brakePulse = 0.7;
      else if (active && name === 'MOVE_LEFT') this.actions.moveLane(-1);
      else if (active && name === 'MOVE_RIGHT') this.actions.moveLane(1);
      else if (active && name === 'HORN') this.actions.horn();
      else if (active && name === 'PAUSE') this.actions.pause();
      else if (active && name === 'MUTE') this.actions.mute();
    }
    release() { this.state.brake = false; this.state.gas = false; this.state.brakePulse = 0; }
  };
});
