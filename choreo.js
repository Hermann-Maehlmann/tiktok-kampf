import * as THREE from 'three';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
const imp = (t, t0, tau) => { const x = (t - t0) / tau; return x <= 0 ? 0 : x * Math.exp(1 - x); };
const easeIn = x => x * x * x;
function hsh(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
const n1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hsh(i), hsh(i + 1), u) * 2 - 1; };

// keyframe track [[t, value], ...] smooth
function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return lerp(v0, v1, ss(t0, t1, t)); }
  return keys[keys.length - 1][1];
}

// ---------------- timeline (video time v -> action time a) ----------------
export const WARP = [[0, 0], [4.8, 2.5], [4.8, .3], [8.6, 3.0], [8.6, 2.9], [11.4, 4.1], [11.4, 4.0], [15.0, 5.6], [15.0, 1.4], [19.0, 5.4], [19.0, 5.5], [23.4, 8.0], [25.2, 9.4], [28.4, 12.6],
  [28.65, 12.8], [30.2, 13.0], [30.7, 13.3], [31.8, 14.4], [35.8, 16.9], [37.3, 17.25], [37.6, 17.45], [38.7, 18.55], [39.4, 18.78], [42.0, 19.02], [42.7, 19.35], [44.7, 20.33], [45.4, 21.0], [59.0, 34.6]];
export function warp(v) {
  for (let i = 1; i < WARP.length; i++) if (v <= WARP[i][0] && WARP[i][0] > WARP[i - 1][0]) { const [v0, a0] = WARP[i - 1], [v1, a1] = WARP[i]; return a0 + (a1 - a0) * (v - v0) / (v1 - v0); }
  const L = WARP[WARP.length - 1]; return L[1] + (v - L[0]);
}
export function speed(v) { const d = (warp(v + .03) - warp(v)) / .03; return d < 0 || d > 2 ? 1 : d; }
// v4: after the v3 timeline (ends 58.4) comes a slow-motion replay of the knockout and an end card
export const REPLAY = { v0: 58.4, cut: 62.2, v1: 65.2 };
export const ENDCARD = { v0: 65.2 };
export const DURATION = 68.5;
const RWARP = [[58.4, 18.25], [59.6, 18.7], [61.2, 18.95], [62.6, 19.6], [63.8, 20.35], [65.2, 21.2]];
export function actionTime(v) {
  if (v >= REPLAY.v0 && v < REPLAY.v1) { for (let i = 1; i < RWARP.length; i++) if (v <= RWARP[i][0]) { const [v0, a0] = RWARP[i - 1], [v1, a1] = RWARP[i]; return a0 + (a1 - a0) * (v - v0) / (v1 - v0); } }
  if (v >= ENDCARD.v0) return 27 + (v - ENDCARD.v0);
  return warp(v);
}
export function replayV(a) { for (let i = 1; i < RWARP.length; i++) if (a <= RWARP[i][1]) { const [v0, a0] = RWARP[i - 1], [v1, a1] = RWARP[i]; return v0 + (v1 - v0) * (a - a0) / (a1 - a0); } return null; }
// voice-over slots: start time in the video + max length (seconds)
export const VO_SLOTS = {
  l01: { t: .3, max: 4.4 }, l02: { t: 5.0, max: 9.9 }, l03: { t: 15.3, max: 8.0 }, l04: { t: 24.0, max: 5.2 }, l05: { t: 29.3, max: 4.3 },
  l06: { t: 33.7, max: 4.6 }, l08: { t: 42.9, max: 2.6 }, l10: { t: 48.3, max: 2.2 }, l11: { t: 50.6, max: 7.6 }, l12: { t: 58.5, max: 5.2 }, l13: { t: 65.5, max: 2.8 },
};

