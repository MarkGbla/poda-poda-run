#!/usr/bin/env python3
"""Build one Congo Cross → Cotton Tree → downtown → PZ → Eastern Police run.

Source tiles are official OSM API /api/0.6/map extracts in .cache/central-osm/.
The route is a directed walk on shared OSM node ids. Roundabouts and one-way
ways are never traversed against their mapped direction.
"""
import glob
import heapq
import json
import math
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TILES = sorted((ROOT / '.cache/central-osm').glob('tile-*-*.osm'))
if len(TILES) != 8:
    raise SystemExit('Expected eight .cache/central-osm/tile-*-*.osm files')
OLD = json.loads((ROOT / 'src/cbd/data/cbd-data.json').read_text())
NODES, WAYS = {}, {}
for tile in TILES:
    root = ET.parse(tile).getroot()
    for el in root:
        if el.tag == 'node':
            NODES[int(el.attrib['id'])] = (
                float(el.attrib['lat']), float(el.attrib['lon']),
                {t.attrib['k']: t.attrib['v'] for t in el.findall('tag')},
            )
        elif el.tag == 'way':
            WAYS[int(el.attrib['id'])] = (
                [int(n.attrib['ref']) for n in el.findall('nd')],
                {t.attrib['k']: t.attrib['v'] for t in el.findall('tag')},
            )

LAT0, LON0 = 8.487148, -13.235624
A, E2, RAD = 6378137, 6.69437999014e-3, math.pi / 180
w = math.sqrt(1 - E2 * math.sin(LAT0 * RAD) ** 2)
KX = A / w * math.cos(LAT0 * RAD) * RAD
KZ = A * (1 - E2) / w ** 3 * RAD
def project(n):
    lat, lon = NODES[n][:2]
    return [(lon - LON0) * KX, -(lat - LAT0) * KZ]
def metres(a, b):
    p, q = project(a), project(b)
    return math.dist(p, q)

COST = {'primary': 1, 'secondary': 1.15, 'tertiary': 1.3,
        'unclassified': 1.5, 'residential': 2, 'living_street': 2.2,
        'service': 4}
graph = defaultdict(list)
for wid, (ns, tags) in WAYS.items():
    weight = COST.get(tags.get('highway'))
    if not weight or any(n not in NODES for n in ns):
        continue
    direction = -1 if tags.get('oneway') == '-1' else (1 if tags.get('oneway') in ('yes', '1', 'true') or tags.get('junction') == 'roundabout' else 0)
    for a, b in zip(ns, ns[1:]):
        distance = metres(a, b)
        if direction >= 0: graph[a].append((b, wid, distance * weight))
        if direction <= 0: graph[b].append((a, wid, distance * weight))

def shortest(start, finish):
    origin = (None, start)
    dist, previous, queue = {origin: 0}, {}, [(0, origin)]
    ending = None
    while queue:
        cost, state = heapq.heappop(queue)
        if cost != dist[state]: continue
        prior, node = state
        if node == finish:
            ending = state
            break
        for target, way, price in graph[node]:
            turn_cost = 0
            if prior is not None:
                a,b,c = project(prior),project(node),project(target)
                u=(b[0]-a[0],b[1]-a[1]); v=(c[0]-b[0],c[1]-b[1])
                den=math.hypot(*u)*math.hypot(*v)
                angle=math.degrees(math.acos(max(-1,min(1,(u[0]*v[0]+u[1]*v[1])/den)))) if den else 0
                if angle > 120: continue  # no hairpin turn across the carriageway
                turn_cost = max(0, angle-55) * 0.6
            next_state = (node,target)
            next_cost = cost + price + turn_cost
            if next_cost < dist.get(next_state, math.inf):
                dist[next_state] = next_cost
                previous[next_state] = (state, way)
                heapq.heappush(queue, (next_cost, next_state))
    if ending is None: raise ValueError(f'No directed road from {start} to {finish}')
    edges, state = [], ending
    while state != origin:
        prev_state, way = previous[state]
        edges.append((prev_state[1], state[1], way))
        state = prev_state
    return list(reversed(edges))

west = shortest(34098827, 4137239735)  # Congo Cross ring → Cotton Tree exit
loop_nodes = OLD['route']['nodes'] + [OLD['route']['nodes'][0]]
loop_ways = set(OLD['meta']['loopWays'])
loop = []
for a, b in zip(loop_nodes, loop_nodes[1:]):
    matches = [way for target, way, _ in graph[a] if target == b and way in loop_ways]
    if not matches: raise ValueError(f'CBD loop reverses a one-way way at {a} → {b}')
    loop.append((a, b, matches[0]))
