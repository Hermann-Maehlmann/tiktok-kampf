import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Fighter, makeSpec } from './fighter.js';
import { loadHeadAssets } from './head.js';
await loadHeadAssets();
import { buildWorld, updateWorld } from './world.js';
import { warp, speed, roots, pose, HITS, PUNCHES, ss, clamp, lerp, DURATION, actionTime, REPLAY, ENDCARD, VO_SLOTS, COLD, COLD_HIT, coldAction } from './choreo.js';
const FIGHT = await (await fetch(new URLSearchParams(location.search).get('fight') || '/fights/v3.json')).json();
const SPECIES = { erectus: makeSpec(FIGHT.red.look, 'red'), sapiens: makeSpec(FIGHT.blue.look, 'blue') };
const COLS = { red: '#ff3b2f', blue: '#3d7bff', white: '#ffffff', gold: '#ffd34d' };

await document.fonts.ready; await Promise.all(['IDB', 'IDK', 'IB'].map(f => document.fonts.load(`40px ${f}`)));
const W = 1080, H = 1920;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function hsh(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
const n1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hsh(i), hsh(i + 1), u) * 2 - 1; };
const imp = (t, t0, tau) => { const x = (t - t0) / tau; return x <= 0 ? 0 : x * Math.exp(1 - x); };

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const glCanvas = renderer.domElement;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, .05, 200);
const world = buildWorld(scene, { mat: FIGHT.ring?.mat, apron: FIGHT.ring?.apron || `${FIGHT.red.name.replace(/^THE /, '')}  vs  ${FIGHT.blue.name.replace(/^THE /, '')}` });

const E = new Fighter(SPECIES.erectus), S = new Fighter(SPECIES.sapiens);
scene.add(E.group, S.group);

