import * as THREE from 'three';
import { RealHead } from './head.js';
import { ObjectFace } from './objects.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
function sdfMesh(list, mat, half, k = .04, res = 64) {
  const mc = new MarchingCubes(res, mat, false, false, 300000); mc.isolation = 0;
  const hs = res / 2;
  const sd = (x, y, z) => {
    let d = 1e9;
    for (const e of list) {
      const px = (x - e.c[0]) / e.r[0], py = (y - e.c[1]) / e.r[1], pz = (z - e.c[2]) / e.r[2];
      const k0 = Math.hypot(px, py, pz), k1 = Math.hypot(px / e.r[0], py / e.r[1], pz / e.r[2]);
      const di = k0 * (k0 - 1) / Math.max(k1, 1e-6);
      const h = Math.max(k - Math.abs(d - di), 0) / k; d = Math.min(d, di) - h * h * k / 4;
    }
    return d;
  };
  for (let kz = 0; kz < res; kz++) for (let ky = 0; ky < res; ky++) for (let kx = 0; kx < res; kx++)
    mc.field[kx + ky * res + kz * res * res] = -sd((kx - hs) / hs * half, (ky - hs) / hs * half, (kz - hs) / hs * half);
  mc.update();
  const n = mc.count, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mc.positionArray.slice(0, n * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mc.normalArray.slice(0, n * 3), 3));
  const uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { uv[i * 2] = mc.positionArray[i * 3] * 2 + .5; uv[i * 2 + 1] = mc.positionArray[i * 3 + 1] * 2 + .5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const m = new THREE.Mesh(g, mat); m.scale.setScalar(half); m.castShadow = m.receiveShadow = true; return m;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);

// ---------- procedural textures ----------
function hash3(x, y, z) { let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w) * 2 - 1;
}
export function fbm3(x, y, z) { return vnoise(x, y, z) * .55 + vnoise(x * 2.03 + 7, y * 2.03, z * 2.03) * .28 + vnoise(x * 4.1, y * 4.1 + 3, z * 4.1) * .17; }

