# Сборка Visibility Browser 3.0

Visibility Browser 3.0 — форк Chromium. Исходники Chromium в этот репозиторий не входят: они скачиваются в `D:\src\chromium`, а здесь хранятся только наши правки.

## Что где лежит

| Путь | Что это |
|---|---|
| `chromium/VERSION` | Версия Chromium, на которой основана сборка |
| `chromium/patches/` | Правки существующих файлов Chromium, по одной теме на файл |
| `chromium/overlay/` | Новые файлы; копируются поверх `src/` с теми же путями |
| `chromium/args/` | Параметры сборки: `dev.gn` и `release.gn` |
| `chromium/scripts/` | Скрипты PowerShell (ниже) |
| `legacy-electron/` | Версия 2.1.0 на Electron (больше не развивается) |
| `ntp-extension/` | Исходная новая вкладка 2.1; в 3.0 перенесена во встроенную страницу (патч 0018) |

## Что нужно установить один раз

1. Visual Studio 2026 (18.0 или новее) с компонентами «Разработка классических приложений на C++» и MFC/ATL:
   ```
   --add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Component.VC.ATLMFC --includeRecommended
   ```
2. Windows 11 SDK 10.0.28000.2270 с компонентом Debugging Tools for Windows.
3. Не меньше 100 ГБ свободного места на диске NTFS; путь без пробелов.
4. Желательно добавить `D:\src` в исключения Защитника Windows: без этого сборка заметно медленнее.

Источник требований: `docs/windows_build_instructions.md` в репозитории Chromium.

## Порядок работы

```powershell
cd chromium\scripts
.\fetch.ps1 -NoHooks   # скачать depot_tools и исходники (больше часа)
.\hooks.ps1            # после установки Visual Studio
.\apply.ps1            # наложить overlay и патчи
.\build.ps1            # сборка для разработки -> D:\src\chromium\src\out\Dev\chrome.exe
```

Релиз и установщик:

```powershell
.\build.ps1 -Config Release
.\build.ps1 -Config Release -Target mini_installer
```

Время каждой сборки записывается в `docs/build-times.md`.

Папку с исходниками можно сменить переменной окружения `VISIB_SRC_ROOT` (по умолчанию `D:\src`).

Если Visual Studio установлена не в `C:\Program Files`, укажите путь к ней переменной `vs2026_install` (например, `D:\VS2026`), иначе `gn gen` не найдёт компилятор.

Иконки для Windows (приложение, установщик, ассоциации файлов, плитки «Пуск») генерирует `scripts\make-icons.py` из `legacy-electron\icon.png`. Он же обновляет дату изменения `.ico`: без этого сборка не замечает замену иконки и оставляет в `chrome.exe` старую.

## Переход на новую версию Chromium

1. Записать новый тег в `chromium/VERSION`.
2. `.\fetch.ps1`
3. `.\apply.ps1 -Reset` — сбрасывает все незакоммиченные изменения в `src`. Патчи, которые не легли, исправить вручную и сохранить заново.
4. `.\build.ps1`

## Кодеки

`release.gn` включает H.264 и AAC (`proprietary_codecs`, `ffmpeg_branding = "Chrome"`). На эти кодеки действуют патентные лицензии; перед публичным распространением это нужно решить отдельно.
