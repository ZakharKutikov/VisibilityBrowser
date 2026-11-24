# Сторонний код и лицензии

Собственный код Visibility Browser распространяется по лицензии MIT (файл `LICENSE`).
В браузер входят и с ним используются компоненты других авторов со своими лицензиями.

| Компонент | Где | Лицензия |
|---|---|---|
| Chromium | Движок браузера. Сами исходники не лежат в этом репозитории; патчи в `chromium/patches/` изменяют файлы Chromium, и изменённые части остаются под его лицензией | BSD-3-Clause и лицензии сторонних библиотек Chromium, см. `LICENSE` и `third_party/` в репозитории Chromium; в собранном браузере полный список на странице `chrome://credits` |
| Golos Text | Шрифт новой вкладки (`ntp-extension/fonts/`, патч 0018) | SIL Open Font License 1.1, текст в `ntp-extension/fonts/OFL.txt` |
| Xray-core | Ядро VPN. В репозиторий и установщик не входит: браузер скачивает его с GitHub-релизов проекта XTLS при первом включении VPN | Mozilla Public License 2.0 |
| Electron | Только у версии 2.1 в `legacy-electron/` | MIT |

Названия Chromium и Google Chrome принадлежат Google LLC. Visibility Browser не связан с Google и не одобрен ей.
