(function (root, factory) {
  const QualityManager = factory();
  if (typeof module === 'object' && module.exports) module.exports = QualityManager;
  if (root) root.PODA_QualityManager = QualityManager;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  return class QualityManager {
    constructor(renderer, sun, scene, resize, deviceRatio) {
      this.renderer = renderer; this.sun = sun; this.scene = scene; this.resize = resize;
      this.maximum = Math.min(deviceRatio || 1, 1.75);
      this.ratio = this.maximum;
      this.profile = 'auto';
      this.budget = { distance: 220, crowd: 1, shadowDistance: 60 };
      this.elapsed = 0; this.frames = 0;
    }
    setProfile(profile) {
      if (!['auto', 'low', 'medium', 'high'].includes(profile)) return;
      this.profile = profile;
      this.budget = profile === 'low' ? {distance:110,crowd:.45,shadowDistance:0}
        : profile === 'medium' ? {distance:165,crowd:.7,shadowDistance:38}
        : {distance:220,crowd:1,shadowDistance:60};
      if(this.scene.fog){this.scene.fog.near=this.budget.distance*.42;this.scene.fog.far=this.budget.distance;}
      if (profile === 'low') this.apply(Math.max(0.6, Math.min(0.8, this.maximum)), false);
      if (profile === 'medium') this.apply(Math.min(1, this.maximum), true);
      if (profile === 'high' || profile === 'auto') this.apply(this.maximum, true);
      this.elapsed = this.frames = 0;
    }
    apply(ratio, shadows) {
      ratio = clamp(ratio, 0.6, this.maximum);
      if (ratio !== this.ratio) {
        this.ratio = ratio; this.renderer.setPixelRatio(ratio); this.resize();
      }
      if (shadows !== this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = shadows; this.sun.castShadow = shadows;
        this.scene.traverse(object => { if (object.material) object.material.needsUpdate = true; });
      }
    }
    sample(seconds) {
      if (this.profile !== 'auto' || seconds <= 0 || seconds > 1) return;
      this.elapsed += seconds; this.frames++;
      if (this.elapsed < 2) return;
      const average = this.elapsed / this.frames;
      this.elapsed = this.frames = 0;
      if (average > 1 / 45) {
        if (this.ratio > 0.6) this.apply(Math.max(0.6, this.ratio - 0.25), this.renderer.shadowMap.enabled);
        else this.apply(this.ratio, false);
      } else if (average < 1 / 58) {
        if (!this.renderer.shadowMap.enabled) this.apply(this.ratio, true);
        else this.apply(Math.min(this.maximum, this.ratio + 0.125), true);
      }
    }
  };
});
