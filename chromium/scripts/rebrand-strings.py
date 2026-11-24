"""Renames Chromium to Visibility in the browser's UI strings.

Run from the Chromium src directory on a clean checkout (after gclient sync):
    python <repo>/chromium/scripts/rebrand-strings.py

What it does:
1. English: in chrome/app/chromium_strings.grd and
   components/components_chromium_strings.grd, "Chromium" becomes "Visibility"
   inside <message> bodies ("Chromium OS" is left alone).
2. Changing English text changes grit message IDs, so every translation file
   (*.xtb, 81 languages) is remapped from the old IDs to the new ones;
   otherwise those strings would fall back to English.
3. Russian: "Chromium" -> "Visibility" in the Russian translations, and
   "Chrome" -> "Visibility" in the Russian settings and component strings
   (store names such as "Интернет-магазин Chrome" are kept).
"""

import io
import os
import re
import subprocess
import sys

sys.path.insert(0, 'tools/grit')
from grit import grd_reader  # noqa: E402
from grit.node import message  # noqa: E402

GRDS = [
    ('chrome/app/chromium_strings.grd', 'chrome/app/resources',
     'chromium_strings_'),
    ('components/components_chromium_strings.grd', 'components/strings',
     'components_chromium_strings_'),
]
RU_CHROMIUM = [
    'chrome/app/resources/chromium_strings_ru.xtb',
    'components/strings/components_chromium_strings_ru.xtb',
]
RU_CHROME = [
    'chrome/app/resources/generated_resources_ru.xtb',
    'components/strings/components_strings_ru.xtb',
]
KEEP = ['Интернет-магазин Chrome', 'Интернет-магазине Chrome',
        'Интернет-магазина Chrome', 'Интернет-магазином Chrome',
        'Google Chrome', 'Chrome Web Store']


def read(path):
    return io.open(path, encoding='utf-8').read()


def write(path, text):
    io.open(path, 'w', encoding='utf-8', newline='').write(text)


def parse(path):
    defines = {}
    for _ in range(80):
        try:
            return grd_reader.Parse(path, debug=False, defines=defines,
                                    target_platform='win32')
        except AssertionError as e:
            m = re.search(r'undefined Grit variable found: (\S+)', str(e))
            if not m:
                raise
            defines[m.group(1)] = False
    raise SystemExit('too many undefined grit variables in ' + path)


def message_ids(path):
    return [(n.attrs['name'], n.GetCliques()[0].GetId())
            for n in parse(path).Preorder()
            if isinstance(n, message.MessageNode)]


def rebrand_grd(text):
    def fix(m):
        body = re.sub(r'Chromium(?!\s?OS)', 'Visibility', m.group(2))
        return m.group(1) + body + m.group(3)
    return re.sub(r'(<message\b[^>]*>)(.*?)(</message>)', fix, text,
                  flags=re.S)


def main():
    for grd, xtb_dir, prefix in GRDS:
        old_ids = message_ids(grd)
        original = read(grd)
        write(grd, rebrand_grd(original))
        new_ids = message_ids(grd)
        if [a[0] for a in old_ids] != [b[0] for b in new_ids]:
            write(grd, original)
            raise SystemExit('message order changed in ' + grd)
        remap = {a[1]: b[1] for a, b in zip(old_ids, new_ids) if a[1] != b[1]}
        files = [f for f in os.listdir(xtb_dir)
                 if f.startswith(prefix) and f.endswith('.xtb')]
        for f in files:
            p = os.path.join(xtb_dir, f)
            write(p, re.sub(r'<translation id="(\d+)"',
                            lambda m: '<translation id="%s"' %
                            remap.get(m.group(1), m.group(1)), read(p)))
        print('%s: %d message ids remapped in %d translation files' %
              (grd, len(remap), len(files)))

    for p in RU_CHROMIUM:
        text, n = re.subn(r'Chromium(?!\s?OS)', 'Visibility', read(p))
        write(p, text)
        print('%s: %d replacements' % (p, n))

    pattern = re.compile(r'(?<![\w/.\-])Chrome'
                         r'(?![\w:/.\-]|\s?OS|\s?Web Store|\s?for Testing)')
    for p in RU_CHROME:
        text = read(p)
        for i, k in enumerate(KEEP):
            text = text.replace(k, '\x00%d\x00' % i)
        text, n = pattern.subn('Visibility', text)
        for i, k in enumerate(KEEP):
            text = text.replace('\x00%d\x00' % i, k)
        write(p, text)
        print('%s: %d replacements' % (p, n))


if __name__ == '__main__':
    main()
