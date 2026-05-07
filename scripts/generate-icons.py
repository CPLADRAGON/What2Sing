from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import math

out = Path('public')
out.mkdir(exist_ok=True)


def lerp(a, b, t):
    return int(a + (b - a) * t)


def draw_icon(size, name):
    scale = size / 1024
    img = Image.new('RGBA', (size, size), (5, 5, 7, 255))
    grad = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pix = grad.load()
    c1 = (85, 230, 255)
    c2 = (255, 61, 139)
    c3 = (5, 5, 7)

    for y in range(size):
        for x in range(size):
            dx = (x / size) - 0.32
            dy = (y / size) - 0.22
            distance = min(1, math.sqrt(dx * dx + dy * dy) / 0.82)
            if distance < 0.38:
                t = distance / 0.38
                color = tuple(lerp(c1[i], c2[i], t) for i in range(3))
            else:
                t = (distance - 0.38) / 0.62
                color = tuple(lerp(c2[i], c3[i], t) for i in range(3))
            pix[x, y] = (*color, 235)

    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        [int(44 * scale), int(44 * scale), int(980 * scale), int(980 * scale)],
        radius=int(206 * scale),
        fill=255,
    )
    img.alpha_composite(Image.composite(grad, Image.new('RGBA', (size, size), (0, 0, 0, 0)), mask))

    draw = ImageDraw.Draw(img)
    draw.arc(
        [int(160 * scale), int(520 * scale), int(880 * scale), int(930 * scale)],
        12,
        165,
        fill=(255, 255, 255, 45),
        width=max(4, int(34 * scale)),
    )

    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    note = [(332, 252), (332, 554), (365, 554), (365, 374), (629, 320), (629, 494), (662, 494), (662, 220)]
    shadow_draw.polygon([(int(x * scale), int(y * scale)) for x, y in note], fill=(0, 0, 0, 135))
    for cx, cy in [(258, 617), (555, 557)]:
        shadow_draw.ellipse(
            [int((cx - 88) * scale), int((cy - 52) * scale), int((cx + 88) * scale), int((cy + 52) * scale)],
            fill=(0, 0, 0, 135),
        )
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, int(18 * scale))))
    img.alpha_composite(shadow)

    white = (255, 255, 255, 245)
    cyan = (85, 230, 255, 240)
    draw.rounded_rectangle([int(332 * scale), int(252 * scale), int(365 * scale), int(610 * scale)], radius=int(16 * scale), fill=white)
    draw.polygon(
        [(int(332 * scale), int(252 * scale)), (int(662 * scale), int(220 * scale)), (int(662 * scale), int(300 * scale)), (int(332 * scale), int(374 * scale))],
        fill=white,
    )
    draw.rounded_rectangle([int(629 * scale), int(220 * scale), int(662 * scale), int(540 * scale)], radius=int(16 * scale), fill=white)
    draw.ellipse([int(164 * scale), int(546 * scale), int(352 * scale), int(708 * scale)], fill=white)
    draw.ellipse([int(461 * scale), int(486 * scale), int(649 * scale), int(648 * scale)], fill=white)
    draw.line(
        [(int(231 * scale), int(576 * scale)), (int(342 * scale), int(690 * scale)), (int(557 * scale), int(465 * scale))],
        fill=cyan,
        width=max(8, int(44 * scale)),
        joint='curve',
    )
    draw.ellipse([int(696 * scale), int(212 * scale), int(788 * scale), int(304 * scale)], fill=(255, 255, 255, 235))
    draw.ellipse([int(788 * scale), int(328 * scale), int(824 * scale), int(364 * scale)], fill=(85, 230, 255, 235))
    draw.ellipse([int(202 * scale), int(255 * scale), int(234 * scale), int(287 * scale)], fill=(255, 177, 211, 235))
    img.save(out / name)


for icon_size, filename in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
    draw_icon(icon_size, filename)
