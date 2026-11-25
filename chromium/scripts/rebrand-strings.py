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
    'chrome/app/resources/generated_resources_ru.xtb',
    'components/strings/components_strings_ru.xtb',
]
RU_CHROME = [
    'chrome/app/resources/generated_resources_ru.xtb',
    'components/strings/components_strings_ru.xtb',
]
KEEP = ['Интернет-магазин Chrome', 'Интернет-магазине Chrome',
        'Интернет-магазина Chrome', 'Интернет-магазином Chrome',
        'интернет-магазин Chrome', 'интернет-магазине Chrome',
        'интернет-магазина Chrome', 'интернет-магазином Chrome',
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


def fix_authors():
    """The About page must credit Chromium's authors, not claim their code.

    Runs after the rename: company name and copyright become GOmp Studios
    "based on Chromium". Other languages fall back to English for these two.
    """
    grd = 'chrome/app/chromium_strings.grd'
    old = dict(message_ids(grd))
    text = read(grd)
    text = text.replace('The Visibility Authors\n', 'GOmp Studios\n', 1)
    text = text.replace(
        '<ex>2016</ex></ph> The Visibility Authors. All rights reserved.',
        '<ex>2016</ex></ph> GOmp Studios. Based on Chromium, Copyright The '
        'Chromium Authors. All rights reserved.', 1)
    write(grd, text)
    new = dict(message_ids(grd))
    changed = {old[k]: new[k] for k in old if old[k] != new[k]}
    ru = 'chrome/app/resources/chromium_strings_ru.xtb'
    xtb = read(ru)
    russian = {
        '7723433520011474808': '© GOmp Studios, <ph name="YEAR" /> . '
                               'Основано на Chromium, '
                               '© The Chromium Authors. Все права '
                               'защищены.',
        '5155533032779998642': 'GOmp Studios',
    }
    for old_id, translation in russian.items():
        xtb = re.sub(r'<translation id="%s">.*?</translation>' % old_id,
                     '<translation id="%s">%s</translation>' %
                     (changed[old_id], translation), xtb, flags=re.S)
    write(ru, xtb)
    print('authors: %d message ids changed' % len(changed))

    # "Developer Build" next to the version number reads as an unfinished
    # product; it is a plain translation edit, ids do not change.
    path = 'components/strings/components_strings_ru.xtb'
    text = read(path)
    write(path, text.replace(
        '<translation id="988159990683914416">Сборка для '
        'разработчиков</translation>',
        '<translation id="988159990683914416">Сборка Visibility</translation>'))


def fix_license():
    """The About page links Chromium's own project page: the link text must
    say Chromium, not Visibility. Changes the English text (so the message id
    changes) and moves the Russian translation to the new id."""
    grd = 'components/components_chromium_strings.grd'
    old = dict(message_ids(grd))
    text = read(grd)
    marker = '</ph>Visibility<ph name="END_LINK_CHROMIUM">'
    start = text.index('name="IDS_VERSION_UI_LICENSE"')
    end = text.index('</message>', start)
    text = (text[:start] + text[start:end].replace(
        marker, '</ph>Chromium<ph name="END_LINK_CHROMIUM">', 1) + text[end:])
    write(grd, text)
    new = dict(message_ids(grd))
    changed = {old[k]: new[k] for k in old if old[k] != new[k]}
    ru = 'components/strings/components_chromium_strings_ru.xtb'
    xtb = read(ru)
    for old_id, new_id in changed.items():
        def fix(m):
            body = re.sub(r'(<ph name="BEGIN_LINK_CHROMIUM" />)Visibility',
                          r'\1Chromium', m.group(0))
            return body.replace('id="%s"' % old_id, 'id="%s"' % new_id, 1)
        xtb = re.sub(r'<translation id="%s">.*?</translation>' % old_id,
                     fix, xtb, flags=re.S)
    write(ru, xtb)
    print('license: %d message ids changed' % len(changed))


if __name__ == '__main__':
    main()
    fix_authors()
    fix_license()
