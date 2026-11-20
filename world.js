import * as THREE from 'three';

function rnd(i) { let n = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); }
function tex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export const RING = { half: 3.1, floor: 0 };

export function buildWorld(scene) {
  const W = {};
  scene.background = new THREE.Color(0x020204);
  scene.fog = new THREE.FogExp2(0x07080d, .045);

  // ---- ring mat ----
  const matTex = tex(2048, 2048, (g, w, h) => {
    g.fillStyle = '#c9ccd2'; g.fillRect(0, 0, w, h);
    // canvas wrinkles / stains
    for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(${rnd(i) > .5 ? '255,255,255' : '60,60,70'},${.02 + rnd(i + 3) * .04})`; g.beginPath(); g.ellipse(rnd(i + 1) * w, rnd(i + 2) * h, 10 + rnd(i + 4) * 60, 4 + rnd(i + 5) * 20, rnd(i + 6) * 3, 0, 6.28); g.fill(); }
    // center logo
    g.save(); g.translate(w / 2, h / 2);
    g.strokeStyle = 'rgba(150,20,25,.85)'; g.lineWidth = 26; g.beginPath(); g.arc(0, 0, 430, 0, 6.28); g.stroke();
    g.strokeStyle = 'rgba(20,40,120,.8)'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 395, 0, 6.28); g.stroke();
    g.fillStyle = 'rgba(25,25,30,.9)'; g.textAlign = 'center'; g.font = '900 120px IDK'; g.fillText('EVOLUTION', 0, -10);
    g.font = '900 64px IDK'; g.fillStyle = 'rgba(150,20,25,.9)'; g.fillText('WORLD TITLE FIGHT', 0, 80);
    g.font = '700 46px IB'; g.fillStyle = 'rgba(25,25,30,.7)'; g.fillText('2,000,000 B.C.', 0, 150);
    g.restore();
    // corner tints
    g.fillStyle = 'rgba(160,20,25,.25)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(420, 0); g.lineTo(0, 420); g.fill();
    g.fillStyle = 'rgba(20,50,170,.25)'; g.beginPath(); g.moveTo(w, h); g.lineTo(w - 420, h); g.lineTo(w, h - 420); g.fill();
  });
  const half = RING.half;
  const mat = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + .6, .12, half * 2 + .6), [
    new THREE.MeshStandardMaterial({ color: 0x111111 }), new THREE.MeshStandardMaterial({ color: 0x111111 }),
    new THREE.MeshStandardMaterial({ map: matTex, roughness: .82 }), new THREE.MeshStandardMaterial({ color: 0x111111 }),
    new THREE.MeshStandardMaterial({ color: 0x111111 }), new THREE.MeshStandardMaterial({ color: 0x111111 })]);
  mat.position.y = -.06; mat.receiveShadow = true; scene.add(mat);
  // apron skirt
  const skirtTex = tex(2048, 256, (g, w, h) => {
    g.fillStyle = '#0c0c10'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b3121b'; g.fillRect(0, 0, w, 14);
    g.font = '900 120px IDB'; g.fillStyle = '#e9e2d0'; g.textAlign = 'center';
    g.fillText('ERECTUS  vs  SAPIENS', w / 2, 170);
  });
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + .7, 1.1, half * 2 + .7), new THREE.MeshStandardMaterial({ map: skirtTex, roughness: .6 }));
  skirt.position.y = -.68; scene.add(skirt);
  // arena floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: .5, metalness: .2 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.22; floor.receiveShadow = true; scene.add(floor);

  // ---- posts + ropes ----
  const postMat = new THREE.MeshPhysicalMaterial({ color: 0xc8ccd4, metalness: .9, roughness: .25 });
  const corners = [[-1, -1, 0xb3121b], [1, -1, 0xeeeeee], [1, 1, 0x1546c8], [-1, 1, 0xeeeeee]];
  const cp = [];
  corners.forEach(([sx, sz, c]) => {
    const x = sx * half, z = sz * half; cp.push([x, z]);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.55, 20), postMat); p.position.set(x, .7, z); p.castShadow = true; scene.add(p);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(.24, 1.05, .24), new THREE.MeshPhysicalMaterial({ color: c, roughness: .35, clearcoat: .6 }));
    pad.position.set(x - sx * .08, .72, z - sz * .08); pad.rotation.y = Math.PI / 4; pad.castShadow = true; scene.add(pad);
  });
  const ropeCols = [0xb3121b, 0xf2f2f2, 0x1546c8, 0xf2f2f2];
  const ropeMats = ropeCols.map(c => new THREE.MeshPhysicalMaterial({ color: c, roughness: .35, clearcoat: .7 }));
  W.ropes = [];
  [.42, .74, 1.06, 1.38].forEach((y, ri) => {
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = cp[k], [x1, z1] = cp[(k + 1) % 4];
      const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * .05, z0 + (z1 - z0) * t)); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, .028, 10), ropeMats[ri]);
      tube.castShadow = true; scene.add(tube); W.ropes.push({ mesh: tube, side: k, y });
    }
  });

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0x6070a0, 0x100808, .35));
  const key = new THREE.SpotLight(0xfff1dc, 160, 30, .52, .55, 1.6);
  key.position.set(0, 9.5, .4); key.target.position.set(0, 0, 0); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.camera.near = 4; key.shadow.camera.far = 14;
  scene.add(key, key.target); W.key = key;
  const rimA = new THREE.SpotLight(0xff8040, 120, 22, .45, .6, 1.5); rimA.position.set(-7, 5.5, -5); rimA.target.position.set(0, 1.3, 0); scene.add(rimA, rimA.target);
  const rimB = new THREE.SpotLight(0x4f86ff, 140, 22, .45, .6, 1.5); rimB.position.set(7, 5.5, 5); rimB.target.position.set(0, 1.3, 0); scene.add(rimB, rimB.target);
  const fill = new THREE.PointLight(0xb0c0ff, 2.5, 12, 1.5); fill.position.set(0, 2.5, 7); scene.add(fill); W.fill = fill;
  W.rimA = rimA; W.rimB = rimB;
  // flash light for hits
  W.flash = new THREE.PointLight(0xffffff, 0, 6, 2); scene.add(W.flash);

  // ---- volumetric beam ----
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(1, .93, .82) }, uStr: { value: .07 } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY=uv.y; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uStr; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(abs(dot(vN,vV)),1.6); float a=uStr*f*smoothstep(0.,.35,vY)*(.35+.65*vY); gl_FragColor=vec4(uCol*a,1.); }`
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.25, 4.2, 9.6, 48, 1, true), beamMat); beam.position.set(0, 4.8, .2); scene.add(beam); W.beam = beam;
  for (const [x, z, c] of [[-6, -4, [1, .55, .3]], [6, 4, [.35, .55, 1]]]) {
    const m = beamMat.clone(); m.uniforms.uCol.value = new THREE.Color(...c); m.uniforms.uStr.value = .035;
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(.2, 2.2, 9, 32, 1, true), m);
    b2.position.set(x * .5, 4.2, z * .5); b2.lookAt(0, 1, 0); b2.rotateX(Math.PI / 2); scene.add(b2);
  }
  // dust motes in beam
  const NM = 1400, mp = new Float32Array(NM * 3);
  for (let i = 0; i < NM; i++) { const r = Math.sqrt(rnd(i)) * 3.2, a = rnd(i + 7) * 6.28; mp[i * 3] = Math.cos(a) * r; mp[i * 3 + 1] = rnd(i + 3) * 7.5; mp[i * 3 + 2] = Math.sin(a) * r; }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  W.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xfff0d0, size: .018, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  W.motesBase = mp.slice(); scene.add(W.motes);

  // ---- crowd ----
  const bodyG = new THREE.CapsuleGeometry(.22, .5, 4, 10), headG = new THREE.SphereGeometry(.13, 12, 10);
  const crowdMat = new THREE.MeshStandardMaterial({ color: 0x15161c, roughness: .8 });
  const seats = [];
  for (let row = 0; row < 12; row++) {
    const dist = 5.6 + row * 1.0, y = -1.2 + row * .45;
    const n = Math.floor(dist * 2 * Math.PI / .62);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rnd(row * 100 + i) * .05; seats.push([Math.cos(a) * dist * 1.0, y, Math.sin(a) * dist, rnd(row * 7 + i * 13)]); }
  }
  W.crowdN = seats.length; W.seats = seats;
  W.crowdBody = new THREE.InstancedMesh(bodyG, crowdMat, seats.length);
  W.crowdHead = new THREE.InstancedMesh(headG, crowdMat, seats.length);
  scene.add(W.crowdBody, W.crowdHead);
  // flashbulbs / phone lights
  const fp = new Float32Array(seats.length * 3), fc = new Float32Array(seats.length * 3);
  seats.forEach((s, i) => { fp[i * 3] = s[0] * .98; fp[i * 3 + 1] = s[1] + 1.1; fp[i * 3 + 2] = s[2] * .98; });
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  W.flashes = new THREE.Points(fg, new THREE.PointsMaterial({ size: .22, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }) }));
  scene.add(W.flashes);
  // big screens / banners in the dark
  const ban = tex(1024, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff3b2f'; g.font = '900 150px IDB'; g.textAlign = 'center'; g.fillText('FIGHT NIGHT', w / 2, 185); });
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: ban, transparent: true, opacity: .55, fog: true }));
    m.position.set(Math.cos(a) * 19, 7.5, Math.sin(a) * 19); m.lookAt(0, 7.5, 0); scene.add(m);
  }
  // overhead truss with lamps
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff4e0 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28 + .39; const l = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 8), lampMat); l.position.set(Math.cos(a) * 2.6, 9.4, Math.sin(a) * 2.6); scene.add(l); }
  const truss = new THREE.Mesh(new THREE.TorusGeometry(2.7, .06, 6, 60), new THREE.MeshStandardMaterial({ color: 0x222228, metalness: .8, roughness: .4 })); truss.rotation.x = Math.PI / 2; truss.position.y = 9.6; scene.add(truss);
  return W;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