to_pz = shortest(4137239735, 21687824)  # Wilberforce × Sani Abacha
to_east = shortest(21687824, 34095927)   # Abacha → Eastern Police ring
ep_stop_index = len(west) + len(loop) + len(to_pz) + len(to_east) - 1
# A short real continuation around the clocktower and onto Kissy Road leaves
# room for the game's missed-stop recovery without drawing through the island.
recovery_tail = shortest(34095927, 34095937)
edges = west + loop + to_pz + to_east + recovery_tail
for i in range(len(edges) - 1):
    if edges[i][1] != edges[i+1][0]: raise ValueError(f'Gap at edge {i}')
node_order = [edges[0][0]] + [b for _, b, _ in edges]
points = [[round(v, 1) for v in project(n)] for n in node_order]
street_order = []
for i, (_, _, wid) in enumerate(edges):
    name = WAYS[wid][1].get('name') or ('roundabout' if WAYS[wid][1].get('junction') == 'roundabout' else 'connector')
    if not street_order or street_order[-1]['name'] != name:
        street_order.append({'name': name, 'start': i})

def nearest_index(lat, lon, lo, hi):
    x, z = (lon - LON0) * KX, -(lat - LAT0) * KZ
    return min(range(lo, hi), key=lambda i: math.dist(points[i], (x, z)))

