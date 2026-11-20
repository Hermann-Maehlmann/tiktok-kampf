// Realistic heads built from the Lee Perry-Smith scan (CC BY 3.0, Infinite-Realities),
// with cut-open eyes/mouth, jaw rig, procedural hair, and an erectus morph.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fbm3 } from './fighter.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const LPS = { scale: .05, center: [0, 1.75, .2] };
export const EYE = { x: .61, y: 1.65, ax: .32, ay: .125 };
export const MOUTH = { y: .45, ax: .52, ay: .1 };
const HINGE = new THREE.Vector3(0, 1.15, .25);

let BASE = null, TEX = null;
export async function loadHeadAssets() {
  const g = await new GLTFLoader().loadAsync('/models/LeePerrySmith.glb');
  const m = g.scene.getObjectByName('LeePerrySmith');
  const geo = m.geometry;
  // crop away the bust below the neck
  const P = geo.attributes.position, I = geo.index.array, keep = [];
  for (let i = 0; i < I.length; i += 3) {
    const ok = [I[i], I[i + 1], I[i + 2]].every(k => P.getY(k) > -1.6);
    if (ok) keep.push(I[i], I[i + 1], I[i + 2]);
  }
  geo.setIndex(keep); geo.translate(.1, 0, 0);
  BASE = geo;
  const tl = new THREE.TextureLoader();
  const col = await tl.loadAsync('/models/Map-COL.jpg'); col.colorSpace = THREE.SRGBColorSpace; col.anisotropy = 8;
  const nm = await tl.loadAsync('/models/Infinite-Level_02_Tangent_SmoothUV.jpg');
  const sp = await tl.loadAsync('/models/Map-SPEC.jpg');
  TEX = { col, nm, sp };
}

function erectusMorph(v, amt = 1) {
  const x0 = v.x, y0 = v.y, z0 = v.z;
  let { x, y, z } = v;
  // receding forehead + low long cranium
  if (y > 2.2) z -= (y - 2.2) * .5 * ss(-.5, 1.5, z);
  if (y > 1.9) y = 1.9 + (y - 1.9) * .8;
  if (z < 0) z *= 1.14;
  if (z < -.9) z -= .18 * ss(1.0, 2.2, y) * ss(3.4, 2.4, y);           // occipital bun
  // heavy brow ridge
  const br = Math.exp(-Math.pow((y - 2.12) / .26, 2)) * ss(1.1, 1.9, z) * ss(1.6, 1.0, Math.abs(x));
  z += .26 * br; y += .03 * br;
  // prognathic midface / mouth
  const pg = ss(1.45, .6, y) * ss(-.9, .1, y) * ss(.6, 1.9, z);
  z += .45 * pg;
  // no chin
  z -= .3 * ss(-.05, -.6, y) * ss(1.0, 2.1, z);
  // broad flat nose
  const nz = ss(.55, .8, y) * ss(1.75, 1.5, y) * ss(1.7, 2.1, z) * ss(.8, .3, Math.abs(x));
  x *= 1 + .38 * nz; z -= .1 * nz;
  // wider, heavier face
  x *= 1.05 + .05 * ss(2.0, .8, y);
  v.set(x0 + (x - x0) * amt, y0 + (y - y0) * amt, z0 + (z - z0) * amt);
}

