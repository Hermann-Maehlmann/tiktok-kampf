import { warp, speed, PUNCHES, DURATION, VO_SLOTS, REPLAY, ENDCARD, replayV, COLD, COLD_HIT } from './choreo.js';
import fs from 'fs';
const find = (a, from = 23.4) => { for (let v = from; v < REPLAY.v0; v += .001) if (warp(v) >= a) return +v.toFixed(3); return null; };
const up = PUNCHES.find(p => p.kind === 'uppercut');
const out = { dur: +(DURATION + COLD).toFixed(3), main: DURATION, cold: COLD, coldHit: COLD_HIT, punches: PUNCHES.map(p => ({ kind: p.kind, lands: p.lands, str: p.str, v0: find(p.t0), vh: find(p.th) })),
  ropes: find(14.05), guard1: find(13.55), guard2: find(13.7), land: find(20.3), speed: [],
  replay: { v0: REPLAY.v0, v1: REPLAY.v1, upV0: +replayV(up.t0).toFixed(3), upHit: +replayV(up.th).toFixed(3), land: +replayV(20.3).toFixed(3) }, endcard: ENDCARD.v0, slots: VO_SLOTS };
for (let v = 0; v < DURATION; v += .01) out.speed.push(v >= REPLAY.v0 && v < REPLAY.v1 ? .35 : +speed(v).toFixed(3));
fs.writeFileSync('events.json', JSON.stringify(out));
console.log(JSON.stringify({ ...out, speed: undefined }));