west_end = len(west)
loop_end = west_end + len(loop)
pz_index = loop_end + len(to_pz)
def street_index(name, lo, hi):
    matches = [i for i in range(lo, hi) if WAYS[edges[i][2]][1].get('name') == name]
    return matches[len(matches)//2] if matches else None

stops = [
    {'name': 'Congo Cross', 'pointIndex': 0, 'osm': 'way/5064456'},
]
for name in ('Ascension Town Road', 'Kingtom Bridge', 'Kroo Town Road'):
    idx = street_index(name, 0, west_end)
    if idx is not None: stops.append({'name': name, 'pointIndex': idx, 'osm': f'way/{edges[idx][2]}'})
# Board on the Siaka Stevens approach, roughly 44 m from the tree. Stopping on
# the roundabout itself would put passengers in the turning carriageway.
stops.append({'name': 'Cotton Tree', 'pointIndex': node_order.index(5509521806), 'osm': 'node/3563419693 (approach at node/5509521806)'})
for name, lat, lon, osm in (
    ('Rokel Commercial Bank', 8.488753, -13.234054, 'way/177521576'),
    ('Wilberforce Street', 8.491124, -13.233026, 'node/21687820'),
    ('City Hall', 8.490401, -13.235251, 'node/13133044444'),
    ('Big Market', 8.489821, -13.236527, 'way/173226206'),
    ('Lightfoot Boston Street', 8.488559, -13.236669, 'node/21687837'),
):
    stops.append({'name': name, 'pointIndex': nearest_index(lat, lon, stops[-1]['pointIndex'] + 1, loop_end), 'osm': osm})
stops.append({'name': 'Law Courts', 'pointIndex': nearest_index(8.487411, -13.234980, loop_end, pz_index), 'osm': 'way/91664110'})
stops += [
    {'name': 'PZ Junction', 'pointIndex': pz_index, 'osm': 'node/21687824 (Wilberforce × Sani Abacha)'},
    {'name': 'Sani Abacha Street', 'pointIndex': pz_index + len(to_east)//2, 'osm': 'way/32840398'},
    {'name': 'Eastern Police', 'pointIndex': ep_stop_index, 'osm': 'way/5064036 (approach on Sani Abacha Street)'},
]
if [s['pointIndex'] for s in stops] != sorted(s['pointIndex'] for s in stops):
    raise ValueError('Stops do not follow the street walk in order: ' + str([(s['name'], s['pointIndex']) for s in stops]))

def segment_distance(p, a, b):
    vx, vz = b[0]-a[0], b[1]-a[1]
    t = max(0, min(1, ((p[0]-a[0])*vx+(p[1]-a[1])*vz)/(vx*vx+vz*vz))) if vx*vx+vz*vz else 0
    return math.hypot(p[0]-a[0]-t*vx, p[1]-a[1]-t*vz)
cells = defaultdict(list)
for a,b in zip(points, points[1:]):
    for cx in range(math.floor((min(a[0],b[0])-70)/100), math.floor((max(a[0],b[0])+70)/100)+1):
        for cz in range(math.floor((min(a[1],b[1])-70)/100), math.floor((max(a[1],b[1])+70)/100)+1):
            cells[cx,cz].append((a,b))
def near_route(p, reach):
    nearby = cells.get((math.floor(p[0]/100), math.floor(p[1]/100)), [])
    return any(segment_distance(p, a, b) <= reach for a,b in nearby)

# Preserve the manually checked downtown relation footprints and landmarks.
REACH = 50
buildings = {b['id']: b for b in OLD['buildings']}
for wid, (ns, tags) in WAYS.items():
    if 'building' not in tags or len(ns) < 4 or ns[0] != ns[-1] or any(n not in NODES for n in ns): continue
    pts = [[round(v, 1) for v in project(n)] for n in ns[:-1]]
    if not any(near_route(p, REACH) for p in pts): continue
    item = {'id': wid, 'pts': pts}
    for key, dest in [('building:levels', 'levels'), ('height', 'height')]:
        try: item[dest] = float(tags[key])
        except (KeyError, ValueError): pass
    if tags.get('name'): item['name'] = tags['name']
    if tags.get('building') not in ('yes', None): item['kind'] = tags['building']
    if tags.get('amenity'): item['amenity'] = tags['amenity']
    buildings[wid] = item

trees = []
for n, (lat, lon, tags) in NODES.items():
    if tags.get('natural') == 'tree':
        p = [round(v, 1) for v in project(n)]
        if near_route(p, REACH): trees.append(p)

# Visible junction stubs at connected streets outside the driven way.
used = {wid for _, _, wid in edges}
route_nodes = set(node_order)
for ring in (5064456, 32934926, 5064036): route_nodes.update(WAYS[ring][0])
side_streets, seen_stubs = [], set()
for wid, (ns, tags) in WAYS.items():
    if wid in used or tags.get('highway') not in COST or not tags.get('name'): continue
    for at, n in enumerate(ns):
        if n not in route_nodes: continue
        for direction in (-1, 1):
            pair = (wid, at, direction)
            if pair in seen_stubs: continue
            seen_stubs.add(pair)
            geom, distance, i = [project(n)], 0, at + direction
            while 0 <= i < len(ns) and distance < 55:
                p = project(ns[i]); distance += math.dist(geom[-1], p); geom.append(p); i += direction
            if len(geom) > 1:
                side_streets.append({'name': tags['name'], 'way': wid, 'highway': tags['highway'],
                                     'oneway': tags.get('oneway') in ('yes', '1'),
                                     'points': [[round(v, 1) for v in p] for p in geom]})

roundabouts = []
for wid in (5064456, 32934926, 5064036):
    ns = WAYS[wid][0][:-1]
    pts = [[round(v, 1) for v in project(n)] for n in ns]
    centre = [round(sum(p[k] for p in pts)/len(pts), 1) for k in (0,1)]
    roundabouts.append({'way': wid, 'centre': centre,
                        'radius': round(sum(math.dist(p, centre) for p in pts)/len(pts), 1),
                        'points': pts})

data = {
    'meta': {'source': 'OpenStreetMap API 0.6 map tiles', 'licence': 'ODbL 1.0 — © OpenStreetMap contributors',
             'origin': OLD['meta']['origin'], 'projection': OLD['meta']['projection'],
             'routeWays': list(dict.fromkeys(wid for _,_,wid in edges)),
             'buildingReach': REACH},
    'route': {'closed': False, 'points': points, 'nodes': node_order, 'streets': street_order, 'stops': stops},
    'sideStreets': side_streets, 'roundabout': OLD['roundabout'], 'roundabouts': roundabouts,
    'buildings': list(buildings.values()), 'trees': trees, 'parks': OLD['parks'], 'coast': OLD['coast'],
}
out = ROOT / 'src/cbd/data/central-data.json'
out.write_text(json.dumps(data, separators=(',', ':')))
print(f'{len(points)} route nodes, {sum(math.dist(a,b) for a,b in zip(points,points[1:])):.0f} m; '
      f'{len(stops)} ordered stops, {len(buildings)} buildings, {len(side_streets)} junction stubs')
for s in stops: print(f"  {s['pointIndex']:3} {s['name']}")
