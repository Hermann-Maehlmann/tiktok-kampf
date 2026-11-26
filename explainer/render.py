#!/usr/bin/env python3
"""Neon science explainer renderer.

Usage: render.py <episode.json> <out.mp4>
episode.json: {
  "voice": "voice.mp3", "music": "music.mp3" (optional), "words": "words.json",
  "scenes": [{"start": 0.0, "image": "img/s01.png", "color": "#ff3b5c",
              "motion": "in"|"out"|"left"|"right"|"up", "focus": [0.5, 0.5]}, ...],
  "tail": 1.6
}
Paths are relative to the episode file.
"""
import json, math, os, random, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "InterDisplay-BlackItalic.otf")


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def load_scene_img(path):
    im = Image.open(path).convert("RGB")
    # cover 1080x1920 with 22% headroom for motion
    s = max(W / im.width, H / im.height) * 1.22
    return im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)


def load_clip(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-vf",
        f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS}",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    n = len(raw) // (W * H * 3)
    return [Image.frombuffer("RGB", (W, H), raw[i*W*H*3:(i+1)*W*H*3]) for i in range(n)]


def clip_frame(frames, t, dur):
    # stretch clip over scene duration, slight push-in
    i = min(int(t / dur * len(frames)), len(frames) - 1)
    im = frames[i]
    z = 1.0 + 0.04 * (t / dur) + 0.05 * (1 - ease(t / 0.35))
    cw, ch = W / z, H / z
    return im.resize((W, H), Image.BICUBIC, box=((W-cw)/2, (H-ch)/2, (W+cw)/2, (H+ch)/2))


def scene_frame(big, t, dur, motion, focus):
    p = ease(t / dur) if dur > 0 else 0
    lin = t / dur if dur > 0 else 0
    z0, z1 = 1.0, 1.0
    dx = dy = 0.0
    if motion == "in":
        z0, z1 = 1.0, 1.14
    elif motion == "out":
        z0, z1 = 1.14, 1.0
    elif motion == "left":
        z0 = z1 = 1.06; dx = 0.05 - 0.10 * lin
    elif motion == "right":
        z0 = z1 = 1.06; dx = -0.05 + 0.10 * lin
    elif motion == "up":
        z0 = z1 = 1.06; dy = 0.04 - 0.08 * lin
    z = z0 + (z1 - z0) * (0.5 * p + 0.5 * lin)
    # punch-in on scene start
    z *= 1.0 + 0.05 * (1 - ease(t / 0.35))
    # breathing wobble
    z *= 1.0 + 0.006 * math.sin(t * 2.1)
    bw, bh = big.size
    cw, ch = bw / 1.22 / z, bh / 1.22 / z
    fx, fy = focus
    cx = fx * bw + dx * bw + 6 * math.sin(t * 0.9)
    cy = fy * bh + dy * bh + 6 * math.cos(t * 0.7)
    cx = min(max(cx, cw / 2), bw - cw / 2)
    cy = min(max(cy, ch / 2), bh - ch / 2)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    return big.resize((W, H), Image.BICUBIC, box=box)


def make_sprite(r, color):
    size = r * 6
    im = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(im)
    c = size // 2
    d.ellipse((c - r, c - r, c + r, c + r), fill=255)
    im = im.filter(ImageFilter.GaussianBlur(r * 1.2))
    a = np.asarray(im, np.float32) / 255.0
    rgb = np.array(color, np.float32)[None, None, :] / 255.0
    return a[..., None] * rgb


class Particles:
    def __init__(self, n=70, seed=7):
        rnd = random.Random(seed)
        cols = [(120, 240, 255), (255, 210, 90), (255, 90, 200), (255, 255, 255)]
        self.p = []
        for _ in range(n):
            r = rnd.choice([2, 2, 3, 4, 6])
            self.p.append(dict(x=rnd.random() * W, y=rnd.random() * H,
                               vy=-(15 + rnd.random() * 50), vx=rnd.uniform(-8, 8),
                               ph=rnd.random() * 6.28, f=rnd.uniform(1.5, 4),
                               spr=make_sprite(r, rnd.choice(cols))))

    def draw(self, arr, t):
        for q in self.p:
            x = (q["x"] + q["vx"] * t) % W
            y = (q["y"] + q["vy"] * t) % H
            a = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(q["ph"] + t * q["f"]))
            s = q["spr"]
            sh, sw = s.shape[:2]
            x0, y0 = int(x - sw / 2), int(y - sh / 2)
            x1, y1 = x0 + sw, y0 + sh
            if x0 < 0 or y0 < 0 or x1 > W or y1 > H:
                continue
            arr[y0:y1, x0:x1] += s * a * 0.9