// ---------- particles ----------
const dropG = new THREE.SphereGeometry(1, 10, 8);
const sweatMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe8ff, roughness: .05, clearcoat: 1, emissive: 0x6d7690, emissiveIntensity: .25, transparent: true, opacity: .85 });
const bloodMat = new THREE.MeshPhysicalMaterial({ color: 0x6a0006, roughness: .12, clearcoat: 1, emissive: 0x200000 });
const MAXP = 900;
const sweat = new THREE.InstancedMesh(dropG, sweatMat, MAXP), blood = new THREE.InstancedMesh(dropG, bloodMat, MAXP);
sweat.frustumCulled = blood.frustumCulled = false; scene.add(sweat, blood);
const SPECS = { E: SPECIES.erectus, S: SPECIES.sapiens };
function headH(sp) { return sp.thigh + sp.shin + .135 - .09 + sp.spine + .2 + sp.neck + .1 - .02; }
// precompute emitters
const emitters = [];
for (const h of HITS) {
  const R = roots(h.th), vic = R[h.victim];
  const dirX = h.victim === 'S' ? 1 : -1;
  const isHead = h.lands === 'head';
  const pos = V(vic.x - dirX * .06, isHead ? headH(SPECS[h.victim]) : headH(SPECS[h.victim]) - .5, vic.z);
  let d = V(dirX, .25, 0);
  if (h.kind === 'hook') d = V(dirX * .6, .2, h.hand === 'L' ? .8 : -.8);
  if (h.kind === 'overhand') d = V(dirX * .9, -.1, .5);
  if (h.kind === 'uppercut') d = V(dirX * .5, 1, .15);
  emitters.push({ t: h.th, pos, dir: d.normalize(), nS: Math.round(60 + 140 * h.str), nB: Math.round(h.blood ? 50 * h.blood : (h.str > .7 ? 6 : 0)), str: h.str, seed: h.th * 13 });
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = V(), _s = V();
function updateParticles(a) {
  let iS = 0, iB = 0;
  for (const e of emitters) {
    const dt = a - e.t; if (dt < 0 || dt > 4) continue;
    const N = e.nS + e.nB;
    for (let k = 0; k < N; k++) {
      const isB = k >= e.nS, sd = e.seed + k * 7.31;
      const delay = hsh(sd + 9) * .05; const t = dt - delay; if (t < 0) continue;
      const sp = (isB ? 1.4 + hsh(sd) * 2.8 : 1.5 + hsh(sd) * 4.5) * (.6 + e.str * .4);
      const r1 = V(hsh(sd + 1) - .5, hsh(sd + 2) - .5, hsh(sd + 3) - .5).multiplyScalar(isB ? 1.1 : 1.6);
      const v = e.dir.clone().add(r1).normalize().multiplyScalar(sp);
      let x = e.pos.x + v.x * t, y = e.pos.y + v.y * t - 4.9 * t * t, z = e.pos.z + v.z * t;
      let size = isB ? .005 + hsh(sd + 4) * .009 : .002 + hsh(sd + 4) * .004;
      let landed = false;
      if (y < .003) { y = .002; landed = true; }
      if (!isB && landed) continue;
      _p.set(x, y, z);
      const vy = v.y - 9.8 * t;
      if (landed) { _q.identity(); _s.set(size * 2.2, size * .15, size * 2.2); }
      else { const vel = V(v.x, vy, v.z); _q.setFromUnitVectors(V(0, 0, 1), vel.clone().normalize()); _s.set(size, size, size * (1 + Math.min(3, vel.length() * .35))); }
      _m.compose(_p, _q, _s);
      if (isB) { if (iB < MAXP) blood.setMatrixAt(iB++, _m); } else if (iS < MAXP) sweat.setMatrixAt(iS++, _m);
    }
  }
  sweat.count = iS; blood.count = iB; sweat.instanceMatrix.needsUpdate = true; blood.instanceMatrix.needsUpdate = true;
}
// flying mouthguard (S, on the overhand)
const MG_T = 12.85;
const flyGuard = new THREE.Mesh(new THREE.TorusGeometry(.03, .012, 8, 20, Math.PI * 1.2), new THREE.MeshPhysicalMaterial({ color: 0x1546c8, roughness: .15, clearcoat: 1, emissive: 0x0a1a50 }));
flyGuard.castShadow = true; scene.add(flyGuard);
function updateGuard(a) {
  const t = a - MG_T; flyGuard.visible = t > 0; S.mouthguard.visible = t <= 0;
  if (t <= 0) return;
  const R = roots(MG_T); const p0 = V(R.S.x + .05, headH(SPECS.S) - .07, R.S.z);
  const v = V(2.2, 2.6, 1.3);
  let y = p0.y + v.y * t - 4.9 * t * t; let x = p0.x + v.x * t, z = p0.z + v.z * t;
  const tl = (v.y + Math.sqrt(v.y * v.y + 2 * 9.8 * (p0.y - .02))) / 9.8;
  if (t > tl) { x = p0.x + v.x * tl + (t - tl) * .3 * Math.exp(-(t - tl) * 3); z = p0.z + v.z * tl; y = .02; flyGuard.rotation.set(Math.PI / 2, 0, tl * 3); }
  else flyGuard.rotation.set(t * 14, t * 9, t * 5);
  flyGuard.position.set(Math.min(x, 2.9), y, Math.min(z, 2.9));
}
// impact flash sprite
const flashTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.12, 'rgba(255,245,220,.8)'); r.addColorStop(.4, 'rgba(255,200,140,.15)'); r.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; g.lineWidth = 3; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 128 * (.5 + (i % 3) * .2), 128 + Math.sin(a) * 128 * (.5 + (i % 3) * .2)); g.stroke(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const flashSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
scene.add(flashSpr);
// dust puff when E lands
const dustTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(220,215,205,.5)'); r.addColorStop(1, 'rgba(220,215,205,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const dust = []; for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false })); scene.add(s); dust.push(s); }
const LAND = 20.3;
function updateDust(a, eX) {
  const t = a - LAND;
  dust.forEach((s, i) => {
    if (t < 0 || t > 3) { s.visible = false; return; } s.visible = true;
    const ang = i / dust.length * 6.28 + hsh(i) * .4, r = (.3 + (1 - Math.exp(-t * 3)) * (.8 + hsh(i + 3) * .8));
    s.position.set(eX - .9 + Math.cos(ang) * r * 1.2, .05 + t * .12 * hsh(i + 5), Math.sin(ang) * r * .7);
    const sc = .3 + t * .5; s.scale.set(sc, sc * .6, 1); s.material.opacity = .55 * Math.exp(-t * 1.1) * ss(0, .05, t);
  });
}

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .35, .5, .92); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAb: { value: .0 }, uFlash: { value: 0 }, uSat: { value: 1 }, uRed: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uAb,uFlash,uSat,uRed; varying vec2 vUv;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){ vec2 c=vUv-.5; float d=length(c*vec2(.75,1.));
    vec2 o=c*(.004+uAb*.03);
    vec3 col=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
    float l=dot(col,vec3(.299,.587,.114));
    col=mix(vec3(l),col,uSat);
    col=pow(col,vec3(1.06));                              // contrast
    col*=vec3(1.03,1.0,.97);
    col=mix(col,col*vec3(1.25,.6,.55),uRed);
    col*=1.-smoothstep(.35,.95,d)*.75;                    // vignette
    col+=(h(vUv*vec2(1080.,1920.)+fract(uTime*7.13))-.5)*.05; // grain
    col=mix(col,vec3(1.),uFlash);
    gl_FragColor=vec4(col,1.); }`
});
composer.addPass(grade);

// ---------- overlay (2D) ----------
const out = document.createElement('canvas'); out.width = W; out.height = H;
const g = out.getContext('2d');

function slam(t, t0) { const x = clamp((t - t0) / .18); return 1 + (1 - x) * (1 - x) * 1.4; }
function txt(s, x, y, size, font, col, opts = {}) {
  g.save(); g.translate(x, y); if (opts.rot) g.rotate(opts.rot); if (opts.sc) g.scale(opts.sc, opts.sc);
  g.font = `${size}px ${font}`; g.textAlign = opts.align || 'center'; g.textBaseline = 'middle';
  if (opts.maxW) { const w = g.measureText(s).width; if (w > opts.maxW) g.scale(opts.maxW / w, opts.maxW / w); }
  g.globalAlpha = opts.a ?? 1;
  if (opts.shadow !== false) { g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 30; g.shadowOffsetY = 6; }
  if (opts.stroke) { g.lineWidth = opts.stroke; g.strokeStyle = opts.strokeCol || '#000'; g.lineJoin = 'round'; g.strokeText(s, 0, 0); }
  g.fillStyle = col; g.fillText(s, 0, 0); g.restore();
}
function overlay(v) {
  // title
  if (v > .6 && v < 4.8) {
    const a = 1 - ss(4.4, 4.8, v);
    txt(FIGHT.red.name, W / 2, 520, 118, 'IDB', '#ff3b2f', { sc: slam(v, .7), a: a * ss(.7, .75, v), stroke: 10, maxW: 980 });
    txt('VS', W / 2, 650, 92, 'IDB', '#ffffff', { sc: slam(v, 1.25), a: a * ss(1.25, 1.3, v), stroke: 8 });
    txt(FIGHT.blue.name, W / 2, 780, 118, 'IDB', '#3d7bff', { sc: slam(v, 1.8), a: a * ss(1.8, 1.85, v), stroke: 10, maxW: 980 });
    txt(FIGHT.title?.sub || 'WORLD TITLE · 12 ROUNDS', W / 2, 890, 40, 'IB', '#e9e2d0', { a: a * ss(2.2, 2.5, v), shadow: true, maxW: 960 });
  }
  const card = (t0, t1, name, col, l1, l2) => {
    if (v < t0 || v > t1) return;
    const k = ss(t0, t0 + .25, v) * (1 - ss(t1 - .25, t1, v));
    const x = lerp(-600, 70, Math.pow(k, .5));
    g.save(); g.globalAlpha = k;
    g.fillStyle = col; g.fillRect(x - 70, 1280, 20, 290);
    txt(name, x, 1330, 104, 'IDB', '#fff', { align: 'left', stroke: 8, maxW: 920 });
    txt(l1, x + 6, 1440, 44, 'IB', '#f2e9d8', { align: 'left', maxW: 920 });
    txt(l2, x + 6, 1505, 44, 'IB', '#f2e9d8', { align: 'left', maxW: 920 });
    g.restore();
  };
  card(6.0, 14.8, FIGHT.red.name, '#ff3b2f', FIGHT.red.stats[0], FIGHT.red.stats[1]);
  card(16.3, 23.2, FIGHT.blue.name, '#3d7bff', FIGHT.blue.stats[0], FIGHT.blue.stats[1]);
  if (v > 23.4 && v < 25.0) { const a = 1 - ss(24.7, 25.0, v); txt('ROUND 1', W / 2, 560, 170, 'IDB', '#ffffff', { sc: slam(v, 23.45), a: a * ss(23.45, 23.5, v), stroke: 12 }); }
  // count (synced to the announcer)
  const CT = [45.7, 46.35, 47.0];
  if (v > 45.6 && v < 48.1) {
    const nums = ['8', '9', '10']; let i = -1; CT.forEach((t, j) => { if (v >= t) i = j; });
    if (i >= 0 && v < 47.5) txt(nums[i], W / 2, 520, 260, 'IDB', '#ffffff', { sc: slam(v, CT[i]), stroke: 14 });
    if (v > 47.5) { const sh = imp(v, 47.5, .08) * 30; txt('K.O.!', W / 2 + n1(v * 40) * sh, 560 + n1(v * 40 + 5) * sh, 300, 'IDB', '#ff3b2f', { sc: slam(v, 47.5), stroke: 16, a: 1 - ss(47.85, 48.05, v) }); }
  }
  if (v > 48.3) {
    const fo = 1 - ss(50.6, 51.0, v);
    txt('WINNER', W / 2, 330, 120, 'IDB', '#ffd34d', { sc: slam(v, 48.3), a: ss(48.3, 48.35, v) * fo, stroke: 10 });
    txt(FIGHT.blue.name, W / 2, 460, 124, 'IDB', '#ffffff', { sc: slam(v, 49.15), a: ss(49.15, 49.2, v) * fo, stroke: 10, maxW: 980 });
  }
  if (v > 51.2 && v < REPLAY.v0) {
    const fo = 1 - ss(REPLAY.v0 - .5, REPLAY.v0 - .1, v), O = FIGHT.outro || [];
    const T = [[300, 84, 51.3, 1], [395, 72, 52.6, 0], [540, 84, 54.5, 1], [635, 72, 55.0, 0]];
    O.slice(0, 4).forEach(([s, c], i) => { const [y, size, t0, big] = T[i]; txt(s, W / 2, y, size, 'IDB', COLS[c] || c, { sc: big ? slam(v, t0) : 1, a: (big ? ss(t0, t0 + .05, v) : ss(t0, t0 + .3, v)) * fo, stroke: 8, maxW: 980 }); });
  }
  // replay badge
  if (v >= REPLAY.v0 && v < REPLAY.v1) {
    const a = ss(REPLAY.v0, REPLAY.v0 + .15, v) * (1 - ss(REPLAY.v1 - .2, REPLAY.v1, v));
    g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(60, 150, 330, 96);
    g.fillStyle = (v * 2) % 2 < 1.3 ? '#ff2a2a' : 'rgba(255,42,42,.25)'; g.beginPath(); g.arc(112, 198, 20, 0, 6.28); g.fill(); g.restore();
    txt('REPLAY', 150, 200, 64, 'IDB', '#ffffff', { align: 'left', a, shadow: false });
  }
  // end card
  if (v >= ENDCARD.v0) {
    const a = ss(ENDCARD.v0 + .1, ENDCARD.v0 + .2, v);
    txt(FIGHT.endcard?.[0] || "WHO'S NEXT?", W / 2, 520, 150, 'IDB', '#ffd34d', { sc: slam(v, ENDCARD.v0 + .1), a, stroke: 12, maxW: 980 });
    txt(FIGHT.endcard?.[1] || 'COMMENT YOUR MATCHUP', W / 2, 670, 64, 'IDB', '#ffffff', { a: ss(ENDCARD.v0 + .6, ENDCARD.v0 + .9, v), stroke: 8, maxW: 980 });
  }
  // narration subtitles
  for (const [t0, t1, str] of SUBS) if (v >= t0 && v < t1) {
    const a = ss(t0, t0 + .12, v) * (1 - ss(t1 - .12, t1, v));
    wrapTxt(str, 1190, a);
  }
}
// cold open: big question over the slow-motion uppercut (fight file `hook`: [line1, line2])
const bare = n => n.replace(/^THE /, ''), art = n => (/^[AEIOU]/.test(n) ? 'AN ' : 'A ') + n;
const HUMAN = [FIGHT.red, FIGHT.blue].find(f => /HUMAN/.test(f.name));
const OPP = HUMAN === FIGHT.red ? FIGHT.blue : FIGHT.red;
const HOOK = FIGHT.hook || (HUMAN ? ['CAN A HUMAN', `BEAT ${art(bare(OPP.name))}?`] : [`${bare(FIGHT.red.name)} vs`, `${bare(FIGHT.blue.name)}?`]);
function coldOverlay(t) {
  const sh = imp(t, COLD_HIT, .08) * 26;
  txt(HOOK[0], W / 2 + n1(t * 40) * sh, 430 + n1(t * 40 + 5) * sh, 128, 'IDB', '#ffffff', { sc: slam(t, .08), a: ss(.08, .12, t), stroke: 12, maxW: 1000 });
  txt(HOOK[1], W / 2 + n1(t * 40 + 9) * sh, 590 + n1(t * 40 + 13) * sh, 128, 'IDB', '#ffd34d', { sc: slam(t, .5), a: ss(.5, .54, t), stroke: 12, maxW: 1000 });
}
const SUBS = [];
for (const k in VO_SLOTS) { const c = FIGHT.cues?.[k]; if (!c) continue; for (const [a, b, t] of c) SUBS.push([VO_SLOTS[k].t + a - .03, VO_SLOTS[k].t + b + .05, t]); }
SUBS.push([45.7, 47.4, 'Eight... nine... ten!']);
SUBS.sort((x, y) => x[0] - y[0]);
for (let i = 0; i + 1 < SUBS.length; i++) SUBS[i][1] = Math.min(SUBS[i][1], SUBS[i + 1][0] - .02); // no overlaps
function wrapTxt(str, y, a) {
  g.save(); g.font = '800 56px IB'; const words = str.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > 900 && cur) { lines.push(cur); cur = w; } else cur = t; }
  lines.push(cur); g.restore();
  lines.forEach((l, i) => txt(l, W / 2, y - (lines.length - 1) * 68 + i * 68, 56, 'IB', '#ffffff', { a, stroke: 9, strokeCol: 'rgba(0,0,0,.85)' }));
}

// ---------- shots ----------
const SH = [];
const shot = (v0, v1, fn, who) => SH.push({ v0, v1, fn, who });
const ZOOM = { E: SPECIES.erectus.object ? 1.7 : 1, S: SPECIES.sapiens.object ? 1.7 : 1 };
const hd = (f) => f.head.getWorldPosition(V());
shot(0, 4.8, (v, a, k) => ({ pos: V(lerp(4, 1.2, ss(0, 4.8, v)), lerp(10, 3.0, ss(0, 4.8, v)), lerp(17, 10.5, ss(0, 4.8, v))), look: V(0, lerp(.4, 1.25, ss(0, 4.8, v)), 0), fov: 44 }));
shot(4.8, 8.6, (v, a, k) => { const h = hd(E); return { pos: V(h.x + lerp(1.55, 1.05, k), lerp(1.15, 1.3, k), lerp(.6, .35, k)), look: V(h.x, h.y - .12, h.z), fov: 34 }; }, 'E');
shot(8.6, 11.4, (v, a, k) => { const h = hd(E); return { pos: V(h.x + lerp(.35, .55, k), lerp(1.25, 1.35, k), lerp(1.25, 1.05, k)), look: V(h.x + .1, h.y - .1, h.z), fov: 34 }; }, 'E');
shot(11.4, 15.0, (v, a, k) => { const h = hd(E); return { pos: V(h.x + lerp(1.5, 1.2, k), lerp(.95, 1.0, k), lerp(-.75, -.45, k)), look: V(h.x, h.y - .05, h.z), fov: 34 }; }, 'E');
shot(15.0, 19.0, (v, a, k) => { const h = hd(S); return { pos: V(h.x - lerp(1.55, 1.05, k), lerp(1.3, 1.45, k), lerp(-.65, -.35, k)), look: V(h.x, h.y - .12, h.z), fov: 34 }; }, 'S');
shot(19.0, 23.4, (v, a, k) => { const h = hd(S); const ph = lerp(-2.2, -1.5, k); return { pos: V(h.x + Math.cos(ph) * 1.25 - .2, lerp(1.5, 1.35, k), Math.sin(ph) * 1.25), look: V(h.x, h.y - .15, h.z), fov: 34 }; }, 'S');
shot(23.4, 25.2, (v, a, k) => ({ pos: V(lerp(-.4, 0, k), lerp(.95, 1.1, k), lerp(7.6, 5.4, k)), look: V(0, 1.2, 0), fov: 42 }));
shot(25.2, 28.4, (v, a, k) => { const cx = (roots(a).E.x + roots(a).S.x) / 2; const th = lerp(.75, 1.15, k); return { pos: V(cx + Math.cos(th) * 3.6, 1.5, Math.sin(th) * 3.6), look: V(cx, 1.35, 0), fov: 40, shake: .6 }; });
shot(28.4, 30.7, (v, a, k) => { const h = hd(S); const R = roots(a); return { pos: V(lerp(R.S.x - .5, R.S.x - .2, k), 1.55, lerp(-2.0, -2.3, k)), look: V(h.x - .25, h.y - .15, h.z), fov: 30 }; });
shot(30.7, 31.8, (v, a, k) => { const R = roots(a); return { pos: V(R.S.x - 2.6, 1.25, 2.4), look: V(R.S.x - .3, 1.15, 0), fov: 38, shake: .5 }; });
shot(31.8, 35.2, (v, a, k) => { const R = roots(a); const h = hd(E); return { pos: V(R.E.x + 2.3, 1.15, 1.3), look: V(h.x, h.y - .3, h.z), fov: 36, shake: .5 }; });
shot(35.2, 37.6, (v, a, k) => ({ pos: V(lerp(1.5, 1.75, k), .75, lerp(2.3, 2.0, k)), look: V(1.85, 1.15, 0), fov: 38 }));
shot(37.6, 38.7, (v, a, k) => { const R = roots(a); const h = hd(E); return { pos: V(R.S.x + .85, 1.6, lerp(-1.25, -1.1, k)), look: V(h.x, h.y - .25, h.z), fov: 38, shake: 1.2 }; });
shot(38.7, 42.7, (v, a, k) => { const h = hd(E); const ph = lerp(1.25, 1.75, ss(0, 1, k)); const R = 2.3; return { pos: V(h.x + .35 + Math.cos(ph) * R, lerp(1.0, 1.15, k), Math.sin(ph) * R), look: V(h.x + .3, h.y - .2, h.z), fov: 32 }; });
shot(42.7, 45.4, (v, a, k) => { const R = roots(a); return { pos: V(R.E.x - 2.7, .45, 2.7), look: V(R.E.x - .5, lerp(1.0, .3, ss(.0, .75, k)), 0), fov: 40 }; });
shot(45.4, 48.0, (v, a, k) => { const R = roots(a); return { pos: V(R.E.x - .8, lerp(3.0, 3.8, k), .01), look: V(R.E.x - .8, 0, 0), fov: 40, up: V(-1, 0, .25 * k).normalize() }; });
shot(48.0, REPLAY.v0, (v, a, k) => { const R = roots(a); const h = hd(S); return { pos: V(R.S.x - lerp(.75, .45, k), lerp(1.05, 1.25, k), R.S.z + lerp(3.6, 2.6, k)), look: V(h.x, h.y - lerp(.45, .25, k), h.z), fov: 40 }; }, 'S');

// replay: slow orbit from the far side, then low wide angle on the fall
shot(REPLAY.v0, REPLAY.cut, (v, a, k) => { const h = hd(E); const R = roots(a); const mid = (R.E.x + R.S.x) / 2; return { pos: V(lerp(mid - .35, mid + .1, k), lerp(.85, 1.0, k), -2.0), look: V(h.x + .2, h.y - .15, 0), fov: 30 }; }, 'E');
shot(REPLAY.cut, REPLAY.v1, (v, a, k) => { const R = roots(a); return { pos: V(R.E.x - 2.5, .4, -2.6), look: V(R.E.x - .5, lerp(.9, .3, ss(0, .7, k)), 0), fov: 40 }; });
shot(ENDCARD.v0, DURATION + 1, (v, a, k) => { const R = roots(a); const h = hd(S); return { pos: V(R.S.x - .5, lerp(1.0, 1.1, k), R.S.z + lerp(3.2, 2.9, k)), look: V(h.x, h.y - .35, h.z), fov: 40 }; }, 'S');
function applyFighter(F, who, a, R) {
  const sp = F.sp, op = who === 'E' ? SPECIES.sapiens : SPECIES.erectus;
  const P = pose(who, a, sp, op, R);
  const r = R[who];
  F.group.position.set(r.x, P.root.lift, r.z);
  F.group.rotation.set(P.root.fall * (who === 'E' ? -1 : -1), (who === 'E' ? Math.PI / 2 : -Math.PI / 2) + P.root.yaw, 0, 'YXZ');
  const O = who === 'E' ? S : E; O.group.updateMatrixWorld(true);
  F.apply(P, O.head.getWorldPosition(V()));
}

const coldShot = (t) => { const k = t / COLD, h = hd(E), R = roots(coldAction(t)), mid = (R.E.x + R.S.x) / 2; const z = SPECIES.erectus.object ? 1.25 : 1; return { pos: V(lerp(mid - .45, mid - .1, k), lerp(.85, .95, k), lerp(-2.15, -1.8, k) * z), look: V(lerp(h.x + .2, mid, .3), h.y - .2, 0), fov: 32 }; };
window.frame = (t, q = .93) => {
  const cold = t < COLD, v = cold ? 40.5 : t - COLD;   // cold open borrows the slow-mo look of the fight
  const a = cold ? coldAction(t) : actionTime(v), R = roots(a);
  applyFighter(E, 'E', a, R); applyFighter(S, 'S', a, R);
  let hype = .3 + .4 * ss(25.2, 25.8, v) + .3 * ss(47.4, 47.8, v);
  for (const h of HITS) hype = Math.max(hype, Math.min(1, imp(a, h.th, .6) * h.str));
  updateWorld(world, v, hype);
  updateParticles(a); updateGuard(a); updateDust(a, R.E.x);
  // impact flash
  let fl = 0, flPos = null;
  for (const h of HITS) { const k = imp(a, h.th, .03) * Math.min(1, h.str); if (k > fl) { fl = k; const e = emitters.find(x => x.t === h.th); flPos = e.pos; } }
  flashSpr.visible = fl > .02; if (flPos) { flashSpr.position.copy(flPos); flashSpr.scale.setScalar(.25 + fl * .35); flashSpr.material.opacity = Math.min(.6, fl * .5); world.flash.position.copy(flPos); }
  world.flash.intensity = fl * 1.0;
  // camera
  const sh = cold ? { fn: () => coldShot(t) } : SH.find(s => v >= s.v0 && v < s.v1) || SH[SH.length - 1];
  const k = (v - sh.v0) / (sh.v1 - sh.v0);
  E.group.updateMatrixWorld(true); S.group.updateMatrixWorld(true);
  const c = sh.fn(v, a, k);
  if (sh.who && ZOOM[sh.who] !== 1) c.pos = c.look.clone().add(c.pos.clone().sub(c.look).multiplyScalar(ZOOM[sh.who]));
  let shake = 0; for (const h of HITS) shake += imp(a, h.th, .15) * h.str;
  shake += imp(a, 20.3, .12) * 1.5;
  const hand = (c.shake ?? .25) * .012;
  camera.position.copy(c.pos).add(V(n1(v * 1.3) * hand, n1(v * 1.1 + 4) * hand, n1(v * .9 + 8) * hand));
  camera.up.copy(c.up || V(0, 1, 0));
  const look = c.look.clone().add(V(n1(v * 23) * shake * .03, n1(v * 21 + 3) * shake * .03, n1(v * 19 + 7) * shake * .02));
  camera.fov = c.fov - shake * 1.5; camera.updateProjectionMatrix(); camera.lookAt(look);
  // grade
  const inRep = cold || (v >= REPLAY.v0 && v < REPLAY.v1);
  const slow = inRep ? .6 : 1 - clamp(speed(v));
  grade.uniforms.uTime.value = v;
  grade.uniforms.uAb.value = Math.min(.5, shake * .22) + slow * .05;
  let flash = 0; for (const h of HITS) if (h.str > 1) flash = Math.max(flash, imp(a, h.th, .02) * .3);
  flash = Math.max(flash, imp(a, 20.3, .03) * .25);
  grade.uniforms.uFlash.value = flash;
  grade.uniforms.uSat.value = inRep ? .55 : 1 - slow * .25;
  if (inRep && !cold) grade.uniforms.uFlash.value = Math.max(grade.uniforms.uFlash.value, (1 - ss(REPLAY.v0, REPLAY.v0 + .25, v)) * .8);
  if (cold) { grade.uniforms.uSat.value = .8; grade.uniforms.uFlash.value = Math.max(grade.uniforms.uFlash.value, imp(t, COLD_HIT, .04) * .7); }
  grade.uniforms.uRed.value = 0;
  bloom.strength = .32 + slow * .2;
  const D = window.DBG || {}; if (D.noSpr) flashSpr.visible = false; if (D.noSweat) { sweat.count = 0; blood.count = 0; } if (D.noLight) world.flash.intensity = 0; if (D.noGrade) grade.uniforms.uFlash.value = 0;
  composer.render();
  g.clearRect(0, 0, W, H); g.drawImage(glCanvas, 0, 0);
  if (cold) coldOverlay(t); else overlay(v);
  // cold open: hard start, dip to black into the title; fade out at the very end
  const fade = cold ? ss(COLD - .2, COLD, t) : Math.max(1 - ss(0, .3, v), ss(DURATION - .5, DURATION, v));
  if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
  return out.toDataURL('image/jpeg', q);
};
window.DURATION = DURATION + COLD;
document.fonts.ready.then(() => Promise.all(['IDB', 'IDK', 'IB'].map(f => document.fonts.load(`40px ${f}`)))).then(() => { window.READY = true; });
