#!/usr/bin/env python3
"""Voice-over for one duel.
usage: python3 tts.py fights/<id>.json
-> build/<id>/voice/lXX.wav (trimmed, 48 kHz mono) + build/<id>/fight.json (with subtitle cues)
Needs: edge-tts (pip install edge-tts), ffmpeg, numpy, and events.json (node events.mjs).
Each line has a slot with a maximum length; a line that is too long is re-spoken faster,
and if it still does not fit the script stops so the text can be shortened."""
import json, os, re, subprocess, sys, wave
import numpy as np

VOICE = os.environ.get('VOICE', 'en-US-AndrewMultilingualNeural')
RATES = [16, 21, 26, 31]  # percent faster (Hermann 20.11.2026: a bit faster than v3's +8%)
COMMON = {'l12': "Let's see that again.", 'l13': "Who should fight next? Tell me in the comments!"}
SR = 48000
here = os.path.dirname(os.path.abspath(__file__))


def synth(text, rate, base):
    subprocess.run(['edge-tts', '--voice', VOICE, f'--rate=+{rate}%', '--text', text,
                    '--write-media', base + '.mp3', '--write-subtitles', base + '.vtt'], check=True, capture_output=True)
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', base + '.mp3', '-ar', str(SR), '-ac', '1', '-f', 's16le', '-'],
                         check=True, capture_output=True).stdout
    x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    env = np.convolve(np.abs(x), np.ones(240) / 240, 'same')
    on = np.where(env > 10 ** (-45 / 20))[0]
    i0, i1 = (max(0, on[0] - 480), min(len(x), on[-1] + 960)) if len(on) else (0, len(x))
    cues = []
    t = lambda s: sum(float(p) * m for p, m in zip(s.replace(',', '.').split(':'), (3600, 60, 1)))
    for a, b, txt in re.findall(r'(\d+:\d+:\d+[.,]\d+) --> (\d+:\d+:\d+[.,]\d+)\s*\n(.+?)(?:\n\n|\n*$)', open(base + '.vtt').read(), re.S):
        cues.append([round(max(0, t(a) - i0 / SR), 3), round(t(b) - i0 / SR, 3), ' '.join(txt.split())])
    return x[i0:i1], cues


def write_wav(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def speak(key, text, slot, outdir):
    for rate in RATES:
        x, cues = synth(text, rate, os.path.join(outdir, key))
        dur = len(x) / SR
        if dur <= slot['max']:
            write_wav(os.path.join(outdir, key + '.wav'), x)
            print(f'{key}: {dur:.2f}s / max {slot["max"]}s (+{rate}%)')
            if dur < .75 * slot['max'] and key not in COMMON: print(f'  SHORT: {key} fills only {dur / slot["max"]:.0%} of its slot. Add a fact or joke so the video has no dead air.')
            return cues
    sys.exit(f'TOO LONG: {key} is {dur:.2f}s even at +{RATES[-1]}% (max {slot["max"]}s). Shorten: "{text}"')


def main(path):
    F = json.load(open(path))
    slots = json.load(open(os.path.join(here, 'events.json')))['slots']
    out = os.path.join(here, 'build', F['id']); vdir = os.path.join(out, 'voice'); os.makedirs(vdir, exist_ok=True)
    common = os.path.join(here, 'voice', 'common'); os.makedirs(common, exist_ok=True)
    F['cues'] = {}
    for key, text in F['vo'].items():
        if key not in slots: sys.exit(f'unknown voice slot {key}')
        F['cues'][key] = speak(key, text, slots[key], vdir)
    for key, text in COMMON.items():  # generic lines, spoken once and reused
        cj = os.path.join(common, key + '.json')
        if key in F['vo']: continue
        if not os.path.exists(cj):
            json.dump(speak(key, text, slots[key], common), open(cj, 'w'))
        F['cues'][key] = json.load(open(cj))
    F['voiceDir'] = os.path.relpath(vdir, here)
    json.dump(F, open(os.path.join(out, 'fight.json'), 'w'), indent=1, ensure_ascii=False)
    print('ok ->', os.path.join(out, 'fight.json'))


if __name__ == '__main__':
    main(sys.argv[1])
