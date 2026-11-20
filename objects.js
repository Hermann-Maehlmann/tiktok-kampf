// Cartoon "object" fighters: the torso + head are replaced by an object (toaster, fridge, ...)
// with a googly face; arms, legs, gloves and boots stay from the normal rig.
// All coordinates are relative to the fighter's chest group (+z = front, +y = up).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
function mesh(geo, mat, parent, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// every builder returns { face: {y, z, s}, shoulder: {y, x}, top } (face = where the eyes sit, s = face scale)
const BUILD = {
  toaster(g) {
    const chrome = phys({ color: 0xd8dde4, metalness: .7, roughness: .22, clearcoat: 1 });
    mesh(new RoundedBoxGeometry(.52, .6, .34, 6, .09), phys({ color: 0x8fd3c1, roughness: .3, clearcoat: 1 }), g, 0, .1, 0);
    mesh(new THREE.BoxGeometry(.53, .03, .35), chrome, g, 0, .32, 0);
    const black = phys({ color: 0x151515, roughness: .5 });
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(.06, .02, .26), black, g, sx * .1, .405, 0);
    const toast = phys({ color: 0xc98a3c, roughness: .85 }), crust = phys({ color: 0x7a4a1c, roughness: .9 });
    for (const sx of [-1, 1]) { const t = mesh(new RoundedBoxGeometry(.04, .2, .22, 3, .015), toast, g, sx * .1, .45, 0); mesh(new RoundedBoxGeometry(.045, .05, .232, 3, .015), crust, t, 0, .085, 0); }
    mesh(new THREE.BoxGeometry(.05, .03, .08), black, g, .29, .2, 0);       // lever
    mesh(new THREE.CylinderGeometry(.025, .025, .03, 16), black, g, -.27, .0, .08).rotation.z = Math.PI / 2; // knob
    mesh(new THREE.BoxGeometry(.5, .04, .32), black, g, 0, -.2, 0);        // base
    return { face: { y: .2, z: .171, s: 1 }, shoulder: { y: .08, x: .3 }, top: .55 };
  },
  fridge(g) {
    const white = phys({ color: 0xf2f2ee, roughness: .25, clearcoat: .8 });
    mesh(new RoundedBoxGeometry(.56, 1.05, .5, 6, .05), white, g, 0, -.02, 0);
    const grey = phys({ color: 0x9aa0a6, metalness: .8, roughness: .3 });
    mesh(new THREE.BoxGeometry(.56, .012, .505), phys({ color: 0x777777 }), g, 0, .12, 0);
    for (const y of [.22, -.1]) mesh(new THREE.CylinderGeometry(.012, .012, y > 0 ? .14 : .3, 10), grey, g, .22, y + (y > 0 ? .06 : -.08), .27);
    // magnets
    const mag = (c, x, y) => mesh(new THREE.CylinderGeometry(.025, .025, .012, 14), phys({ color: c, roughness: .3, clearcoat: 1 }), g, x, y, .255).rotation.x = Math.PI / 2;
    mag(0xe0302a, -.18, -.05); mag(0x2a6ee0, -.1, -.18); mag(0xf2c21b, -.2, -.25);
    return { face: { y: .3, z: .25, s: 1.1 }, shoulder: { y: .05, x: .3 }, top: .5 };
  },
  cone(g) {
    const map = tex(64, 512, (c, w, h) => { c.fillStyle = '#ff5a0a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f4f4'; c.fillRect(0, h * .3, w, h * .1); c.fillRect(0, h * .55, w, h * .1); });
    const P = []; for (let i = 0; i <= 20; i++) { const t = i / 20; P.push(new THREE.Vector2(.31 - .25 * t + (t > .97 ? -.06 * (t - .97) / .03 : 0), -.42 + .92 * t)); }
    const geo = new THREE.LatheGeometry(P, 48);
    mesh(geo, phys({ map, roughness: .35, clearcoat: .6 }), g);
    mesh(new RoundedBoxGeometry(.72, .06, .72, 3, .02), phys({ color: 0x1b1b1b, roughness: .8 }), g, 0, -.45, 0);
    return { face: { y: .22, z: .135, s: .8 }, shoulder: { y: .0, x: .27 }, top: .5 };
  },
  trashcan(g) {
    const metal = phys({ color: 0xc4c8ce, metalness: .45, roughness: .35, clearcoat: .5 });
    const P = []; for (let i = 0; i <= 40; i++) { const t = i / 40; P.push(new THREE.Vector2(.25 + .03 * t + .006 * Math.cos(t * 40 * Math.PI), -.45 + .8 * t)); }
    mesh(new THREE.LatheGeometry(P, 48), metal, g);
    mesh(new THREE.SphereGeometry(.3, 40, 12, 0, Math.PI * 2, 0, Math.PI * .32), metal, g, 0, .19, 0);
    mesh(new THREE.TorusGeometry(.06, .012, 8, 20, Math.PI), metal, g, 0, .35, 0);
    // banana peel hanging out
    const peel = mesh(new THREE.CapsuleGeometry(.025, .12, 4, 8), phys({ color: 0xf2d43a, roughness: .6 }), g, .2, .32, .12); peel.rotation.z = -.8;
    return { face: { y: .1, z: .275, s: 1 }, shoulder: { y: .05, x: .3 }, top: .38 };
  },
  washer(g) {
    const white = phys({ color: 0xf4f4f2, roughness: .3, clearcoat: .8 });
    mesh(new RoundedBoxGeometry(.58, .82, .52, 6, .05), white, g, 0, -.08, 0);
    const ring = mesh(new THREE.TorusGeometry(.17, .03, 12, 40), phys({ color: 0xbfc4c9, metalness: .9, roughness: .25 }), g, 0, -.15, .265);
    const glass = mesh(new THREE.CircleGeometry(.16, 40), phys({ color: 0x5aa0d8, roughness: .05, transmission: 0, clearcoat: 1, metalness: .2 }), g, 0, -.15, .262);
    // socks in the drum
    mesh(new THREE.CapsuleGeometry(.03, .08, 4, 8), phys({ color: 0xe0405a }), g, -.04, -.2, .25).rotation.z = 1;
    mesh(new THREE.BoxGeometry(.56, .005, .005), phys({ color: 0x999999 }), g, 0, .15, .262);
    mesh(new THREE.CylinderGeometry(.03, .03, .02, 16), phys({ color: 0x333333 }), g, .2, .23, .265).rotation.x = Math.PI / 2;
    return { face: { y: .26, z: .262, s: .85 }, shoulder: { y: .05, x: .31 }, top: .33 };
  },
  cactus(g) {
    const green = phys({ color: 0x3f8f3a, roughness: .6, clearcoat: .2 });
    const P = []; for (let i = 0; i <= 30; i++) { const t = i / 30, y = -.45 + .95 * t; P.push(new THREE.Vector2(.2 * Math.sqrt(Math.max(0, 1 - Math.pow((t - .5) * 1.9, 8))) + .0001, y)); }
    const geo = new THREE.LatheGeometry(P, 64), A = geo.attributes.position;
    for (let i = 0; i < A.count; i++) { const x = A.getX(i), z = A.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z), k = 1 + .06 * Math.cos(a * 10); A.setX(i, Math.cos(a) * r * k); A.setZ(i, Math.sin(a) * r * k); }
    geo.computeVertexNormals(); mesh(geo, green, g);
    const spine = phys({ color: 0xf0ead2, roughness: .4 });
    for (let i = 0; i < 70; i++) { const a = (i % 10) / 10 * Math.PI * 2, y = -.35 + Math.floor(i / 10) * .12; if (Math.abs(a - Math.PI / 2) < .5 && y > .05) continue; const s = mesh(new THREE.ConeGeometry(.006, .05, 4), spine, g, Math.cos(a) * .215, y, Math.sin(a) * .215); s.lookAt(Math.cos(a) * 2, y, Math.sin(a) * 2); s.rotateX(Math.PI / 2); }
    const fl = phys({ color: 0xff4fa0, roughness: .5 }); for (let k = 0; k < 6; k++) { const p = mesh(new THREE.SphereGeometry(.035, 10, 8), fl, g, Math.cos(k) * .04, .5, Math.sin(k) * .04); p.scale.set(1, .5, 1); }
    return { face: { y: .25, z: .2, s: .85 }, shoulder: { y: .02, x: .25 }, top: .52 };
  },
  burger(g) {
    const bun = phys({ color: 0xd08a3a, roughness: .55, clearcoat: .4 });
    mesh(new THREE.SphereGeometry(.34, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), bun, g, 0, .12, 0).scale.y = .9;
    const seed = phys({ color: 0xfbf0d0 }); for (let i = 0; i < 40; i++) { const a = i * 2.4, r = .08 + (i % 7) * .035, y = Math.sqrt(Math.max(0, .34 * .34 - r * r)) * .9; mesh(new THREE.SphereGeometry(.008, 6, 4), seed, g, Math.cos(a) * r, .12 + y, Math.sin(a) * r).scale.set(1.8, .6, 1); }
    mesh(new THREE.CylinderGeometry(.36, .36, .03, 40), phys({ color: 0x4caf3a, roughness: .7 }), g, 0, .1, 0);            // lettuce
    mesh(new THREE.BoxGeometry(.6, .02, .6), phys({ color: 0xffc21a, roughness: .4 }), g, 0, .075, 0).rotation.y = .3;      // cheese
    mesh(new THREE.CylinderGeometry(.35, .35, .12, 40), phys({ color: 0x5a2f18, roughness: .9 }), g, 0, .01, 0);           // patty
    mesh(new THREE.CylinderGeometry(.35, .31, .16, 40), bun, g, 0, -.13, 0);                                                // bottom bun
    return { face: { y: .26, z: .3, s: 1 }, shoulder: { y: .0, x: .34 }, top: .43 };
  },
};
export const OBJECTS = Object.keys(BUILD);

