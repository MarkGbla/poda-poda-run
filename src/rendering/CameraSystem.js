(function (root, factory) {
  const CameraSystem = factory();
  if (typeof module === 'object' && module.exports) module.exports = CameraSystem;
  if (root) root.PODA_CameraSystem = CameraSystem;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  return class CameraSystem {
    constructor(camera, sun, random) {
      this.camera = camera; this.sun = sun; this.random = random;
      this.previousSpeed = 0; this.acceleration = 0; this.lookX = 0;
    }
    update(run, dt, gas, baseFov) {
      const c = this.camera, ease = 1 - Math.exp(-dt * 4);
      const acceleration = Math.max(-1, Math.min(1, (run.speed - this.previousSpeed) / Math.max(dt, .001) / 20));
      this.previousSpeed = run.speed;
      this.acceleration += (acceleration - this.acceleration) * ease;
      const wanted = baseFov + (gas && run.speed > 20 ? 4 : 0) + run.shake * 1.2;
      c.fov += (wanted - c.fov) * (1 - Math.exp(-dt * 3));
      c.updateProjectionMatrix();
      run.shake = Math.max(0, run.shake - dt * 1.6);
      const amount = run.shake * run.shake * .12;
      const portrait = c.aspect < .8;
      c.position.x += (run.x + (portrait ? 1.0 : 2.0) - c.position.x) * (1 - Math.exp(-dt * 2.8));
      c.position.y += ((run.vehicle?.camera.height || 4.5) + (run.jumpY || 0) * .25 - this.acceleration * .12 - c.position.y) * ease;
      c.position.z += ((run.vehicle?.camera.distance || 13.5) + this.acceleration * .65 - c.position.z) * ease;
      this.lookX += (run.x - this.lookX) * (1 - Math.exp(-dt * 3.5));
      c.position.x += this.random(-amount, amount);
      c.position.y += this.random(-amount, amount);
      c.lookAt(this.lookX, 1.5, -16);
      c.rotation.z += Math.sin(run.time * 35) * amount * .12;
      this.sun.position.set(run.x - 28, 32, 20);
      this.sun.target.position.set(run.x, 0, -12);
    }
  };
});