function scalpMask(x, y, z, sp) {
  if (sp === 'mohawk') return ss(2.6, 2.9, y) * ss(.32, .18, Math.abs(x));
  if (sp === 'wild' || sp === 'long') {
    const front = ss(2.2, 2.45, y - .15 * ss(1.0, 2.0, z));
    const back = ss(.7, .4, z) * ss(1.0, 1.3, y);
    const ear = ss(1.35, 1.5, Math.abs(x)) * ss(2.35, 2.2, y) * ss(.8, 1.0, y) * ss(-.7, -.5, z) * ss(1.0, .8, z);
    return Math.max(front, back) * (1 - ear);
  }
  const front = ss(2.82, 3.0, y + .25 * ss(1.4, .6, z));
  const sides = ss(.75, .45, z) * ss(1.5, 1.75, y);
  const ear = ss(1.3, 1.45, Math.abs(x)) * ss(2.5, 2.3, y) * ss(-.8, -.6, z) * ss(1.1, .9, z);
  return Math.max(front, sides) * (1 - ear);
}
function beardMask(x, y, z) {
  const lips = ss(.7, .55, Math.abs(x)) * ss(.3, .2, Math.abs(y - MOUTH.y)) * ss(1.5, 1.7, z);
  const nose = ss(.85, 1.0, y) * ss(.55, .4, Math.abs(x));
  return ss(1.25, 1.0, y) * ss(-1.3, -1.0, y) * ss(-.2, .1, z) * (1 - lips) * (1 - nose);
}
function hairTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const im = g.createImageData(512, 512);
  for (let i = 0; i < 512 * 512; i++) { const x = i % 512, y = (i / 512) | 0; const v = 128 + (Math.random() - .5) * 160 + fbm3(x / 3, y / 18, 2) * 60; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
}
function eyeTex(iris) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#ece4da'; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(170,40,40,.25)'; g.lineWidth = 1.2; g.beginPath(); let x = 256 + (Math.random() - .5) * 400, y = 256 + (Math.random() - .5) * 300; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (256 - x) * .12 + (Math.random() - .5) * 20; y += (256 - y) * .12 + (Math.random() - .5) * 20; g.lineTo(x, y); } g.stroke(); }
  const cx = 256, cy = 256, R = 78;
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
  gr.addColorStop(0, '#000'); gr.addColorStop(.32, '#000'); gr.addColorStop(.36, iris[0]); gr.addColorStop(.8, iris[1]); gr.addColorStop(.95, '#140a05'); gr.addColorStop(1, 'rgba(20,10,5,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, R, R, 0, 0, 6.28); g.fill();
  for (let i = 0; i < 120; i++) { const a = Math.random() * 6.28; g.strokeStyle = `rgba(255,220,170,${Math.random() * .15})`; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * .38, cy + Math.sin(a) * R * .38); g.lineTo(cx + Math.cos(a) * R * .9, cy + Math.sin(a) * R * .9); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class RealHead {
  constructor(s) {
    const M = s.morph || 0, E = M > .5; this.E = E;
    const geo = BASE.clone(); const P = geo.attributes.position, n = P.count;
    const aEye = new Float32Array(n), aMouth = new Float32Array(n), wJaw = new Float32Array(n), wBrow = new Float32Array(n);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i);
      let e = 0;
      for (const sx of [-1, 1]) { const r = Math.hypot((v.x - sx * EYE.x) / EYE.ax, (v.y - EYE.y) / EYE.ay); if (v.z > 1.3) e = Math.max(e, 1 - r); }
      aEye[i] = e;
      const rm = Math.hypot(v.x / MOUTH.ax, (v.y - MOUTH.y) / MOUTH.ay); aMouth[i] = v.z > 1.7 ? 1 - rm : -1;
      // jaw weight: below the lip seam, fading towards the back of the head and down the neck
      let wj = ss(MOUTH.y + .02, MOUTH.y - .2, v.y) * ss(-.4, .9, v.z) * ss(-1.2, -.6, v.y + .25 * (v.z - 1.2));
      wj = Math.max(wj, ss(MOUTH.y + .02, MOUTH.y - .06, v.y) * ss(1.6, 2.1, v.z) * ss(.6, .3, Math.abs(v.x)));
      wJaw[i] = wj;
      for (const sx of [-1, 1]) wBrow[i] = Math.max(wBrow[i], Math.exp(-Math.pow((v.x - sx * .5) / .38, 2) - Math.pow((v.y - 2.12) / .2, 2)) * ss(1.5, 2.0, v.z));
      if (M > 0) { erectusMorph(v, M); P.setXYZ(i, v.x, v.y, v.z); }
    }
    geo.setAttribute('aEye', new THREE.BufferAttribute(aEye, 1));
    geo.setAttribute('aMouth', new THREE.BufferAttribute(aMouth, 1));
    geo.computeVertexNormals();
    this.base = Float32Array.from(P.array); this.wJaw = wJaw; this.wBrow = wBrow; this.geo = geo;

    const tint = new THREE.Color(...s.headTint);
    const mat = new THREE.MeshPhysicalMaterial({ map: TEX.col, normalMap: TEX.nm, color: tint, roughness: s.metal ? .3 : .52, metalness: s.metal ? .8 : 0, specularIntensityMap: TEX.sp, specularIntensity: .9, clearcoat: .25, clearcoatRoughness: .4, sheen: .25, sheenColor: new THREE.Color(.7, .25, .15) });
    this.uni = { uEye: { value: .3 }, uMouth: { value: 2 } };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uEye = this.uni.uEye; sh.uniforms.uMouth = this.uni.uMouth;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aEye; attribute float aMouth; varying float vEye; varying float vMouth;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEye=aEye; vMouth=aMouth;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uEye; uniform float uMouth; varying float vEye; varying float vMouth;')
        .replace('void main() {', 'void main() {\n if (vEye > uEye || vMouth > uMouth) discard;');
    };
    mat.side = THREE.DoubleSide;
    this.mat = mat;
    this.group = new THREE.Group();
    const ls = LPS.scale;
    this.inner = new THREE.Group(); this.inner.scale.setScalar(ls); this.inner.position.set(0, -LPS.center[1] * ls + .012, -LPS.center[2] * ls);
    this.group.add(this.inner);
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.castShadow = this.mesh.receiveShadow = true; this.inner.add(this.mesh);
    { // bounds of the cranium (above eye level) in head-group coordinates
      const Pp = geo.attributes.position, ip = this.inner.position; let top = -9, xmax = 0, zmin = 9, zmax = -9;
      for (let i = 0; i < Pp.count; i++) { const y = Pp.getY(i); if (y < EYE.y + .2) continue; top = Math.max(top, y); xmax = Math.max(xmax, Math.abs(Pp.getX(i))); zmin = Math.min(zmin, Pp.getZ(i)); zmax = Math.max(zmax, Pp.getZ(i)); }
      this.bounds = { top: top * ls + ip.y, halfW: xmax * ls, cz: (zmin + zmax) / 2 * ls + ip.z, front: zmax * ls + ip.z };
    }

    // eyes: find lid surface depth
    const lidZ = (sx) => { let zmax = -9; for (let i = 0; i < n; i++) { const x = this.base[i * 3], y = this.base[i * 3 + 1], z = this.base[i * 3 + 2]; if (Math.abs(x - sx * EYE.x) < .1 && Math.abs(y - EYE.y) < .05) zmax = Math.max(zmax, z); } return zmax; };
    const eyeMat = new THREE.MeshPhysicalMaterial({ map: eyeTex(s.iris), emissive: s.eyeGlow ?? 0x000000, emissiveIntensity: s.eyeGlow ? 1.6 : 0, roughness: .05, clearcoat: 1, clearcoatRoughness: .02 });
    this.eyes = [-1, 1].map(sx => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.22, 32, 24), eyeMat);
      const w = new THREE.Group(); w.add(e); w.position.set(sx * EYE.x, EYE.y + .02, lidZ(sx) - .25); this.inner.add(w); return w;
    });
    // mouth cavity + teeth
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a0505, roughness: .8 });
    const cav = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), dark); cav.scale.set(.55, .5, .55);
    const mz = (() => { let zmax = -9; for (let i = 0; i < n; i++) { const x = this.base[i * 3], y = this.base[i * 3 + 1], z = this.base[i * 3 + 2]; if (Math.abs(x) < .1 && Math.abs(y - MOUTH.y) < .08) zmax = Math.max(zmax, z); } return zmax; })();
    cav.position.set(0, MOUTH.y - .15, mz - .65); this.inner.add(cav);
    const toothMat = new THREE.MeshPhysicalMaterial({ color: E ? 0xd9c79a : 0xf0ece2, roughness: .25, clearcoat: .6 });
    const teeth = (up) => { const g = new THREE.Group(); for (let k = -4; k <= 4; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(.1, .14, .08), toothMat); const a = k * .16; t.position.set(Math.sin(a) * .5, up ? .06 : -.06, Math.cos(a) * .5 - .5); t.rotation.y = a; g.add(t); } g.position.set(0, MOUTH.y, mz - .14); return g; };
    this.upperTeeth = teeth(true); this.inner.add(this.upperTeeth);
    this.lowerTeeth = teeth(false); this.inner.add(this.lowerTeeth);
    { this.guard = new THREE.Mesh(new THREE.BoxGeometry(.7, .1, .14), new THREE.MeshPhysicalMaterial({ color: s.guardCol, roughness: .15, clearcoat: 1 })); this.guard.position.set(0, MOUTH.y + .02, mz - .3); this.inner.add(this.guard); }

    // hair + beard as offset shells
    const hairMat = new THREE.MeshStandardMaterial({ color: s.hairCol, roughness: .85, bumpMap: hairTex(), bumpScale: 4, side: THREE.DoubleSide });
    const H = s.hair;
    const thick = H === 'wild' ? (x, y, z) => .14 + .12 * (fbm3(x * 2, y * 2, z * 2) + .5) : H === 'long' ? (x, y, z) => .12 + .1 * (fbm3(x * 2, y * 2, z * 2) + .5) + .35 * ss(1.8, .6, y) * ss(.5, -1, z) : H === 'mohawk' ? (x, y, z) => .1 + .5 * ss(2.6, 3.4, y) : (x, y, z) => .05 + .17 * ss(2.9, 3.8, y) * ss(-1, .8, z) + .03 * fbm3(x * 4, y * 4, z * 4);
    if (H && H !== 'bald') this.hair = this.shell(geo, (x, y, z) => scalpMask(x, y, z, H), thick, hairMat);
    if (s.beard) this.beard = this.shell(geo, beardMask, (x, y, z) => .1 + .1 * (fbm3(x * 3, y * 3, z * 3) + .5) * ss(1.15, .6, y), hairMat, true);
    this.jawAngle = 0; this.browAmt = 0;
    this.update(0, 0);
  }
  shell(geo, mask, thick, mat, jaw) {
    const P = geo.attributes.position, N = geo.attributes.normal, I = geo.index.array, n = P.count;
    const m = new Float32Array(n);
    for (let i = 0; i < n; i++) m[i] = mask(this.base[i * 3], this.base[i * 3 + 1], this.base[i * 3 + 2]);
    const idx = []; for (let i = 0; i < I.length; i += 3) if (m[I[i]] > .02 || m[I[i + 1]] > .02 || m[I[i + 2]] > .02) idx.push(I[i], I[i + 1], I[i + 2]);
    const g = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3), off = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = this.base[i * 3], y = this.base[i * 3 + 1], z = this.base[i * 3 + 2]; off[i] = thick(x, y, z) * (.35 + .65 * m[i]); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', geo.attributes.uv); g.setAttribute('aMask', new THREE.BufferAttribute(m, 1)); g.setIndex(idx);
    mat = mat.clone();
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aMask; varying float vMask; varying vec2 vU;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask=aMask; vU=uv;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vMask; varying vec2 vU;').replace('void main() {', 'void main() {\n float hn=fract(sin(dot(floor(vU*vec2(900.,300.)),vec2(12.9898,78.233)))*43758.5453); if (vMask < .3 + hn*.45) discard;');
    };
    const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; this.inner.add(mesh);
    return { mesh, off, jaw };
  }
  // jaw: radians open, brow: anger 0..1, eye: 1 open / 0 closed
  update(jaw, brow, eyeOpen = 1, look) {
    const P = this.geo.attributes.position, n = P.count;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), jaw);
    const v = new THREE.Vector3(), v2 = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set(this.base[i * 3], this.base[i * 3 + 1], this.base[i * 3 + 2]);
      const w = this.wJaw[i];
      if (w > 0 && jaw !== 0) { v2.copy(v).sub(HINGE).applyQuaternion(new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), q, w)).add(HINGE); v.copy(v2); }
      const b = this.wBrow[i] * brow; if (b > 0) { v.y -= .12 * b; v.z += .03 * b; v.x *= 1 - .05 * b; }
      P.setXYZ(i, v.x, v.y, v.z);
    }
    P.needsUpdate = true; this.geo.computeVertexNormals();
    const N = this.geo.attributes.normal;
    for (const sh of [this.hair, this.beard, this.stubble]) {
      if (!sh) continue; const sp = sh.mesh.geometry.attributes.position;
      for (let i = 0; i < n; i++) { sp.setXYZ(i, P.getX(i) + N.getX(i) * sh.off[i], P.getY(i) + N.getY(i) * sh.off[i], P.getZ(i) + N.getZ(i) * sh.off[i]); }
      sp.needsUpdate = true; sh.mesh.geometry.computeVertexNormals();
    }
    this.lowerTeeth.position.copy(this.upperTeeth.position).sub(HINGE).applyQuaternion(q).add(HINGE); this.lowerTeeth.rotation.x = jaw;
    // openings: mouth opens with jaw; eyes open unless blinking/KO
    this.uni.uMouth.value = jaw > .03 ? .05 + .02 / Math.max(.03, jaw) * 0 : 2;
    this.uni.uMouth.value = jaw > .03 ? Math.max(-.2, .35 - jaw * 2.5) : 2;
    this.uni.uEye.value = eyeOpen > .5 ? lerpE(.6, .3, eyeOpen) : 2;
    this.eyes.forEach(e => e.visible = true);
    if (look) this.eyes.forEach(e => e.lookAt(look));
  }
}
function lerpE(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, (t - .5) * 2)); }
