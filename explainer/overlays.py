"""Phrase captions (lower third, active word highlighted) + info callouts (labels with pointer, stat cards)."""
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def back(x):  # overshoot ease
    x = min(max(x, 0.0), 1.0)
    c = 1.70158
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def clean(w):
    return w.strip().strip("\"“”")


# ---------------- phrase captions ----------------
def build_chunks(words, max_words=4, max_chars=22):
    chunks, cur = [], []
    for w in words:
        cur.append(w)
        txt = " ".join(clean(x["text"]) for x in cur)
        end_punct = w["text"].strip()[-1:] in ".,!?:;"
        if len(cur) >= max_words or len(txt) >= max_chars or end_punct:
            chunks.append(cur); cur = []
    if cur:
        chunks.append(cur)
    out = []
    for i, c in enumerate(chunks):
        start = c[0]["start"]
        nxt = chunks[i + 1][0]["start"] if i + 1 < len(chunks) else c[-1]["end"] + 0.8
        end = min(nxt, c[-1]["end"] + 0.6)
        out.append(dict(words=c, start=start, end=end))
    return out


class PhraseCaptions:
    def __init__(self, words, font_path, y=0.73, size=82):
        self.chunks = build_chunks(words)
        self.font_path, self.y, self.size = font_path, y, size
        self.cache = {}

    def _layer(self, ci, ai, color):
        key = (ci, ai, color)
        if key in self.cache:
            return self.cache[key]
        if len(self.cache) > 300:
            self.cache.clear()
        words = [clean(w["text"]).upper() for w in self.chunks[ci]["words"]]
        font = ImageFont.truetype(self.font_path, self.size)
        d = ImageDraw.Draw(Image.new("L", (1, 1)))
        sp = d.textlength(" ", font=font)
        widths = [d.textlength(w, font=font) for w in words]
        # wrap into max 2 lines
        lines, cur, cw = [], [], 0
        for i, w in enumerate(widths):
            if cur and cw + sp + w > W - 140:
                lines.append(cur); cur, cw = [], 0
            cw += (sp if cur else 0) + w
            cur.append(i)
        lines.append(cur)
        lh = int(self.size * 1.18)
        hh = lh * len(lines) + 80
        lay = Image.new("RGBA", (W, hh), (0, 0, 0, 0))
        glow = Image.new("RGBA", (W, hh), (0, 0, 0, 0))
        dl, dg = ImageDraw.Draw(lay), ImageDraw.Draw(glow)
        for li, ln in enumerate(lines):
            tw = sum(widths[i] for i in ln) + sp * (len(ln) - 1)
            x = (W - tw) / 2
            y = 40 + li * lh
            for i in ln:
                active = i == ai
                fill = color if active else (255, 255, 255)
                if active:
                    dg.text((x, y), words[i], font=font, fill=color + (255,), stroke_width=12, stroke_fill=color + (255,))
                dl.text((x + 5, y + 7), words[i], font=font, fill=(8, 4, 26, 190), stroke_width=9, stroke_fill=(8, 4, 26, 190))
                dl.text((x, y), words[i], font=font, fill=fill + (255,), stroke_width=8, stroke_fill=(18, 8, 42, 255))
                x += widths[i] + sp
        glow = glow.filter(ImageFilter.GaussianBlur(16))
        glow.alpha_composite(lay)
        self.cache[key] = glow
        return glow

    def draw(self, frame, t, color):
        for ci, c in enumerate(self.chunks):
            if c["start"] - 0.03 <= t < c["end"]:
                ai = 0
                for i, w in enumerate(c["words"]):
                    if t >= w["start"] - 0.03:
                        ai = i
                lay = self._layer(ci, ai, color)
                k = (t - c["start"]) / 0.14
                y0 = int(H * self.y) - lay.height // 2
                if k < 1:
                    s = 0.88 + 0.12 * back(k)
                    lw, lh = int(W * s), int(lay.height * s)
                    l2 = lay.resize((lw, lh), Image.BILINEAR)
                    a = l2.getchannel("A").point(lambda v: int(v * ease(k * 1.5)))
                    l2.putalpha(a)
                    frame.alpha_composite(l2, ((W - lw) // 2, y0 + (lay.height - lh) // 2 + int(18 * (1 - ease(k)))))
                else:
                    frame.alpha_composite(lay, (0, y0))
                return


# ---------------- callouts ----------------
def _neon_box(text, sub, color, font_path, size=66, sub_size=40):
    f = ImageFont.truetype(font_path, size)
    fs = ImageFont.truetype(font_path, sub_size)
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    tw = d.textlength(text, font=f)
    sw = d.textlength(sub, font=fs) if sub else 0
    bw = int(max(tw, sw) + 64)
    bh = int(size * 1.25 + (sub_size * 1.35 if sub else 0) + 34)
    pad = 40
    im = Image.new("RGBA", (bw + 2 * pad, bh + 2 * pad), (0, 0, 0, 0))
    g = Image.new("RGBA", im.size, (0, 0, 0, 0))
    dg = ImageDraw.Draw(g)
    box = (pad, pad, pad + bw, pad + bh)
    dg.rounded_rectangle(box, 22, outline=color + (255,), width=10)
    g = g.filter(ImageFilter.GaussianBlur(12))
    di = ImageDraw.Draw(im)
    di.rounded_rectangle(box, 22, fill=(10, 6, 32, 215), outline=color + (255,), width=4)
    di.text((pad + 32, pad + 14), text, font=f, fill=color + (255,))
    if sub:
        di.text((pad + 32, pad + 14 + size * 1.22), sub, font=fs, fill=(235, 235, 255, 255))
    g.alpha_composite(im)
    return g, pad


def _stat(big, sub, color, font_path):
    fb = ImageFont.truetype(font_path, 150)
    fs = ImageFont.truetype(font_path, 44)
    im = Image.new("RGBA", (W, 330), (0, 0, 0, 0))
    g = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    bw = d.textlength(big, font=fb)
    sw = d.textlength(sub, font=fs)
    ImageDraw.Draw(g).text(((W - bw) / 2, 20), big, font=fb, fill=color + (255,), stroke_width=14, stroke_fill=color + (255,))
    g = g.filter(ImageFilter.GaussianBlur(22))
    d.text(((W - bw) / 2 + 6, 28), big, font=fb, fill=(8, 4, 26, 190), stroke_width=9, stroke_fill=(8, 4, 26, 190))
    d.text(((W - bw) / 2, 20), big, font=fb, fill=color + (255,), stroke_width=8, stroke_fill=(18, 8, 42, 255))
    d.text(((W - sw) / 2, 215), sub, font=fs, fill=(255, 255, 255, 255), stroke_width=6, stroke_fill=(18, 8, 42, 255))
    g.alpha_composite(im)
    return g


class Callouts:
    """items: {at, dur, type: label|stat, text, sub, pos:[x,y] (box centre, 0-1), target:[x,y] (0-1), color}"""

    def __init__(self, items, font_path):
        self.items = items
        for it in items:
            col = hex2rgb(it.get("color", "#3ee8ff"))
            it["_col"] = col
            if it["type"] == "label":
                it["_img"], it["_pad"] = _neon_box(it["text"], it.get("sub", ""), col, font_path)
            else:
                it["_img"] = _stat(it["text"], it.get("sub", ""), col, font_path)

    def draw(self, frame, t):
        for it in self.items:
            lt = t - it["at"]
            if lt < 0 or lt > it["dur"]:
                continue
            out = 1 - ease((lt - (it["dur"] - 0.3)) / 0.3)
            img = it["_img"]
            col = it["_col"]
            if it["type"] == "label":
                cx, cy = it["pos"][0] * W, it["pos"][1] * H
                hw = img.width / 2 - it["_pad"] + 36
                cx = min(max(cx, hw), W - 110 - hw)
                d = ImageDraw.Draw(frame)
                if it.get("target"):
                    tx, ty = it["target"][0] * W, it["target"][1] * H
                    # pulsing target ring
                    r = 16 + 6 * math.sin(lt * 7)
                    ra = int(255 * out * ease(lt / 0.2))
                    d.ellipse((tx - 9, ty - 9, tx + 9, ty + 9), fill=col + (ra,))
                    d.ellipse((tx - r - 8, ty - r - 8, tx + r + 8, ty + r + 8), outline=col + (int(ra * 0.7),), width=4)
                    # line draws from target to box
                    k = ease((lt - 0.1) / 0.3)
                    if k > 0:
                        ex, ey = tx + (cx - tx) * k, ty + (cy - ty) * k
                        d.line((tx, ty, ex, ey), fill=col + (ra,), width=5)
                k = (lt - 0.3) / 0.25
                if k <= 0:
                    continue
                s = 0.6 + 0.4 * back(k)
                iw, ih = int(img.width * s), int(img.height * s)
                im2 = img.resize((iw, ih), Image.BILINEAR) if s != 1 else img.copy()
                # wipe-in left to right
                wipe = ease((lt - 0.3) / 0.35)
                a = im2.getchannel("A")
                if wipe < 1:
                    m = Image.new("L", im2.size, 0)
                    ImageDraw.Draw(m).rectangle((0, 0, int(iw * wipe), ih), fill=255)
                    from PIL import ImageChops
                    a = ImageChops.multiply(a, m)
                if out < 1:
                    a = a.point(lambda v: int(v * out))
                im2.putalpha(a)
                frame.alpha_composite(im2, (int(cx - iw / 2), int(cy - ih / 2)))
            else:  # stat
                k = (lt) / 0.3
                s = 0.5 + 0.5 * back(k)
                iw, ih = int(img.width * s), int(img.height * s)
                im2 = img.resize((iw, ih), Image.BILINEAR)
                a = im2.getchannel("A").point(lambda v: int(v * min(1, ease(k * 2)) * out))
                im2.putalpha(a)
                cy = it.get("pos", [0.5, 0.2])[1] * H
                frame.alpha_composite(im2, (int((W - iw) / 2), int(cy - ih / 2)))