def build_overlay():
    yy = np.arange(H)[:, None]
    scan = np.where((yy % 4) < 2, 1.0, 0.86).astype(np.float32)
    xs = (np.arange(W) - W / 2) / (W / 2)
    ys = (np.arange(H) - H / 2) / (H / 2)
    vig = 1.0 - 0.38 * np.clip((xs[None, :] ** 2 + ys[:, None] ** 2) / 1.6, 0, 1)
    return (scan * vig)[..., None].astype(np.float32)


def caption_layer(word, color, scale):
    font = ImageFont.truetype(FONT, int(118 * scale))
    tmp = Image.new("RGBA", (W, 400), (0, 0, 0, 0))
    d = ImageDraw.Draw(tmp)
    bb = d.textbbox((0, 0), word, font=font, stroke_width=10)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    if tw > W - 80:  # shrink long words
        font = ImageFont.truetype(FONT, int(118 * scale * (W - 80) / tw))
        bb = d.textbbox((0, 0), word, font=font, stroke_width=10)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x, y = (W - tw) // 2 - bb[0], (400 - th) // 2 - bb[1]
    glow = Image.new("RGBA", (W, 400), (0, 0, 0, 0))
    ImageDraw.Draw(glow).text((x, y), word, font=font, fill=color + (255,), stroke_width=14, stroke_fill=color + (255,))
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    out = Image.new("RGBA", (W, 400), (0, 0, 0, 0))
    out.alpha_composite(glow)
    d2 = ImageDraw.Draw(out)
    d2.text((x + 6, y + 8), word, font=font, fill=(10, 5, 30, 200), stroke_width=10, stroke_fill=(10, 5, 30, 200))
    d2.text((x, y), word, font=font, fill=color + (255,), stroke_width=9, stroke_fill=(20, 8, 45, 255))
    return out


