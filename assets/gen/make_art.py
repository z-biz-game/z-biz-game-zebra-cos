#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""谁养鱼 ZEBRA · 美术资产生成器（仓内自绘，可复现，不依赖网络/系统时钟）。

母题（与玩法一致，颜色取自本仓真值，不凭空编）：
  一张"纸墨逻辑格"卡片（三态格子里有两三个 ✗/✓ 的铅笔注记）压在几道**斑马条纹**上，
  右上角一条靛蓝**鱼**游过来 —— 正面回答"谁养鱼"这一问。
  纸色 #fbf8f2 / 墨色 #1b1a18 / 线 #cfc7b8 / 棕 ✓ #6b4a2f / 红 ✗ #b23a30 / 光标靛蓝 #2b6cb0，
  都是从 js/render/board.js 与 css/game.css 里抄来的同一套色，保证图标与盘面对得上。

产出的都是**真实可读的位图**（PNG，RGBA），全部由这张母图在 4× 超采样下矢量绘制再 LANCZOS 缩到目标尺寸：
  icons/icon-512.png            PWA 512
  icons/icon-192.png            PWA 192
  icons/icon-maskable-512.png   PWA maskable（主体缩进 80% 安全区，四周纯纸色）
  icons/apple-touch-icon.png    iOS 180
  icons/favicon-32.png / -16.png
  assets/paper-texture.png      页面级纸纹（CSS body 背景用的可平铺颗粒）
  assets/sprite-zebra-fish.png  游戏内品牌 sprite（页眉用，透明底）
  assets/og-card.png            社交卡 1200×630（og:image）

