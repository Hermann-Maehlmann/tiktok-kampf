import numpy as np, wave
from scipy.signal import butter, sosfilt, fftconvolve
import json
import os, sys
EV = json.load(open('events.json'))
FIGHT = json.load(open(os.environ.get('FIGHT', 'fights/v3.json')))
OUT = os.environ.get('AUDIO_OUT', 'audio3.wav')
RP = EV['replay']; ENDV = EV['endcard']
SR = 48000; DUR = EV['dur']; N = int(SR * DUR)
rng = np.random.default_rng(7)
WARP = [[0, 0], [12.6, 12.6], [12.85, 12.8], [14.4, 13.0], [14.9, 13.3], [16.0, 14.4], [18.4, 16.9], [19.9, 17.25], [20.2, 17.45], [21.3, 18.55], [22.0, 18.78], [24.6, 19.02], [25.3, 19.35], [27.3, 20.33], [28.0, 21.0], [34.2, 27.2]]
def inv(a):
    for i in range(1, len(WARP)):
        if a <= WARP[i][1]:
            v0, a0 = WARP[i-1]; v1, a1 = WARP[i]; return v0 + (v1 - v0) * (a - a0) / (a1 - a0)
    return WARP[-1][0] + a - WARP[-1][1]
def spd(v):
    for i in range(1, len(WARP)):
        if v <= WARP[i][0]:
            v0, a0 = WARP[i-1]; v1, a1 = WARP[i]; return (a1 - a0) / (v1 - v0)
    return 1
t = np.arange(N) / SR
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def add(buf, sig, at, g=1.0):
    i = int(at * SR); j = min(N, i + len(sig))
    if i < N: buf[i:j] += sig[:j - i] * g
def env(n, a, d):  # attack/decay seconds
    tt = np.arange(n) / SR; return np.minimum(1, tt / max(a, 1e-4)) * np.exp(-tt / d)

def S(*xs):
    L = max(len(x) for x in xs); o = np.zeros(L)
    for x in xs: o[:len(x)] += x
    return o
music = np.zeros(N); sfx = np.zeros(N); crowd = np.zeros(N)

# ---------- crowd ----------
# crowd = many synthetic voices (glottal pulses through vowel formants), no broadband noise
VOW = [(730, 1090), (530, 1840), (270, 2290), (570, 840), (440, 1020), (660, 1720)]
def babble(nv, seed, pitch=(95, 260)):
    r = np.random.default_rng(seed); out = np.zeros(N)
    for k in range(nv):
        f0 = r.uniform(*pitch); pos = r.uniform(0, .5)
        while pos < DUR:
            L = r.uniform(.12, .45); n = int(L * SR); i = int(pos * SR)
            if i + n > N: break
            tt = np.arange(n) / SR
            f = f0 * (1 + .04 * np.sin(2 * np.pi * r.uniform(3, 6) * tt) + r.uniform(-.08, .08) * tt / L)
            ph = np.cumsum(f) / SR; saw = 2 * (ph % 1) - 1
            F1, F2 = VOW[r.integers(len(VOW))]
            v = bp(saw, F1 * .85, F1 * 1.15) + .6 * bp(saw, F2 * .88, F2 * 1.12)
            out[i:i + n] += v * np.sin(np.pi * tt / L) ** 1.5 * r.uniform(.3, 1)
            pos += L + r.exponential(.15)
    return out
base = babble(70, 11) + .6 * babble(40, 12, (180, 380))
base = lp(base, 2500)
# murmur modulation
mod = lp(rng.standard_normal(N), 3) ; mod = 1 + .6 * mod / np.abs(mod).max()
level = np.full(N, .25)
def ramp(v0, v1, l0, l1):
    i0, i1 = int(v0 * SR), int(v1 * SR); level[i0:i1] = np.linspace(l0, l1, i1 - i0)