// ---------------- root paths (world) ----------------
// E faces +x, S faces -x. x positions:
const EX = [[0, -2.25], [8.2, -2.25], [9.3, -.58], [11.8, -.58], [12.3, -.48], [13.3, -.40], [14.9, -.5], [16.2, .9], [16.9, 1.25], [17.6, 1.25], [17.9, 1.4], [18.4, 1.45], [18.85, 1.45], [19.3, 1.25], [27, 1.25]];
const SX = [[0, 2.25], [8.2, 2.25], [9.3, .58], [11.8, .62], [12.3, .66], [12.85, .66], [13.25, 1.35], [13.8, 2.15], [14.2, 2.45], [16.3, 2.45], [16.9, 2.4], [17.3, 2.35], [17.6, 2.25], [18.4, 2.2], [19.5, 2.1], [21.2, 2.1], [23.4, 2.1]];
const SZ = [[0, 0], [13.25, 0], [13.8, -.15], [14.2, -.1], [17, 0], [17.4, .12], [18.4, .05], [21.2, 0], [23.4, -.2], [24.5, -.6], [27, -.7]];
const EZ = [[0, 0], [15, 0], [16.2, -.05], [27, -.05]];

// ---------------- events ----------------
// punches: attacker, hand, kind, t0 (start), th (hit), te (end), lands
export const PUNCHES = [
  { who: 'S', hand: 'L', kind: 'jab', t0: 9.6, th: 9.72, te: 9.95, lands: 'head', str: .35 },
  { who: 'S', hand: 'L', kind: 'jab', t0: 10.1, th: 10.22, te: 10.45, lands: 'head', str: .5 },
  { who: 'E', hand: 'L', kind: 'hook', t0: 11.15, th: 11.42, te: 11.8, lands: 'block', str: .4 },
  { who: 'S', hand: 'L', kind: 'jab', t0: 11.95, th: 12.07, te: 12.3, lands: 'miss', str: 0 },
  { who: 'E', hand: 'R', kind: 'overhand', t0: 12.45, th: 12.85, te: 13.5, lands: 'head', str: 1.3, blood: 1 },
  { who: 'E', hand: 'R', kind: 'hook', t0: 16.75, th: 17.12, te: 17.6, lands: 'miss', str: 0, big: 1 },
  { who: 'S', hand: 'L', kind: 'body', t0: 17.5, th: 17.66, te: 17.9, lands: 'body', str: .7 },
  { who: 'S', hand: 'L', kind: 'hook', t0: 17.85, th: 18.05, te: 18.35, lands: 'head', str: .8 },
  { who: 'S', hand: 'R', kind: 'uppercut', t0: 18.35, th: 18.86, te: 19.4, lands: 'head', str: 1.6, blood: 1.2, upper: 1 },
];
export const HITS = PUNCHES.filter(p => p.lands === 'head' || p.lands === 'body').map(p => ({ ...p, victim: p.who === 'E' ? 'S' : 'E' }));

const E_FALL = { t0: 19.25, tLand: 20.3 };

export function roots(a) {
  return {
    E: { x: track(EX, a), z: track(EZ, a) },
    S: { x: track(SX, a), z: track(SZ, a) },
  };
}

// ---------------- pose ----------------
function basePose(sp, a, seed) {
  const hipH = sp.thigh + sp.shin + .135;
  const bob = Math.sin(a * Math.PI * 2 * 1.55 + seed) * .018;
  const sway = Math.sin(a * Math.PI * 1.55 + seed) * .03;
  return {
    pelvis: V(sway * .5, hipH - .09 + bob, 0), pelvisRot: [0, -.5, 0], spineRot: [.16, .22, 0], headRot: [.12, .3, 0],
    jaw: .03, blink: 0, anger: sp.name === 'erectus' ? .8 : .35,
    lGuard: V(.04, .17, .3), rGuard: V(-.13, .23, .2), lTarget: V(), rTarget: V(), lW: 0, rW: 0,
    lPole: V(.55, -1, -.2).normalize(), rPole: V(-.55, -1, -.2).normalize(), lTwist: 0, rTwist: 0,
    lFoot: V(.16, 0, .26), rFoot: V(-.17, 0, -.3), lKnee: V(.35, 0, 1).normalize(), rKnee: V(-.2, 0, 1).normalize(), lFootYaw: -.3, rFootYaw: -.7,
    root: { yaw: 0, fall: 0, lift: 0 }
  };
}