复现：`python3 assets/gen/make_art.py`（需要 Pillow，与本组合 007_美术资产/make_icons.py 同一条依赖）。
本脚本**只用确定性 LCG（自己实现，不 import random、不调 Date.now/new Date）**，同一份源码在任何机器上
逐字节产出同样的图，不掺时间戳。重跑是幂等的（固定 seed ⇒ 颗粒噪声一致）。
"""
import os
from PIL import Image, ImageDraw, ImageFilter

# ── 路径：仓根 = 本脚本所在目录的上上级（assets/gen/ → assets/ → 仓根）──────────────────
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ICONS = os.path.join(ROOT, 'icons')
ASSETS = os.path.join(ROOT, 'assets')

# ── 配色：与本仓 js/render/board.js / css/game.css 同一套，逐值抄来 ──────────────────────
INK       = (27, 26, 24)        # #1b1a18
INK_SOFT  = (92, 86, 77)        # #5c564d
LINE      = (207, 199, 184)     # #cfc7b8
LINE_BOLD = (138, 131, 120)     # #8a8378
PAPER     = (251, 248, 242)     # #fbf8f2
PAPER_ALT = (242, 237, 228)     # #f2ede4
CARD      = (255, 253, 248)     # 卡片比纸再亮一点
ACCENT    = (138, 90, 43)       # #8a5a2b
CHECK_INK = (107, 74, 47)        # #6b4a2f  铅笔 ✓ 的棕墨
BAD       = (178, 58, 48)        # #b23a30  冲突/✗ 的红
CURSOR    = (43, 108, 176)       # #2b6cb0  光标蓝 —— 用来画那条鱼
ZEBRA     = (24, 23, 22)         # 斑马墨条
FOIL      = (207, 190, 150)      # 纸卡投在底上的一层暖高光


def a(color, alpha):
    return (color[0], color[1], color[2], alpha)


class Rng:
    """确定性线性同余（Numerical Recipes 参数），不碰系统时钟也不 import random。"""
    _M = (1 << 32)
    _A = 1664525
    _C = 1013904223

    def __init__(self, seed):
        self.s = seed & (self._M - 1)

    def next(self):
        self.s = (self._A * self.s + self._C) % self._M
        return self.s

    def float(self):
        return self.next() / self._M

    def range(self, lo, hi):
        return lo + self.float() * (hi - lo)


def render_master(S, maskable=False):
    """在 S×S 的 RGBA 上画出母图（S 建议取目标尺寸 ×4 做超采样）。maskable=True 时主体缩进 80% 安全区。"""
    img = Image.new('RGBA', (S, S), a(PAPER, 255))
    d = ImageDraw.Draw(img, 'RGBA')
    u = S / 100.0
    rng = Rng(20261003)  # 固定 seed ⇒ 颗粒/微旋转逐次一致

    scale = 0.80 if maskable else 1.0

    def sq(v):
        return v * u * scale

    # 1) 底：纸色 + 极淡的对角 hatch（确定性）
    for i in range(-20, 120, 7):
        d.line([(i * u, 0), ((i - 40) * u, S)], fill=a(ACCENT, 8), width=max(1, int(0.4 * u)))
    # 2) 斑马条纹：从左下角探出的几道墨条（圆头粗线），压在卡片下
    for k, off in enumerate((-10, 4, 18)):
        w = sq(9.0 - k * 0.6)
        x0, y0 = (off) * u, S - (2) * u
        x1, y1 = (off + 26) * u, S - sq(34)
        d.line([x0, y0, x1, y1], fill=a(ZEBRA, 210 - k * 12), width=int(w))

    # 3) 卡片投影 + 卡片本体（圆角矩形，纸白，墨边）；绕中心缩放由 scale 决定
    pad = sq(2.2)
    cxL, cyT = (50 + (2 - 50) * scale) * u, (50 + (18 - 50) * scale) * u
    cxR, cyB = (50 + (40 - 50) * scale) * u, (50 + (58 - 50) * scale) * u
    d.rounded_rectangle([cxL + pad, cyT + pad, cxR + pad, cyB + pad],
                        radius=sq(5), fill=a(INK, 40))
    d.rounded_rectangle([cxL, cyT, cxR, cyB], radius=sq(5),
                        fill=a(CARD, 255), outline=a(INK, 255), width=max(2, int(sq(1.1))))

    # 4) 3×3 逻辑格（画在卡片内），棋盘底纹 + 细线 + 中缝粗线
    gx0, gy0 = cxL + sq(4.5), cyT + sq(4.5)
    gx1, gy1 = cxR - sq(4.5), cyB - sq(4.5)
    cw, ch = (gx1 - gx0) / 3.0, (gy1 - gy0) / 3.0
    for i in range(3):
        for j in range(3):
            x, y = gx0 + j * cw, gy0 + i * ch
            fill = a(PAPER_ALT, 255) if (i + j) % 2 else a(CARD, 255)
            d.rectangle([x, y, x + cw, y + ch], fill=fill)
    for i in range(3):
        for j in range(3):
            x, y = gx0 + j * cw, gy0 + i * ch
            d.rectangle([x, y, x + cw, y + ch], outline=a(LINE, 255), width=max(1, int(sq(0.4))))
    # 外框粗线
    d.rectangle([gx0, gy0, gx1, gy1], outline=a(LINE_BOLD, 255), width=max(2, int(sq(1.0))))

    # 5) 铅笔注记：两 ✓ 一 ✗，像纸笔做到一半
    def cell_center(i, j):
        return (gx0 + (j + 0.5) * cw, gy0 + (i + 0.5) * ch)
    marks = [((0, 0), 'check'), ((1, 2), 'check'), ((2, 1), 'cross'), ((2, 0), 'cross')]
    for (i, j), kind in marks:
        mx, my = cell_center(i, j)
        r = min(cw, ch) * 0.30
        if kind == 'check':
            _check2(d, mx, my, r, a(CHECK_INK, 255))
        else:
            _cross2(d, mx, my, r, a(BAD, 255))

    # 6) 靛蓝鱼：右上角，朝左游（"谁养鱼"）
    fL = sq(15)
    fx, fy = (50 + (66 - 50) * scale) * u, (50 + (22 - 50) * scale) * u
    _fish_px(d, fx, fy, fL, a(CURSOR, 255), a(INK_SOFT, 255), rng)

    # 7) 纸面颗粒（细、确定性），maskable 版不加边缘杂质
    grain = 26 if maskable else 42
    for _ in range(int(grain * scale * scale)):
        gx, gy = rng.float() * S, rng.float() * S
        gr = max(1, int(0.5 * u))
        d.ellipse([gx, gy, gx + gr, gy + gr], fill=a(INK, int(rng.range(5, 16))))
    if not maskable:
        img = img.filter(ImageFilter.GaussianBlur(S * 0.0016))
    return img


def _check2(d, x, y, r, color):
    lw = max(2, int(r * 0.42))
    p0, p1, p2 = (x - 0.95 * r, y - 0.05 * r), (x - 0.18 * r, y + 0.72 * r), (x + 1.0 * r, y - 0.82 * r)
    d.line([p0, p1, p2], fill=color, width=lw, joint='curve')
    for px, py in (p0, p1, p2):
        rr = lw // 2
        d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=color)


def _cross2(d, x, y, r, color):
    lw = max(2, int(r * 0.34))
    for x1, y1, x2, y2 in ((x - r, y - r, x + r, y + r), (x - r, y + r, x + r, y - r)):
        d.line([(x1, y1), (x2, y2)], fill=color, width=lw)
    for kx, ky in ((-r, -r), (r, r), (-r, r), (r, -r)):
        rr = lw // 2
        d.ellipse([x + kx - rr, y + ky - rr, x + kx + rr, y + ky + rr], fill=color)


def _fish_px(d, x, y, L, color, dark, rng):
    """像素坐标的鱼（右上角用）：L 为身长像素。纺锤身 + 三角尾 + 背鳍 + 眼 + 两道体纹。"""
    H = L * 0.54
    body = [(x - 0.42 * L, y), (x - 0.12 * L, y - 0.44 * H), (x + 0.24 * L, y - 0.34 * H),
            (x + 0.46 * L, y), (x + 0.24 * L, y + 0.34 * H), (x - 0.12 * L, y + 0.44 * H)]
    d.polygon(body, fill=color)
    d.polygon([(x + 0.44 * L, y), (x + 0.74 * L, y - 0.36 * H), (x + 0.74 * L, y + 0.36 * H)], fill=dark)
    d.polygon([(x + 0.00 * L, y - 0.34 * H), (x + 0.20 * L, y - 0.30 * H), (x + 0.08 * L, y - 0.66 * H)], fill=dark)
    for fx in (-0.10, 0.14):
        d.line([(x + fx * L, y - 0.26 * H), (x + (fx + 0.05) * L, y + 0.26 * H)],
               fill=dark, width=max(2, int(L * 0.035)))
    ex, ey, er = x - 0.30 * L, y - 0.06 * H, L * 0.055
    d.ellipse([ex - er, ey - er, ex + er, ey + er], fill=a(CARD, 255))
    pr = er * 0.5
    d.ellipse([ex - pr, ey - pr, ex + pr, ey + pr], fill=a(INK, 255))


def down(img, size):
    return img.resize((size, size), Image.LANCZOS)


def font_for(size):
    from PIL import ImageFont
    cands = [
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
    ]
    for p in cands:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def render_og():
    """1200×630 社交卡：左侧大标题「谁养鱼 ZEBRA」+ 副标，右侧压暗面板放母图徽标。"""
    W, H = 1200, 630
    base = Image.new('RGBA', (W, H), a(PAPER, 255))
    d = ImageDraw.Draw(base, 'RGBA')
    # 整张卡铺几道淡斑马墨条（对角），像一张压在桌上的斑马皮纸
    for off in range(-120, W + 160, 150):
        d.line([(off, H + 40), (off + 200, -40)], fill=a(ZEBRA, 22), width=44)
    # 右侧压一层暖暗，托住徽标
    d.rectangle([760, 0, W, H], fill=a(INK_SOFT, 34))
    d.rectangle([760, 0, 762, H], fill=a(LINE_BOLD, 255))
    # 母图徽标放右侧（4× 超采样再缩到 460）
    em = down(render_master(4 * 460, maskable=False), 460)
    base.alpha_composite(em, (735, (H - 460) // 2))
    d = ImageDraw.Draw(base, 'RGBA')
    d.text((72, 138), '谁养鱼', font=font_for(150), fill=a(INK, 255))
    d.text((76, 330), 'ZEBRA · 逻辑格', font=font_for(52), fill=a(ACCENT, 255))
    d.text((76, 416), '纸笔推理 · 每一盘都由 seed 现算，唯一解被引擎证明', font=font_for(38), fill=a(INK_SOFT, 255))
    return base


def render_texture(size=256):
    """可平铺纸纹：暖纸底 + 确定性细颗粒 + 极淡纤维，供 CSS 背景。边缘无缝（颗粒取模平移）。"""
    img = Image.new('RGBA', (size, size), a(PAPER, 255))
    d = ImageDraw.Draw(img, 'RGBA')
    rng = Rng(19621217)  # Life 原题面日期当固定 seed，不读系统时钟
    for _ in range(int(size * size * 0.012)):
        x, y = rng.float() * size, rng.float() * size
        r = rng.range(0.4, 1.6)
        d.ellipse([x, y, x + r, y + r], fill=a(INK, int(rng.range(4, 16))))
    # 淡纤维（短斜线），两端都取模保证平铺无缝
    for _ in range(int(size * 0.5)):
        x, y = rng.float() * size, rng.float() * size
        ln = rng.range(4, 12)
        ang = rng.range(-0.6, 0.6)
        x2, y2 = x + ln * 0.9, y + ln * ang
        d.line([(x % size, y % size), (x2 % size, y2 % size)], fill=a(ACCENT, int(rng.range(4, 12))), width=1)
    return img


def render_sprite(size=256):
    """透明底品牌 sprite：斑马条纹 + 逻辑格小卡 + 鱼，页眉用。"""
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, 'RGBA')
    u = S / 100.0
    # 几道斑马墨条（对角）
    for off in (-6, 12, 30):
        d.line([off * u, 100 * u, (off + 30) * u, 0], fill=a(ZEBRA, 200), width=int(9 * u))
    # 中央一张 2×2 小逻辑格卡
    d.rounded_rectangle([28 * u, 30 * u, 74 * u, 76 * u], radius=6 * u,
                        fill=a(CARD, 255), outline=a(INK, 255), width=int(2 * u))
    d.line([28 * u, 53 * u, 74 * u, 53 * u], fill=a(LINE, 255), width=int(1.4 * u))
    d.line([51 * u, 30 * u, 51 * u, 76 * u], fill=a(LINE, 255), width=int(1.4 * u))
    _check2(d, 40 * u, 42 * u, 6 * u, a(CHECK_INK, 255))
    _cross2(d, 63 * u, 63 * u, 5.5 * u, a(BAD, 255))
    # 右上角的鱼
    _fish_px(d, 70 * u, 22 * u, 16 * u, a(CURSOR, 255), a(INK_SOFT, 255), Rng(1))
    return img.resize((size, size), Image.LANCZOS)


def save(img, rel):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # 去掉多余元数据保证可复现；PNG 由 Pillow 写确定性字节（同一尺寸同一像素）。
    img.save(path, 'PNG', optimize=True)
    return path


def main():
    SS = 4
    master1024 = render_master(1024 * SS)
    master_mask = render_master(1024 * SS, maskable=True)
    outputs = {
        'icons/icon-512.png': down(master1024, 512),
        'icons/icon-192.png': down(master1024, 192),
        'icons/icon-180.png': down(master1024, 180),
        'icons/apple-touch-icon.png': down(master1024, 180),
        'icons/icon-maskable-512.png': down(master_mask, 512),
        'icons/icon-maskable-192.png': down(master_mask, 192),
        'icons/favicon-32.png': down(master1024, 32),
        'icons/favicon-16.png': down(master1024, 16),
    }
    written = []
    for rel, im in outputs.items():
        written.append(save(im, rel))
    written.append(save(render_og(), 'assets/og-card.png'))
    written.append(save(render_texture(256), 'assets/paper-texture.png'))
    written.append(save(render_sprite(256), 'assets/sprite-zebra-fish.png'))
    for p in written:
        print(os.path.relpath(p, ROOT))
    print('-> 生成 %d 个位图，母图 seed=20261003（确定性 LCG，无系统时钟）' % len(written))


if __name__ == '__main__':
    main()
