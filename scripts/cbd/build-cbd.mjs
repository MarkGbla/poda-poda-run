#!/usr/bin/env node
/**
 * Build the Freetown CBD dataset from the cached OpenStreetMap extract.
 *
 *   node scripts/cbd/fetch-osm.mjs     (once, or to refresh the source data)
 *   node scripts/cbd/build-cbd.mjs
 *
 * Output: src/cbd/data/cbd-data.json — projected local metres, nothing else.
 * No smoothing, widening or building adjustment happens here; those are
 * gameplay decisions made at runtime by src/cbd/RoadPath.js and
 * src/cbd/CbdWorld.js so the source geometry stays inspectable.
 *
 * Coordinates: local tangent plane (equirectangular) centred on the OSM
 * Cotton Tree node. x = metres east, z = metres SOUTH (Three.js: +x east,
 * +y up, so north is -z). Over the ~1.5 km study area the scale error of
 * this projection against UTM 28N is well under 0.1 %.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { project } = require('../../src/cbd/geo.js');

const read = name => JSON.parse(readFileSync(`.cache/cbd-osm/${name}.json`, 'utf8'));
const roads = read('roads'), buildings = read('buildings'), coast = read('coast'), green = read('green');
const ways = new Map(roads.elements.map(w => [w.id, w]));
const round = v => Math.round(v * 10) / 10;
const P = g => project(g.lat, g.lon).map(round);

/* ---------- 1. The playable loop, as an ordered walk over real OSM ways ----------
   Each step names a way and the two of its nodes to travel between. The walk is
   checked node-by-node: every step must start on the node the previous one ended
   on, and one-way streets must be driven in their mapped direction. */
const LOOP = [
  { street: 'Siaka Stevens Street', way: 573743200, from: 4137239735, to: 5509521797 },   // slip off the Cotton Tree roundabout
  { street: 'Siaka Stevens Street', way: 33615653, from: 5509521797, to: 21687821 },
  { street: 'Wilberforce Street', way: 572463160, from: 21687821, to: 21687820 },
  { street: 'Wilberforce Street', way: 5032940, from: 21687820, to: 21687819 },
  { street: 'Wallace Johnson Street', way: 669957484, from: 21687819, to: 6274224064 },
  { street: 'Wallace Johnson Street', way: 669957483, from: 6274224064, to: 6274224065 },  // westbound carriageway
  { street: 'Wallace Johnson Street', way: 5032937, from: 6274224065, to: 21687838 },
  { street: 'Walpole Street', way: 5032962, from: 21687838, to: 370887096 },
  { street: 'Cotton Tree roundabout', way: 32934926, from: 370887096, to: 4137239735 },    // anticlockwise, three-quarters round
];

function walk(step) {
  const w = ways.get(step.way);
  if (!w) throw new Error(`way ${step.way} missing from extract`);
  const closed = w.nodes[0] === w.nodes.at(-1);
  const n = closed ? w.nodes.length - 1 : w.nodes.length;
  const i0 = w.nodes.indexOf(step.from), i1 = w.nodes.indexOf(step.to);
  if (i0 < 0 || i1 < 0) throw new Error(`way ${step.way} does not contain ${step.from}/${step.to}`);
  const oneway = w.tags.oneway === 'yes' || w.tags.junction === 'roundabout';
  let dir = i1 >= i0 ? 1 : -1;
  if (closed) dir = 1;                                      // roundabouts only run in node order
  if (oneway && dir < 0) throw new Error(`way ${step.way} (${w.tags.name}) is one-way; walk reverses it`);
  const out = [];
  for (let i = i0; ; i = (i + dir + n) % n) {
    out.push({ node: w.nodes[i], p: P(w.geometry[i]) });
    if (i === i1 && out.length > 1) break;
    if (out.length > w.nodes.length + 1) throw new Error(`walk on ${step.way} did not terminate`);
  }
  return out;
}

const route = { points: [], nodes: [], streets: [] };
let lastNode = null;
for (const step of LOOP) {
  const pts = walk(step);
  if (lastNode !== null && pts[0].node !== lastNode) throw new Error(`gap before way ${step.way}`);
  if (route.streets.at(-1)?.name !== step.street) route.streets.push({ name: step.street, start: Math.max(0, route.points.length - 1) });   // the shared junction node
  for (const [k, { node, p }] of pts.entries()) {
    if (k === 0 && lastNode !== null) continue;              // shared junction node already recorded
    route.points.push(p); route.nodes.push(node);
  }
  lastNode = pts.at(-1).node;
}
if (lastNode !== route.nodes[0]) throw new Error('loop does not close');
route.points.pop(); route.nodes.pop();                      // the closing node duplicates the first