level[:] = .22
ramp(0, 1.5, .1, .3); ramp(23.4, 25.2, .3, .45)
HITS = [(p['vh'], p['str'], p['kind'] if p['lands'] != 'block' else 'block') for p in EV['punches'] if p['lands'] != 'miss']
for v, s, k in HITS:
    i = int(v * SR); n = int(2.5 * SR)
    if i < N:
        e = env(n, .15, 1.0 if s > 1 else .6) * s * .5
        level[i:i + n][:len(e[:N - i])] += e[:N - i]
# slow-mo: crowd muffled (handled below by lowpass mix)
ramp(47.4, 47.8, .45, 1.1); level[int(47.8 * SR):int(51 * SR)] = 1.0; ramp(51, 53, 1.0, .55); level[int(53 * SR):] = .55
# replay: muffled crowd, then roar on the replayed impact; end card: cheering
level[int(RP['v0'] * SR):int(RP['upHit'] * SR)] = .3; ramp(RP['upHit'], RP['upHit'] + .4, .3, .9); level[int((RP['upHit'] + .4) * SR):int(RP['v1'] * SR)] = .9; level[int(ENDV * SR):] = .75
crowd = base * mod * level / np.abs(base).max() * 1.6
# cheers/whistles on KO and win
for k in range(14):
    v = 47.6 + rng.random() * 5; f = 1800 + rng.random() * 1200; n = int(.6 * SR); tt = np.arange(n) / SR
    w = np.sin(2 * np.pi * (f * tt + 300 * np.sin(tt * 6) / 6)) * env(n, .05, .25) * .08
    add(crowd, w, v)
# muffle crowd in slow motion
sp = np.array(EV['speed']); spI = np.interp(t, np.arange(len(sp)) * .01, sp)
slow = np.clip(1 - spI, 0, 1); slow = lp(slow, 4)
crowd = crowd * (1 - .8 * slow) + lp(crowd, 400) * .8 * slow

# ---------- sfx ----------
def thump(f0, f1, dur, g):
    n = int(dur * SR); tt = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-tt * 18)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .002, dur / 3) * g
def crack(dur, g, lo=1500, hi=9000):
    n = int(dur * SR); return bp(rng.standard_normal(n), lo, hi) * env(n, .001, dur / 4) * g
def whoosh(dur, g, f0=400, f1=2500):
    n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n); seg = 256
    for i in range(0, n, seg):
        fr = f0 + (f1 - f0) * (i / n); out[i:i + seg] = 0
    tt = np.arange(n) / SR; e = np.sin(np.pi * tt / dur) ** 2
    return bp(x, f0, f1) * e * g
for p in EV['punches']:
    v0, v1 = p['v0'], p['vh']; d = max(.12, v1 - v0)
    lo = 300 if d > .5 else 600
    add(sfx, whoosh(d + .05, .35 if d < .5 else .5, lo, 2400 if d < .5 else 1200), v0)
for v, s, k in HITS:
    if k == 'block':
        add(sfx, S(thump(180, 90, .25, .6), crack(.06, .3, 800, 4000)), v); continue
    slowhit = np.interp(v + .05, np.arange(len(sp)) * .01, sp) < .5
    if slowhit:
        # big cinematic slow-mo impact: deep boom + crunchy layer + long tail
        boom = S(thump(90, 32, 2.2, 1.2), crack(.35, .5, 200, 3000), thump(240, 60, .5, .6))
        add(sfx, boom, v)
    else:
        add(sfx, S(thump(130, 55, .35, .9 * s + .3), crack(.05, .5 * s + .2), thump(300, 120, .08, .3)), v)
# replay: whoosh + big slow-mo impact + body fall again
add(sfx, whoosh(RP['upHit'] - RP['upV0'] + .05, .5, 300, 1200), RP['upV0'])
add(sfx, S(thump(90, 32, 2.2, 1.2), crack(.35, .5, 200, 3000), thump(240, 60, .5, .6)), RP['upHit'])
add(sfx, S(thump(70, 28, 1.6, 1.4), crack(.2, .5, 100, 2500)), RP['land'])
for v in np.arange(RP['v0'] + .2, RP['upHit'], .78):
    add(sfx, thump(55, 38, .3, .5), v); add(sfx, thump(50, 36, .25, .35), v + .22)
