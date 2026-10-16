#!/usr/bin/env node
/**
 * Download the OpenStreetMap extract the CBD build uses.
 *
 *   node scripts/cbd/fetch-osm.mjs
 *
 * Writes raw Overpass JSON to .cache/cbd-osm/ (gitignored). The build step,
 * scripts/cbd/build-cbd.mjs, turns that into the compact game dataset in
 * src/cbd/data/. OSM data is © OpenStreetMap contributors, ODbL 1.0; see
 * docs/cbd/03-geospatial-data-pipeline.md for the attribution obligations.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
// south, west, north, east: the CBD core plus a margin for side streets and buildings
const BBOX = '8.4805,-13.2440,8.4935,-13.2240';
const QUERIES = {
  roads: `[out:json][timeout:120];way["highway"](${BBOX});out body geom;`,
  buildings: `[out:json][timeout:180];(way["building"](${BBOX});relation["building"](${BBOX}););out tags geom;`,
  coast: `[out:json][timeout:90];way["natural"="coastline"](8.47,-13.26,8.51,-13.20);out geom;`,
  green: `[out:json][timeout:90];(node["natural"="tree"](${BBOX});way["natural"~"tree_row|wood|scrub"](${BBOX});way["landuse"~"grass|forest"](${BBOX});way["leisure"~"park|garden|pitch"](${BBOX}););out geom;`,
};

mkdirSync('.cache/cbd-osm', { recursive: true });
const only = process.argv[2];
for (const [name, query] of Object.entries(QUERIES)) {
  if (only && name !== only) continue;
  let json = null;
  // The public instance returns 429/502/504 under load; back off and retry.
  for (let attempt = 1; !json; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'User-Agent': 'poda-poda-run-cbd-build/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
    if (res.ok) json = await res.json();
    else if (attempt >= 5) throw new Error(`${name}: HTTP ${res.status}`);
    else { console.log(`${name}: HTTP ${res.status}, retrying`); await new Promise(r => setTimeout(r, 8000 * attempt)); }
  }
  writeFileSync(`.cache/cbd-osm/${name}.json`, JSON.stringify(json));
  console.log(`${name}: ${json.elements.length} elements, OSM base ${json.osm3s?.timestamp_osm_base}`);
  await new Promise(r => setTimeout(r, 3000));    // be polite to the public Overpass instance
}