def main():
    ep_path, out = sys.argv[1], sys.argv[2]
    base = os.path.dirname(os.path.abspath(ep_path))
    ep = json.load(open(ep_path))
    P = lambda p: os.path.join(base, p)
    words = json.load(open(P(ep["words"])))["words"]
    words = [w for w in words if w.get("type", "word") == "word"]
    voice_dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", P(ep["voice"])]).decode())
    total = voice_dur + ep.get("tail", 1.6)
    nframes = int(os.environ.get("LIMIT", 0)) or int(total * FPS)
    scenes = ep["scenes"]
    for i, s in enumerate(scenes):
        s["end"] = scenes[i + 1]["start"] if i + 1 < len(scenes) else total
        s["big"] = None
    cache = {}
    for s in scenes:
        if s.get("video"):
            s["clip"] = load_clip(P(s["video"]))
        if s["image"] not in cache:
            cache[s["image"]] = load_scene_img(P(s["image"]))
        s["big"] = cache[s["image"]]
    overlay = build_overlay()
    parts = Particles()
    cap_cache = {}
    phrase = callouts = None
    if ep.get("captions") == "phrase":
        from overlays import PhraseCaptions, Callouts
        phrase = PhraseCaptions(words, FONT)
        callouts = Callouts(ep.get("callouts", []), FONT) if ep.get("callouts") else None

    living = {}
    if ep.get("living"):
        from anim import Living
        for k, v in cache.items():
            living[k] = Living(v)

    def render_scene(sc, t):
        if sc.get("clip"):
            return np.asarray(clip_frame(sc["clip"], t - sc["start"], sc["end"] - sc["start"]), np.float32) / 255.0
        if living:
            return living[sc["image"]].frame(t - sc["start"], sc["end"] - sc["start"], sc.get("motion", "in"), sc.get("focus", [0.5, 0.5]), sc.get("fx", {}))
        return np.asarray(scene_frame(sc["big"], t - sc["start"], sc["end"] - sc["start"], sc.get("motion", "in"), sc.get("focus", [0.5, 0.5])), np.float32) / 255.0

    def word_at(t):
        for i, w in enumerate(words):
            nxt = words[i + 1]["start"] if i + 1 < len(words) else w["end"] + 0.6
            if w["start"] - 0.03 <= t < max(nxt, w["start"] + 0.12):
                return i, w
        return None, None

    tmp_video = out + ".video.mp4"
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                           "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", os.environ.get("CRF", "21"), "-pix_fmt", "yuv420p", tmp_video],
                          stdin=subprocess.PIPE)
    test = [int(x) for x in os.environ.get("FRAMES", "").split(",") if x]
    for fi in (test or range(nframes)):
        t = fi / FPS
        si = max(i for i, s in enumerate(scenes) if s["start"] <= t)
        s = scenes[si]
        img = render_scene(s, t)
        # short crossfade from previous scene
        ts = t - s["start"]
        if si > 0 and ts < 0.18:
            pv = scenes[si - 1]
            prev = render_scene(pv, t)
            k = ease(ts / 0.18)
            img = prev * (1 - k) + img * k
        arr = np.array(img, np.float32)
        # glow pulse
        arr *= 1.0 + 0.05 * math.sin(t * 3.0)
        parts.draw(arr, t)
        # flash on cut
        if si > 0 and ts < 0.12:
            arr += (1 - ts / 0.12) * 0.25
        # chromatic offset
        arr[:, 3:, 0] = arr[:, :-3, 0]
        arr[:, :-3, 2] = arr[:, 3:, 2]
        arr *= overlay
        arr += np.random.default_rng(fi).normal(0, 0.012, (H // 4, W // 4, 1)).repeat(4, 0).repeat(4, 1)
        frame = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
        if phrase:
            frame = frame.convert("RGBA")
            if callouts:
                callouts.draw(frame, t)
            if t < voice_dur + 0.4:
                phrase.draw(frame, t, hex2rgb(s.get("color", "#ff3b5c")))
            frame = frame.convert("RGB")
        wi, w = word_at(t) if not phrase else (None, None)
        if w is not None and t < voice_dur + 0.4:
            txt = w["text"].strip(".,!?;:\"“”").strip()
            txt = txt[:1].upper() + txt[1:]
            k = ease((t - w["start"]) / 0.09)
            scale = 1.25 - 0.25 * k
            key = (txt, s.get("color", "#ff3b5c"), round(scale, 2))
            if key not in cap_cache:
                if len(cap_cache) > 400:
                    cap_cache.clear()
                cap_cache[key] = caption_layer(txt, hex2rgb(s.get("color", "#ff3b5c")), scale)
            frame = frame.convert("RGBA")
            frame.alpha_composite(cap_cache[key], (0, int(H * 0.5) - 200))
            frame = frame.convert("RGB")
        if test:
            frame.save(f"{out}.{fi}.jpg"); continue
        ff.stdin.write(frame.tobytes())
        if fi % 300 == 0:
            print(f"frame {fi}/{nframes}", flush=True)
    ff.stdin.close()
    ff.wait()
    # audio mix: voice + music bed (ducked) with fades
    inputs = ["-i", tmp_video, "-i", P(ep["voice"])]
    if ep.get("music"):
        inputs += ["-i", P(ep["music"])]
        fc = (f"[1:a]aresample=48000,apad=pad_dur=3[v];"
              f"[2:a]aresample=48000,volume=0.20,afade=t=in:d=0.8,afade=t=out:st={total-1.8}:d=1.8[m];"
              f"[v][m]amix=inputs=2:duration=first:normalize=0,atrim=0:{total},loudnorm=I=-14:TP=-1.5:LRA=11[a]")
    else:
        fc = f"[1:a]aresample=48000,apad,atrim=0:{total},loudnorm=I=-14:TP=-1.5[a]"
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
                           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{total}", "-movflags", "+faststart", out])
    os.remove(tmp_video)
    print("done", out, total)


if __name__ == "__main__":
    main()