n = int((RP['v1'] - RP['v0']) * SR); tt = np.arange(n) / SR
add(sfx, (np.sin(2 * np.pi * 41 * tt) + .5 * np.sin(2 * np.pi * 61.5 * tt)) * np.minimum(1, tt / .2) * np.clip((n / SR - tt) / .5, 0, 1) * .1, RP['v0'])
# rope rattle when S hits ropes (a~14.0)
v = EV['ropes']; n = int(1.2 * SR)
add(sfx, S(bp(rng.standard_normal(n), 80, 600) * env(n, .01, .3) * .5, thump(70, 45, .8, .4)), v)
# mouthguard clatter
add(sfx, crack(.04, .25, 2000, 8000), EV['guard1']); add(sfx, crack(.03, .15, 2000, 8000), EV['guard2'])
# body fall
vland = EV['land']
add(sfx, S(thump(70, 28, 1.6, 1.6), crack(.2, .6, 100, 2500), bp(rng.standard_normal(int(1.5 * SR)), 60, 300) * env(int(1.5 * SR), .005, .35) * .9), vland)
add(sfx, thump(90, 40, .4, .5), vland + .28)
# heartbeat during uppercut slow-mo
for v in np.arange(38.8, 42.6, .78):
    add(sfx, thump(55, 38, .3, .55), v); add(sfx, thump(50, 36, .25, .4), v + .22)
# slow-mo "time stretch" drone
for v0, v1 in [(29.04, 30.6), (35.8, 37.3), (39.4, 42.0), (42.7, 44.7)]:
    n = int((v1 - v0 + 1) * SR); tt = np.arange(n) / SR
    dr = (np.sin(2 * np.pi * 41 * tt) + .5 * np.sin(2 * np.pi * 61.5 * tt)) * np.minimum(1, tt / .2) * np.clip((v1 - v0 + 1 - tt) / 1, 0, 1) * .12
    add(sfx, dr, v0)
# bells
def bell(g=1):
    n = int(2.5 * SR); tt = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt * d) for f, a, d in [(830, 1, 1.5), (1660 * 1.01, .5, 2.5), (2490 * 1.03, .35, 3.5), (3280, .2, 5), (520, .3, 2)])
    return s * env(n, .001, 10) * .25 * g
for k in range(3): add(sfx, bell(), 23.45 + k * .32)
for k in range(5): add(sfx, bell(.8), 47.55 + k * .28)

