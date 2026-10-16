#!/usr/bin/env node
/** Fetch the eight official OSM API map tiles used by build-central.py.
 *  The API's 50,000-node limit requires small tiles. Each tile contains full
 *  ways and node references; the builder deduplicates them by OSM id.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const out = '.cache/central-osm';
mkdirSync(out, { recursive: true });
const west = -13.263, east = -13.220, south = 8.477, north = 8.497;
for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 2; iy++) {
  const file = `${out}/tile-${ix}-${iy}.osm`;
  if (existsSync(file) && !process.argv.includes('--refresh')) { console.log(`${file}: cached`); continue; }
  const bounds = [west + (east-west)*ix/4, south + (north-south)*iy/2,
    west + (east-west)*(ix+1)/4, south + (north-south)*(iy+1)/2];
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${bounds.join(',')}`;
  let body;
  for (let attempt = 0; attempt < 3 && !body; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': 'poda-poda-run-central-build/1.0' } });
    if (response.ok) body = await response.text();
    else if (attempt === 2) throw new Error(`${file}: OSM API ${response.status}`);
    else await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
  }
  writeFileSync(file, body);
  console.log(`${file}: ${body.length} bytes`);
  await new Promise(resolve => setTimeout(resolve, 1000));
}
