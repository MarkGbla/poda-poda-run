import '../base-ui.css';
import '../drive-ui.css';
import '../start-ui.css';
import '../run-ui.css';
import './simulation/systems/RoadContactSystem.js';
import { registerEasternDistricts } from './data/EasternDistricts.js';
import { createScorePoster } from './ui/ScorePoster.js';
import './simulation/systems/TrafficAI.js';
import './data/GameConfig.js';
import './simulation/systems/JumpSystem.js';
import { createWorkshop } from './assets/props/workshop.js';
import { createRoleDecorator } from './assets/people/roles.js';
import { createBuildingFactory } from './assets/buildings/buildingFactory.js';
import { createLumleyDetails } from './assets/props/lumley.js';
import { createFreightFactory } from './assets/vehicles/freight.js';
import { TrafficPool } from './assets/vehicles/trafficPool.js';
import { createStreetAssets } from './assets/roads/streetAssets.js';
import '../vehicles.js';
import '../districts-west.js';
import '../districts-east.js';
import '../people.js';
import '../engine-sound.js';

import './simulation/RunRules.js';
import './engine/GameStateMachine.js';
import './engine/GameClock.js';
import './engine/EventBus.js';
import './simulation/systems/PlayerSystem.js';
import './simulation/systems/TrafficSystem.js';
import './simulation/systems/CollisionSystem.js';
import './simulation/systems/PassengerSystem.js';
import './simulation/systems/MissionSystem.js';
import './input/InputManager.js';
import './rendering/CameraSystem.js';
import './rendering/QualityManager.js';
import './services/ApiClient.js';

(() => {
'use strict';
const THREE = window.THREE;
const gameURL = 'https://podapodarun.com/';

/* ================================================================
   Local flavour — everything Freetown lives here
   ================================================================ */
const DATA = {
  // Lumley → Waterloo, the east–west corridor the official fare tables use
  route: window.PODA_RUN_RULES.ROUTE,
  fare: 6,                        // new Leones per hop (2026 fare table: Lumley–Regent Rd NLe 6.1)
  // real slogans seen painted on Freetown poda-podas
  slogans: ['GOD IS GREAT', 'DONE DEM ALL', 'NEVER DISCOURAGE', 'RESPECT THY NEIGHBOUR', 'FEAR JUDGMENT DAY', 'GOD WILL PROVIDE', "GOD'S GIFT", 'TRUST IN ALLAH', 'GOD SAVE THE TRAVELERS', 'DE GUNNERS'],
  // transport-company names painted along poda-poda sides
  companies: ['KAMARA TOURS', 'SESAY TRANSPORT', 'BANGURA TOURS', 'KOROMA & SONS', 'CONTEH TRAVELS', 'JALLOH EXPRESS', 'TURAY TOURS', 'MANSARAY TRANSPORT'],
  shops: ['FRY FRY JOINT', 'GRANAT & GINGER BEER', 'DONE DEM ALL PHONES', 'GOD WILL PROVIDE PROVISIONS', 'SWEET SALONE COOL ROOM', 'NEVER DISCOURAGE SALON', 'MAMA SALONE CHOP BAR', 'BAY GOD PAWA BUILDING MAT.'],
  // Krio in plain e/o spelling (official orthography uses ɛ and ɔ)
  krio: {
    load:   [['PZ! PZ! PZ! Una kam!', 'The apprentice calls the route'], ['Mekes! Mekes!', 'Hurry up!'], ['I don fulop!', "It's full!"], ['Sidom!', 'Sit down!']],
    drop:   [['Wan bel na ya!', 'Stop here!'], ['Drop mi ya.', 'Drop me here.'], ['Gi mi mi chenj!', 'Give me my change!']],
    miss:   [['Lef! Lef! Driver, lef!', 'Stop! Stop! Driver, stop!'], ['Eh bo! Wan bel na ya!', 'Ah, man! I said stop here!']],
    stumble:[['Tek tem!', 'Careful!'], ['Eh bo!', 'Ah, man!'], ['A de kam dong!', "I'm getting off!"], ['Wahala!', 'Trouble!']],
    horn:   [['Komot na rod!', 'Out of the way!']],
    perfect:[['A tel God tenki!', 'Thank God!']],
  },
  over: ['Di poda don jam!', 'Wahala!'],
};

/* ================================================================
   Helpers
   ================================================================ */
const $ = id => document.getElementById(id);
let visualSeed = 7264;
const seededVisuals = new URLSearchParams(location.search).has('benchmark');
const visualRandom = () => seededVisuals ? ((visualSeed = visualSeed * 16807 % 2147483647) / 2147483647) : Math.random();
const rand = (a, b) => a + visualRandom() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmtLe = n => 'Le ' + Math.round(n).toLocaleString('en-US');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
};

/* ================================================================
   Three.js setup
   ================================================================ */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); // lowered at runtime by adapt()
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.94;
let hud3d = null;

const scene = new THREE.Scene();
const FOG = 0xc6c8be;
scene.fog = new THREE.Fog(FOG, 90, 240);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function fitText(g, text, maxW, size, font) {
  let s = size;
  do { g.font = `${s}px ${font}`; s -= 2; } while (g.measureText(text).width > maxW && s > 10);
}

scene.background = canvasTex(4, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#6689a5'); gr.addColorStop(0.4, '#a8bac5'); gr.addColorStop(0.63, '#d5d1c3'); gr.addColorStop(1, '#c6c8be');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

const hemi = new THREE.HemisphereLight(0xbacddd, 0x6d5540, 0.65);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd39b, 1.18);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 34, bottom: -18, near: 1, far: 120 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);
const cameraSystem = new window.PODA_CameraSystem(camera, sun, rand);
const qualityManager = new window.PODA_QualityManager(renderer, sun, scene, resize, devicePixelRatio);

/* shared geometry + material cache */
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  sph: new THREE.SphereGeometry(0.5, 10, 8),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  pyr: new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4),
  cone: new THREE.ConeGeometry(0.5, 1, 7),
  disc: new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2),
};
const mats = {};
const M = c => {
  if (!mats[c]) { const colour=new THREE.Color(c).convertSRGBToLinear(); mats[c]=new THREE.MeshLambertMaterial({color:colour}); }
  return mats[c];
};
function add(parent, geo, color, sx, sy, sz, x, y, z, cast) {
  const m = new THREE.Mesh(geo, typeof color === 'number' ? M(color) : color);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  if (cast) m.castShadow = true;
  parent.add(m);
  return m;
}

const SKIN = [0x3d281c, 0x553624, 0x6b4630, 0x2e1f16];
const CLOTH = [0xe8b52a, 0x1eb53a, 0x0072c6, 0xd8333a, 0xf2f2f2, 0x7a3fa0, 0xff7a29, 0x10a58c, 0xe24f8f];
const PANTS = [0x22313b, 0x3b3b3b, 0x5a4632, 0x1d3a5f];
const HOUSE = [0xf2d16b, 0xf3a6a0, 0x9fd3e6, 0xb9e0a5, 0xf6efe1, 0xe58a5c, 0xc9b6e4, 0xf7c873, 0x8ec5c0];
const ROOF = [0x8f9396, 0x9a5a3a, 0xa7abad, 0x7f4a32, 0x6e7276];

/* ================================================================
   Textures drawn at boot (after fonts load)
   ================================================================ */
let roadTex, roadDetailTex, walkTex, coinMat, shopTex = [], sloganTex = {};
const LANE_W = 3.4, LANES = [-LANE_W, 0, LANE_W], ROAD_HALF = LANE_W * 1.5 + 0.35;