# ---------- music / hits ----------
def kick(g=1): return thump(120, 45, .45, g)
def snare(g=1): n = int(.25 * SR); return S(bp(rng.standard_normal(n), 1500, 8000) * env(n, .001, .06) * .7, np.sin(2 * np.pi * 190 * np.arange(n) / SR) * env(n, .001, .05) * .4) * g
def braam(dur, g):
    n = int(dur * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for f in [55, 55.4, 82.4, 110.2, 164.8]:
        ph = 2 * np.pi * f * tt; x += np.sign(np.sin(ph)) * .3 + np.sin(ph)
    return lp(x, 900) * env(n, .03, dur / 2.5) * g * .12
for v in [.7, 1.25, 1.8]: add(music, S(kick(1.2), braam(1.8, 1)), v)
add(music, braam(2.5, 1.0), 6.0); add(music, braam(2.5, .9), 16.3)
add(music, S(kick(1.4), braam(1.5, 1.2)), 23.45)
for v in [45.7, 46.35, 47.0]: add(music, S(kick(1.3), snare(.6)), v)
add(music, S(kick(1.8), braam(3.5, 1.6)), 47.5); add(music, braam(3.5, 1.1), 48.3)
add(music, S(kick(.8), braam(2.5, .7)), 51.3); add(music, S(kick(.8), braam(2.5, .7)), 54.5)
add(music, S(kick(1.2), braam(3.0, 1.2)), RP['v0']); add(music, S(kick(1.4), braam(3.0, 1.3)), RP['upHit']); add(music, S(kick(1.2), braam(2.5, 1.0)), ENDV + .1)
# low drone pad under intro
n = int(23.5 * SR); tt = np.arange(n) / SR
pad = (np.sin(2 * np.pi * 55 * tt) + .4 * np.sin(2 * np.pi * 82.5 * tt) + .2 * np.sin(2 * np.pi * 110 * tt + np.sin(tt))) * np.minimum(1, tt / 1.5) * np.clip((23.5 - tt) / .5, 0, 1) * .08
add(music, pad, 0)
# fight beat 120 BPM during realtime action, drops out in slow-mo
bpm = 124; beat = 60 / bpm
for seg0, seg1 in [(25.2, 29.0), (31.8, 35.6), (37.6, 39.3), (48.3, RP['v0']), (ENDV, DUR - .4)]:
    v = seg0; k = 0
    while v < seg1:
        add(music, kick(.9), v)
        if k % 2 == 1: add(music, snare(.5), v)
        add(music, crack(.02, .08, 6000, 12000), v + beat / 2)
        v += beat; k += 1
# bass line
for seg0, seg1 in [(25.2, 29.0), (31.8, 35.6), (37.6, 39.3), (48.3, RP['v0']), (ENDV, DUR - .4)]:
    n = int((seg1 - seg0) * SR); tt = np.arange(n) / SR
    notes = [55, 55, 65.4, 49]
    f = np.array([notes[int(x / (beat * 4)) % 4] for x in tt])
    b = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .5 + np.sin(2 * np.pi * np.cumsum(f) / SR)
    b = lp(b, 300) * (0.6 + .4 * np.exp(-(tt % beat) * 8)) * .09
    b *= np.clip(tt / .05, 0, 1) * np.clip((seg1 - seg0 - tt) / .1, 0, 1)
    add(music, b, seg0)

# ---------- reverb + mix ----------
irn = int(1.6 * SR); ir = rng.standard_normal(irn) * np.exp(-np.arange(irn) / SR / .45); ir = lp(ir, 5000); ir /= np.abs(ir).sum() ** .5 * 30
def verb(x, wet): return x + fftconvolve(x, ir)[:N] * wet
def loadw(p):
    w = wave.open(p); d = np.frombuffer(w.readframes(w.getnframes()), np.int16) / 32768.; return d
voice = np.zeros(N)
VD = FIGHT.get('voiceDir', 'voice')
for k, sl in EV['slots'].items():
    p = f'{VD}/{k}.wav'
    if not os.path.exists(p): p = f'voice/common/{k}.wav'
    if os.path.exists(p): add(voice, loadw(p), sl['t'])
    else: print('missing voice', k, file=sys.stderr)
c9 = loadw('voice/common/l09.wav'); cuts = [0, int(.25 * SR), int(.66 * SR), len(c9)]
for j, v in enumerate([45.7, 46.35, 47.0]):
    seg = c9[cuts[j]:cuts[j + 1]].copy(); f = min(len(seg), 240); seg[-f:] *= np.linspace(1, 0, f); add(voice, seg * 1.15, v)
voice = hp(voice, 90) + .25 * bp(voice, 2500, 6000)          # presence
voice = np.tanh(voice * 2.2) / np.tanh(2.2)                  # gentle compression
venv = lp(np.abs(voice), 6); venv = np.clip(venv / (venv.max() + 1e-9) * 4, 0, 1)
duck = 1 - .55 * venv
mix = verb(sfx, .5) * 1.0 + verb(crowd, .3) * .55 * duck + verb(music, .25) * .8 * duck + verb(voice, .1) * 1.6
fade = np.clip((DUR - t) / .6, 0, 1) * np.clip(t / .3, 0, 1)
mix *= fade
mix = np.tanh(mix / np.abs(mix).max() * 2.2) * .89
st = np.stack([mix, verb(mix, .0)], 1)
d = (st * 32767).astype(np.int16)
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())
print('ok')
