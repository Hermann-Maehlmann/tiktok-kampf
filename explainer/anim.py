"""'Living image' animation: parallax fg/bg split, organic wobble, neon bloom pulse, light sweep."""
import math
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

torch.set_num_threads(4)
W, H = 1080, 1920
HEAD = 1.22


def _blur(x, k):
    # cheap large blur: downsample, box blur, upsample
    _, _, h, w = x.shape
    f = max(1, k // 6)
    s = F.avg_pool2d(x, f, f) if f > 1 else x
    kk = max(3, (k // f) | 1)
    s = F.avg_pool2d(s, kk, 1, kk // 2, count_include_pad=False)
    s = F.avg_pool2d(s, kk, 1, kk // 2, count_include_pad=False)
    return F.interpolate(s, size=(h, w), mode="bilinear", align_corners=False)


def _smooth(x, a, b):
    x = ((x - a) / (b - a)).clamp(0, 1)
    return x * x * (3 - 2 * x)


class Living:
    def __init__(self, big_pil):
        a = torch.from_numpy(np.asarray(big_pil, np.float32) / 255.0).permute(2, 0, 1)[None]
        self.h, self.w = a.shape[2], a.shape[3]
        lum = a.max(1, keepdim=True).values
        mn = a.min(1, keepdim=True).values
        sat = (lum - mn) / (lum + 1e-4)
        score = _blur(lum * (0.4 + 0.6 * sat), 15)
        m = _smooth(score, 0.16, 0.38)
        m = F.max_pool2d(m, 9, 1, 4)
        m = _blur(m, 13).clamp(0, 1)
        inv = 1 - m
        fill = _blur(a * inv, 120) / (_blur(inv, 120) + 1e-3)
        bg = a * inv + fill.clamp(0, 1) * m
        bright = _smooth(lum, 0.55, 0.95) * a
        bloom = _blur(bright, 24) * 0.7 + _blur(bright, 70) * 0.45
        self.bg = bg
        self.fgstack = torch.cat([a, m, bloom], 1)  # 7 channels
        ys = torch.linspace(-1, 1, H)
        xs = torch.linspace(-1, 1, W)
        self.gy, self.gx = torch.meshgrid(ys, xs, indexing="ij")

    def _grid(self, cx, cy, cw, ch, dx=None, dy=None):
        # map output pixels to normalized coords of big image
        px = (cx + self.gx * cw / 2) / self.w * 2 - 1
        py = (cy + self.gy * ch / 2) / self.h * 2 - 1
        if dx is not None:
            px = px + dx / self.w * 2
            py = py + dy / self.h * 2
        return torch.stack([px, py], -1)[None]

    def frame(self, t, dur, motion, focus, fx):
        from_ease = lambda x: (lambda y: y * y * (3 - 2 * y))(min(max(x, 0.0), 1.0))
        p = from_ease(t / dur) if dur > 0 else 0
        lin = t / dur if dur > 0 else 0
        z0 = z1 = 1.0
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
        z *= 1.0 + 0.05 * (1 - from_ease(t / 0.35))
        bw, bh = self.w, self.h
        fx_, fy_ = focus
        wob = fx.get("wobble", 4.0)
        par = fx.get("parallax", 1.0)

        def cam(zf, pan):
            zz = 1 + (z - 1) * zf
            cw, ch = bw / HEAD / zz, bh / HEAD / zz
            cx = fx_ * bw + dx * bw * pan + 10 * pan * math.sin(t * 0.9)
            cy = fy_ * bh + dy * bh * pan + 10 * pan * math.cos(t * 0.7)
            cx = min(max(cx, cw / 2), bw - cw / 2)
            cy = min(max(cy, ch / 2), bh - ch / 2)
            return cx, cy, cw, ch

        # background: slower, drifts opposite
        cbx, cby, cbw, cbh = cam(0.45, -0.6 * par)
        bg = F.grid_sample(self.bg, self._grid(cbx, cby, cbw, cbh), mode="bilinear", padding_mode="border", align_corners=False)
        # foreground: faster + breathing + organic wobble
        breathe = 1 + 0.018 * math.sin(t * 1.7) * fx.get("breathe", 1.0)
        cfx, cfy, cfw, cfh = cam(1.35, 1.4 * par)
        cfw /= breathe
        cfh /= breathe * (1 + 0.006 * math.sin(t * 1.7 + 0.8))
        gx, gy = self.gx, self.gy
        ddx = wob * (torch.sin(gy * 9.0 + t * 2.3) + 0.6 * torch.sin(gy * 23.0 - t * 3.1 + gx * 4))
        ddy = wob * (torch.sin(gx * 7.0 - t * 1.9) + 0.6 * torch.sin(gx * 19.0 + t * 2.7 + gy * 5))
        st = F.grid_sample(self.fgstack, self._grid(cfx, cfy, cfw, cfh, ddx, ddy), mode="bilinear", padding_mode="border", align_corners=False)
        fg, m, bloom = st[:, :3], st[:, 3:4], st[:, 4:]
        out = bg * (1 - m) + fg * m
        # neon pulse travelling along the lines
        wave = 0.55 + 0.45 * torch.sin(gy * 6.0 - t * 3.4 + gx * 2.0)
        pulse = 0.16 + 0.14 * math.sin(t * 2.6)
        out = out + bloom * (pulse * (0.6 + 0.8 * wave)) * fx.get("glow", 1.0)
        # one light sweep per scene across the subject
        sp = (t / max(dur, 0.1)) * 3.2 - 1.6
        band = torch.exp(-((gx * 0.6 + gy * 0.35 - sp) ** 2) / 0.02)
        out = out + band[None, None] * m * 0.16
        # flicker for fire/electric scenes
        if fx.get("flicker"):
            out = out * (1 + 0.07 * math.sin(t * 31) * math.sin(t * 13.7))
        return out[0].permute(1, 2, 0).clamp(0, 1.5).numpy()