function buildTextures() {
  roadTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#53534f'; g.fillRect(0, 0, w, h);
    // Broad wear, fine aggregate, repair patches and sparse cracks live in one repeating map.
    for (let i = 0; i < 95; i++) {
      const v = randi(43, 81), x = rand(0, w), y = rand(0, h), r = rand(11, 62);
      const wash = g.createRadialGradient(x, y, 1, x, y, r);
      wash.addColorStop(0, `rgba(${v},${v - 2},${v - 4},.19)`);
      wash.addColorStop(1, `rgba(${v},${v - 2},${v - 4},0)`);
      g.fillStyle = wash; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 13500; i++) {
      const v = randi(65, 122);
      g.fillStyle = `rgba(${v},${v - 2},${v - 4},${rand(.12, .37)})`;
      g.fillRect(rand(0, w), rand(0, h), rand(.6, 2.3), rand(.6, 2.3));
    }
    for (let i = 0; i < 3; i++) {
      const x = rand(36, w - 115), y = rand(10, h - 65), pw = rand(35, 90), ph = rand(23, 65);
      g.beginPath();
      g.moveTo(x + rand(-4, 4), y); g.lineTo(x + pw + rand(-4, 4), y + rand(-3, 3));
      g.lineTo(x + pw + rand(-4, 4), y + ph); g.lineTo(x + rand(-4, 4), y + ph + rand(-3, 3)); g.closePath();
      g.fillStyle = `rgba(${randi(55, 70)},${randi(55, 70)},${randi(52, 66)},.3)`; g.fill();
      g.strokeStyle = 'rgba(27,28,27,.18)'; g.lineWidth = 1.2; g.stroke();
    }
    for (let i = 0; i < 13; i++) {
      let x = rand(20, w - 20), y = rand(0, h);
      g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += rand(-11, 11); y += rand(5, 19); g.lineTo(x, y); }
      g.strokeStyle = 'rgba(22,23,23,.28)'; g.lineWidth = rand(.7, 1.8); g.stroke();
    }
    const edge = g.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, '#756c5c'); edge.addColorStop(.045, '#5d5b54'); edge.addColorStop(.14, '#0000');
    edge.addColorStop(.86, '#0000'); edge.addColorStop(.955, '#5d5b54'); edge.addColorStop(1, '#756c5c');
    g.fillStyle = edge; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(224,214,179,.72)';
    for (const x of [w / 3, 2 * w / 3]) g.fillRect(x - 2, 15, 4, h * .42);
    g.fillStyle = 'rgba(231,195,82,.73)'; g.fillRect(7, 0, 4, h); g.fillRect(w - 11, 0, 4, h);
  });
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(1, 10);
  // Non-colour data for aggregate relief and dry/worn roughness.
  roadDetailTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 21000; i++) {
      const v = randi(115, 245);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rand(0, w), rand(0, h), rand(.6, 2.4), rand(.6, 2.4));
    }
    for (let i = 0; i < 13; i++) {
      g.fillStyle = 'rgba(67,67,67,.25)';
      g.fillRect(rand(35, w - 110), rand(0, h), rand(35, 95), rand(25, 75));
    }
  });
  roadDetailTex.encoding = THREE.LinearEncoding;
  roadDetailTex.wrapS = roadDetailTex.wrapT = THREE.RepeatWrapping;
  roadDetailTex.repeat.set(1, 10);

  walkTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#9f9b8e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1100; i++) { const v = randi(105, 171); g.fillStyle = `rgba(${v},${v - 5},${v - 17},.4)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#7d7a6e'; g.fillRect(0, h / 2 - 1, w, 3); g.fillRect(0, h - 2, w, 3);
    g.fillStyle = '#77776b'; g.fillRect(0, 0, 15, h); // stained drain-side edge
    g.fillStyle = '#5b5d53'; g.fillRect(14, 0, 3, h);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(59,65,55,${rand(.12,.36)})`; g.fillRect(rand(17,w), rand(0,h), rand(3,11), rand(2,9)); }
  });
  walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping; walkTex.repeat.set(1, 50);

  const coinTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e9b62e'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    g.fillStyle = '#f7d35e'; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.fill();
    g.fillStyle = '#8a5a00'; g.font = '44px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Le', 64, 68);
  });
  coinMat = new THREE.MeshLambertMaterial({ map: coinTex, emissive: 0x6b4a00, emissiveIntensity: 0.35 });

  const shopColors = [['#1eb53a', '#fff'], ['#0072c6', '#fff'], ['#ffc23d', '#0f1d26'], ['#d8333a', '#fff'], ['#f6ecd6', '#0f1d26'], ['#7a3fa0', '#ffc23d']];
  shopTex = DATA.shops.map((name, i) => canvasTex(512, 112, (g, w, h) => {
    const [bg, fg] = shopColors[i % shopColors.length];
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitText(g, name, w - 50, 52, 'Bungee, Impact, sans-serif'); g.fillText(name, w / 2, h / 2 + 3);
  }));
}

function getSloganTex(slogan, routeText) {
  const key = slogan + '|' + routeText;
  if (sloganTex[key]) return sloganTex[key];
  return (sloganTex[key] = canvasTex(512, 256, (g, w, h) => {
    // rear window with sticker lettering
    g.fillStyle = '#1b2a33'; g.fillRect(0, 0, w, h * 0.6);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(40, 0); g.lineTo(140, 0); g.lineTo(60, h * 0.6); g.lineTo(-40, h * 0.6); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    fitText(g, slogan, w - 40, 64, 'Bungee, Impact, sans-serif');
    g.lineWidth = 10; g.strokeStyle = '#0f1d26'; g.strokeText(slogan, w / 2, h * 0.31);
    g.fillStyle = '#ffc23d'; g.fillText(slogan, w / 2, h * 0.31);
    // painted panel
    g.fillStyle = '#f6ecd6'; g.fillRect(0, h * 0.6, w, h * 0.4);
    g.fillStyle = '#0f1d26'; fitText(g, routeText, w - 60, 40, 'Bungee, Impact, sans-serif');
    g.fillText(routeText, w / 2, h * 0.75);
    g.fillStyle = '#1eb53a'; g.fillRect(0, h - 22, w, 8); g.fillStyle = '#fff'; g.fillRect(0, h - 14, w, 7); g.fillStyle = '#0072c6'; g.fillRect(0, h - 7, w, 7);
  }));
}

function stopSignTex(name) {
  return canvasTex(512, 200, (g, w, h) => {
    g.fillStyle = '#1eb53a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.fillRect(0, h - 36, w, 36);
    g.fillStyle = '#0072c6'; g.fillRect(0, h - 18, w, 18);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 28px Outfit, sans-serif'; g.fillText('PODA-PODA STOP', w / 2, 34);
    fitText(g, name.toUpperCase(), w - 40, 76, 'Bungee, Impact, sans-serif'); g.fillText(name.toUpperCase(), w / 2, 102);
  });
}

/* ================================================================
   Models (plug-ins in window.PODA override the built-ins)
   ================================================================ */
const PLUG = window.PODA || {};
PLUG.vehicles = PLUG.vehicles || {}; PLUG.districts = PLUG.districts || {};
let streetAssets, freight, lumleyDetails, roles;
const trafficPool = new TrafficPool(bake);
function pooled(key, factory) { return trafficPool.acquire(key, factory); }
function releaseObstacle(o) { if (o.poolKey) trafficPool.release(o); else drop(o.g); }
const kit = {};   // filled at boot; handed to every plug-in
function makePerson(opt = {}) {
  if (PLUG.people && PLUG.people.make) { const p = PLUG.people.make(kit, roles ? roles.options(opt) : opt); p.userData.decorativePerson=true; return roles ? roles.decorate(p, opt) : p; }
  return builtinPerson(opt);
}
function builtinPerson(opt = {}) {
  const g = new THREE.Group();
  const skin = pick(SKIN);
  const lappa = opt.lappa ?? Math.random() < 0.45;
  if (lappa) add(g, G.cyl, pick(CLOTH), 0.56, 0.9, 0.46, 0, 0.45, 0);
  else { add(g, G.box, pick(PANTS), 0.17, 0.82, 0.22, -0.12, 0.41, 0); add(g, G.box, pick(PANTS), 0.17, 0.82, 0.22, 0.12, 0.41, 0); }
  add(g, G.box, opt.shirt ?? pick(CLOTH), 0.52, 0.66, 0.3, 0, 1.15, 0);
  g.userData.armL = add(g, G.box, skin, 0.13, 0.6, 0.15, -0.33, 1.1, 0);
  g.userData.armR = add(g, G.box, skin, 0.13, 0.6, 0.15, 0.33, 1.1, 0);
  add(g, G.sph, skin, 0.34, 0.38, 0.34, 0, 1.68, 0);
  if (opt.tray) {
    add(g, G.cyl, 0xb8b8b8, 0.8, 0.08, 0.8, 0, 1.92, 0);
    for (let i = 0; i < 5; i++) add(g, G.sph, pick([0xff7a29, 0xe8b52a, 0x6dbb3c, 0xd8333a]), 0.2, 0.2, 0.2, rand(-0.25, 0.25), 2.02, rand(-0.25, 0.25));
  } else if (lappa && Math.random() < 0.7) add(g, G.box, pick(CLOTH), 0.42, 0.2, 0.42, 0, 1.9, 0);
  if (opt.cast) g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

const SCHEMES = [
  { body: 0xf3ead2, stripe: 0x1eb53a, stripe2: 0x0072c6 },
  { body: 0xf3ead2, stripe: 0x0072c6, stripe2: 0xd8333a },
  { body: 0xffffff, stripe: 0xd8333a, stripe2: 0xffc23d },
  { body: 0xe8d9b0, stripe: 0x6b3f8f, stripe2: 0x1eb53a },
];
const LIVERIES = [
  ['tricolour', 'Salone stripes'], ['redskirt', 'Red skirt'],
  ['flame', 'Flame stripe'], ['bluelower', 'Blue lower'], ['silver', 'Silver'],
];
let selectedLivery = LIVERIES.some(([id]) => id === store.get('poda-livery')) ? store.get('poda-livery') : 'bluelower';
let selectedSlogan = DATA.slogans.includes(store.get('poda-slogan')) ? store.get('poda-slogan') : DATA.slogans[0];
function makePoda(slogan, routeText, scheme, withCrew, livery) {
  if (PLUG.vehicles.podapoda) return PLUG.vehicles.podapoda(kit, { slogan, routeText, scheme, withCrew, livery, roofCargo:withCrew?store.get('poda-cargo'):null, wheelStyle:withCrew?store.get('poda-wheels'):null, paint:withCrew?store.get('poda-paint'):null, roofRack:withCrew?store.get('poda-rack'):null, bodyTrim:withCrew?store.get('poda-trim'):null });
  return builtinPoda(slogan, routeText, scheme, withCrew);
}
function builtinPoda(slogan, routeText, scheme, withCrew) {
  const g = new THREE.Group();
  add(g, G.box, scheme.body, 2.2, 1.85, 5.4, 0, 1.38, 0, true);
  add(g, G.box, scheme.stripe, 2.23, 0.34, 5.43, 0, 0.72, 0);
  add(g, G.box, scheme.stripe2, 2.23, 0.12, 5.43, 0, 0.98, 0);
  add(g, G.box, 0x1b2a33, 2.25, 0.62, 4.3, 0, 1.86, 0.2);
  add(g, G.box, 0x2c4654, 1.96, 0.8, 0.06, 0, 1.82, -2.72);
  add(g, G.box, scheme.body, 2.28, 0.14, 5.5, 0, 2.36, 0);
  add(g, G.box, 0x2b2b2b, 2.32, 0.26, 0.22, 0, 0.55, 2.76);
  add(g, G.box, 0x2b2b2b, 2.32, 0.26, 0.22, 0, 0.55, -2.76);
  // roof rack + load
  add(g, G.box, 0x2f2f2f, 0.07, 0.2, 4.4, -1.0, 2.53, 0); add(g, G.box, 0x2f2f2f, 0.07, 0.2, 4.4, 1.0, 2.53, 0);
  add(g, G.box, 0x7a4b2a, 0.9, 0.5, 0.9, -0.45, 2.68, -1.2, true);
  add(g, G.box, 0x2f6fb5, 0.8, 0.4, 1.1, 0.5, 2.63, -0.3, true);
  add(g, G.cyl, 0xd9d0b8, 0.7, 1.4, 0.7, 0, 2.78, 1.2).rotation.z = Math.PI / 2;
  add(g, G.box, 0xd8333a, 0.6, 0.35, 0.6, 0.55, 2.6, 1.8);
  // rear art
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), new THREE.MeshLambertMaterial({ map: getSloganTex(slogan, routeText) }));
  rear.position.set(0, 1.78, 2.716); g.add(rear);
  for (const x of [-0.86, 0.86]) {
    add(g, G.box, 0xd11f1f, 0.3, 0.2, 0.05, x, 0.98, 2.72);
    add(g, G.box, 0xfff3b0, 0.32, 0.2, 0.05, x, 0.95, -2.72);
  }
  for (const [x, z] of [[-1.0, -1.75], [1.0, -1.75], [-1.0, 1.75], [1.0, 1.75]]) {
    add(g, G.cyl, 0x161616, 0.92, 0.34, 0.92, x, 0.46, z).rotation.z = Math.PI / 2;
    add(g, G.cyl, 0xb0b0b0, 0.42, 0.36, 0.42, x, 0.46, z).rotation.z = Math.PI / 2;
  }
  if (withCrew) {
    // apprentice hanging out of the open side door
    add(g, G.box, 0x0e1418, 0.04, 1.3, 1.1, 1.11, 1.35, -0.75);
    const app = makePerson({ lappa: false, shirt: 0xffc23d, cast: true });
    app.position.set(1.22, 0.32, -0.75); app.rotation.z = -0.28; app.rotation.y = -0.4;
    app.userData.armR.rotation.z = 2.4;
    g.add(app); g.userData.apprentice = app;
  }
  return g;
}

function makeKekeh() {
  if (PLUG.vehicles.kekeh) return PLUG.vehicles.kekeh(kit);
  const g = new THREE.Group(); const c = pick([0xf2c230, 0x1eb53a, 0x2a7de1]);
  add(g, G.box, c, 1.4, 0.75, 2.0, 0, 0.75, 0.25, true);
  add(g, G.box, c, 0.8, 0.8, 0.7, 0, 0.8, -1.05, true);
  add(g, G.box, 0x1c1c1c, 1.48, 0.08, 2.5, 0, 2.0, 0, true);
  for (const [x, z] of [[-0.68, -0.85], [0.68, -0.85], [-0.68, 1.15], [0.68, 1.15]]) add(g, G.box, 0x1c1c1c, 0.05, 0.9, 0.05, x, 1.55, z);
  add(g, G.box, 0x2c4654, 0.75, 0.55, 0.04, 0, 1.45, -1.38);
  add(g, G.cyl, 0x161616, 0.6, 0.22, 0.6, 0, 0.3, -1.2).rotation.z = Math.PI / 2;
  for (const x of [-0.7, 0.7]) add(g, G.cyl, 0x161616, 0.6, 0.22, 0.6, x, 0.3, 0.9).rotation.z = Math.PI / 2;
  const d = makePerson({ lappa: false, role: 'driver' }); d.rotation.y = Math.PI; d.position.set(0, 0.35, -0.6); d.scale.setScalar(0.85); g.add(d);
  return { g, wid: 1.5, len: 2.8 };
}
function makeOkada() {
  if (PLUG.vehicles.okada) return PLUG.vehicles.okada(kit);
  const g = new THREE.Group();
  add(g, G.box, pick([0xd8333a, 0x1c1c1c, 0x2a7de1]), 0.32, 0.45, 1.5, 0, 0.7, 0, true);
  add(g, G.cyl, 0x161616, 0.62, 0.14, 0.62, 0, 0.32, -0.75).rotation.z = Math.PI / 2;
  add(g, G.cyl, 0x161616, 0.62, 0.14, 0.62, 0, 0.32, 0.75).rotation.z = Math.PI / 2;
  const r = makePerson({ lappa: false, cast: true, role: 'rider' }); r.rotation.y = Math.PI; r.position.set(0, 0.3, -0.15); r.scale.setScalar(0.9); g.add(r);
  add(g, G.sph, 0xd8333a, 0.4, 0.38, 0.42, 0, 1.86, -0.15);
  const p = makePerson({ cast: true, role: 'rider' }); p.rotation.y = Math.PI; p.position.set(0, 0.36, 0.45); p.scale.setScalar(0.88); g.add(p);
  return { g, wid: 0.9, len: 1.9, weave: true };
}
function makeCar() {
  if (PLUG.vehicles.taxi) return PLUG.vehicles.taxi(kit);
  const g = new THREE.Group(); const c = pick([0xf2c230, 0xf2c230, 0xffffff, 0x9aa4ab, 0x1d3a5f, 0x8b1e24]);
  add(g, G.box, c, 1.9, 0.72, 4.2, 0, 0.72, 0, true);
  add(g, G.box, c, 1.7, 0.62, 2.2, 0, 1.38, 0.25, true);
  add(g, G.box, 0x1b2a33, 1.74, 0.42, 2.0, 0, 1.38, 0.25);
  for (const [x, z] of [[-0.9, -1.35], [0.9, -1.35], [-0.9, 1.35], [0.9, 1.35]]) add(g, G.cyl, 0x161616, 0.66, 0.26, 0.66, x, 0.33, z).rotation.z = Math.PI / 2;
  for (const x of [-0.6, 0.6]) add(g, G.box, 0xd11f1f, 0.35, 0.16, 0.05, x, 0.86, 2.11);
  return { g, wid: 1.95, len: 4.2 };
}
function makeTrafficPoda() {
  const g = makePoda(pick(DATA.slogans), pick(DATA.route).toUpperCase() + ' – ' + pick(DATA.route).toUpperCase(), pick(SCHEMES), false);
  return { g, wid: 2.2, len: 5.4 };
}
function makeWakaFine() {
  if (PLUG.vehicles.wakaFine) return PLUG.vehicles.wakaFine(kit);
  const g = new THREE.Group();
  add(g, G.box, 0xffffff, 2.5, 2.6, 9, 0, 1.75, 0, true);
  add(g, G.box, 0x1eb53a, 2.53, 0.7, 9.03, 0, 0.8, 0);
  add(g, G.box, 0x0072c6, 2.53, 0.35, 9.03, 0, 1.3, 0);
  add(g, G.box, 0x1b2a33, 2.55, 0.85, 8.2, 0, 2.25, 0);
  add(g, G.box, 0x1b2a33, 2.2, 0.9, 0.05, 0, 2.2, 4.51);
  for (const [x, z] of [[-1.15, -3.2], [1.15, -3.2], [-1.15, 3.2], [1.15, 3.2]]) add(g, G.cyl, 0x161616, 1.0, 0.36, 1.0, x, 0.5, z).rotation.z = Math.PI / 2;
  return { g, wid: 2.5, len: 9 };
}
function makeGoat() {
  const g = new THREE.Group(); const c = pick([0xf2efe6, 0x6b4a32, 0x2a2420, 0xc9a77c]);
  const b = new THREE.Group(); g.add(b);
  add(b, G.box, c, 0.42, 0.42, 0.85, 0, 0.72, 0, true);
  add(b, G.box, c, 0.26, 0.3, 0.36, 0, 0.98, -0.55, true);
  add(b, G.box, 0x2a2420, 0.05, 0.16, 0.05, -0.08, 1.18, -0.5); add(b, G.box, 0x2a2420, 0.05, 0.16, 0.05, 0.08, 1.18, -0.5);
  for (const [x, z] of [[-0.14, -0.3], [0.14, -0.3], [-0.14, 0.3], [0.14, 0.3]]) add(b, G.box, c, 0.09, 0.52, 0.09, x, 0.26, z);
  return { g, wid: 0.9, len: 0.7, body: b };
}
function makeHawker() {
  const g = makePerson({ tray: true, cast: true, lappa: true, role: 'hawker' });
  return { g, wid: 0.7, len: 0.7, person: true };
}
function makePothole() { return streetAssets.pothole(randi(0, 4)); }

/* ================================================================
   World: road, ground, scenery chunks, mountains
   ================================================================ */
const world = new THREE.Group(); scene.add(world);
const CH = 30, NCH = 8;
const chunks = [];
let chunkSerial = 0;
const hy = ax => Math.max(0, ax - 11) * 0.42;

function buildStatic() {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 200), new THREE.MeshStandardMaterial({ map: roadTex, bumpMap: roadDetailTex, bumpScale: .035, roughnessMap: roadDetailTex, roughness: .96, metalness: 0 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -90); road.receiveShadow = true; scene.add(road);
  for (const s of [-1, 1]) {
    const channel = new THREE.Mesh(new THREE.PlaneGeometry(.36, 200), M(0x343a36));
    channel.rotation.x = -Math.PI / 2; channel.position.set(s * (ROAD_HALF + .18), .025, -90); scene.add(channel);
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(2.64, 200), new THREE.MeshStandardMaterial({ map: walkTex, roughness: 1 }));
    walk.rotation.x = -Math.PI / 2; walk.position.set(s * (ROAD_HALF + 1.68), 0.2, -90); walk.receiveShadow = true;
    if (s < 0) walk.scale.x = -1; // mirror wear onto the roadside edge
    scene.add(walk);
    add(scene, G.box, 0x89867b, 0.22, 0.22, 200, s * (ROAD_HALF + 0.05), 0.1, -90);
    add(scene, G.box, 0x75766b, .12, .22, 200, s * (ROAD_HALF + .36), .1, -90);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 600), M(0x8a745c));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, -250); ground.receiveShadow = true; scene.add(ground);

  // Layered peninsula ridges replace isolated geometric peaks. Both are cheap single meshes.
  const ridgeHeight = (x, near) => (near ? 37 : 77) + Math.sin(x * .011 + (near ? 1 : 0)) * (near ? 12 : 24)
    + Math.sin(x * .027 + 2.4) * (near ? 7 : 13) + Math.sin(x * .063) * (near ? 2 : 5);
  function ridge(z, near, color) {
    const verts = [];
    for (let x = -420; x < 420; x += 12) {
      const y0 = ridgeHeight(x, near), y1 = ridgeHeight(x + 12, near);
      verts.push(x, -12, z, x, y0, z, x + 12, y1, z, x, -12, z, x + 12, y1, z, x + 12, -12, z);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), side: THREE.DoubleSide, fog: false }));
    scene.add(mesh);
  }
  ridge(-495, false, 0x68858d);
  ridge(-410, true, 0x617d73);
  const hillHouses = new THREE.Group();
  for (let i = 0; i < 420; i++) {
    const x = rand(-300, 300), y = rand(4, ridgeHeight(x, true) - 8), z = -409 + rand(1, 3);
    const w = rand(2.2, 5), h = rand(2, 4.5);
    add(hillHouses, G.box, pick([0x968f79, 0xb3aa94, 0x819687, 0x9b8374, 0x879497]), w, h, .5, x, y, z);
    if (Math.random() < .6) add(hillHouses, G.box, pick([0x7e655a, 0x76776e, 0x807f75]), w + .2, .45, .65, x, y + h / 2, z);
  }
  scene.add(hillHouses); bake(hillHouses);
  for (const m of hillHouses.children) m.material = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const cloudG = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const cx = rand(-320, 320), cy = rand(120, 190), cz = rand(-520, -380);
    for (let j = 0; j < 4; j++) add(cloudG, G.sph, 0xffffff, rand(18, 34), rand(8, 13), rand(10, 16), cx + j * 14 - 20, cy + rand(-2, 3), cz + rand(-4, 4));
  }
  scene.add(cloudG); bake(cloudG);
  for (const m of cloudG.children) m.material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xa8b6bc, fog: false });

  // hillside slopes, one pair per chunk
  const slope = (s) => {
    const geo = new THREE.BufferGeometry();
    const a = 10.5, b = 52, y = hy(b);
    const v = s > 0 ? [a, 0, 0, b, y, 0, b, y, -CH, a, 0, 0, b, y, -CH, a, 0, -CH] : [-a, 0, 0, -a, 0, -CH, -b, y, -CH, -a, 0, 0, -b, y, -CH, -b, y, 0];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals(); return geo;
  };
  const slopeR = slope(1), slopeL = slope(-1);
  for (let i = 0; i < NCH; i++) {
    const ch = new THREE.Group(); ch.position.z = -i * CH + 10;
    const green = pick([0x55694b, 0x657650, 0x5b7153]);
    const r = new THREE.Mesh(slopeR, M(green)); r.receiveShadow = true; ch.add(r);
    const l = new THREE.Mesh(slopeL, M(green)); l.receiveShadow = true; ch.add(l);
    const content = new THREE.Group(); ch.add(content);
    Object.assign(ch.userData, { content, slopeL: l, slopeR: r, green });
    world.add(ch); chunks.push(ch); fillChunk(ch);
  }
}

function addHouse(parent, x, z, base, front, side) {
  const w = front ? rand(4.5, 7) : rand(3.5, 6), d = rand(4, 6), h = front ? rand(3.2, 5.5) : rand(2.6, 4.2);
  const board = !front && Math.random() < 0.28;
  const body = board ? pick([0x8a5a3a, 0x6f8fa6, 0xa8724a]) : pick(HOUSE);
  add(parent, G.box, body, d, h + 1, w, x, base + (h - 1) / 2, z);
  if (Math.random() < 0.65 || board) {
    add(parent, G.pyr, pick(ROOF), d * 1.62, board ? 2.2 : 1.3, w * 1.62, x, base + h - 0.5 + (board ? 1.1 : 0.65), z);
  } else {
    add(parent, G.box, 0xd6cfbf, d + 0.2, 0.3, w + 0.2, x, base + h - 0.35, z);
    if (Math.random() < 0.5) add(parent, G.box, 0x6a6e70, 0.12, 1.4, 0.12, x + rand(-1, 1), base + h + 0.4, z + rand(-1, 1)); // rebar stub
  }
  if (front) {
    const fx = x - side * (d / 2 + 0.02);
    add(parent, G.box, 0x24292c, 0.06, 2.1, 1.4, fx, 1.05, z + rand(-1, 1));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, w * 0.86 * 112 / 512), new THREE.MeshLambertMaterial({ map: pick(shopTex) }));
    sign.position.set(fx - side * 0.03, Math.min(h - 0.6, 2.9), z); sign.rotation.y = -side * Math.PI / 2; parent.add(sign);
  } else if (Math.random() < 0.6) {
    add(parent, G.box, 0x2b3135, 0.06, 0.8, 0.9, x - side * (d / 2 + 0.02), base + h * 0.55, z + rand(-1, 1));
  }
}
function addTree(parent, x, z, base, palm) {
  if (palm) {
    const t = add(parent, G.cyl6, 0x8a6a4a, 0.35, 7, 0.35, x, base + 3.5, z); t.rotation.z = rand(-0.12, 0.12);
    for (let i = 0; i < 7; i++) {
      const f = add(parent, G.box, 0x3f8a3a, 0.5, 0.08, 3.2, x + t.rotation.z * -3.5, base + 7, z);
      f.rotation.y = i / 7 * Math.PI * 2; f.rotation.x = 0.5; f.translateZ(1.4);
    }
  } else {
    add(parent, G.cyl6, 0x6b4f37, 0.5, 2.6, 0.5, x, base + 1.3, z);
    add(parent, G.ico, pick([0x2f6e33, 0x3b7d3a, 0x2a5f2f]), rand(4, 6), rand(3.2, 4.2), rand(4, 6), x, base + 3.8, z, true);
  }
}
function addVendor(parent, x, z, side) {
  const c = pick([0xd8333a, 0x1eb53a, 0xffc23d, 0x0072c6]);
  add(parent, G.cyl6, 0x2b2b2b, 0.06, 2.4, 0.06, x, 1.4, z);
  add(parent, G.cone, c, 2.8, 0.7, 2.8, x, 2.7, z, true);
  add(parent, G.box, 0x8a6a4a, 1.4, 0.8, 0.9, x, 0.6, z);
  for (let i = 0; i < 6; i++) add(parent, G.sph, pick([0xff7a29, 0xe8b52a, 0x6dbb3c, 0xf6efe1]), 0.22, 0.22, 0.22, x + rand(-0.55, 0.55), 1.1, z + rand(-0.3, 0.3));
  const p = makePerson({ cast: true }); p.position.set(x + side * 0.9, 0.2, z + 0.4); p.rotation.y = -side * Math.PI / 2; parent.add(p);
}

// The stretch of road leading up to stop i belongs to route[i]'s district.
const params = new URLSearchParams(location.search);
const benchmark = params.has('benchmark');
const forcedDistrict = params.get('district') || (benchmark ? 'Lumley' : null);
function districtFor(distAhead) {
  if (forcedDistrict) return forcedDistrict;
  const idx = S.stopIdx ?? 1, toStop = S.toStop ?? 260;
  return stopName(distAhead < toStop ? idx : idx + 1);
}
function fillChunk(ch) {
  const u = ch.userData, c = u.content;
  c.traverse(m => { if (m.userData.baked) m.geometry.dispose(); });
  while (c.children.length) c.remove(c.children[0]);
  u.slopeL.visible = u.slopeR.visible = true;
  u.slopeL.material = u.slopeR.material = M(u.green);
  const name = districtFor(-(ch.position.z - CH / 2));
  const d = PLUG.districts[name];
  // index counts chunks in driving order, so a district can make set pieces span consecutive chunks
  if (PLUG.people) PLUG.people.lodDefault = 'low';
  if (d && d.fill) d.fill(c, kit, { name, slopeL: u.slopeL, slopeR: u.slopeR, index: chunkSerial++ });
  else defaultFill(c);
  if (name === 'Lumley') {
    lumleyDetails.fill(c, chunkSerial);
    for (const side of [-1, 1]) streetAssets.drain(c, side, chunkSerial);
    if (chunkSerial % 3 === 0) streetAssets.roadworks(c, -ROAD_HALF - .65, -14);
  }
  // Repair seams and covers move with the recycled road and remain below hazard contrast.
  const seamX = rand(-ROAD_HALF + 1, ROAD_HALF - 1), seamZ = rand(-CH + 3, -3);
  add(c, G.box, 0x454743, rand(.8, 1.5), .006, .035, seamX, .014, seamZ);
  if (Math.random() < .5) {
    const z = rand(-CH + 5, -5), x = pick([-2.3, 2.3]);
    add(c, G.disc, 0x303330, 1.0, 1, 1.0, x, .021, z);
    add(c, G.disc, 0x65645b, .75, 1, .75, x, .023, z);
  }
  for (const side of [-1, 1]) if (Math.random() < .42) {
    const z = rand(-CH + 4, -4), x = side * (ROAD_HALF + .18);
    add(c, G.box, 0x545b55, .29, .015, .58, x, .036, z);
    for (const dz of [-.18, 0, .18]) add(c, G.box, 0x252b28, .22, .003, .035, x, .046, z + dz);
  }
  if (PLUG.people) PLUG.people.lodDefault = undefined;
  const trimmed=[];c.traverse(o=>{if(o.userData.decorativePerson&&Math.random()>qualityManager.budget.crowd)trimmed.push(o);});for(const person of trimmed)person.parent?.remove(person);
  bake(c);
}

/* ================================================================
   Baking: merge a group's static meshes into one draw call per material.
   Colour-only Lambert meshes share a single vertex-coloured material;
   textured meshes are merged per texture. Transparent ones stay as they are.
   ================================================================ */
const bakedVC = new THREE.MeshLambertMaterial({ vertexColors: true });
const bakedTex = {};
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3();
function bake(root, cast = false) {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const buckets = new Map(), done = [];
  root.traverse(o => {
    if (!o.isMesh || !o.visible || o.userData.baked) return;
    const mat = o.material;
    if (Array.isArray(mat) || mat.transparent || !mat.isMeshLambertMaterial) return;
    const key = mat.map ? mat.map.uuid : 'vc';
    if (key !== 'vc' && !o.geometry.attributes.uv) return;
    let b = buckets.get(key);
    if (!b) buckets.set(key, b = { mat, pos: [], nor: [], col: [], uv: [] });
    _m.multiplyMatrices(_inv, o.matrixWorld); _n.getNormalMatrix(_m);
    const flip = _m.determinant() < 0;
    const geo = o.geometry, P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, I = geo.index;
    const cnt = I ? I.count : P.count, c = mat.color;
    for (let t = 0; t < cnt; t += 3) {
      for (let k = 0; k < 3; k++) {
        const idx = I ? I.getX(t + (flip ? 2 - k : k)) : t + (flip ? 2 - k : k);
        _v.fromBufferAttribute(P, idx).applyMatrix4(_m); b.pos.push(_v.x, _v.y, _v.z);
        _v.fromBufferAttribute(N, idx).applyMatrix3(_n).normalize(); b.nor.push(_v.x, _v.y, _v.z);
        if (key === 'vc') b.col.push(c.r, c.g, c.b); else b.uv.push(U.getX(idx), U.getY(idx));
      }
    }
    done.push(o);
  });
  for (const o of done) o.parent.remove(o);
  for (const [key, b] of buckets) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    if (key === 'vc') geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    else geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    const mat = key === 'vc' ? bakedVC : (bakedTex[key] || (bakedTex[key] = new THREE.MeshLambertMaterial({ map: b.mat.map })));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.baked = true; mesh.castShadow = cast; mesh.matrixAutoUpdate = false;
    root.add(mesh);
  }
  return root;
}
function drop(obj) {
  world.remove(obj);
  for(const texture of obj.userData.ownedTextures||[])texture.dispose();
  obj.traverse(m => { if (m.userData.baked) m.geometry.dispose(); });
}
function defaultFill(c) {
  for (const s of [-1, 1]) {
    let z = -rand(0.5, 3);
    while (z > -CH + 3) {
      const gapAhead = rand(4.5, 7);
      if (Math.random() < 0.82) addHouse(c, s * rand(12.4, 13.6), z - gapAhead / 2, 0, true, s);
      else addTree(c, s * 12.5, z - gapAhead / 2, 0, Math.random() < 0.6);
      z -= gapAhead + rand(0.4, 1.6);
    }
    for (let i = randi(6, 9); i > 0; i--) { const ax = rand(18, 50); addHouse(c, s * ax, rand(-CH + 2, -2), hy(ax), false, s); }
    for (let i = randi(1, 3); i > 0; i--) { const ax = rand(17, 48); addTree(c, s * ax, rand(-CH, 0), hy(ax), Math.random() < 0.5); }
    if (Math.random() < 0.45) addVendor(c, s * (ROAD_HALF + 2.2), rand(-CH + 3, -3), s);
    if (Math.random() < 0.3) addTree(c, s * (ROAD_HALF + 2.6), rand(-CH + 2, -2), 0.2, true);
  }
  // power line on the left kerb
  add(c, G.cyl6, 0x6b4f37, 0.22, 8, 0.22, -(ROAD_HALF + 2.6), 4, -CH / 2);
  add(c, G.box, 0x6b4f37, 1.8, 0.14, 0.14, -(ROAD_HALF + 2.6), 7.6, -CH / 2);
  for (const dx of [-0.8, 0.8]) add(c, G.box, 0x1c1c1c, 0.04, 0.04, CH, -(ROAD_HALF + 2.6) + dx, 7.45, -CH / 2);
}

/* ================================================================
   Game state
   ================================================================ */
const RULES = window.PODA_RUN_RULES;
const CONFIG = window.PODA_CONFIG;
let vehicleId = CONFIG.vehicles[store.get('poda-vehicle')] ? store.get('poda-vehicle') : 'poda';
let routeId = CONFIG.routes[store.get('poda-route')] ? store.get('poda-route') : 'western';
let CAP = CONFIG.vehicles[vehicleId].capacity;
DATA.route = CONFIG.routes[routeId].stops;
const S = {};
let player, apprentice, contactShadow, workshop;
let transitionTime = 0, transitionPose = null, garageCategory = 'paint';
let obstacles = [], coins = [], boosts = [], stopObj = null, debris = [];
const stateMachine = new window.PODA_GameStateMachine();
const clock = new window.PODA_GameClock();
const events = new window.PODA_EventBus();
const missions = new window.PODA_MissionSystem(events, store);
const api = new window.PODA_ApiClient(store, fetch.bind(window), () => crypto.randomUUID());
let runSerial = 0, lastResult=null, resultVehicle=null, resultRoute=null, resultModel=null;
let garageReturnState = 'attract';
let garageHidden = [];
let state = stateMachine.current, demo = location.hash === '#demo' || new URLSearchParams(location.search).has('district');
function changeState(next) { state = stateMachine.transition(next); }
const inputManager = new window.PODA_InputManager({ moveLane: laneTo, horn, pause: () => state === 'paused' ? resumeRun() : pauseRun(), mute: toggleMute });
const input = inputManager.state;

function resetRun() {
  inputManager.release();
  for (const o of obstacles) releaseObstacle(o);
  for (const c of coins) coinFree(c);
  for (const b of boosts) world.remove(b.m);
  for (const d of debris) drop(d.g);
  if (stopObj) drop(stopObj.g);
  obstacles = []; coins = []; boosts = []; debris = []; stopObj = null;
  Object.assign(S, {
    vehicle: CONFIG.vehicles[vehicleId], jumpY:0, jumpVelocity:0, jumpCooldown:0, bump:0,
    dist: 0, speed: 12, lane: 2, x: LANES[2], cash: 0, coins: 0, dropped: 0, stops: 0,
    perfectStops: 0, missedStops: 0, collisions: 0, lost: 0, completed: false,
    stopIdx: 1, toStop: 260, legLen: 260, nextRow: 60,
    pax: [], hitAt: -99, invuln: 0, dwell: 0, dwellPlan: null, shake: 0, magnet: 0, time: 0, over: false,
  });
  // start half-full; each passenger knows where they're going
  for (let i = 0; i < Math.ceil(CAP / 2); i++) S.pax.push(randi(0, 2));
  for (let z = -45; z > -200; z -= 36) spawnRow(z);
  renderSeats(); renderBody();
}

/* ---------- Stops ---------- */
function stopName(i) { return DATA.route[i] || DATA.route[DATA.route.length - 1]; }
function spawnStop() {
  const g = new THREE.Group();
  const sx = ROAD_HALF + 1.7;
  add(g, G.box, 0x2b2b2b, 0.12, 2.6, 0.12, sx + 0.9, 1.5, -2.5); add(g, G.box, 0x2b2b2b, 0.12, 2.6, 0.12, sx + 0.9, 1.5, 2.5);
  add(g, G.box, 0x1eb53a, 1.8, 0.12, 5.8, sx + 0.4, 2.85, 0, true);
  add(g, G.box, 0x8a6a4a, 0.5, 0.45, 4, sx + 0.9, 0.5, 0);
  add(g, G.box, 0x2b2b2b, 0.1, 3.4, 0.1, sx - 0.6, 1.9, -6.5);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshLambertMaterial({ map: stopSignTex(stopName(S.stopIdx)) }));
  sign.position.set(sx - 0.6, 3.6, -6.5); sign.rotation.y = -0.6; g.add(sign);
  // yellow loading box in the kerb lane
  const zone = canvasTex(128, 512, (c, w, h) => {
    c.fillStyle = 'rgba(255,194,61,.0)'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffc23d'; c.lineWidth = 12; c.strokeRect(6, 6, w - 12, h - 12);
    c.lineWidth = 6; for (let y = -w; y < h; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + w); c.stroke(); }
  });
  g.userData.ownedTextures=[zone,sign.material.map];
  const zm = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 16), new THREE.MeshBasicMaterial({ map: zone, transparent: true, opacity: 0.85, depthWrite: false }));
  zm.rotation.x = -Math.PI / 2; zm.position.set(LANES[2], 0.03, 0); g.add(zm);
  const d0 = PLUG.districts[forcedDistrict || stopName(S.stopIdx)];
  if (d0 && d0.landmark) d0.landmark(g, kit, { name: stopName(S.stopIdx) });
  bake(g);
  const waiting = [];
  const n = Math.min(CAP, randi(3, CAP===30?15:7));
  for (let i = 0; i < n; i++) {
    const p = makePerson({ cast: true }); p.position.set(sx + rand(-0.6, 0.6), 0.2, rand(-4, 4)); p.rotation.y = -Math.PI / 2 + rand(-0.4, 0.4);
    g.add(p); waiting.push(p);
  }
  g.position.z = -S.toStop; world.add(g);
  stopObj = { g, z: -S.toStop, served: false, missed: false, waiting, walkers: [] };
}
function paxForStop() { return RULES.passengersDue(S.pax); }
function beginDwell() {
  const s = stopObj; s.served = true;
  const { dropN, board, remaining } = window.PODA_PassengerSystem.planStop(S.pax, s.waiting.length, S.stopIdx, DATA.route.length - 1, CAP);
  S.pax = remaining;
  S.dwell = 1.4 + 0.18 * (dropN + board);
  S.dwellPlan = { dropN, board, perfect: RULES.stopGrade(s.z) === 'perfect' };
  const door = new THREE.Vector3(S.x + 1.3, 0.2, -0.75 - s.z);
  s.waiting.slice(0, board).forEach((p, i) => s.walkers.push({ p, to: door.clone(), delay: i * 0.18, vanish: true }));
  for (let i = 0; i < dropN; i++) {
    const p = makePerson({ cast: true }); p.position.copy(door); s.g.add(p);
    s.walkers.push({ p, to: new THREE.Vector3(ROAD_HALF + rand(2, 3), 0.2, door.z + rand(-3, 3)), delay: i * 0.18, vanish: false });
  }
  if (dropN > 0) say('drop'); else say('load');
}
function finishDwell() {
  const { dropN, board, perfect } = S.dwellPlan;
  const earned = dropN * DATA.fare + (perfect ? 5 : 0);
  S.cash += earned; S.dropped += dropN; S.stops++;
  if (perfect) S.perfectStops++;
  events.emit('stop:served', { stop: stopName(S.stopIdx), grade: perfect ? 'perfect' : 'served', passengersDropped: dropN, passengersBoarded: board, earned });
  S.pax = window.PODA_PassengerSystem.boardPassengers(S.pax, board, S.stopIdx, DATA.route.length - 1, randi);
  if (earned > 0) pop('+' + fmtLe(earned), 'money');
  if (perfect) { pop('Perfect stop!'); say('perfect'); }
  if (S.pax.length >= CAP) say('load', 2);
  advanceStop();
  renderSeats();
  sfx('chime');
}
function advanceStop() {
  if (S.stopIdx === DATA.route.length - 1) { endRun(true); return; }
  S.pax = window.PODA_PassengerSystem.advanceDestinations(S.pax);
  S.stopIdx = S.stopIdx + 1;
  S.legLen = S.toStop = rand(420, 560);
}
function missStop() {
  const s = stopObj; s.missed = true;
  const { lost: owed, remaining } = window.PODA_PassengerSystem.missStop(S.pax);
  S.pax = remaining;
  S.lost += owed; S.missedStops++;
  events.emit('stop:missed', { stop: stopName(S.stopIdx), passengersLost: owed });
  if (owed > 0) { pop('No fare!', 'bad'); say('miss'); }
  advanceStop(); renderSeats();
}

/* ---------- Obstacles, coins, boosts ---------- */
const COIN_MAX = 90;
let coinIM = null;
const coinSlots = [];
const _cq = new THREE.Quaternion(), _ce = new THREE.Euler(), _cs = new THREE.Vector3(0.9, 0.12, 0.9), _c0 = new THREE.Vector3(0, 0, 0), _cp = new THREE.Vector3(), _cm = new THREE.Matrix4();
function initCoins() {
  coinIM = new THREE.InstancedMesh(G.cyl, coinMat, COIN_MAX);
  coinIM.frustumCulled = false;
  _cm.makeScale(0, 0, 0);
  for (let i = 0; i < COIN_MAX; i++) { coinIM.setMatrixAt(i, _cm); coinSlots.push(i); }
  world.add(coinIM);
}
function coinFree(c) { _cm.makeScale(0, 0, 0); coinIM.setMatrixAt(c.slot, _cm); coinSlots.push(c.slot); }
const LANE_SPEED = [10.5, 8, 5.5];
const heading = o => (o.person ? (o.vx > 0 ? Math.PI / 2 : -Math.PI / 2) : (o.vx > 0 ? -Math.PI / 2 : Math.PI / 2));
function spawnRow(z) {
  const prog = clamp(S.dist / 5000, 0, 1);
  const n = Math.random() < 0.3 + 0.35 * prog ? 2 : 1;
  const stopZ = -S.toStop;
  const lanes = shuffle([0, 1, 2]);
  let placed = 0;
  for (const lane of lanes) {
    if (placed >= n) break;
    if (lane === 2 && Math.abs(z - stopZ) < 55) continue;
    if(obstacles.some(o=>Math.abs(o.z-z)<22&&Math.abs(o.x-LANES[lane])<3))continue;
    const district=districtFor(-z);
    const freightDistrict=['Cline Town','Wellington','Kissy'].includes(district);
    const r = freightDistrict && Math.random()<.25 ? .65 : Math.random();
    let o, speed = LANE_SPEED[lane], cross = 0;
    if (r < 0.18) o = pooled('taxi', makeCar);
    else if (r < 0.34) o = pooled('kekeh', makeKekeh);
    else if (r < 0.46) o = pooled('okada', makeOkada);
    else if (r < 0.56) o = pooled('poda', makeTrafficPoda);
    else if (r < 0.62) { o = lane === 2 ? pooled('kekeh', makeKekeh) : pooled('waka', makeWakaFine); speed = 4; }
    else if (r < 0.70) { const type=pick(['box','flatbed','tipper','tanker','container','coach']), variant=randi(0,2); o=pooled(type+variant,()=>freight.make({type,variant})); speed=4; }
    else if(r<.73) {const g=new THREE.Group();streetAssets.roadworks(g,0,0);o={g,wid:2.1,len:8,static:true};speed=0;}
    else if (r < 0.74) { o = makeGoat(); speed = 0; cross = 1; }
    else if (r < 0.84) { o = makeHawker(); speed = 0; cross = 1; }
    else if(r<.89){const g=new THREE.Group();add(g,G.box,0xe1a242,1.6,.35,.5,0,.18,0);o={g,wid:1.6,len:.5,static:true,jumpable:true};speed=0;}
    else { const v=randi(0,4); o=pooled('pothole'+v,()=>streetAssets.pothole(v)); speed=0; }
    o.cruise=speed; o.weave=false; o.lane = lane; o.speed = speed; o.z = z; o.x = LANES[lane];
    if (cross) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      o.vx = dir * rand(0.9, 1.5); o.crossVelocity=o.vx; o.x = LANES[lane] - dir * 2.2; o.cross = true;
      o.g.rotation.y = heading(o);
    } else if (!o.poolKey && !o.flat && !o.person) bake(o.g, true);
    o.g.position.set(o.x, 0, z);
    world.add(o.g); obstacles.push(o); placed++;
  }
  // a line of coins in a free lane
  const free = [0, 1, 2].filter(l => !obstacles.some(o => o.z === z && o.lane === l));
  if (free.length && Math.random() < 0.75) {
    const l = pick(free);
    for (let i = 0; i < 5; i++) {
      const slot = coinSlots.pop(); if (slot === undefined) break;
      coins.push({ slot, x: LANES[l], z: z - 6 - i * 3 });
    }
  } else if (free.length && Math.random() < 0.25) {
    const l = pick(free); const m = new THREE.Group();
    add(m, G.cyl, 0x8a4b12, 0.42, 1.0, 0.42, 0, 0, 0);
    add(m, G.cyl, 0x8a4b12, 0.2, 0.4, 0.2, 0, 0.66, 0);
    add(m, G.cyl, 0xf6ecd6, 0.44, 0.35, 0.44, 0, 0.05, 0);
    m.position.set(LANES[l], 1.2, z - 10); world.add(m); boosts.push({ m, x: LANES[l], z: z - 10 });
  }
}

function hit(o) {
  if (o.flat) {
    if(!window.PODA_RoadContact.pothole(S,o,reduceMotion))return;
    sfx('thud'); events.emit('pothole:hit', {distance:S.dist}); pop('Pothole · tek tem!'); return;
  }
  if (S.invuln > 0 || o.dead) return;
  o.dead = true;
  const side = o.x >= S.x ? 1 : -1;
  debris.push({ g: o.g, vx: side * rand(5, 9), vy: o.flat ? 0 : rand(3, 6), spin: rand(-6, 6), t: 0, flat: o.flat });
  obstacles.splice(obstacles.indexOf(o), 1);
  S.shake = reduceMotion ? 0.1 : 0.6;
  sfx(o.flat ? 'thud' : 'crash');
  if (state !== 'play') return;
  S.collisions++;
  events.emit('collision', { type: o.flat ? 'pothole' : 'traffic', collisions: S.collisions });
  const second = S.time - S.hitAt < 4;
  S.hitAt = S.time; S.invuln = 1.0;
  if (second) { endRun(); return; }
  S.speed *= 0.4;
  const bail = Math.min(S.pax.length, randi(1, 3));
  S.pax.splice(0, bail);
  S.lost += bail;
  pop(o.flat ? 'POTHOLE!' : 'BAM!', 'bad');
  say('stumble');
  renderSeats(); renderBody();
}

/* ================================================================
   Input
   ================================================================ */
function laneTo(d) {
  if (state !== 'play' || demo || S.dwell > 0) return;
  S.lane = clamp(S.lane + d, 0, 2);
}
addEventListener('keydown', e => {
  if(e.target?.closest?.('input,select,textarea,button,summary,a,dialog'))return;
  if (e.repeat && !['ArrowDown', 's', 'S', ' ', 'ArrowUp', 'w', 'W'].includes(e.key)) return;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (state === 'play' || state === 'paused') inputManager.command('PAUSE');
    e.preventDefault(); return;
  }
  if (state === 'play') {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputManager.command('MOVE_LEFT');
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputManager.command('MOVE_RIGHT');
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' ) { inputManager.command('BRAKE'); e.preventDefault(); }
    else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { inputManager.command('ACCELERATE'); e.preventDefault(); }
    else if (e.key === ' ' && !e.repeat) { e.preventDefault(); jump(); }
    else if (e.key === 'h' || e.key === 'H') inputManager.command('HORN');
    else if (e.key === 'm' || e.key === 'M') inputManager.command('MUTE');
  } else if (state === 'attract' || state === 'over' || state === 'complete') {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startRun(); }
  }
});
addEventListener('keyup', e => {
  if (['ArrowDown', 's', 'S', ' '].includes(e.key)) inputManager.command('BRAKE', false);
  if (['ArrowUp', 'w', 'W'].includes(e.key)) inputManager.command('ACCELERATE', false);
});
function jump() { if(state==='play' && !demo && window.PODA_JumpSystem.start(S)) {events.emit('jump:start',{});tone(220,.12,'sine',.08,420);} }
let touch0 = null;
canvas.addEventListener('pointerdown', e => { if(e.isPrimary && !input.brake && !input.gas) {canvas.setPointerCapture(e.pointerId);touch0 = { x: e.clientX, y: e.clientY, time:performance.now(), id:e.pointerId };} });
canvas.addEventListener('pointerup', e => {
  if (!touch0 || touch0.id!==e.pointerId) return;
  const dx = e.clientX - touch0.x, dy = e.clientY - touch0.y, elapsed=performance.now()-touch0.time; touch0 = null;
  if(input.brake || input.gas) return;
  if(window.PODA_JumpSystem.swipe(dx,dy,elapsed)) {jump();return;}
  if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) inputManager.command(dx > 0 ? 'MOVE_RIGHT' : 'MOVE_LEFT');
  else if (dy > 40) inputManager.command('BRAKE_PULSE');
});
canvas.addEventListener('pointercancel',()=>touch0=null);
const brakeBtn = $('brakeBtn');
brakeBtn.addEventListener('pointerdown', e => { touch0=null; e.preventDefault(); inputManager.command('BRAKE'); brakeBtn.classList.add('down'); hud3d?.control('brake', true); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) brakeBtn.addEventListener(ev, () => { inputManager.command('BRAKE', false); brakeBtn.classList.remove('down'); hud3d?.control('brake', false); });
const gasBtn = $('gasBtn');
gasBtn.addEventListener('pointerdown', e => { touch0=null; e.preventDefault(); inputManager.command('ACCELERATE'); gasBtn.classList.add('down'); hud3d?.control('gas', true); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) gasBtn.addEventListener(ev, () => { inputManager.command('ACCELERATE', false); gasBtn.classList.remove('down'); hud3d?.control('gas', false); });
addEventListener('blur', () => inputManager.release());
const hornBtn = $('hornBtn');
hornBtn.addEventListener('pointerdown', () => hud3d?.control('horn', true));
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) hornBtn.addEventListener(ev, () => hud3d?.control('horn', false));
hornBtn.addEventListener('click', () => inputManager.command('HORN'));
$('startBtn').addEventListener('click', startRun);
$('againBtn').addEventListener('click', startRun);
$('pauseBtn').addEventListener('click', pauseRun);
$('resumeBtn').addEventListener('click', resumeRun);
$('restartBtn').addEventListener('click', startRun);
$('homeResult').addEventListener('click', returnHome);
$('homePause').addEventListener('click', () => $('leaveRun').showModal());
$('keepDriving').addEventListener('click', () => $('leaveRun').close());
$('leaveConfirm').addEventListener('click', () => {
  $('leaveRun').close();
  if (state !== 'paused') return;
  endRun(); returnHome();
});
$('pauseMute').addEventListener('click', toggleMute);
$('pauseMusic').addEventListener('click', () => $('auxFile').click());
$('pause').addEventListener('keydown', event => {
  if ($('leaveRun').open) return;
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); resumeRun(); }
  if (event.key === 'Tab') {
    const buttons = [...$('pause').querySelectorAll('button, select, summary')].filter(el => el.getClientRects().length);
    const first=buttons[0], last=buttons.at(-1);
    if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
  }
});
$('qualityProfile').addEventListener('change', e => { qualityManager.setProfile(e.target.value); store.set('poda-quality', e.target.value); });
$('leadersTitle').addEventListener('click', showLeaderboard);
$('leadersResult').addEventListener('click', showLeaderboard);
$('missionsTitle').addEventListener('click', () => { $('missionsText').textContent=missions.status().map(m=>`${m.label}: ${m.progress}/${m.target}`).join(' • '); $('missionsPanel').hidden=false; });
$('missionsClose').addEventListener('click', () => $('missionsPanel').hidden=true);
for(const button of document.querySelectorAll('[data-garage-category]')) button.addEventListener('click',()=>{ garageCategory=button.dataset.garageCategory; document.querySelectorAll('[data-garage-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); document.querySelectorAll('[data-garage-detail]').forEach(p=>p.hidden=p.dataset.garageDetail!==garageCategory); });
$('chooseRide').addEventListener('click', openPlayerGarage);
const titleHelp = $('titleHelp');
$('titleHow').addEventListener('click', () => titleHelp.showModal());
$('titleHelpClose').addEventListener('click', () => titleHelp.close());
titleHelp.addEventListener('click', event => { if (event.target === titleHelp) titleHelp.close(); });
for(const [id,v] of Object.entries(CONFIG.vehicles)) $('rideSelect').add(new Option(v.name,id));
for(const [id,r] of Object.entries(CONFIG.routes)) $('routeSelect').add(new Option(r.name+' · '+r.difficulty,id));
$('rideSelect').value=vehicleId; $('routeSelect').value=routeId;
function updateTitleRoute() {
 const ids=Object.keys(CONFIG.routes), index=ids.indexOf(routeId), route=CONFIG.routes[routeId];
 $('titleRouteIndex').textContent=`ROUTE ${String(index+1).padStart(2,'0')} / ${String(ids.length).padStart(2,'0')} · ${route.difficulty.toUpperCase()}`;
 $('titleRouteName').textContent=route.name;
 $('titleRouteStops').textContent=`${route.stops[0]} → ${route.stops.at(-1)} · ${route.stops.length} stops`;
}
for (const [id, direction] of [['titleRoutePrev',-1],['titleRouteNext',1]]) $(id).addEventListener('click',()=>{
 const ids=Object.keys(CONFIG.routes), index=ids.indexOf(routeId);
 $('routeSelect').value=ids[(index+direction+ids.length)%ids.length];
 $('routeSelect').dispatchEvent(new Event('change'));
});
function selectionDetails() {
 const v=CONFIG.vehicles[vehicleId],r=CONFIG.routes[routeId];
 $('rideStats').textContent=`${v.capacity} passengers · Speed ${Math.round(v.maxSpeed*3.6)} km/h · Handling ${Math.round(v.handling/18*5)}/5 · Braking ${Math.round(v.braking/30*5)}/5`;
 $('routeDescription').textContent=r.stops.join(' → ')+' · '+r.description+'. Condensed arcade route.';
 document.querySelector('.garage-tabs').hidden=vehicleId!=='poda';
 for(const panel of document.querySelectorAll('[data-garage-detail]'))panel.hidden=vehicleId!=='poda'||panel.dataset.garageDetail!==garageCategory;
}
selectionDetails();
updateTitleRoute();
$('rideSelect').addEventListener('change',e=>{vehicleId=e.target.value;store.set('poda-vehicle',vehicleId);buildPlayer();selectionDetails();});
$('routeSelect').addEventListener('change',e=>{routeId=e.target.value;store.set('poda-route',routeId);DATA.route=CONFIG.routes[routeId].stops;buildPlayer();selectionDetails();updateTitleRoute();});
for(const [id,key,fallback] of [['cargoSelect','poda-cargo','loaded'],['wheelSelect','poda-wheels','steel'],['hornSelect','poda-horn','classic'],['bodyPaint','poda-paint','default'],['rackSelect','poda-rack','fitted'],['bodyTrim','poda-trim','standard'],['routeBoard','poda-board','auto'],['stickerSelect','poda-sticker','none']]){
 $(id).value=store.get(key)||fallback;
 $(id).addEventListener('change',e=>{store.set(key,e.target.value);buildPlayer();if(id==='hornSelect')horn();});
}
$('garageTitle').addEventListener('click', openPlayerGarage);
$('garageResult').addEventListener('click', openPlayerGarage);
$('garageClose').addEventListener('click', closePlayerGarage);
$('garageDrive').addEventListener('click', startRun);
$('garageLivery').addEventListener('change', e => {
  selectedLivery = e.target.value; store.set('poda-livery', selectedLivery); buildPlayer(); poseGarageCamera();
});
$('garageSlogan').addEventListener('change', e => {
  selectedSlogan = e.target.value; store.set('poda-slogan', selectedSlogan); buildPlayer(); poseGarageCamera();
});
$('leaderClose').addEventListener('click', () => { $('leaderboard').hidden = true; });
$('leaderPeriod').addEventListener('change', loadLeaderboard);
$('mute').addEventListener('click', toggleMute);
addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pauseRun(); });

function horn() {
  const hornStyle=store.get('poda-horn');
  if(hornStyle==='bright')tone(660,.3,'square',.08,480);else if(hornStyle==='deep')tone(150,.4,'sawtooth',.14,110);else sfx('horn');
  pop('POOP POOP!');
  for(const o of obstacles)if(!o.cross&&!o.flat&&o.z>-45&&o.z<-8){o.honked=true;o.decision=0;}
  let scared = false;
  for (const o of obstacles) if (o.cross && o.z > -45 && o.z < 2 && !o.flee) { o.flee = true; o.vx = Math.sign(o.x || 1) * 4.5; scared = true; }
  if (scared && Math.random() < 0.6) say('horn');
}

/* ================================================================
   Audio (Web Audio, synthesised)
   ================================================================ */
let ac = null, muted = store.get('poda-muted') === '1';
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return ac; }
function syncSoundButtons() {
  $('mute').textContent = muted ? '🔇' : '🔊';
  $('mute').setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  $('mute').title = muted ? 'Turn sound on' : 'Turn sound off';
  $('pauseMute').querySelector('span').textContent = muted ? '🔇' : '🔊';
  $('pauseMute').querySelector('b').textContent = muted ? 'Sound off' : 'Sound on';
  $('pauseMute').setAttribute('aria-pressed', String(!muted));
}
function toggleMute() { muted = !muted; store.set('poda-muted', muted ? '1' : '0'); syncSoundButtons(); }
syncSoundButtons();
function tone(f, dur, type, vol, f2, when = 0) {
  const a = audio(); if (!a || muted) return;
  const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, cutoff) {
  const a = audio(); if (!a || muted) return;
  const b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = b; f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination); s.start();
}
/* ---------- Music: a synthesised Salone afropop riddim, plus AUX for the player's own songs ----------
   Plays while the poda is moving and drops right down while it's stopped. */
const music = { gain: null, noise: null, next: 0, step: 0 };
const STEP = 60 / 104 / 4;                       // 16th notes at 104 bpm
const ROOTS = [110, 87.31, 130.81, 98];          // Am – F – C – G
const CHORD = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
const KICK = [1,0,0,0, 0,0,1,0, 1,0,0,1, 0,0,0,0];
const BASS = [1,0,0,1, 0,0,2,0, 1,0,0,1, 0,0,2,0];
const STAB = [0,0,1,0, 0,0,0,1, 0,0,1,0, 0,0,0,1];
// Default song while the poda moves. Streamed, not decoded, so it stays light on memory.
// If the file isn't there (e.g. a public build without it), the synthesised riddim takes over.
const DEFAULT_SONG = { name: 'Drizilik – Sabi Road', url: new URL('../audio/sabi-road.mp3', import.meta.url).href };
const aux = { el: new Audio(), list: [DEFAULT_SONG], i: 0 };
aux.el.preload = 'none'; aux.el.src = DEFAULT_SONG.url; aux.el.volume = 0;
aux.el.addEventListener('error', () => {
  if (aux.list[aux.i] !== DEFAULT_SONG) return;
  aux.list = aux.list.filter(t => t !== DEFAULT_SONG); aux.i = 0;
  if (aux.list.length) aux.el.src = aux.list[0].url;
  auxLabel();
});
function musicInit() {
  const a = audio(); if (!a || music.gain) return;
  music.gain = a.createGain(); music.gain.gain.value = 0; music.gain.connect(a.destination);
  music.noise = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
  const d = music.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  music.next = a.currentTime + 0.1;
}
function voice(t, f, f2, dur, type, vol, cutoff) {
  const a = ac, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (cutoff) { const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff; o.connect(fl).connect(g); } else o.connect(g);
  g.connect(music.gain); o.start(t); o.stop(t + dur + 0.02);
}
function hat(t, vol, dur, freq) {
  const a = ac, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = music.noise; f.type = 'highpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(music.gain); s.start(t, Math.random() * 0.4, dur + 0.02);
}
function playStep(i, t) {
  const bar = (i >> 4) % 4, st = i % 16, root = ROOTS[bar];
  if (KICK[st]) voice(t, 150, 42, 0.28, 'sine', 0.55);
  if (st === 4 || st === 12) { hat(t, 0.22, 0.12, 1800); voice(t, 220, 160, 0.06, 'triangle', 0.12); }
  hat(t, st % 2 ? 0.07 : 0.035, 0.04, 7000);                       // shaker
  if (st === 3 || st === 10) voice(t, 1250, 0, 0.05, 'sine', 0.07); // clave
  if (BASS[st]) voice(t, root * (BASS[st] === 2 ? 1 : 0.5), 0, 0.22, 'triangle', 0.32, 600);
  if (STAB[st]) for (const n of CHORD[bar]) voice(t, root * 2 * Math.pow(2, n / 12), 0, 0.16, 'sawtooth', 0.035, 1800);
  if (st === 14 && bar === 3) voice(t, root * 4, root * 3, 0.3, 'square', 0.03, 2400); // little pickup
}
function musicTick(dt) {
  const a = ac; if (!a || !music.gain) return;
  const moving = state === 'play' && S.speed > 2 && S.dwell <= 0;
  const level = muted ? 0 : state !== 'play' ? 0 : moving ? 1 : 0.15;
  const usingAux = aux.list.length > 0;
  music.gain.gain.setTargetAtTime(usingAux ? 0 : level * 0.36, a.currentTime, 0.35);
  if (usingAux) {
    // songs play only while the poda moves: fade out and pause at stops, pick up where they left off
    const want = level === 1 ? 0.85 : 0;
    aux.el.volume = clamp(aux.el.volume + (want - aux.el.volume) * Math.min(1, dt * (want ? 2 : 4)), 0, 1);
    if (aux.el.paused && want > 0) aux.el.play().catch(() => {});
    if (want === 0 && aux.el.volume < 0.01 && !aux.el.paused) aux.el.pause();
  }
  if (usingAux || level === 0) { music.next = a.currentTime + 0.05; return; } // idle: schedule nothing
  while (music.next < a.currentTime + 0.12) { playStep(music.step, music.next); music.next += STEP; music.step = (music.step + 1) % 64; }
}
/* ---------- Engine: one looped recording, pitched and opened up with speed ---------- */
const engine = { src: null, gain: null, lp: null, loading: false };
function engineInit() {
  const a = audio(); if (!a || engine.src || engine.loading || !window.PODA_ENGINE_MP3) return;
  engine.loading = true;
  const bin = atob(window.PODA_ENGINE_MP3), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  a.decodeAudioData(u8.buffer).then(buf => {
    // skip any encoder silence at either end so the loop is gapless
    const d = buf.getChannelData(0); let i0 = 0, i1 = d.length - 1;
    while (i0 < d.length && Math.abs(d[i0]) < 0.003) i0++;
    while (i1 > i0 && Math.abs(d[i1]) < 0.003) i1--;
    const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
    src.loopStart = i0 / buf.sampleRate; src.loopEnd = i1 / buf.sampleRate;
    engine.lp = a.createBiquadFilter(); engine.lp.type = 'lowpass'; engine.lp.frequency.value = 900;
    engine.gain = a.createGain(); engine.gain.gain.value = 0;
    src.connect(engine.lp).connect(engine.gain).connect(a.destination);
    src.start(0, src.loopStart); engine.src = src;
  }).catch(() => {});
}
function engineTick() {
  if (!engine.src) return;
  const t = ac.currentTime, on = state === 'play' && !muted;
  const sp = clamp(S.speed / 33, 0, 1), pushing = !input.brake && S.dwell <= 0 && S.speed > 0.5;
  const rev = pushing && input.gas ? 0.14 : pushing ? 0.05 : -0.04;
  const rate = S.dwell > 0 || S.speed < 0.5 ? 0.7 : 0.78 + 0.62 * sp + rev;
  engine.src.playbackRate.setTargetAtTime(rate * CONFIG.vehicles[vehicleId].pitch, t, 0.18);
  engine.gain.gain.setTargetAtTime(on ? (S.speed < 0.5 ? 0.22 : 0.3 + 0.35 * sp) : 0, t, 0.2);
  engine.lp.frequency.setTargetAtTime(700 + 2600 * sp + (pushing ? 500 : 0), t, 0.2);
}
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend(); else ac.resume();   // stop all sound and audio work in background tabs
});

function auxLabel() {
  const t = aux.list.length ? aux.list[aux.i].name : 'Salone Riddim';
  $('auxBtn').innerHTML = '♪ <b></b> · AUX'; $('auxBtn').querySelector('b').textContent = t;
}
aux.el.addEventListener('ended', () => {
  if (!aux.list.length) return; aux.i = (aux.i + 1) % aux.list.length; aux.el.src = aux.list[aux.i].url; aux.el.play().catch(() => {}); auxLabel(); });
$('auxBtn').addEventListener('click', () => $('auxFile').click());
$('auxFile').addEventListener('change', e => {
  const files = [...e.target.files]; if (!files.length) return;
  for (const t of aux.list) if (t.url.startsWith('blob:')) URL.revokeObjectURL(t.url);
  aux.list = files.map(f => ({ name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) }));
  aux.i = 0; aux.el.src = aux.list[0].url; aux.el.volume = 0; auxLabel();
  musicInit(); e.target.value = '';
});

function sfx(k) {
  if (state !== 'play' && !demo) return;
  if (k === 'horn') { tone(392, 0.16, 'square', 0.05); tone(494, 0.16, 'square', 0.04); tone(392, 0.22, 'square', 0.05, null, 0.2); tone(494, 0.22, 'square', 0.04, null, 0.2); }
  if (k === 'coin') tone(1180, 0.09, 'sine', 0.06, 1760);
  if (k === 'chime') { tone(660, 0.14, 'triangle', 0.07); tone(990, 0.2, 'triangle', 0.06, null, 0.12); }
  if (k === 'crash') { noise(0.45, 0.35, 900); tone(120, 0.3, 'sawtooth', 0.08, 50); }
  if (k === 'thud') { noise(0.2, 0.25, 400); }
  if (k === 'boost') { tone(500, 0.3, 'sine', 0.06, 1200); }
}

/* ================================================================
   HUD
   ================================================================ */
const hudEls = { cash: $('cash'), dist: $('dist'), kmh: $('kmh'), stopName: $('stopName'), stopDist: $('stopDist'), stopDrop: $('stopDrop'), bar: $('stopBar').firstElementChild, paxN: $('paxN'), hint: $('hint') };
const seatsEl = $('seats');
for (let i = 0; i < CAP; i++) seatsEl.appendChild(document.createElement('i'));
function renderSeats() {
  if(seatsEl.children.length!==CAP){seatsEl.replaceChildren();for(let i=0;i<CAP;i++)seatsEl.appendChild(document.createElement('i'));}
  const drops = paxForStop();
  [...seatsEl.children].forEach((el, i) => { el.className = i < drops ? 'drop' : i < S.pax.length ? 'on' : ''; });
  hudEls.paxN.textContent = `${S.pax.length}/${CAP}`;
}
function renderBody() {
  const shaken = S.time - S.hitAt < 4 && state === 'play';
  const els = $('body').children;
  els[0].className = shaken ? 'off' : ''; els[1].className = '';
  $('bodyLabel').textContent = shaken ? 'Careful! Another hit ends the run' : 'Bus ready';
}
let lastRouteRail = '';
function renderRouteRail() {
  const key = routeId + ':' + S.stopIdx;
  if (key === lastRouteRail) return;
  lastRouteRail = key;
  $('routeRail').replaceChildren(...DATA.route.map((name, index) => {
    const stop = document.createElement('span');
    stop.className = index < S.stopIdx ? 'passed' : index === S.stopIdx ? 'current' : '';
    if(index === S.stopIdx) stop.setAttribute('aria-current','step');
    stop.title = name;
    const bar=document.createElement('i'), label=document.createElement('small');
    label.textContent=name; stop.append(bar,label); return stop;
  }));
  $('routeRail').setAttribute('aria-label', `Next stop ${Math.min(S.stopIdx+1,DATA.route.length)} of ${DATA.route.length}: ${stopName(S.stopIdx)}`);
}
let lastHud = '';
function updateHud() {
  const score = RULES.calculateScore(S);
  const key = [score, S.coins, Math.round(S.cash), Math.round(S.dist / 10), Math.round(S.speed), S.stopIdx, Math.round(S.toStop / 5), S.pax.length, S.time - S.hitAt < 4].join('|');
  if (key === lastHud) return; lastHud = key;
  hudEls.cash.textContent = fmtLe(S.cash);
  $('liveScore').textContent = score.toLocaleString('en-US');
  $('liveCoins').textContent = S.coins.toLocaleString('en-US');
  renderRouteRail();
  hudEls.dist.textContent = (S.dist / 1000).toFixed(2) + ' km';
  hudEls.kmh.textContent = Math.round(S.speed * 3.6) + ' km/h';
  hudEls.stopName.textContent = stopName(S.stopIdx);
  hudEls.stopDist.textContent = Math.max(0, Math.round(S.toStop)) + ' m';
  const d = paxForStop();
  hudEls.stopDrop.textContent = d + ' to drop';
  const progress = clamp(100 - S.toStop / S.legLen * 100, 0, 100);
  hudEls.bar.style.width = progress + '%';
  hudEls.bar.parentElement.style.setProperty('--progress', progress + '%');
  if (hud3d) hud3d.set({
    cash: fmtLe(S.cash), speed: Math.round(S.speed * 3.6) + ' km/h',
    distance: (S.dist / 1000).toFixed(2) + ' km', pax: `${S.pax.length}/${CAP}`,
    damaged: S.time - S.hitAt < 4 && state === 'play',
    stop: stopName(S.stopIdx), toStop: Math.max(0, Math.round(S.toStop)) + ' m',
    drops: d, progress: progress / 100,
  });
}
function setHint(html) {
  if (hudEls.hint.innerHTML !== html) hudEls.hint.innerHTML = html;
  hudEls.hint.hidden = !html;
  if (hud3d) hud3d.setHint(html.replace(/<[^>]*>/g, ''));
}
const popsEl = $('pops');
function pop(text, cls = '') {
  if (state !== 'play' && !demo) return;
  while (popsEl.children.length > 2) popsEl.firstChild.remove();
  const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text;
  popsEl.appendChild(el); setTimeout(() => el.remove(), 1900);
  if (hud3d) hud3d.pop(text, cls);
}
function say(kind, idx) {
  if (state !== 'play' && !demo) return;
  const lines = DATA.krio[kind]; if (!lines) return;
  const [kr, en] = idx != null ? lines[idx] : pick(lines);
  while (popsEl.children.length > 2) popsEl.firstChild.remove();
  const el = document.createElement('div'); el.className = 'pop krio';
  el.innerHTML = `${kr}<small>${en}</small>`;
  if (hud3d) hud3d.pop(kr, 'krio', en);
  popsEl.appendChild(el); setTimeout(() => el.remove(), 2200);
}

/* ================================================================
   Flow
   ================================================================ */
function startRun() {
  runSerial++;
  audio(); if (ac && ac.state === 'suspended') ac.resume();
  freeTown();
  transitionPose = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
  transitionTime = reduceMotion || demo ? 0 : 1.3;
  if (workshop) workshop.visible = false;
  world.visible = true;
  CAP=CONFIG.vehicles[vehicleId].capacity; DATA.route=CONFIG.routes[routeId].stops; buildPlayer();
  resetRun();
  for(const ch of chunks) fillChunk(ch);
  changeState('play');
  clock.reset();
  garageHidden = [];
  $('playerGarage').hidden = true;
  $('pause').hidden = true;
  $('leaveRun').close();
  $('radio').inert = false;
  $('hud').inert = false;
  lastHud = ''; lastRouteRail = '';
  $('title').hidden = true; $('over').hidden = true; $('hud').hidden = false; $('touch').hidden = false; $('radio').hidden = false;
  musicInit(); engineInit();
  popsEl.innerHTML = '';
  pop('Swipe to steer · tap GAS to drive');
  updateHud();
  canvas.focus?.();
  events.emit('game:start', { route: DATA.route });
  // New vehicle/route scores are local until the online validator supports this ruleset.
}
function pauseRun() {
  if (state !== 'play') return;
  changeState('paused');
  inputManager.release();
  $('pause').hidden = false; $('touch').hidden = true;
  $('radio').inert = true;
  $('hud').inert = true;
  $('pauseGoals').replaceChildren(...missions.status().map(mission => {
    const row=document.createElement('div'), label=document.createElement('label'), amount=document.createElement('b'), progress=document.createElement('progress');
    progress.id='pause-goal-'+mission.id; progress.max=mission.target; progress.value=mission.progress;
    label.htmlFor=progress.id; label.textContent=mission.label;
    amount.textContent=mission.complete?'Done':`${mission.progress}/${mission.target}`;
    row.className=mission.complete?'goal-done':''; row.append(label,amount,progress); return row;
  }));
  syncSoundButtons(); $('resumeBtn').focus();
  events.emit('game:pause', {});
}
function resumeRun() {
  if (state !== 'paused' || $('leaveRun').open) return;
  changeState('play'); clock.reset(); canvas.focus();
  $('pause').hidden = true; $('touch').hidden = false;
  $('radio').inert = false;
  $('hud').inert = false;
  events.emit('game:resume', {});
}
function endRun(completed = false) {
  if (state === 'over' || state === 'complete') return;
  changeState(completed ? 'complete' : 'over');
  S.over = true; S.completed = completed;
  inputManager.release();
  $('pause').hidden = true; $('radio').hidden = true; $('touch').hidden = true; $('hud').hidden = true;
  $('shareStatus').textContent = '';
  $('over').classList.toggle('run-complete', completed);
  const result = RULES.summarize(S);
  lastResult={...result,id:crypto.randomUUID(),date:Date.now(),vehicle:vehicleId,route:routeId};resultVehicle=CONFIG.vehicles[vehicleId].name;resultRoute=CONFIG.routes[routeId].name;
  if(resultModel)resultModel.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
  resultModel=player.clone(true);resultModel.traverse(m=>{if(m.isMesh)m.geometry=m.geometry.clone();});
  events.emit(completed ? 'route:complete' : 'game:over', result);
  const best = Math.max(+store.get('poda-best-score') || 0, result.score);
  store.set('poda-best-score', String(best));
  $('overTitle').textContent = completed ? 'Route complete!' : 'Di poda don jam!';
  $('overEyebrow').textContent = completed ? CONFIG.routes[routeId].name : 'Jammed near ' + stopName(S.stopIdx);
  $('overLine').textContent = `Delivered ${result.passengersDelivered} passenger${result.passengersDelivered === 1 ? '' : 's'} across ${(result.distance / 1000).toFixed(2)} km. ${result.stopsServed} stops served · ${result.stopsMissed} missed.`;
  $('sScore').textContent = result.score.toLocaleString('en-US');
  $('sCash').textContent = fmtLe(result.earnings);
  $('sCoins').textContent = result.coins;
  $('sDist').textContent = (result.distance / 1000).toFixed(2) + ' km';
  $('sPax').textContent = result.passengersDelivered;
  $('sStops').textContent = result.stopsServed;
  $('sMissed').textContent = result.stopsMissed;
  $('sPerfect').textContent = result.perfectStops;
  $('scoreBreakdown').textContent = `Score: ${result.passengersDelivered} delivered × 100 + ${result.stopsServed} stops × 30 + ${result.perfectStops} perfect × 40 + ${Math.floor(result.distance / 20)} distance${completed ? ' + 300 finish' : ''} − ${result.stopsMissed} missed × 25 − ${result.collisions} collisions × 40 (minimum 0).`;
  $('missionSummary').textContent = 'Route goals: ' + missions.status().map(mission => `${mission.label} ${mission.progress}/${mission.target}`).join(' · ');
  const saved = saveLocalScore();
  $('onlineStatus').textContent = saved ? 'Saved on this device. You can change your name and save again.' : 'You can download a picture of this run even when browser storage is unavailable.';
  const finishedSerial = runSerial;
  $('bestOver').textContent = 'Best score: ' + best.toLocaleString('en-US');
  setHint('');
  setTimeout(() => {
    if (runSerial !== finishedSerial || (state !== 'over' && state !== 'complete')) return;
    $('over').hidden = false; $('over').scrollTop=0; $('againBtn').focus({preventScroll:true});
  }, 900);
}
function returnHome() {
  if (!isFinished()) return;
  runSerial++;
  changeState('attract');
  inputManager.release();
  resetRun();
  for(const ch of chunks) fillChunk(ch);
  for(const id of ['over','pause','hud','touch','radio','playerGarage','leaderboard','missionsPanel']) $(id).hidden=true;
  $('radio').inert=false;
  if(workshop)workshop.visible=false;
  world.visible=true; transitionTime=0;
  setHint(''); popsEl.replaceChildren();
  $('title').hidden=false; showBest(); $('startBtn').focus();
}
function isFinished() { return state === 'over' || state === 'complete'; }
function showBest() { const b = +store.get('poda-best-score') || 0; $('bestTitle').textContent = b ? b.toLocaleString('en-US') : '—'; }
function buildPlayer() {
  if (player) {
    scene.remove(player);
    player.traverse(part => { if (part.userData.baked) part.geometry.dispose(); });
  }
  player = vehicleId==='poda' ? makePoda(selectedSlogan, (store.get('poda-board')&&store.get('poda-board')!=='auto'?store.get('poda-board'):DATA.route[0].toUpperCase()+' – '+DATA.route.at(-1).toUpperCase()), SCHEMES[0], true, selectedLivery) : ({kekeh:makeKekeh,taxi:makeCar,okada:makeOkada,waka:makeWakaFine}[vehicleId]()).g;
  if(vehicleId==='poda' && ['salone','tektem'].includes(store.get('poda-sticker'))){
    const style=store.get('poda-sticker'),key='sticker:'+style;
    if(!mats[key]){const tex=canvasTex(256,96,(g,w,h)=>{g.fillStyle='#f8efd9';g.fillRect(0,0,w,h);if(style==='salone'){['#1eb53a','#fff','#0072c6'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*h/3,w,h/3);});}else{g.fillStyle='#254b37';g.font='bold 38px sans-serif';g.fillText('TEK TEM!',20,62);}});mats[key]=new THREE.MeshLambertMaterial({map:tex});}
    const sticker=new THREE.Mesh(G.box,mats[key]);sticker.scale.set(.8,.3,.025);sticker.position.set(-.48,.95,2.745);player.add(sticker);
  }
  apprentice = player.userData.apprentice;
  const parent = apprentice?.parent;
  if (apprentice) parent.remove(apprentice);
  bake(player, true);
  player.traverse(m=>{if(m.isMesh&&m.userData.baked){
    const old=m.material,key='hero:'+old.uuid;
    if(!mats[key])mats[key]=new THREE.MeshStandardMaterial({map:old.map,color:old.color,vertexColors:old.vertexColors,roughness:.78,metalness:.12});
    m.material=mats[key];m.receiveShadow=true;
  }});
  if (apprentice) parent.add(apprentice);
  scene.add(player);
  if(contactShadow)contactShadow.scale.set(CONFIG.vehicles[vehicleId].width/2.1,CONFIG.vehicles[vehicleId].length/5.4,1);
}
function poseGarageCamera() {
  player.position.set(0, 0, 0);
  player.rotation.set(0, 0.25, 0);
  if (contactShadow) contactShadow.position.x = 0;
  const angle = {paint:[6,3.4,-8],slogan:[4.8,3.0,9],horn:[4,2.6,-8],body:[6,4,7],upgrades:[5,3,-7]}[garageCategory] || [6,3.4,-8];
  const orbit=reduceMotion?0:Math.sin(performance.now()*.0003)*1.2;
  const scale=vehicleId==='waka'?1.4:vehicleId==='okada'?.8:1;
  camera.position.set((angle[0]+orbit)*scale,angle[1]*scale,angle[2]*scale);
  camera.lookAt(camera.aspect < .8 ? 0 : -1.6, camera.aspect < .8 ? -1.35 : 1.45, 0);

}
function openPlayerGarage() {
  if (!player || (state !== 'attract' && !isFinished())) return;
  garageReturnState = state;
  changeState('garage');
  freeTown();
  if (!workshop) { workshop=createWorkshop(kit,streetAssets,bake); scene.add(workshop); }
  workshop.visible=true; world.visible=false;
  $('hud').hidden=true; $('radio').hidden=true;
  garageHidden = obstacles.map(obstacle => obstacle.g);
  for (const group of garageHidden) group.visible = false;
  $('title').hidden = true; $('over').hidden = true;
  $('playerGarage').hidden = false;
  poseGarageCamera();
}
function closePlayerGarage() {
  if (state !== 'garage') return;
  changeState(garageReturnState);
  workshop.visible=false; world.visible=true;
  for (const group of garageHidden) group.visible = true;
  garageHidden = [];
  $('playerGarage').hidden = true;
  if (state === 'attract') $('title').hidden = false;
  else $('over').hidden = false;
}
function showLeaderboard() { $('leaderboard').hidden = false; loadLeaderboard(); }
function readScores(){try{const rows=JSON.parse(store.get('poda-scores-v2')||'[]');return Array.isArray(rows)?rows.filter(r=>Number.isFinite(r.score)&&Number.isFinite(r.date)):[];}catch{return [];}}
function saveLocalScore(){
 if(!lastResult)return;
 const name=$('driverName').value.trim().slice(0,24)||'Salone driver';store.set('poda-driver-name',name);
 const rows=readScores().filter(r=>r.id!==lastResult.id);rows.push({...lastResult,name});rows.sort((a,b)=>b.score-a.score);const saved=store.set('poda-scores-v2',JSON.stringify(rows.slice(0,100)));
 $('shareStatus').textContent=saved?'Score saved on this device.':'Browser storage is unavailable. You can still download your poster.';
 return saved;
}
$('driverName').value=store.get('poda-driver-name')||'';
$('saveScore').addEventListener('click',saveLocalScore);
$('copyLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(gameURL);$('shareStatus').textContent='Game link copied.';}catch{$('shareStatus').textContent=gameURL;}});
$('shareScore').addEventListener('click',()=>exportPoster(true));
$('downloadPoster').addEventListener('click',()=>exportPoster(false));
async function exportPoster(allowNativeShare){
 if(!lastResult)return;saveLocalScore();$('shareScore').disabled=true;$('shareStatus').textContent='Creating your 4K poster…';
 try{
 const blob=await createScorePoster({THREE,renderer,player:resultModel,name:$('driverName').value,score:lastResult.score,vehicle:resultVehicle,route:resultRoute,url:gameURL});
 const file=new File([blob],'poda-poda-score.png',{type:'image/png'});
 if(allowNativeShare && navigator.canShare?.({files:[file]})){$('shareScore').disabled=false;$('shareStatus').textContent='Choose an app in the share dialog, or use Download PNG.';try{await navigator.share({files:[file],title:'Poda-Poda Run',text:`I scored ${lastResult.score.toLocaleString('en-US')} in Poda-Poda Run. Think you can beat me? Play: ${gameURL}`});$('shareStatus').textContent='Poster shared.';return;}catch(error){if(error.name==='AbortError'){$('shareStatus').textContent='Sharing cancelled. Your score is saved.';return;}}}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);$('shareStatus').textContent='4K PNG downloaded. Share it with your crew!';
 }catch(error){$('shareStatus').textContent='Could not create the poster. Please try again.';console.error(error);}finally{$('shareScore').disabled=false;}
}
async function loadLeaderboard() {
 const period=$('leaderPeriod').value,now=new Date(),start=new Date(now);start.setHours(0,0,0,0);if(period==='week')start.setDate(start.getDate()-(start.getDay()+6)%7);
 const entries=readScores().filter(r=>period==='all'||r.date>=start.getTime()).sort((a,b)=>b.score-a.score);
 $('leaderEntries').replaceChildren();$('leaderMessage').textContent='This device · '+(entries.length?'Best driving scores':'No saved scores yet.');
 for(const entry of entries){const li=document.createElement('li');li.textContent=`${entry.name} — ${entry.score.toLocaleString('en-US')} · ${CONFIG.routes[entry.route]?.name||'Run'} · ${CONFIG.vehicles[entry.vehicle]?.name||'Poda'}`;$('leaderEntries').append(li);}
}

/* ---------- Autopilot (title-screen attract mode and #demo) ---------- */
function autopilot() {
  const look = 14 + S.speed * 1.2;
  const blocked = (l, far, near = 6) => obstacles.some(o => Math.abs(o.x - LANES[l]) < (o.wid + 2.2) / 2 && o.z > -far && o.z < near);
  let want = S.lane, brake = false;
  const s = stopObj && !stopObj.served && !stopObj.missed ? stopObj : null;
  if (s && s.z > -110 && s.z < 6) {
    want = 2;
    const need = S.speed * S.speed / (2 * 24) + 0.5;
    if (-s.z <= need || Math.abs(s.z) < 7) brake = S.lane === 2;
  } else if (blocked(S.lane, look)) {
    const opts = [S.lane - 1, S.lane + 1].filter(l => l >= 0 && l <= 2 && !blocked(l, look, 7));
    if (opts.length) want = opts.sort((a, b) => coinsIn(b) - coinsIn(a))[0];
  } else if (Math.random() < 0.01) {
    const l = clamp(S.lane + (Math.random() < 0.5 ? -1 : 1), 0, 2);
    if (!blocked(l, look + 10, 7)) want = l;
  }
  if (want !== S.lane && S.dwell <= 0) {
    const step = S.lane + Math.sign(want - S.lane);
    if (!blocked(step, 10, 7) || blocked(S.lane, 12)) S.lane = step;
  }
  if (blocked(S.lane, 22) && !(s && Math.abs(s.z) < 10)) brake = true;
  input.brake = brake;
  if (obstacles.some(o => o.cross && !o.flee && o.z > -30 && o.z < -8 && Math.abs(o.x - S.x) < 3)) horn();
}
function coinsIn(l) { return coins.filter(c => Math.abs(c.x - LANES[l]) < 1 && c.z > -40 && c.z < 0).length; }

/* ================================================================
   Main loop
   ================================================================ */
function adapt(raw) {
  if (!navigator.webdriver) qualityManager.sample(raw);
}
function loop(now) {
  const { raw, dt } = clock.tick(now);
  adapt(raw);
  if (state === 'attract') {
    player.position.set(0,0,0); player.rotation.set(0,0,0); player.visible=true;
    const a=reduceMotion ? .57 : .57 + Math.sin(now*.00012)*.1;
    const distance=CONFIG.vehicles[vehicleId].camera.distance;
    camera.position.set(Math.sin(a)*distance,CONFIG.vehicles[vehicleId].camera.height,Math.cos(a)*distance);
    camera.lookAt(camera.aspect<.8 ? 0 : 3.4, camera.aspect<.8 ? .0 : 1.55, 0);
    sun.position.set(-28,32,20);sun.target.position.set(0,0,-12);
    if(contactShadow)contactShadow.position.x=0;
    for(const o of obstacles){if(!o.flat&&!o.static){o.z-=(o.speed||0)*dt;if(o.z < -220)o.z=20;o.g.position.z=o.z;}}

  }
  if (state === 'play' && !benchmark) {
    if(transitionTime>0){
      transitionTime=Math.max(0,transitionTime-dt);
      const t=1-transitionTime/1.3, smooth=t*t*(3-2*t);
      const vc=S.vehicle.camera;
      camera.position.set(S.x+2,vc.height,vc.distance);camera.lookAt(S.x,1.5,-16);
      const targetQ=camera.quaternion.clone();
      camera.position.lerpVectors(transitionPose.position,new THREE.Vector3(S.x+2,vc.height,vc.distance),smooth);
      camera.quaternion.copy(transitionPose.quaternion).slerp(targetQ,smooth);
      player.position.x=S.x;
    }else update(dt);
  }
  if(state==='garage') poseGarageCamera();
  musicTick(dt);
  engineTick();
  for(const ch of chunks){
    ch.visible=ch.position.z > -qualityManager.budget.distance;
    const nearby=ch.position.z > -qualityManager.budget.shadowDistance;
    for(const mesh of ch.userData.content.children)if(mesh.isMesh)mesh.castShadow=nearby;
  }
  renderer.render(scene, camera);
  sampleMetrics(raw);
  if (hud3d && (state === 'play' || demo)) {
    try { hud3d.render(renderer); }
    catch (err) { console.error('Three.js HUD render failed; using DOM instruments', err); hud3d = null; document.body.classList.remove('hud-three'); }
  }
  requestAnimationFrame(loop);
}

function update(dt) {
  const auto = state === 'attract' || demo;
  if (auto && !isFinished()) autopilot();
  if (state === 'attract') S.hitAt = -99;

  const { distance: d, gas, dwellFinished } = window.PODA_PlayerSystem.stepPlayer(S, input, dt, state, LANES);
  if (dwellFinished) finishDwell();

  if(window.PODA_JumpSystem.step(S,dt)){S.bump=.22;S.shake=reduceMotion?0:.15;sfx('thud');events.emit('jump:land',{});}
  S.bump=Math.max(0,S.bump-dt);
  // player
  player.position.x = S.x;
  player.rotation.y = -(LANES[S.lane] - S.x) * 0.07;
  player.rotation.z = (LANES[S.lane] - S.x) * 0.025 + (S.speed > 1 ? Math.sin(S.time * 18) * 0.004 : 0);
  player.position.y = (S.jumpY||0) + Math.sin(S.bump*35)*S.bump*.22 + (S.speed > 1 ? Math.abs(Math.sin(S.time * 9)) * 0.03 : 0);
  player.visible = !(S.invuln > 0 && Math.floor(S.time * 14) % 2 === 0);
  if (apprentice) {
    const u=apprentice.userData;
    u.armR.rotation.x = -.5; // inside hand stays on the door frame
    u.armL.rotation.x = S.dwell > 0 ? Math.sin(S.time*7)*.55 : input.brake ? -.7 : Math.sin(S.time*3)*.12;
    apprentice.rotation.z = S.shake > .1 ? -.12 : input.brake ? .08 : 0;
  }

  // scrolling surfaces
  roadTex.offset.y += d / 20; roadDetailTex.offset.y += d / 20; walkTex.offset.y += d / 4;
  if (contactShadow) {contactShadow.position.x = S.x;contactShadow.material.opacity=.6/(1+(S.jumpY||0));}

  // scenery chunks
  for (const ch of chunks) {
    ch.position.z += d;
    if (ch.position.z - CH > 22) { ch.position.z -= NCH * CH; fillChunk(ch); }
  }

  // bus stops
  if (!stopObj && !isFinished() && S.toStop <= 205) spawnStop();
  if (stopObj) {
    const s = stopObj; s.z += d; s.g.position.z = s.z;
    if (!s.served && !s.missed && !isFinished()) {
      const inZone = RULES.canServeStop({ distanceFromCentre: s.z, lane: S.lane, laneX: LANES[2], playerX: S.x, speed: S.speed });
      if (inZone && !S.jumpY) beginDwell();
      else if (s.z > 9) missStop();
    }
    for (const w of s.walkers) {
      if ((w.delay -= dt) > 0) continue;
      const to = w.to, p = w.p.position, dx = to.x - p.x, dz = to.z - p.z, len = Math.hypot(dx, dz);
      if (len < 0.15) { if (w.vanish) w.p.visible = false; continue; }
      const st = Math.min(len, 3.2 * dt); p.x += dx / len * st; p.z += dz / len * st; w.p.rotation.y = Math.atan2(dx, dz);
      if (PLUG.people && PLUG.people.walk) PLUG.people.walk(w.p, S.time * 1.6);
    }
    if (s.z > 45) { drop(s.g); stopObj = null; }
  }

  // hints
  if (state === 'play' && !demo) {
    const s = stopObj && !stopObj.served && !stopObj.missed ? stopObj : null;
    if (S.dwell > 0) setHint('Loading passengers…');
    else if (s && s.z > -110 && s.z < 8) {
      const metres = Math.max(0, Math.round(-s.z));
      setHint(S.lane !== 2 ? `STOP IN ${metres} m · KEEP RIGHT <kbd>→</kbd>` :
        metres > 25 ? `STOP IN ${metres} m · SLOW DOWN <kbd>↓</kbd>` : 'BRAKE IN THE YELLOW BOX <kbd>↓</kbd>');
    }
    else setHint('');
  }

  // spawn
  S.nextRow -= d;
  if (S.nextRow <= 0) {
    spawnRow(-200);
    const prog = clamp(S.dist / 5000, 0, 1);
    S.nextRow = rand(30, 42) - 12 * prog;
  }

  // obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    window.PODA_TrafficAI.step(o,obstacles,S,dt,LANES);
    const despawn = window.PODA_TrafficSystem.stepTraffic(o, d, dt, LANES);
    if (o.cross) {
      if (o.body) o.body.position.y = Math.abs(Math.sin(S.time * 10)) * 0.06;
      o.g.rotation.y = heading(o);
      if (o.person && PLUG.people && PLUG.people.walk) PLUG.people.walk(o.g, S.time * (o.flee ? 2.2 : 1));
    }
    o.g.position.set(o.x, 0, o.z);
    if (despawn) { releaseObstacle(o); obstacles.splice(i, 1); continue; }
    if (!isFinished() && window.PODA_CollisionSystem.overlapsPlayer(S, o)) {
      if (state === 'attract' && !demo) { /* attract mode never crashes */ drop(o.g); obstacles.splice(i, 1); continue; }
      hit(o);
    }
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const b = debris[i]; b.t += dt;
    b.g.position.z += d; b.g.position.x += b.vx * dt;
    if (!b.flat) { b.vy -= 18 * dt; b.g.position.y = Math.max(0, b.g.position.y + b.vy * dt); b.g.rotation.z += b.spin * dt; }
    if (b.t > 2.5 || b.g.position.z > 30) { drop(b.g); debris.splice(i, 1); }
  }

  // coins & boosts
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.z += d;
    if (S.magnet > 0 && c.z > -25 && c.z < 2) { c.x += (S.x - c.x) * Math.min(1, dt * 6); c.z += (0 - c.z) * Math.min(1, dt * 4); }
    _cq.setFromEuler(_ce.set(Math.PI / 2, 0, S.time * 3));
    coinIM.setMatrixAt(c.slot, _cm.compose(_cp.set(c.x, 1.1, c.z), _cq, _cs));
    if (Math.abs(c.z) < 2.6 && Math.abs(c.x - S.x) < 1.5 && !isFinished()) {
      coinFree(c); coins.splice(i, 1);
      if (state === 'play' || demo) { S.coins += 1; sfx('coin'); }
      continue;
    }
    if (c.z > 20) { coinFree(c); coins.splice(i, 1); }
  }
  coinIM.instanceMatrix.needsUpdate = true;
  for (let i = boosts.length - 1; i >= 0; i--) {
    const b = boosts[i];
    b.z += d; b.m.position.set(b.x, 1.2 + Math.sin(S.time * 4) * 0.15, b.z); b.m.rotation.y += dt * 2;
    if (Math.abs(b.z) < 2.6 && Math.abs(b.x - S.x) < 1.5 && !isFinished()) {
      world.remove(b.m); boosts.splice(i, 1);
      S.magnet = 9; pop('Ginger beer! Coin magnet'); sfx('boost');
      continue;
    }
    if (b.z > 20) { world.remove(b.m); boosts.splice(i, 1); }
  }

  if (state === 'play' && S.time - S.hitAt > 4 && S.time - S.hitAt < 4.1) renderBody();

  // camera
  cameraSystem.update(S, dt, gas, baseFov);

  if (state === 'play' || demo) updateHud();
}

function setupBenchmark() {
  changeState('play');
  for(const o of obstacles)releaseObstacle(o);obstacles=[];
  for(const c of coins)coinFree(c);coins=[];
  coinIM.instanceMatrix.needsUpdate=true;
  S.x=0;S.lane=1;S.speed=13.3;S.toStop=420;S.legLen=600;
  player.position.set(0,0,0);player.rotation.set(0,0,0);
  contactShadow.position.x=0;
  const fixtures=[[makeWakaFine,-3.4,-23],[makeKekeh,3.4,-18],[makeKekeh,-3.4,-45],[makeCar,0,-38],[()=>freight.make({type:'flatbed'}),3.4,-57]];
  for(const [factory,x,z] of fixtures){const o=pooled('benchmark'+x+z,factory);o.g.position.set(x,0,z);world.add(o.g);obstacles.push(o);}
  for(let i=0;i<5;i++){const o=pooled('pothole'+i,()=>streetAssets.pothole(i));o.g.position.set(i%2?-2.2:2.3,0,-9-i*10);world.add(o.g);obstacles.push(o);}
  camera.position.set(2,4.5,13.5);camera.lookAt(0,1.5,-16);cameraSystem.lookX=0;
  sun.position.set(-28,32,20);sun.target.position.set(0,0,-12);
  $('title').hidden=true;$('hud').hidden=false;$('touch').hidden=false;$('radio').hidden=false;
  updateHud();
}
let metricSeconds=0,metricFrames=0;
function sampleMetrics(raw) {
  metricSeconds+=raw;metricFrames++;
  if(metricSeconds>=1){
    const m={fps:Math.round(metricFrames/metricSeconds),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,ratio:qualityManager.ratio};
    PLUG.debug.metrics=m;
    if(params.has('stats')){let el=$('renderStats');if(!el){el=document.createElement('output');el.id='renderStats';document.body.appendChild(el);}el.textContent=`${m.fps} FPS · ${m.calls} draws · ${Math.round(m.triangles/1000)}k triangles · DPR ${m.ratio.toFixed(2)}`;}
    metricSeconds=metricFrames=0;
  }
}

/* Dev view: ?garage lines up every vehicle model (add &rear for the back view) */
function garage() {
  $('title').hidden = true;
  resetRun();
  for (const o of obstacles) world.remove(o.g);
  obstacles = [];
  const rear = params.has('rear');
  const items = [makePoda(DATA.slogans[0], 'LUMLEY – PZ', SCHEMES[0], true), makeTrafficPoda().g, makeWakaFine().g, makeCar().g, makeKekeh().g, makeOkada().g, makeGoat().g, makeHawker().g];
  items.forEach((g, i) => { g.position.set(-15 + i * 4.4, 0, -14 - (i % 2) * 3); g.rotation.y = rear ? Math.PI + 0.7 : 0.7; scene.add(g); });
  resize();
  camera.position.set(0, 7, 9); camera.lookAt(0, 1, -15);
  if (params.has('focus')) {           // ?garage&focus=N: close-up on vehicle N
    const g = items[+params.get('focus')] || items[0];
    for (const o of items) o.visible = o === g;
    g.position.set(0, 0, -12);
    camera.position.set(4.2, 3, -5.5); camera.lookAt(0, 1.3, -12);
    if (params.has('side')) { g.rotation.y = 0; camera.position.set(7.5, 2.4, -10); camera.lookAt(0, 1.4, -12); }
  }
  sun.position.set(-20, 40, 20); sun.target.position.set(0, 0, -15);
  (function spin() { renderer.render(scene, camera); requestAnimationFrame(spin); })();
}

/* ---------- Title backdrop: slow aerial orbit over the downtown Freetown diorama ----------
   Decoded from town-model.js (gzipped int16 positions + per-triangle palette), one draw call.
   Freed as soon as a run starts, so it costs nothing during play. */
const town = { scene: null, cam: new THREE.PerspectiveCamera(42, 1, 1, 900), mesh: null };
async function loadTown() {
  if (!window.PODA_TOWN || !window.DecompressionStream || demo || params.has('district') || params.has('garage')) return;
  const b64 = window.PODA_TOWN, bin = new Uint8Array(b64.length * 3 / 4 | 0);
  const raw = atob(b64); for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
  window.PODA_TOWN = null;
  const buf = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const hl = new DataView(buf).getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  let off = 4 + hl; off += (4 - off % 4) % 4;
  const n = head.tris * 9, q = new Int16Array(buf, off, n), fc = new Uint8Array(buf, off + n * 2, head.tris);
  const pos = new Float32Array(n), col = new Float32Array(n);
  for (let i = 0; i < n; i++) pos[i] = (q[i] + 32767) * head.scale + head.lo[i % 3];
  for (let t = 0; t < head.tris; t++) { const c = head.palette[fc[t]]; for (let k = 0; k < 9; k += 3) col.set(c, t * 9 + k); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();                                   // flat, low-poly shading
  for (const k of ['position', 'color', 'normal']) geo.attributes[k].onUpload(function () { this.array = null; }); // drop CPU copies once on the GPU
  if (state !== 'attract') { geo.dispose(); return; }
  const sc = new THREE.Scene();
  sc.background = scene.background;
  sc.fog = new THREE.Fog(0xcfe3e8, 260, 520);
  sc.add(new THREE.HemisphereLight(0xf2f8ff, 0x8a5a3a, 0.85));
  const dl = new THREE.DirectionalLight(0xfff0d2, 0.75); dl.position.set(-60, 120, 70); sc.add(dl);
  town.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  town.mesh.matrixAutoUpdate = false; sc.add(town.mesh);
  town.scene = sc;
  resize();
}
function freeTown() {
  if (!town.mesh) return;
  town.mesh.geometry.dispose(); town.mesh.material.dispose();
  town.scene = town.mesh = null;
}
function renderTown(t) {
  const a = t * 0.00006 + 0.6, r = 135;
  town.cam.position.set(Math.sin(a) * r, 52 + Math.sin(t * 0.0002) * 8, Math.cos(a) * r);
  town.cam.lookAt(0, 4, 0);
  renderer.render(town.scene, town.cam);
}

let baseFov = 58;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  baseFov = w / h < 0.8 ? 68 : 58;
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  town.cam.aspect = w / h; town.cam.fov = w / h < 0.8 ? 62 : 42; town.cam.updateProjectionMatrix();
  if (hud3d) hud3d.resize(w, h);
}
addEventListener('resize', resize);

/* ================================================================
   Boot
   ================================================================ */
const fontsReady = document.fonts && document.fonts.load
  ? Promise.race([Promise.all([document.fonts.load('48px Bungee'), document.fonts.load('800 28px Outfit')]), new Promise(r => setTimeout(r, 2500))])
  : Promise.resolve();
fontsReady.catch(() => {}).then(() => {
  buildTextures();
  Object.assign(kit, {
    THREE, G, M, add, rand, randi, pick, clamp, canvasTex, fitText, makePerson, getSloganTex,
    addHouse, addTree, addVendor, defaultFill, shopTex, DATA, SCHEMES,
    CH, LANE_W, LANES, ROAD_HALF, hy, HOUSE, ROOF, CLOTH, SKIN, PANTS,
  });
  roles = createRoleDecorator(kit);
  streetAssets = createStreetAssets(kit);
  kit.streetAssets = streetAssets;
  registerEasternDistricts(PLUG);
  freight = createFreightFactory(kit, streetAssets);
  lumleyDetails = createLumleyDetails(kit, streetAssets, createBuildingFactory(kit, streetAssets));
  PLUG.kit = kit; PLUG.debug = { renderer, scene };
  initCoins();
  buildStatic();
  if (params.has('garage')) return garage();
  for (const [id, label] of LIVERIES) $('garageLivery').add(new Option(label, id));
  for (const slogan of DATA.slogans) $('garageSlogan').add(new Option(slogan, slogan));
  $('garageLivery').value = selectedLivery;
  $('garageSlogan').value = selectedSlogan;
  buildPlayer();
  const shadowTex = canvasTex(128, 128, (g, w, h) => {
    const halo = g.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w / 2);
    halo.addColorStop(0, 'rgba(0,0,0,.7)'); halo.addColorStop(.58, 'rgba(0,0,0,.28)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
  });
  contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 7.3), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: .6 }));
  contactShadow.rotation.x = -Math.PI / 2; contactShadow.position.set(LANES[2], .018, 0); scene.add(contactShadow);
  resetRun();
  camera.position.set(S.x + 2, 4.5, 13.5);
  cameraSystem.lookX = S.x;
  camera.lookAt(S.x, 1.5, -16);
  showBest();
  const savedQuality = store.get('poda-quality') || 'auto';
  $('qualityProfile').value = savedQuality;
  qualityManager.setProfile(savedQuality);
  resize();
  if (demo && !benchmark) startRun();
  // The actual player vehicle is the title showcase; no separate town scene is allocated.
  if (benchmark) setupBenchmark();
  requestAnimationFrame(t => { clock.reset(); loop(t); });
});
})();
