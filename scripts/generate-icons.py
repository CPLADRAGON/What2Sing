from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import math

OUT = Path('public')
OUT.mkdir(exist_ok=True)


def lerp(a, b, t):
    return int(a + (b - a) * t)


def scale_box(box, scale):
    return [int(v * scale) for v in box]


def draw_icon(size, filename):
    scale = size / 1024
    img = Image.new('RGBA', (size, size), (5, 5, 7, 255))
    pixels = img.load()
    c1 = (35, 35, 54)
    c2 = (17, 17, 24)
    c3 = (5, 5, 7)

    for y in range(size):
        for x in range(size):
            dx = (x / size) - 0.34
            dy = (y / size) - 0.24
            distance = min(1, math.sqrt(dx * dx + dy * dy) / 0.86)
            if distance < 0.52:
                t = distance / 0.52
                color = tuple(lerp(c1[i], c2[i], t) for i in range(3))
            else:
                t = (distance - 0.52) / 0.48
                color = tuple(lerp(c2[i], c3[i], t) for i in range(3))
            pixels[x, y] = (*color, 255)

    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, size, size], radius=int(232 * scale), fill=255)
    img.putalpha(mask)

    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(scale_box([202, 202, 822, 822], scale), outline=(85, 230, 255, 65), width=max(4, int(70 * scale)))
    glow_draw.ellipse(scale_box([202, 202, 822, 822], scale), outline=(255, 61, 139, 55), width=max(3, int(42 * scale)))
    glow = glow.filter(ImageFilter.GaussianBlur(max(2, int(10 * scale))))
    img.alpha_composite(glow)

    draw = ImageDraw.Draw(img)
    draw.ellipse(scale_box([202, 202, 822, 822], scale), outline=(235, 252, 255, 245), width=max(5, int(54 * scale)))
    draw.arc(scale_box([202, 202, 822, 822], scale), 130, 254, fill=(85, 230, 255, 255), width=max(5, int(54 * scale)))
    draw.arc(scale_box([202, 202, 822, 822], scale), -48, 44, fill=(255, 61, 139, 255), width=max(5, int(54 * scale)))
    draw.ellipse(scale_box([294, 294, 730, 730], scale), fill=(5, 5, 7, 235))

    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(scale_box([396, 240, 628, 620], scale), radius=int(116 * scale), fill=(0, 0, 0, 160))
    shadow_draw.arc(scale_box([338, 298, 686, 646], scale), 0, 180, fill=(0, 0, 0, 160), width=max(5, int(44 * scale)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, int(18 * scale))))
    img.alpha_composite(shadow)

    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(scale_box([396, 240, 628, 620], scale), radius=int(116 * scale), fill=(245, 255, 255, 255))
    draw.rounded_rectangle(scale_box([444, 296, 580, 510], scale), radius=int(68 * scale), fill=(11, 11, 16, 242))
    draw.arc(scale_box([338, 298, 686, 646], scale), 0, 180, fill=(85, 230, 255, 255), width=max(5, int(44 * scale)))
    draw.line([tuple(scale_box([512, 646], scale)), tuple(scale_box([512, 738], scale))], fill=(255, 255, 255, 255), width=max(5, int(44 * scale)))
    draw.line([tuple(scale_box([420, 782], scale)), tuple(scale_box([604, 782], scale))], fill=(255, 255, 255, 255), width=max(5, int(44 * scale)))
    draw.arc(scale_box([582, 288, 760, 504], scale), 278, 36, fill=(255, 61, 139, 255), width=max(4, int(34 * scale)))
    draw.arc(scale_box([616, 206, 838, 516], scale), 278, 38, fill=(255, 61, 139, 190), width=max(3, int(26 * scale)))

    img.save(OUT / filename)


for icon_size, icon_name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
    draw_icon(icon_size, icon_name)