// opponent point in my local frame
function toLocal(meX, meZ, meYaw, wx, wy, wz) {
  // my group: position (meX,0,meZ), rotation.y = meYaw
  const dx = wx - meX, dz = wz - meZ, c = Math.cos(-meYaw), s = Math.sin(-meYaw);
  return V(dx * c + dz * s, wy, -dx * s + dz * c);
}

export function pose(who, a, sp, opSp, R, extra = {}) {
  const me = R[who], op = R[who === 'E' ? 'S' : 'E'];
  const myYaw = who === 'E' ? Math.PI / 2 : -Math.PI / 2;
  const P = basePose(sp, a, who === 'E' ? 0 : 2.1);
  const opHeadH = opSp.thigh + opSp.shin + .135 - .09 + opSp.spine + .2 + opSp.neck + .1 - .02;
  const opHead = toLocal(me.x, me.z, myYaw, op.x, opHeadH, op.z);
  const opBody = toLocal(me.x, me.z, myYaw, op.x, opHeadH - .55, op.z);
  P.blink = (a * 1.7 + (who === 'E' ? .3 : 0)) % 3.1 < .12 ? 1 : 0;

  // walking: knees + foot lift when moving
  const vx = (track(who === 'E' ? EX : SX, a + .05) - track(who === 'E' ? EX : SX, a - .05)) / .1;
  const mv = clamp(Math.abs(vx) / 1.2);
  if (mv > .01) { const ph = a * Math.PI * 2 * 2.6; P.lFoot.y += Math.max(0, Math.sin(ph)) * .08 * mv; P.rFoot.y += Math.max(0, -Math.sin(ph)) * .08 * mv; P.lFoot.z += Math.sin(ph) * .12 * mv; P.rFoot.z -= Math.sin(ph) * .12 * mv; P.pelvis.y += Math.abs(Math.cos(ph)) * .02 * mv; }

  // ---- pre-fight character moments ----
  { const pre = 1 - ss(7.9, 8.6, a); P.lGuard.y -= .15 * pre; P.rGuard.y -= .2 * pre; P.lGuard.z -= .04 * pre; }
  if (who === 'E') {
    // intro: glove pounds + roar (a 3.0 - 5.6)
    const k = ss(2.9, 3.2, a) * (1 - ss(5.4, 5.8, a));
    if (k > 0) {
      const pound = Math.abs(Math.sin((a - 3.0) * Math.PI * 2.2));
      P.lGuard.lerp(V(-.02, .1 + pound * .06, .3), k); P.rGuard.lerp(V(-.12, .1 + pound * .06, .3), k);
      P.lGuard.x += (1 - pound) * .02 * k; P.rGuard.x -= (1 - pound) * .02 * k;
      const roar = ss(4.2, 4.45, a) * (1 - ss(5.2, 5.5, a));
      P.headRot[0] -= roar * .55; P.jaw += roar * .5; P.spineRot[0] -= roar * .2;
      P.lGuard.lerp(V(.48, -.02, .02), roar); P.rGuard.lerp(V(-.55, -.02, .0), roar);
      P.spineRot[1] -= .2 * k; P.headRot[1] += .2 * k * (1 - roar);
    }
  } else {
    // intro: cocky, neck roll + glove tap (a 5.6 - 8.0)
    const k = ss(5.5, 5.8, a) * (1 - ss(7.8, 8.1, a));
    if (k > 0) {
      const tap = Math.max(0, Math.sin((a - 5.6) * Math.PI * 3)) * ss(6.6, 6.8, a) * (1 - ss(7.5, 7.7, a));
      P.headRot[2] += Math.sin((a - 5.6) * 3.5) * .25 * (1 - ss(6.4, 6.6, a)) * k;
      P.headRot[0] -= .1 * k; P.jaw = .02;
      P.lGuard.lerp(V(.0, .12, .28 - tap * .04), k * ss(6.4, 6.7, a)); P.rGuard.lerp(V(-.15, .12, .28 - tap * .04), k * ss(6.4, 6.7, a));
      P.spineRot[1] -= .25 * k; P.headRot[1] += .05 * k;
    }
  }

  // ---- punches thrown ----
  for (const p of PUNCHES) {
    if (p.who !== who || a < p.t0 - .2 || a > p.te + .1) continue;
    const L = p.hand === 'L', sgn = L ? -1 : 1;
    const wIn = p.kind === 'uppercut' || p.kind === 'overhand' ? easeIn(ss(p.t0 + (p.th - p.t0) * .45, p.th, a)) : ss(p.t0, p.th, a);
    const w = wIn * (1 - ss(p.th + .04, p.te, a));
    let T = (p.lands === 'body' ? opBody : opHead).clone();
    if (p.lands === 'miss' && p.kind === 'jab') T.add(V(0, .05, -.2));
    if (p.lands === 'block') T.add(V(0, 0, -.12));
    const pr = ss(p.t0, p.th, a);
    if (p.kind === 'jab') { T.add(V(0, 0, .02)); }
    if (p.kind === 'hook') { T.add(V(-sgn * .4 * (1 - pr), .02, -.25 * (1 - pr) + .04)); if (p.big) T.add(V(sgn * .25 * ss(p.th, p.te, a), 0, .15 * ss(p.th, p.te, a))); }
    if (p.kind === 'body') { T.add(V(.05, -.05 * (1 - pr), -.02)); }
    if (p.kind === 'overhand') { T.add(V(-.25 * (1 - pr), .45 * Math.sin(pr * Math.PI) * (1 - pr * .6), -.25 * (1 - pr))); T.add(V(.05, -.2, .1).multiplyScalar(ss(p.th, p.th + .25, a))); }
    if (p.kind === 'uppercut') { T.add(V(0, -.45 * (1 - pr) + .12 * ss(p.th, p.th + .3, a), -.2 * (1 - pr) + .03)); }
    // windup
    const wind = ss(p.t0 - .18, p.t0 + (p.th - p.t0) * .4, a) * (1 - ss(p.t0 + (p.th - p.t0) * .4, p.th, a));
    const W = (p.kind === 'jab' || p.kind === 'body') ? w : Math.max(w, 0);
    if (L) { P.lTarget = T; P.lW = W; } else { P.rTarget = T; P.rW = W; }
    const big = p.kind === 'jab' ? .35 : 1;
    // body rotation into punch
    P.pelvisRot[1] += sgn * .35 * big * w - sgn * .3 * wind * big;
    P.spineRot[1] += sgn * .55 * big * w - sgn * .45 * wind * big;
    P.headRot[1] -= sgn * .35 * big * w;
    P.spineRot[0] += .12 * w * big;
    P.pelvis.z += .08 * w * big;
    if (p.kind === 'hook') { (L ? P.lPole.set(1, .35, -.2) : P.rPole.set(-1, .35, -.2)).normalize(); if (L) P.lTwist = 1; else P.rTwist = 1; }
    if (p.kind === 'overhand') { P.rPole.lerp(V(-.6, .9, -.3), pr).normalize(); P.pelvis.y -= .06 * w; P.spineRot[0] += .2 * w; P.jaw += .25 * w; }
    if (p.kind === 'uppercut') {
      P.pelvis.y -= .13 * wind + .1 * ss(p.t0 - .2, p.t0 + .1, a) * (1 - ss(p.t0 + .2, p.th, a));
      P.pelvis.y += .06 * ss(p.th - .15, p.th, a) * (1 - ss(p.th + .2, p.te, a));
      P.rPole.lerp(V(-.2, -1, -.3), .8).normalize();
      P.spineRot[0] -= .25 * ss(p.th - .1, p.th + .1, a) * (1 - ss(p.th + .2, p.te, a)); P.spineRot[2] += .2 * wind;
      P.rGuard.lerp(V(-.15, -.05, .15), wind);
      P.jaw += .2 * w;
    }
    if (p.kind === 'body') { P.pelvis.y -= .12 * w; P.spineRot[2] -= .2 * w; P.spineRot[0] += .1 * w; }
    P.anger = Math.max(P.anger, .7 * w + P.anger * (1 - w));
  }

  // ---- defensive moves ----
  if (who === 'S') {
    // block E's left hook (comes to S's right side): raise right glove to temple
    const b = ss(11.15, 11.35, a) * (1 - ss(11.6, 11.9, a));
    P.rGuard.lerp(V(-.18, .32, .1), b); P.rPole.lerp(V(-1, 0, 0), b).normalize(); P.headRot[2] += .1 * b;
    P.pelvis.x -= imp(a, 11.42, .08) * .05;
    // duck under big hook (a 16.85 - 17.4)
    const d = ss(16.85, 17.02, a) * (1 - ss(17.3, 17.55, a));
    P.pelvis.y -= .28 * d; P.spineRot[0] += .45 * d; P.spineRot[2] -= .35 * d; P.headRot[0] -= .25 * d; P.pelvis.x += .08 * d;
    P.lKnee.set(.5, 0, 1).normalize();
  }

  // ---- hit reactions ----
  for (const h of HITS) {
    if (h.victim !== who || a < h.th) continue;
    const s = h.str, dt = a - h.th;
    const k1 = imp(a, h.th, .07) * s, k2 = imp(a, h.th, .22) * s;
    if (h.lands === 'head') {
      if (h.kind === 'jab') { P.headRot[0] -= .5 * k1; P.spineRot[0] -= .15 * k2; P.blink = Math.max(P.blink, k1 > .1 ? 1 : 0); }
      if (h.kind === 'hook') { P.headRot[1] += (h.hand === 'L' ? 1 : -1) * .9 * k1; P.headRot[2] += .4 * k1; P.spineRot[1] += .3 * k2; P.jaw += .3 * k1; P.blink = Math.max(P.blink, k1 > .15 ? 1 : 0); }
      if (h.kind === 'overhand') {
        P.headRot[1] -= 1.1 * k1; P.headRot[0] += .3 * k1; P.headRot[2] -= .5 * k1; P.spineRot[1] -= .5 * k2; P.spineRot[2] -= .3 * k2; P.jaw += .5 * k1;
        P.blink = Math.max(P.blink, dt < .5 ? 1 : 0);
        // stumbling back to the ropes with guard dropped
        const st = ss(12.85, 13.1, a) * (1 - ss(14.2, 15.2, a));
        P.lGuard.lerp(V(.25, -.05, .2), st * .7); P.rGuard.lerp(V(-.3, -.05, .15), st * .7);
        P.spineRot[0] -= .25 * st; P.headRot[0] -= .15 * st; P.pelvis.y -= .05 * st; P.lKnee.set(.6, 0, 1).normalize();
        P.headRot[1] += Math.sin(a * 6) * .1 * ss(14, 14.6, a) * (1 - ss(15.4, 16, a)); // shakes it off
      }
      if (h.kind === 'uppercut') {
        P.headRot[0] -= 1.25 * imp(a, h.th, .09) * 1.0; P.spineRot[0] -= .55 * imp(a, h.th, .2); P.jaw += .55 * imp(a, h.th, .1);
        P.blink = 1; P.anger = 0;
      }
    }
    if (h.lands === 'body') { P.spineRot[0] += .45 * k2; P.pelvis.z -= .05 * k2; P.jaw += .3 * k1; P.headRot[0] += .2 * k2; }
  }

  // E head shake after jabs, grin
  if (who === 'E') {
    const sh = ss(10.45, 10.6, a) * (1 - ss(11.0, 11.15, a));
    P.headRot[1] += Math.sin(a * 30) * .2 * sh; P.jaw += .15 * sh;
    // roar + chest beat between a 14.4 and 15.9
    const rb = ss(14.4, 14.6, a) * (1 - ss(15.7, 16.0, a));
    if (rb > 0) {
      const beat = Math.abs(Math.sin((a - 14.4) * Math.PI * 3.2));
      P.lGuard.lerp(V(.12 + beat * .05, .05, .2 + beat * .08), rb); P.rGuard.lerp(V(-.2 - (1 - beat) * .05, .05, .2 + (1 - beat) * .08), rb);
      P.headRot[0] -= .5 * rb; P.jaw += .55 * rb; P.spineRot[0] -= .15 * rb; P.spineRot[1] -= .3 * rb; P.headRot[1] += .25 * rb;
    }
    // charge: lean forward
    const ch = ss(16.2, 16.6, a) * (1 - ss(17.2, 17.5, a)); P.spineRot[0] += .2 * ch; P.jaw += .25 * ch;
    // overswing after the miss: off balance
    const ob = ss(17.12, 17.35, a) * (1 - ss(17.6, 17.9, a)); P.spineRot[1] += .3 * ob; P.pelvisRot[1] += .3 * ob;
  }

  // ---- E knockout fall ----
  if (who === 'E' && a > E_FALL.t0 - .4) {
    const f = a < E_FALL.tLand ? easeIn(clamp((a - E_FALL.t0) / (E_FALL.tLand - E_FALL.t0))) : 1;
    const bounce = a > E_FALL.tLand ? Math.abs(Math.sin((a - E_FALL.tLand) * 11)) * Math.exp(-(a - E_FALL.tLand) * 7) * .08 : 0;
    P.root.fall = f * 1.52 - bounce;
    P.root.lift = f * .14;
    // limbs go limp / flail
    const limp = ss(18.9, 19.3, a);
    P.lGuard.lerp(V(.45, .25 + f * .2, .0), limp); P.rGuard.lerp(V(-.5, .28 + f * .25, -.05), limp);
    P.lPole.lerp(V(1, 0, 0), limp).normalize(); P.rPole.lerp(V(-1, 0, 0), limp).normalize();
    P.lW = P.lW * (1 - limp); P.rW = P.rW * (1 - limp);
    P.headRot[0] -= .4 * limp * (1 - f) + (a > E_FALL.tLand ? -.3 + Math.exp(-(a - E_FALL.tLand) * 5) * .4 : 0);
    P.headRot[1] = lerp(P.headRot[1], .5, ss(20.3, 20.8, a));
    P.jaw = lerp(P.jaw, .32, limp); P.blink = 1; P.anger = 0;
    P.spineRot = [lerp(P.spineRot[0], -.05, limp), lerp(P.spineRot[1], 0, limp), 0];
    P.pelvisRot[1] = lerp(P.pelvisRot[1], 0, limp);
    P.lFoot.lerp(V(.2, 0, .05), limp); P.rFoot.lerp(V(-.2, 0, -.05), limp);
    P.pelvis.y += .06 * limp; P.pelvis.z = lerp(P.pelvis.z, 0, limp);
    // twitch while lying
    if (a > 21) P.lGuard.y += Math.max(0, Math.sin(a * 9)) * .03 * (a < 22.5 ? 1 : 0);
  }

  // ---- S victory ----
  if (who === 'S') {
    const turn = ss(21.2, 22.0, a);
    P.root.yaw += turn * .9; // turn toward camera/crowd
    const v = ss(23.3, 23.7, a);
    if (v > 0) {
      const pump = Math.sin((a - 23.5) * Math.PI * 2 * 1.1) * .5 + .5;
      P.lGuard.lerp(V(.22, .62 + pump * .08, .05), v); P.rGuard.lerp(V(-.22, .62 + pump * .08, .05), v);
      P.lPole.lerp(V(1, 0, -.3), v).normalize(); P.rPole.lerp(V(-1, 0, -.3), v).normalize();
      P.headRot[0] -= .2 * v; P.jaw += .3 * v * (.6 + .4 * pump); P.anger = .2;
      P.pelvisRot[1] = lerp(P.pelvisRot[1], 0, v); P.spineRot = [lerp(P.spineRot[0], -.15, v), 0, 0]; P.headRot[1] = lerp(P.headRot[1], 0, v);
      P.pelvis.y += .06 * v + pump * .05 * v; P.lFoot.lerp(V(.18, pump * .03, .05), v); P.rFoot.lerp(V(-.18, pump * .03, -.05), v);
    } else if (a > 19.3) { // breathing, looking down at E
      P.headRot[0] += .25 * ss(19.5, 20.5, a); P.lGuard.lerp(V(.1, .0, .25), ss(20, 21, a)); P.rGuard.lerp(V(-.2, .0, .22), ss(20, 21, a));
      P.pelvis.y += Math.sin(a * 5) * .01;
    }
  }
  // breathing jitter on head
  P.headRot[0] += n1(a * 2 + (who === 'E' ? 0 : 50)) * .03; P.headRot[1] += n1(a * 1.7 + 9) * .04;
  return P;
}

export function particlesFor() { return HITS.filter(h => h.lands === 'head' && h.str >= .7); }
