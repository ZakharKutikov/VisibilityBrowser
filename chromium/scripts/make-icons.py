"""Generates every Windows branding image of the Chromium tree from our logo.

Chromium ships its own blue logo in .ico/.png files that end up in the
executable (taskbar, Task Manager, Explorer), the installer, file
associations and Start menu tiles. This script overwrites all of them in the
checkout with the Visibility logo, so nothing blue is left.

Usage: python make-icons.py [--src D:\\src\\chromium\\src] [--logo path\\to\\logo.png]

Needs Pillow. The logo should be a square PNG of 512 px or more. After running,
touch is done for you: the .ico files get a fresh modification time, because the
Windows resource compiler step does not notice a replaced icon that keeps an
old timestamp (that is how the old blue icon stayed in chrome.exe).
"""

import argparse
import os
import time

from PIL import Image, ImageDraw, ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]


def scaled(logo, size):
    """High-quality downscale in halving steps, so small sizes stay crisp."""
    img = logo
    while img.width // 2 >= size:
        img = img.resize((img.width // 2, img.height // 2), Image.LANCZOS)
    return img.resize((size, size), Image.LANCZOS)


def save_ico(frames, path):
    """frames: {size: RGBA image}. Pillow writes 32-bit (PNG for 256) entries."""
    biggest = frames[max(frames)]
    biggest.save(path, format='ICO', sizes=[(s, s) for s in sorted(frames)],
                 append_images=[frames[s] for s in sorted(frames) if s != max(frames)])


def document(logo, size, pdf=False):
    """A white page with a folded corner and the logo on it."""
    s = size * 4  # supersample, then downscale
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    left, top, right, bottom = s * 0.16, s * 0.04, s * 0.84, s * 0.96
    fold = s * 0.2
    page = [(left, top), (right - fold, top), (right, top + fold), (right, bottom), (left, bottom)]
    d.polygon(page, fill=(255, 255, 255, 255), outline=(160, 166, 176, 255))
    d.polygon([(right - fold, top), (right - fold, top + fold), (right, top + fold)],
              fill=(214, 218, 224, 255), outline=(160, 166, 176, 255))
    mark = int(s * 0.44)
    img.alpha_composite(scaled(logo, mark), (int((s - mark) / 2), int(s * 0.36)))
    if pdf:
        d.rectangle([left, bottom - s * 0.16, right, bottom], fill=(229, 72, 77, 255))
    return img.resize((size, size), Image.LANCZOS)


def wordmark(logo, height, color, font_path):
    """Logo + "Visibility" at the size of Chromium's product_logo_name_22."""
    s = 4
    h = height * s
    font = ImageFont.truetype(font_path, int(h * 0.62))
    text = 'Visibility'
    tw = int(font.getlength(text))
    w = h + int(h * 0.3) + tw
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    img.alpha_composite(scaled(logo, h), (0, 0))
    ImageDraw.Draw(img).text((h + int(h * 0.3), h // 2), text, font=font, fill=color, anchor='lm')
    return img.resize((max(1, w // s), height), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=r'D:\src\chromium\src')
    ap.add_argument('--logo', default=os.path.join(REPO, 'legacy-electron', 'icon.png'))
    ap.add_argument('--font', default=os.path.join(REPO, 'ntp-extension', 'fonts', 'GolosText.ttf'))
    args = ap.parse_args()

    logo = Image.open(args.logo).convert('RGBA')
    assert logo.width == logo.height and logo.width >= 256, 'logo must be a square PNG of 256 px or more'
    theme = os.path.join(args.src, 'chrome', 'app', 'theme')
    win = os.path.join(theme, 'chromium', 'win')
    written = []

    app_icon = {s: scaled(logo, s) for s in ICO_SIZES}
    for path in [os.path.join(win, 'chromium.ico'),
                 os.path.join(win, 'app_list.ico'),
                 os.path.join(args.src, 'chrome', 'installer', 'mini_installer', 'mini_installer.ico'),
                 os.path.join(args.src, 'chrome', 'installer', 'setup', 'setup.ico')]:
        save_ico(app_icon, path)
        written.append(path)

    for name, pdf in (('chromium_doc.ico', False), ('chromium_pdf.ico', True)):
        path = os.path.join(win, name)
        save_ico({s: document(logo, s, pdf) for s in (16, 24, 32, 48, 64, 256)}, path)
        written.append(path)

    for name, size in (('Logo.png', 600), ('SmallLogo.png', 176)):
        # Start menu tiles: the logo at half the tile, on a transparent tile.
        tile = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        mark = scaled(logo, size // 2)
        tile.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
        path = os.path.join(win, 'tiles', name)
        tile.save(path)
        written.append(path)

    for scale, folder in ((1, 'default_100_percent'), (2, 'default_200_percent')):
        for suffix, color in (('', (32, 33, 36, 255)), ('_white', (255, 255, 255, 255))):
            path = os.path.join(theme, folder, 'chromium', f'product_logo_name_22{suffix}.png')
            wordmark(logo, 22 * scale, color, args.font).save(path)
            written.append(path)

    now = time.time()
    for path in written:
        os.utime(path, (now, now))
        print('wrote', os.path.relpath(path, args.src))


if __name__ == '__main__':
    main()