export class ObjectFace {
  constructor(s, chest) {
    const g = new THREE.Group(); chest.add(g); this.group = g;
    const info = (BUILD[s.object] || BUILD.toaster)(g); this.info = info;
    const f = info.face, k = f.s;
    const face = new THREE.Group(); face.position.set(0, f.y, f.z); g.add(face); this.face = face;
    const white = phys({ color: 0xffffff, roughness: .1, clearcoat: 1 }), black = phys({ color: 0x0a0a0a, roughness: .2, clearcoat: 1 });
    const glow = s.eyeGlow ? new THREE.MeshStandardMaterial({ color: s.eyeGlow, emissive: s.eyeGlow, emissiveIntensity: 1.5 }) : black;
    this.eyes = [-1, 1].map(sx => {
      const e = new THREE.Group(); e.position.set(sx * .075 * k, 0, .0); face.add(e);
      const ball = mesh(new THREE.SphereGeometry(.058 * k, 24, 16), white, e); ball.scale.z = .7;
      const pivot = new THREE.Group(); e.add(pivot);
      mesh(new THREE.SphereGeometry(.026 * k, 16, 12), glow, pivot, 0, 0, .036 * k);
      return { e, pivot };
    });
    this.brows = [-1, 1].map(sx => { const b = mesh(new THREE.CapsuleGeometry(.012 * k, .06 * k, 4, 8), black, face, sx * .075 * k, .075 * k, .02); b.rotation.z = Math.PI / 2; return { b, sx }; });
    const mouth = new THREE.Group(); mouth.position.set(0, -.11 * k, .004); face.add(mouth); this.mouth = mouth;
    const md = mesh(new THREE.CircleGeometry(.06 * k, 32), phys({ color: 0x2a0505, roughness: .6, side: THREE.DoubleSide }), mouth); md.scale.y = .35; this.md = md;
    this.teeth = mesh(new THREE.BoxGeometry(.07 * k, .014 * k, .004), white, mouth, 0, .012 * k, .002);
    this.guard = mesh(new THREE.BoxGeometry(.06 * k, .012 * k, .004), phys({ color: s.guardCol, roughness: .2, clearcoat: 1 }), mouth, 0, -.004, .003);
    this.bounds = null;
  }
  update(jaw, brow, eyeOpen = 1, look) {
    const o = Math.min(1, jaw * 3);
    this.md.scale.y = .3 + o * 1.1; this.md.scale.x = 1 + o * .15; this.teeth.position.y = (.012 + o * .045) * this.info.face.s;
    for (const { e, pivot } of this.eyes) { e.scale.y = Math.max(.08, eyeOpen); if (look) { const lp = e.worldToLocal(look.clone()); lp.z = Math.max(lp.z, .2); pivot.lookAt(pivot.localToWorld(lp.normalize())); } }
    for (const { b, sx } of this.brows) { b.rotation.z = Math.PI / 2 + sx * brow * .5; b.position.y = (.075 - brow * .012) * this.info.face.s; }
  }
}
