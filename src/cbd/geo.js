/* Geographic ↔ game-world conversion for the Freetown CBD.
   Local tangent plane about the OSM Cotton Tree node, scaled by the WGS84
   ellipsoid's meridional (M) and prime-vertical (N) radii at that latitude.
   Over the ~2 km study area its distortion against UTM 28N (EPSG:32628) is
   well below 0.1 %, i.e. under 1 m end to end, far inside the error of the
   source data. (A plain spherical radius would overstate north–south distance
   by 0.65 % here; tests/cbd-route.test.cjs guards against that.)
   Game axes: x = metres east, z = metres south (north is -z), y up. */
(function (root, factory) {
  const geo = factory();
  if (typeof module === 'object' && module.exports) module.exports = geo;
  if (root) root.PODA_CBD_GEO = geo;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const ORIGIN = Object.freeze({ lat: 8.487148, lon: -13.235624 });
  const A = 6378137, E2 = 6.69437999014e-3;    // WGS84 semi-major axis (m), first eccentricity squared
  const RAD = Math.PI / 180;
  const SIN0 = Math.sin(ORIGIN.lat * RAD), W = Math.sqrt(1 - E2 * SIN0 * SIN0);
  const M = A * (1 - E2) / (W * W * W);        // metres per radian of latitude
  const N = A / W;                             // prime vertical radius
  const KX = N * Math.cos(ORIGIN.lat * RAD) * RAD, KZ = M * RAD;   // metres per degree

  /** WGS84 degrees → [x east, z south] metres. */
  function project(lat, lon) {
    return [(lon - ORIGIN.lon) * KX, -(lat - ORIGIN.lat) * KZ];
  }
  /** Inverse of project(). */
  function unproject(x, z) {
    return { lat: ORIGIN.lat - z / KZ, lon: ORIGIN.lon + x / KX };
  }
  return Object.freeze({ ORIGIN, project, unproject, metresPerDegree: { lat: KZ, lon: KX } });
});