function canvasTex(w, h, draw, srgb = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let _skinBump;
function skinBump() {
  if (_skinBump) return _skinBump;
  _skinBump = canvasTex(512, 512, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = (i / w) | 0;
      let v = 128 + (Math.random() - .5) * 50 + fbm3(x / 9, y / 9, 1) * 40;
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  });
  _skinBump.repeat.set(3, 3);
  return _skinBump;
}
function skinColorTex(base, mottle, seed) {
  return canvasTex(512, 512, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = (i / w) | 0;
      const n = fbm3(x / 60 + seed, y / 60, seed) * .5 + fbm3(x / 14, y / 14, seed + 3) * .25;
      const r = base[0] * (1 + n * mottle) + n * 12, gg = base[1] * (1 + n * mottle * .9), b = base[2] * (1 + n * mottle * .8);
      im.data[i * 4] = Math.min(255, r); im.data[i * 4 + 1] = Math.min(255, gg); im.data[i * 4 + 2] = Math.min(255, b); im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, true);
}
function peltTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#b07a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { // fur strands
      const x = Math.random() * w, y = Math.random() * h, l = 4 + Math.random() * 8, s = Math.random();
      g.strokeStyle = `rgba(${s > .5 ? '230,180,110' : '90,55,25'},${.25 + Math.random() * .3})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 2 - 1, y + l); g.stroke();
    }
    for (let i = 0; i < 70; i++) { // leopard rosettes
      const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 10;
      g.fillStyle = 'rgba(40,22,10,.85)';
      for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 + Math.random() * .5; g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, 3 + Math.random() * 3, 2 + Math.random() * 2, a, 0, 6.28); g.fill(); }
      g.fillStyle = 'rgba(150,90,35,.6)'; g.beginPath(); g.arc(x, y, r * .55, 0, 6.28); g.fill();
    }
  }, true);
}
function shortsTex(col, stripe, text) {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = stripe; g.fillRect(0, h * .82, w, h * .18); // waistband (top of lathe = v=1 -> canvas top? handled by flipY)
    g.fillRect(0, 0, w, h * .05);
    for (const sx of [.25, .75]) { g.fillRect(w * sx - 14, 0, 28, h); }
    g.font = '900 60px IDK'; g.fillStyle = col; g.textAlign = 'center';
    g.fillText(text, w * .5, h * .955); g.fillText(text, w * 0, h * .955); g.fillText(text, w * 1, h * .955);
  }, true);
}

// ---------- geometry helpers ----------
function limbGeo(r0, r1, bulge = 0, bulgeAt = .35, seg = 20) {
  const pts = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let r = r0 + (r1 - r0) * t + bulge * Math.exp(-Math.pow((t - bulgeAt) / .22, 2));
    pts.push(new THREE.Vector2(r, t));
  }
  const g = new THREE.LatheGeometry(pts, seg);
  return g;
}
function noisySphere(r, amp, freq, seed, opts = {}) {
  const g = new THREE.SphereGeometry(r, opts.ws ?? 48, opts.hs ?? 32, 0, Math.PI * 2, opts.t0 ?? 0, opts.tl ?? Math.PI);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize();
    const d = fbm3(n.x * freq + seed, n.y * freq, n.z * freq) * amp + (Math.random() - .5) * amp * .5;
    v.addScaledVector(n, d); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
const SPH = new THREE.SphereGeometry(1, 40, 28);
function ell(mat, sx, sy, sz, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(SPH, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m;
}
function placeSeg(mesh, A, B) {
  const d = B.clone().sub(A); const L = d.length();
  mesh.position.copy(A); mesh.quaternion.setFromUnitVectors(Y, d.normalize()); mesh.scale.set(1, L, 1);
}
export function ik2(S, T, a, b, pole) {
  const d = T.clone().sub(S); let L = d.length();
  const maxL = (a + b) * .995, minL = Math.abs(a - b) + .02;
  if (L > maxL) { d.setLength(maxL); L = maxL; } if (L < minL) { d.setLength(minL); L = minL; }
  const T2 = S.clone().add(d);
  const dir = d.clone().normalize();
  const cosA = (a * a + L * L - b * b) / (2 * a * L);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const E = S.clone().addScaledVector(dir, a * cosA).addScaledVector(perp, a * sinA);
  return [E, T2];
}

// ---------- species / look definitions ----------
// Bodies: 'brute' = heavy, low (v3 erectus), 'human' = athletic modern boxer (v3 sapiens)
export const BODY = {
  brute: { thigh: .43, shin: .43, hipW: .11, up: .30, fore: .28, shW: .225, spine: .30, neck: .07, bulk: 1.18, headS: 1.05, neckZ: .03, belly: 1 },
  human: { thigh: .46, shin: .46, hipW: .1, up: .31, fore: .28, shW: .205, spine: .32, neck: .05, bulk: 1.0, headS: 1.0, neckZ: 0, belly: 0 },
  slim: { thigh: .47, shin: .47, hipW: .095, up: .31, fore: .29, shW: .19, spine: .33, neck: .06, bulk: .9, headS: 1.0, neckZ: 0, belly: 0 },
  giant: { thigh: .47, shin: .46, hipW: .12, up: .33, fore: .30, shW: .24, spine: .33, neck: .06, bulk: 1.3, headS: 1.0, neckZ: .02, belly: 1 },
};
// skin presets: body colour (0-255) + tint for the head scan texture (0-1)
export const SKINS = {
  pale: { skin: [214, 172, 142], tint: [1.08, .9, .78], mottle: .15 },
  light: { skin: [200, 146, 116], tint: [1.0, .8, .66], mottle: .18 },
  tan: { skin: [168, 112, 80], tint: [.7, .5, .38], mottle: .22 },
  brown: { skin: [140, 90, 60], tint: [.48, .34, .26], mottle: .28 },
  dark: { skin: [118, 74, 48], tint: [.33, .23, .18], mottle: .35 },
  zombie: { skin: [118, 138, 98], tint: [.52, .64, .46], mottle: .55 },
  alien: { skin: [130, 165, 150], tint: [.55, .74, .68], mottle: .2 },
  robot: { skin: [165, 170, 182], tint: [.75, .77, .84], mottle: .04, metal: 1 },
  gold: { skin: [205, 160, 70], tint: [1.0, .78, .32], mottle: .05, metal: 1 },
  devil: { skin: [165, 42, 30], tint: [.9, .24, .17], mottle: .3 },
  ice: { skin: [170, 200, 225], tint: [.75, .9, 1.05], mottle: .15 },
  fur_dark: { skin: [48, 40, 36], tint: [.17, .14, .13], mottle: .55 },
  fur_brown: { skin: [112, 72, 42], tint: [.42, .27, .17], mottle: .55 },
};
const CORNER = {
  red: { glove: 0xb3121b, gloveTrim: 0xf2e6d0, guardCol: 0xb3121b, trunks: '#7a0c12', stripe: '#f4f4f4' },
  blue: { glove: 0x1546c8, gloveTrim: 0xffffff, guardCol: 0x1546c8, trunks: '#0d1f5c', stripe: '#f4f4f4' },
};
const col = c => (typeof c === 'string' ? new THREE.Color(c).getHex() : c);
// look: see fights/README.md. corner: 'red' | 'blue'
export function makeSpec(look = {}, corner = 'red') {
  const body = BODY[look.body || 'human'] || BODY.human;
  const sk = SKINS[look.skin || 'light'] || SKINS.light;
  const C = CORNER[corner];
  const id = look.id || look.name || corner;
  let seed = 0; for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  const objBody = look.object ? { bulk: .72, shW: .4, neck: .05, belly: 0, neckZ: 0, headS: 1 } : {};
  return {
    ...body, ...objBody, ...(look.bodyTweaks || {}),
    name: id, corner, seed: seed / 97,
    skin: sk.skin, headTint: sk.tint, mottle: sk.mottle, metal: !!sk.metal,
    hairCol: col(look.hairCol ?? '#1a120c'), hair: look.hair || 'short', beard: !!look.beard, chestHair: !!look.chestHair,
    morph: look.morph ?? 0, outfit: look.outfit || 'trunks', trunks: look.trunks || C.trunks, stripe: look.stripe || C.stripe,
    trunksText: (look.trunksText ?? look.name ?? '').toUpperCase().slice(0, 12), feet: look.feet || 'boots', bootCol: col(look.bootCol ?? 0xf0f0f0),
    iris: look.iris || (sk.metal ? ['#202020', '#101010'] : ['#5a3a1c', '#3a2410']), eyeGlow: look.eyeGlow ? col(look.eyeGlow) : null,
    hat: look.hat || null, hatCol: col(look.hatCol ?? 0x9aa0a8), object: look.object || null, limbCol: col(look.limbCol ?? 0x1c1c1c),
    glove: C.glove, gloveTrim: C.gloveTrim, guardCol: C.guardCol,
  };
}
// the v3 duel, kept as default/reference
export const V3_LOOKS = {
  red: { id: 'erectus', name: 'erectus', body: 'brute', skin: 'dark', hair: 'wild', beard: true, chestHair: true, morph: 1, outfit: 'pelt', feet: 'bare', iris: ['#3a2412', '#24150a'] },
  blue: { id: 'sapiens', name: 'sapiens', body: 'human', skin: 'light', hair: 'short', trunksText: 'SAPIENS' },
};
export const SPECIES = { erectus: makeSpec(V3_LOOKS.red, 'red'), sapiens: makeSpec(V3_LOOKS.blue, 'blue') };

export class Fighter {
  constructor(sp) {
    this.sp = sp; const s = sp;
    this.group = new THREE.Group();
    const skinMat = new THREE.MeshPhysicalMaterial({
      map: skinColorTex(s.skin, s.mottle, s.seed), bumpMap: skinBump(), bumpScale: s.metal ? .15 : .6,
      roughness: s.metal ? .28 : .48, metalness: s.metal ? .85 : 0, clearcoat: .35, clearcoatRoughness: .35, sheen: s.metal ? 0 : .4, sheenColor: new THREE.Color(0.6, 0.2, 0.12), sheenRoughness: .5,
    });
    if (s.object) { skinMat.map = null; skinMat.color.setHex(s.limbCol); skinMat.metalness = 0; skinMat.roughness = .45; skinMat.sheen = 0; skinMat.bumpScale = .1; }
    this.skin = skinMat;
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0b0605, roughness: .6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: s.hairCol, roughness: .95, bumpMap: skinBump(), bumpScale: 3 });
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0xe8e2d6, roughness: .15, clearcoat: 1 });
    const irisMat = new THREE.MeshPhysicalMaterial({ color: s.name === 'erectus' ? 0x2a1608 : 0x3a2a14, roughness: .1, clearcoat: 1 });
    const gloveMat = new THREE.MeshPhysicalMaterial({ color: s.glove, roughness: .28, clearcoat: .9, clearcoatRoughness: .15 });
    const trimMat = new THREE.MeshPhysicalMaterial({ color: s.gloveTrim, roughness: .4, clearcoat: .5 });
    const lipMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(s.skin[0] / 255 * .7, s.skin[1] / 255 * .45, s.skin[2] / 255 * .45), roughness: .4 });
    this.mats = { skinMat, gloveMat };
    const b = s.bulk;

    // ---- torso hierarchy ----
    this.pelvis = new THREE.Group(); this.group.add(this.pelvis);
    this.spine = new THREE.Group(); this.spine.position.y = .12; this.pelvis.add(this.spine);
    this.chest = new THREE.Group(); this.chest.position.y = s.spine - .12; this.spine.add(this.chest);
    this.neck = new THREE.Group(); this.neck.position.set(0, .2, s.neckZ); this.chest.add(this.neck);
    this.head = new THREE.Group(); this.head.position.y = s.neck + .1; this.neck.add(this.head);
    this.head.scale.setScalar(s.headS);

    if (!s.object) {
    // pelvis + shorts
    ell(skinMat, .15 * b, .11, .11 * b, 0, 0, 0, this.pelvis);
    let shorts;
    if (s.outfit === 'pelt') {
      const pm = new THREE.MeshStandardMaterial({ map: peltTex(), roughness: .9, bumpMap: skinBump(), bumpScale: 2 });
      const g = new THREE.LatheGeometry([[.0, -.2], [.21, -.2], [.215, -.12], [.2, .0], [.185, .1], [.18, .13], [.0, .13]].map(p => new THREE.Vector2(p[0], p[1])), 40);
      // ragged hem
      const P = g.attributes.position;
      for (let i = 0; i < P.count; i++) { if (P.getY(i) < -.19) { const a = Math.atan2(P.getZ(i), P.getX(i)); P.setY(i, -.2 - Math.abs(Math.sin(a * 7)) * .05 - Math.random() * .02); } }
      g.computeVertexNormals();
      shorts = new THREE.Mesh(g, pm); shorts.scale.set(1.05 * b, 1, .82 * b);
    } else {
      const tex = shortsTex(s.trunks, s.stripe, s.trunksText);
      const sm = new THREE.MeshPhysicalMaterial({ map: tex, roughness: .32, sheen: 1, sheenColor: new THREE.Color(.4, .5, 1), sheenRoughness: .3, clearcoat: .2 });
      const g = new THREE.LatheGeometry([[.0, -.21], [.2, -.21], [.215, -.12], [.2, .0], [.18, .1], [.175, .14], [.0, .14]].map(p => new THREE.Vector2(p[0], p[1])), 40);
      shorts = new THREE.Mesh(g, sm); shorts.scale.set(1.04, 1, .8);
    }
    shorts.castShadow = shorts.receiveShadow = true; this.pelvis.add(shorts);
    // abdomen + chest as smooth-blended (SDF) surfaces
    const E_ = s.belly > 0;
    const ab = [{ c: [0, .06, 0], r: [.14 * b, .16, .095 * b] }];
    for (const sx of [-1, 1]) ab.push({ c: [sx * .1 * b, .02, -.005], r: [.06, .085, .07] });
    if (E_) ab.push({ c: [0, .02, .035], r: [.125, .12, .1] });
    this.spine.add(sdfMesh(ab, skinMat, .3));
    const ch = [{ c: [0, .04, 0], r: [.17 * b, .16, .11 * b] }, { c: [0, -.06, .01], r: [.14 * b, .1, .1 * b] }];
    for (const sx of [-1, 1]) {
      ch.push({ c: [sx * .075 * b, .08, .065 * b], r: [.09 * b, .065, .045 * b] });  // pecs
      ch.push({ c: [sx * .12 * b, .01, -.03], r: [.07 * b, .1, .06] });              // lats
      ch.push({ c: [sx * .085 * b, .16, -.025], r: [.08 * b, .05, .06] });            // traps
      ch.push({ c: [sx * s.shW * b * .95, .12, 0], r: [.072 * b, .068 * b, .07 * b] }); // deltoids
    }
    this.chest.add(sdfMesh(ch, skinMat, .36, .045));
    if (s.chestHair) { // chest hair
      const ch = new THREE.Mesh(noisySphere(1, .25, 6, 4), hairMat); ch.scale.set(.1, .08, .02); ch.position.set(0, .07, .115); this.chest.add(ch);
      const back = new THREE.Mesh(noisySphere(1, .2, 5, 8), hairMat); back.scale.set(.14, .12, .03); back.position.set(0, .07, -.095); this.chest.add(back);
    }
    }
    this.shoulderL = new THREE.Object3D(); this.shoulderL.position.set(s.shW * b * .95, .12, 0); this.chest.add(this.shoulderL);
    this.shoulderR = new THREE.Object3D(); this.shoulderR.position.set(-s.shW * b * .95, .12, 0); this.chest.add(this.shoulderR);
    // neck
    if (!s.object) {
    const nk = new THREE.Mesh(limbGeo(.06 * b, .052 * b, 0), skinMat); nk.scale.set(1, s.neck + .12, 1); nk.position.y = -.02; nk.castShadow = true; this.neck.add(nk);
    }

    if (s.object) { this.rh = new ObjectFace(s, this.chest); const I = this.rh.info; this.neck.position.set(0, .2, 0); this.head.position.set(0, I.face.y - .2, .1); this.shoulderL.position.set(I.shoulder.x, I.shoulder.y, 0); this.shoulderR.position.set(-I.shoulder.x, I.shoulder.y, 0); }
    else { this.rh = new RealHead(s); this.addHat(s); } this.head.add(this.rh.group); this.mouthguard = this.rh.guard || new THREE.Object3D();

    // ---- limbs ----
    const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; this.group.add(m); return m; };
    this.uaL = mk(limbGeo(.058 * b, .042 * b, .012 * b, .45), skinMat); this.uaR = mk(limbGeo(.058 * b, .042 * b, .012 * b, .45), skinMat);
    this.faL = mk(limbGeo(.045 * b, .034 * b, .008 * b, .25), skinMat); this.faR = mk(limbGeo(.045 * b, .034 * b, .008 * b, .25), skinMat);
    this.thL = mk(limbGeo(.085 * b, .05 * b, .01 * b, .3), skinMat); this.thR = mk(limbGeo(.085 * b, .05 * b, .01 * b, .3), skinMat);
    this.shL = mk(limbGeo(.052 * b, .034 * b, .014 * b, .3), skinMat); this.shR = mk(limbGeo(.052 * b, .034 * b, .014 * b, .3), skinMat);
    this.elL = ell(skinMat, .042 * b, .042 * b, .042 * b, 0, 0, 0, this.group); this.elR = ell(skinMat, .042 * b, .042 * b, .042 * b, 0, 0, 0, this.group);
    this.knL = ell(skinMat, .052 * b, .052 * b, .052 * b, 0, 0, 0, this.group); this.knR = ell(skinMat, .052 * b, .052 * b, .052 * b, 0, 0, 0, this.group);
    // gloves
    const mkGlove = () => {
      const g = new THREE.Group(); this.group.add(g);
      ell(gloveMat, .075, .068, .095, 0, 0, .045, g);
      ell(gloveMat, .07, .06, .06, 0, -.01, -.01, g);
      ell(gloveMat, .028, .024, .05, .055, .02, .03, g).rotation.set(0, -.4, 0); // thumb
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.058, .052, .09, 28), trimMat); cuff.rotation.x = Math.PI / 2; cuff.position.z = -.06; cuff.castShadow = true; g.add(cuff);
      const lace = new THREE.Mesh(new THREE.TorusGeometry(.058, .006, 6, 28), gloveMat); lace.position.z = -.085; g.add(lace);
      return g;
    };
    this.glL = mkGlove(); this.glR = mkGlove(); this.glR.scale.x = -1;
    // boots
    const bootMat = new THREE.MeshPhysicalMaterial({ color: s.feet === 'bare' ? 0x3b2414 : s.bootCol, roughness: s.feet === 'bare' ? .9 : .35, clearcoat: s.feet === 'bare' ? 0 : .6 });
    const mkBoot = () => {
      const g = new THREE.Group(); this.group.add(g);
      if (s.feet === 'bare') { // bare feet wrapped in hide
        ell(skinMat, .05, .04, .11, 0, -.035, .05, g); ell(bootMat, .055, .05, .07, 0, -.01, -.0, g);
        for (let k = 0; k < 4; k++) ell(skinMat, .014, .012, .02, -.03 + k * .02, -.06, .15, g);
      } else {
        ell(bootMat, .05, .045, .12, 0, -.03, .05, g);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(.048, .045, .14, 24), bootMat); c.position.y = .03; c.castShadow = true; g.add(c);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(.0485, .0485, .02, 24), new THREE.MeshStandardMaterial({ color: s.glove })); st.position.y = .08; g.add(st);
      }
      return g;
    };
    this.ftL = mkBoot(); this.ftR = mkBoot();
    this.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // hats / accessories, placed relative to the head scan bounds
  addHat(s) {
    if (!s.hat) return;
    const B = this.rh.bounds, h = this.head, g = new THREE.Group(); h.add(g);
    const metal = new THREE.MeshPhysicalMaterial({ color: s.hatCol, metalness: .9, roughness: .3, clearcoat: .5 });
    const bone = new THREE.MeshPhysicalMaterial({ color: 0xe8dcc0, roughness: .5, clearcoat: .3 });
    const m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    const r = B.halfW * 1.12, cy = B.top - r * .62, cz = B.cz;
    const cap = (mat) => { const o = m(new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI * .5), mat, 0, cy, cz); o.scale.set(1, .95, 1.18); return o; };
    if (s.hat === 'viking') {
      cap(metal); const rim = m(new THREE.TorusGeometry(r * 1.0, r * .07, 8, 40), metal, 0, cy + r * .02, cz); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1.18, 1);
      for (const sx of [-1, 1]) {
        const pts = [V(sx * r * .85, cy + r * .3, cz), V(sx * r * 1.35, cy + r * .5, cz + r * .05), V(sx * r * 1.6, cy + r * 1.0, cz + r * .15), V(sx * r * 1.5, cy + r * 1.5, cz + r * .25)];
        const curve = new THREE.CatmullRomCurve3(pts), TS = 24, RS = 12, geo = new THREE.TubeGeometry(curve, TS, r * .17, RS, false), P = geo.attributes.position;
        for (let k = 0; k < P.count; k++) { const u = Math.floor(k / (RS + 1)) / TS, c = curve.getPointAt(Math.min(1, u)), p = V().fromBufferAttribute(P, k); p.sub(c).multiplyScalar(1 - .9 * u).add(c); P.setXYZ(k, p.x, p.y, p.z); }
        geo.computeVertexNormals(); const horn = new THREE.Mesh(geo, bone); horn.castShadow = true; g.add(horn);
      }
    } else if (s.hat === 'gladiator') {
      cap(metal); const crest = m(new THREE.BoxGeometry(r * .18, r * .45, r * 2.1), new THREE.MeshStandardMaterial({ color: 0xc0141c, roughness: .9 }), 0, cy + r * 1.0, cz); crest.scale.set(1, 1, 1);
    } else if (s.hat === 'crown') {
      const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc83d, metalness: 1, roughness: .25 });
      const ring = m(new THREE.CylinderGeometry(r * .86, r * .8, r * .38, 40, 1, true), gold, 0, B.top - r * .12, cz); ring.material.side = THREE.DoubleSide; ring.scale.z = 1.12;
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; m(new THREE.ConeGeometry(r * .1, r * .32, 8), gold, Math.sin(a) * r * .86, B.top + r * .2, cz + Math.cos(a) * r * .96); m(new THREE.SphereGeometry(r * .05, 8, 6), new THREE.MeshPhysicalMaterial({ color: k % 2 ? 0xc01030 : 0x2050ff, roughness: .1, clearcoat: 1 }), Math.sin(a) * r * .87, B.top - r * .1, cz + Math.cos(a) * r * .99); }
    } else if (s.hat === 'headband') {
      const band = m(new THREE.TorusGeometry(r * .93, r * .09, 10, 48), new THREE.MeshStandardMaterial({ color: s.hatCol, roughness: .8 }), 0, B.top - r * .5, cz); band.rotation.x = Math.PI / 2 - .12; band.scale.set(1, 1.17, 1);
    } else if (s.hat === 'horns') {
      const hm = new THREE.MeshPhysicalMaterial({ color: s.hatCol, roughness: .35, clearcoat: .6 });
      for (const sx of [-1, 1]) { const c = m(new THREE.ConeGeometry(r * .14, r * .6, 16), hm, sx * r * .45, B.top - r * .05, cz + r * .45); c.rotation.set(-.3, 0, -sx * .45); }
    } else if (s.hat === 'antenna') {
      const glow = new THREE.MeshStandardMaterial({ color: s.eyeGlow ?? 0xff2020, emissive: s.eyeGlow ?? 0xff2020, emissiveIntensity: 2 });
      for (const sx of [-1, 1]) { m(new THREE.CylinderGeometry(r * .03, r * .03, r * .7, 8), metal, sx * r * .35, B.top + r * .25, cz); m(new THREE.SphereGeometry(r * .09, 12, 8), glow, sx * r * .35, B.top + r * .62, cz); }
    } else if (s.hat === 'cap') {
      const cm = new THREE.MeshStandardMaterial({ color: s.hatCol, roughness: .8 }); cap(cm);
      const brim = m(new THREE.CylinderGeometry(r * .7, r * .7, r * .05, 30, 1, false, -Math.PI / 2, Math.PI), cm, 0, cy + r * .02, cz + r * .9); brim.scale.z = 1.1;
    }
  }

  // pose: see choreo.js
  apply(P, look) {
    const s = this.sp;
    this.pelvis.position.copy(P.pelvis);
    this.pelvis.rotation.set(P.pelvisRot[0], P.pelvisRot[1], P.pelvisRot[2], 'YXZ');
    this.spine.rotation.set(P.spineRot[0] * .5, P.spineRot[1] * .5, P.spineRot[2] * .5, 'YXZ');
    this.chest.rotation.set(P.spineRot[0] * .5, P.spineRot[1] * .5, P.spineRot[2] * .5, 'YXZ');
    this.neck.rotation.set(P.headRot[0] * .4, P.headRot[1] * .4, P.headRot[2] * .4, 'YXZ');
    this.head.rotation.set(P.headRot[0] * .6, P.headRot[1] * .6, P.headRot[2] * .6, 'YXZ');
    const blink = P.blink ?? 0;
    this.group.updateMatrixWorld(true);
    this.rh.update(Math.min(.42, (P.jaw ?? 0) * .75), Math.min(1, P.anger ?? .3), 1 - blink, look);
    const toLocal = (o) => this.group.worldToLocal(o.getWorldPosition(V()));
    const SL = toLocal(this.shoulderL), SR = toLocal(this.shoulderR);
    const hipL = this.pelvis.localToWorld(V(s.hipW, -.05, 0)); const hipR = this.pelvis.localToWorld(V(-s.hipW, -.05, 0));
    const HL = this.group.worldToLocal(hipL), HR = this.group.worldToLocal(hipR);
    const arm = (S, T, pole, ua, fa, el, gl, twist) => {
      const [E, W] = ik2(S, T, s.up, s.fore, pole);
      placeSeg(ua, S, E); placeSeg(fa, E, W); el.position.copy(E);
      const z = W.clone().sub(E).normalize();
      const x = V().crossVectors(pole.clone().add(V(0, twist, 0)), z).normalize();
      const y = V().crossVectors(z, x);
      gl.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      gl.position.copy(W).addScaledVector(z, .03);
      return W;
    };
    const tgt = (g, T, w) => { const G = this.group.worldToLocal(this.chest.localToWorld(g.clone())); return w ? G.lerp(T, w) : G; };
    this.handL = arm(SL, tgt(P.lGuard, P.lTarget, P.lW), P.lPole, this.uaL, this.faL, this.elL, this.glL, P.lTwist ?? 0);
    this.handR = arm(SR, tgt(P.rGuard, P.rTarget, P.rW), P.rPole, this.uaR, this.faR, this.elR, this.glR, P.rTwist ?? 0);
    const leg = (Hp, F, pole, th, sh, kn, ft, fyaw) => {
      const A = F.clone().add(V(0, .085, 0));
      const [K, A2] = ik2(Hp, A, s.thigh, s.shin, pole);
      placeSeg(th, Hp, K); placeSeg(sh, K, A2); kn.position.copy(K);
      ft.position.copy(A2); ft.rotation.set(0, fyaw, 0);
    };
    leg(HL, P.lFoot, P.lKnee, this.thL, this.shL, this.knL, this.ftL, P.lFootYaw ?? 0);
    leg(HR, P.rFoot, P.rKnee, this.thR, this.shR, this.knR, this.ftR, P.rFootYaw ?? 0);
  }
  headWorld() { return this.head.getWorldPosition(V()); }
}