/* ---------- 2. Junctions: other named streets meeting the loop ---------- */
const nodeUse = new Map();
for (const w of roads.elements) for (const n of w.nodes) {
  if (!nodeUse.has(n)) nodeUse.set(n, new Set());
  nodeUse.get(n).add(w.id);
}
const loopWays = new Set(LOOP.map(s => s.way));
const MAJOR = /^(primary|secondary|tertiary|unclassified|residential)(_link)?$/;
const junctions = [], sideStreets = [];
route.nodes.forEach((node, index) => {
  const others = [...nodeUse.get(node)].map(id => ways.get(id))
    .filter(w => !loopWays.has(w.id) && MAJOR.test(w.tags.highway));
  if (!others.length) return;
  junctions.push({ index, node, names: [...new Set(others.map(w => w.tags.name || w.tags.highway))] });
  // A stub of each side street, 70 m outward from the junction, so the opening is visible.
  for (const w of others) {
    const i = w.nodes.indexOf(node);
    for (const dir of [1, -1]) {
      const pts = [];
      let len = 0;
      for (let j = i; j >= 0 && j < w.nodes.length; j += dir) {
        const p = P(w.geometry[j]);
        if (pts.length) len += Math.hypot(p[0] - pts.at(-1)[0], p[1] - pts.at(-1)[1]);
        pts.push(p);
        if (len > 70) break;
      }
      if (pts.length > 1) sideStreets.push({ name: w.tags.name || null, way: w.id, highway: w.tags.highway, oneway: w.tags.oneway === 'yes', points: pts });
    }
  }
});

/* ---------- 3. Building footprints within reach of the loop ---------- */
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const loopDist = p => {
  let best = Infinity;
  for (let i = 0; i < route.points.length; i++) best = Math.min(best, segDist(p, route.points[i], route.points[(i + 1) % route.points.length]));
  return best;
};
function simplify(pts, tol) {                               // Douglas–Peucker, open polyline
  if (pts.length < 3) return pts;
  let idx = -1, max = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], pts[0], pts.at(-1)); if (d > max) { max = d; idx = i; } }
  if (max <= tol) return [pts[0], pts.at(-1)];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}
const REACH = 70;                                           // metres from the loop centreline
const out = [];
let skippedRelations = 0;
for (const b of buildings.elements) {
  let ring = null;
  if (b.type === 'way') ring = b.geometry;
  else {
    const outers = (b.members || []).filter(m => m.role === 'outer' && m.geometry);
    if (outers.length === 1 && outers[0].geometry.length > 3) ring = outers[0].geometry;
    else { skippedRelations++; continue; }
  }
  let pts = ring.map(P);
  if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
  if (pts.length < 3 || Math.min(...pts.map(loopDist)) > REACH) continue;
  pts = simplify([...pts, pts[0]], 0.35).slice(0, -1);
  if (pts.length < 3) continue;
  const t = b.tags || {};
  const levels = parseFloat(t['building:levels']);
  const height = parseFloat(t.height);
  out.push({
    id: b.id, pts,
    ...(Number.isFinite(levels) ? { levels } : {}),
    ...(Number.isFinite(height) ? { height } : {}),
    ...(t.name ? { name: t.name } : {}),
    ...(t.building && t.building !== 'yes' ? { kind: t.building } : {}),
    ...(t.amenity ? { amenity: t.amenity } : {}),
  });
}

/* ---------- 4. The Cotton Tree roundabout ring, in full ---------- */
const ringWay = ways.get(32934926);
const ringPts = ringWay.geometry.slice(0, -1).map(P);
const ringCentre = [0, 1].map(k => round(ringPts.reduce((a, p) => a + p[k], 0) / ringPts.length));
const roundabout = {
  way: 32934926,
  centre: ringCentre,
  radius: round(ringPts.reduce((a, p) => a + Math.hypot(p[0] - ringCentre[0], p[1] - ringCentre[1]), 0) / ringPts.length),
  points: ringPts,
};

/* ---------- 5. Mapped trees and green spaces near the loop ---------- */
const trees = green.elements.filter(e => e.type === 'node' && loopDist(P(e)) <= REACH).map(e => P(e));
const parks = green.elements.filter(e => e.type === 'way' && e.geometry && Math.min(...e.geometry.map(g => loopDist(P(g)))) <= REACH)
  .map(e => ({ id: e.id, kind: e.tags.leisure || e.tags.landuse || e.tags.natural, name: e.tags.name || null, pts: e.geometry.slice(0, -1).map(P) }));

/* ---------- 6. Coastline, for the backdrop ---------- */
const coastLines = coast.elements.map(w => w.geometry.map(P));

const data = {
  meta: {
    source: 'OpenStreetMap via Overpass API',
    licence: 'ODbL 1.0 — © OpenStreetMap contributors',
    osmBase: roads.osm3s.timestamp_osm_base,
    origin: { lat: 8.487148, lon: -13.235624, osmNode: 3563419693, name: 'The Cotton Tree (OSM node)' },
    projection: 'local equirectangular tangent plane; x east (m), z south (m)',
    loopWays: LOOP.map(s => s.way),
    buildingReach: REACH,
    skippedRelations,
  },
  route, junctions, sideStreets, roundabout, buildings: out, trees, parks, coast: coastLines,
};
mkdirSync('src/cbd/data', { recursive: true });
writeFileSync('src/cbd/data/cbd-data.json', JSON.stringify(data));
const len = route.points.reduce((s, p, i) => s + Math.hypot(...[0, 1].map(k => route.points[(i + 1) % route.points.length][k] - p[k])), 0);
console.log(`loop: ${route.points.length} nodes, ${len.toFixed(0)} m of OSM centreline, ${route.streets.length} street sections`);
console.log(`junctions: ${junctions.length}, side-street stubs: ${sideStreets.length}`);
console.log(`buildings within ${REACH} m: ${out.length} (${out.filter(b => b.levels).length} with levels tagged), relations skipped: ${skippedRelations}`);
console.log(`trees: ${trees.length}, green areas: ${parks.length}`);
console.log(`coastline ways: ${coastLines.length}; roundabout centre ${roundabout.centre}, mean radius ${roundabout.radius} m`);