export function updateWorld(W, t, hype) {
  // crowd sway / jump
  W.seats.forEach((s, i) => {
    const ph = s[3] * 6.28, j = Math.max(0, Math.sin(t * (5 + s[3] * 3) + ph)) * .12 * hype;
    const sway = Math.sin(t * 1.3 + ph) * .04;
    _p.set(s[0] + sway, s[1] + .45 + j, s[2]); _q.identity(); _m.compose(_p, _q, _s); W.crowdBody.setMatrixAt(i, _m);
    const arm = hype > .6 && s[3] > .7 ? .25 : 0;
    _p.set(s[0] + sway, s[1] + .98 + j + arm * 0, s[2]); _m.compose(_p, _q, _s); W.crowdHead.setMatrixAt(i, _m);
  });
  W.crowdBody.instanceMatrix.needsUpdate = true; W.crowdHead.instanceMatrix.needsUpdate = true;
  const c = W.flashes.geometry.attributes.color;
  const fr = Math.floor(t * 24);
  for (let i = 0; i < W.crowdN; i++) {
    const r = rnd(i * 31.7 + fr * 1.37);
    const on = r < .004 + .02 * hype ? 1 : 0;
    const phone = rnd(i * 3.3) < .05 ? .25 : 0;
    const v = Math.max(on * 1.6, phone * (hype > .3 ? 1 : .4));
    c.setXYZ(i, v, v * .97, v * (phone && !on ? 1.1 : .9));
  }
  c.needsUpdate = true;
  const mp = W.motes.geometry.attributes.position;
  for (let i = 0; i < mp.count; i++) { mp.setY(i, (W.motesBase[i * 3 + 1] + t * .05 + Math.sin(t * .3 + i) * .05) % 7.5); mp.setX(i, W.motesBase[i * 3] + Math.sin(t * .2 + i * .3) * .1); }
  mp.needsUpdate = true;
}
