// lang-manager.js - Localization for Visibility Browser
"use strict";

(function () {
    let electron;
    try { electron = require('electron'); } catch (e) { }
    const ipcRenderer = (electron ? electron.ipcRenderer : null) || window.ipcRenderer;

    if (!ipcRenderer) {
        console.warn("lang-manager: ipcRenderer not found");
    }

    const translations = {
        ru: {
            // App
            "title": "Visibility Browser",
            "btn-minimize": "Свернуть",
            "btn-maximize": "Развернуть",
            "btn-close": "Закрыть",
            "new-tab-btn": "Новая вкладка (Ctrl+T)",
            "tab-new": "Новая вкладка",
            "tab-close-title": "Закрыть (Ctrl+W)",
            "untitled": "Без названия",
            "incognito-pill": "Инкогнито",

            // Navbar
            "url-bar": "Поиск или введите URL...",
            "btn-back": "Назад (Alt+←)",
            "btn-forward": "Вперёд (Alt+→)",
            "btn-reload": "Обновить (F5)",
            "btn-home": "Домой",
            "btn-bookmark": "Добавить закладку (Ctrl+D)",
            "btn-incognito": "Инкогнито (Ctrl+Shift+N)",
            "btn-vpn": "VPN",
            "btn-sidebar": "История / Закладки (Ctrl+H)",
            "btn-downloads": "Загрузки (Ctrl+J)",
            "btn-settings": "Настройки",
            "btn-zoom-out": "Уменьшить (Ctrl+-)",
            "btn-zoom-in": "Увеличить (Ctrl+=)",

            // Sidebar & History window
            "sidebar-title": "История и закладки",
            "browser-title": "Браузер", // for history.html
            "tab-history": "История",
            "tab-bookmarks": "Закладки",
            "history-search": "Поиск в истории...",
            "btn-clear-history": "Очистить историю",
            "btn-clear-all": "Очистить всё",
            "empty-history": "История пуста",
            "empty-bookmarks": "Нет закладок",
            "nothing-found": "Ничего не найдено",

            // Downloads
            "dl-title": "Загрузки",
            "dl-empty": "Нет загрузок",
            "dl-empty-hint": "Загруженные файлы появятся здесь",
            "dl-completed": "Завершено",
            "dl-cancelled": "Отменено",
            "dl-paused": "Приостановлено",
            "dl-interrupted": "Прервано",
            "dl-open": "Открыть",
            "dl-folder": "В папке",
            "dl-retry": "Повторить",
            "dl-resume": "Продолжить",
            "dl-pause": "Пауза",
            "dl-cancel": "Отменить",
            "dl-eta-sec": "ост.",
            "dl-eta-min": "ост.",
            "dl-eta-hr": "ост.",
            "dl-sec": "сек.",
            "dl-min": "мин.",
            "dl-hr": "ч.",

            // Settings Modal
            "modal-settings-title": " Настройки",
            "stab-general": "Основные",
            "stab-privacy": "Приватность",
            "stab-appearance": "Вид",
            "stab-shortcuts": "Клавиши",
            "stab-vpn": "VPN",

            "set-nav-title": "Навигация",
            "set-language-label": "Language / Язык",
            "set-language-desc": "Browser language / Язык интерфейса",
            "set-homepage-label": "Домашняя страница",
            "set-homepage-desc": "URL, открываемый по кнопке «Домой»",
            "set-search-label": "Поисковая система",
            "set-ua-title": "User Agent",
            "set-ua-label": "Режим User Agent",
            "set-ua-mode-label": "Режим User Agent",
            "set-ua-mode-desc": "Выберите режим маскировки браузера",
            "set-ua-chrome": "Chrome (по умолчанию)",
            "set-ua-firefox": "Firefox",
            "set-ua-safari": "Safari",
            "set-ua-custom": "Свой...",
            "set-ua-custom-label": "Свой User Agent",
            "set-default-browser-label": "Браузер по умолчанию",
            "set-default-browser-desc": "Использовать Visibility для открытия всех ссылок",
            "set-ntp-recent-label": "Недавние на новой вкладке",
            "set-ntp-recent-desc": "Отображать последние посещенные сайты",
            "set-ntp-shortcuts-label": "Ярлыки на новой вкладке",
            "set-ntp-shortcuts-desc": "Отображать быстрые ссылки",

            "set-privacy-title": "История и данные",
            "set-clear-cookies": "Очистить cookies и кэш",
            "set-clear-cookies-desc": "Удалит данные основной сессии",
            "btn-clear-cookies": "Очистить",
            "set-clear-history": "Очистить всю историю",
            "btn-clear-all-history": "Удалить",
            
            "set-permissions-title": "Разрешения сайтов",
            "set-permissions-camera": "Камера и микрофон",
            "set-permissions-camera-desc": "Запрашивать разрешение при обращении",
            "set-permissions-geo": "Геолокация",
            "set-permissions-geo-desc": "Запрашивать разрешение при обращении",
            "set-permissions-notif": "Уведомления",
            "set-permissions-notif-desc": "Запрашивать разрешение при обращении",
            "set-permissions-screenshare": "Демонстрация экрана",
            "set-permissions-screenshare-desc": "Запрашивать разрешение при обращении",
            "set-permissions-reset": "Сбросить все разрешения",
            "set-permissions-reset-desc": "Все сайты будут запрашивать разрешения заново",
            "btn-permissions-reset": "Сбросить",

            "set-incognito-title": "Инкогнито",
            "set-incognito-tabs": "Инкогнито-вкладки",
            "set-incognito-desc": "Отдельная сессия, без истории, без cookies",

            "set-appearance-title": "Внешний вид",
            "set-theme-label": "Тема оформления",
            "set-theme-desc": "Управляйте цветами браузера",
            "set-theme-dark": "Тёмная (по умолчанию)",
            "set-theme-light": "Светлая",
            "set-theme-dracula": "Dracula",
            "set-theme-hacker": "Хакер",
            "set-bookmarks-bar-label": "Панель закладок",
            "set-bookmarks-bar-desc": "Отображать под адресной строкой",
            
            "set-account-title": "Войти в аккаунт",
            "set-profile-title": "Профиль",
            "set-account-desc": "Аккаунт Visibility",
            "set-account-login-desc": "Войдите чтобы синхронизировать закладки, настройки и историю между устройствами.",
            "set-account-login": "Войти",
            "set-account-register": "Создать аккаунт",
            "set-account-logout": "Выйти",
            "set-account-email-placeholder": "Email",
            "set-account-password-placeholder": "Пароль",
            "set-sync-title": "Синхронизация",
            "set-sync-push": "↑ Загрузить",
            "set-sync-pull": "↓ Скачать",
            "set-sync-all": "Синхронизировать всё",
            "set-account-open-profile-btn": "Открыть →",
            "set-sync-bookmarks": "Закладки",
            "set-sync-settings": "Настройки",
            "set-sync-status": "Не синхронизировано",
            "set-manage-title": "Управление",
            "set-open-profile": "Открыть профиль",
            "set-open-profile-desc": "Просмотр данных на сайте",

            "set-zoom-title": "Масштаб по умолчанию",
            "set-zoom-label": "Масштаб страниц",
            "set-zoom-desc": "Масштаб содержимого веб-страниц",
            "set-ui-scale-label": "Масштаб интерфейса",
            "set-ui-scale-desc": "Размер элементов браузера (вкладки, панели, кнопки)",

            "set-default-browser-label": "Браузер по умолчанию",
            "set-default-browser-desc": "Использовать Visibility для открытия всех ссылок",
            "btn-set-default": "Сделать основным",

            "btn-settings-cancel": "Отмена",
            "btn-settings-save": "Сохранить",

            // Shortcuts list
            "sh-tabs": "Вкладки",
            "sh-new-tab": "Новая вкладка",
            "sh-close-tab": "Закрыть вкладку",
            "sh-next-tab": "Следующая вкладка",
            "sh-reopen-tab": "Реopen закрытой",
            "sh-nav": "Навигация",
            "sh-url-bar": "Адресная строка",
            "sh-reload": "Обновить",
            "sh-force-reload": "Принудительно обновить",
            "sh-back-forward": "Назад / Вперёд",
            "sh-tools": "Инструменты",
            "sh-history": "История",
            "sh-downloads": "Загрузки",
            "sh-incognito": "Инкогнито",
            "sh-bookmark": "Закладка",
            "sh-zoom": "Масштаб +/−/сброс",

            // NTP
            "ntp-search-placeholder": "Введите поисковый запрос или URL...",
            "ntp-recent-title": "Недавние посещения",
            "ntp-dino-name": "Динозаврик",

            // VPN
            "vpn-offline": "VPN Отключен",
            "vpn-online": "VPN Подключен",
            "vpn-connecting": "Подключение...",
            "vpn-disconnecting": "Отключение...",
            "vpn-select-server": "Выберите сервер и нажмите Подключить",
            "vpn-connect": "Подключить",
            "vpn-disconnect": "Отключить",
            "vpn-servers-title": "Серверы",
            "vpn-sub-title": "URL подписки (Clash/V2Ray)",
            "vpn-url-placeholder": "https://... (ссылка на подписку)",
            "vpn-manual-title": "Добавить ссылку вручную",
            "vpn-import": "Импорт",
            "vpn-add": "Добавить ссылку",
            "vpn-empty": "Серверы не найдены. Добавьте подписку или ссылку.",
            "vpn-no-binary": "(!) Xray-core не найден. Требуется для VPN.",
            "vpn-xray-title": "Xray-core не установлен",
            "vpn-xray-desc": "Для загрузки ядра может потребоваться VPN — включите Happ, Hiddify, v2rayN или другой клиент.",
            "vpn-xray-hint": "Сначала подключитесь к VPN в другом приложении, затем нажмите «Загрузить».",
            "vpn-download-btn": "Загрузить Xray Core",
            "vpn-pending": "Ожидание...",
            "vpn-downloading": "Загрузка...",
            "vpn-selected-label": "Выбран: ",
            "vpn-downloading-progress": "Загрузка ",
            "vpn-routing-full": "Весь трафик",
            "vpn-routing-split": "Раздельная маршрутизация",
            "toast-vpn-no-url": "Введите URL подписки",

            "set-vpn-title": "VPN и маршрутизация",
            "set-vpn-sub-url-label": "URL подписки",
            "set-vpn-sub-url-desc": "Clash / V2Ray subscription — импорт серверов",
            "set-vpn-routing-mode-label": "Режим маршрутизации",
            "set-vpn-routing-mode-desc": "Раздельный: заблокированные в РФ сервисы через VPN, остальное напрямую",
            "set-vpn-routing-mode-split-ru": "Раздельный (РФ)",
            "set-vpn-routing-mode-full": "Весь трафик через VPN",
            "set-vpn-auto-connect-label": "Подключать при запуске",
            "set-vpn-auto-connect-desc": "Автоматически включать VPN после старта браузера",
            "set-vpn-panel-open": "Открыть VPN",
            "set-vpn-panel-label": "Управление серверами",
            "set-vpn-panel-desc": "Подключение, список серверов и загрузка Xray-core",
            "set-vpn-custom-title": "Дополнительные домены",
            "set-vpn-custom-blocked-label": "Свои домены для VPN",
            "set-vpn-custom-blocked-desc": "По одному на строку — только в режиме «Раздельный (РФ)»",

            // Delete History Modal
            "del-hist-title": "Удалить историю",
            "del-hist-hour": "За последний час",
            "del-hist-day": "За последний день",
            "del-hist-week": "За последнюю неделю",
            "del-hist-month": "За последний месяц",
            "del-hist-all": "Удалить всё",
            "del-hist-confirm": "Очистить всю историю?",

            // SSL Modal
            "ssl-title": "Сведения о безопасности",
            "ssl-loading": "Загрузка...",
            "ssl-cert-info": "Загрузка сведений о сертификате...",
            "ssl-not-secure": "Подключение не защищено",
            "ssl-unencrypted": "Сайт использует незашифрованное соединение.",
            "ssl-issued-to": "Выдан для:",
            "ssl-issued-by": "Кем выдан:",
            "ssl-valid-from": "Действителен с:",
            "ssl-valid-to": "Действителен до:",
            "ssl-protocol": "Протокол:",
            "ssl-fingerprint": "Отпечаток:",
            "ssl-cert-fail": "Не удалось получить сведения о сертификате.",
            "ssl-ok": "Понятно",

            // VPN Errors
            "SUB_PARSE_ERROR": "Не удалось распознать серверы в подписке",
            "LINK_FORMAT_ERROR": "Неверный формат ссылки",
            "XRAY_START_ERROR": "Xray не запустился",

            // Toasts & more
            "toast-bookmark-added": "Добавлено в закладки",
            "toast-bookmark-removed": "Закладка удалена",
            "toast-history-cleared": "История очищена",
            "toast-incognito-open": "Открывается окно инкогнито...",
            "toast-download-start": "Загрузка: ",
            "toast-download-complete": "Загружено: ",
            "toast-vpn-error": "Ошибка VPN: ",
            "toast-vpn-imported": "Импортировано: ",
            "toast-vpn-added": "Добавлено: ",
            "toast-xray-ready": "Xray готов",
            "toast-xray-fail": "Ошибка Xray: ",
            "toast-xray-need-vpn": "Для загрузки Xray-core включите VPN (Happ, Hiddify, v2rayN и др.)",
            "toast-tab-crashed": "Вкладка упала. Перезагрузка...",
            "toast-tab-crash-fail": "Вкладка не отвечает. Закройте и откройте снова.",
            "toast-gpu-crashed": "Проблема с видео. Перезагрузка...",
            "toast-cookies-cleared": "Cookies и кэш очищены",
            "toast-settings-saved": "Настройки сохранены",
            "toast-bookmarks-exported": "Закладки экспортированы",
            "toast-bookmarks-imported": "Закладки импортированы",
            "toast-export-failed": "Ошибка экспорта",
            "toast-import-failed": "Неверный файл закладок",
            "toast-url-copied": "Ссылка скопирована",
            "bookmarks-empty-hint": "Нет закладок — нажмите <kbd>Ctrl+D</kbd> или кнопку + слева",
            "bookmarks-count": "{n} закладок",
            "bookmarks-count-filtered": "{n} из {total}",
            "bm-ctx-open": "Открыть",
            "bm-ctx-new-tab": "Открыть в новой вкладке",
            "bm-ctx-copy": "Копировать ссылку",
            "bm-ctx-delete": "Удалить закладку",
            "bookmarks-search": "Поиск в закладках...",
            "set-export-bookmarks-label": "Экспорт закладок",
            "set-export-bookmarks-desc": "Сохранить закладки в JSON-файл",
            "set-import-bookmarks-label": "Импорт закладок",
            "set-import-bookmarks-desc": "Загрузить закладки из JSON-файла",
            "set-webrtc-title": "Голос и видео (WebRTC)",
            "set-webrtc-label": "Режим голосовых вкладок",
            "set-webrtc-desc": "Discord, Meet, Zoom и другие открываются с полной поддержкой микрофона и камеры",
            "set-webrtc-status": "Активен",
            "set-about-title": "О браузере",
            "set-about-name": "Visibility Browser",
            "set-about-desc": "Современный браузерный движок на Electron + Chromium",
            "toast-default-browser-success": "Протоколы зарегистрированы. Теперь выберите Visibility в настройках Windows",
            "toast-default-browser-fail": "Ошибка регистрации",
            "toast-download-cancelled": "Отменено: ",
            "vid-not-found": "Видео не найдено на этой странице.",
            "vid-pip-fail": "PiP недоступен: ",
            "btn-delete-tooltip": "Удалить",
            "btn-cancel": "Отмена",
            "banner-error": "Ошибка",
            "banner-warning": "Внимание",
            "banner-success": "Успех",
            "banner-info": "Информация",
            
            // SSL Certificate v2.0
            "ssl-title": "Сведения о безопасности",
            "ssl-unsecure": "Небезопасное соединение",
            "ssl-unsecure-title": "Соединение не защищено",
            "ssl-unsecure-desc": "Данные, передаваемые на этот сайт, могут быть перехвачены. Не вводите конфиденциальную информацию.",
            "ssl-secure": "Безопасное соединение",
            "ssl-expired": "Сертификат просрочен",
            "ssl-expiring": "Срок действия истекает скоро",
            "ssl-expired-days": "Просрочено",
            "ssl-valid-for": "Осталось дней",
            "ssl-days": "дней",
            "ssl-issued-to": "Выдан для",
            "ssl-issued-by": "Выдан организацией",
            "ssl-validity": "Срок действия",
            "ssl-technical": "Технические данные",
            "ssl-from": "С",
            "ssl-to": "По",
            "ssl-protocol": "Протокол",
            "ssl-key-alg": "Алгоритм ключа",
            "ssl-fingerprint": "Отпечаток SHA-256",
            "ssl-copy": "Копировать",
            "ssl-copied": "Отпечаток скопирован",
            "ssl-unknown": "Неизвестно",
            "ssl-error": "Ошибка",
            "ssl-fail-title": "Не удалось получить сведения",
            "ssl-fail-desc": "Возможно, сайт использует самоподписанный сертификат или есть проблемы с соединением.",
            
            // Extensions
            "ext-empty": "Нет установленных расширений",
            "ext-default-desc": "Расширение интерфейса",
            "ext-official": "Официальное расширение",
            "ext-verified": "Проверенное расширение",
            "ext-delete": "Удалить",
            "ext-delete-confirm": "Удалить расширение",
            "ext-deleted": "Расширение удалено. Перезапустите браузер (F5)",
            "ext-installed": "Расширение установлено! Перезапустите браузер",
            "ext-install-error": "Ошибка файла расширения (Неверный формат)",
            
            // v2.0 Features
            "bookmarks-exported": "Закладки экспортированы",
            "bookmarks-imported": "Закладки импортированы",
            "bookmarks-import-fail": "Ошибка импорта",
            "restore-session": "Восстановить предыдущую сессию?",
            "restore-session-title": "Восстановить сессию?",
            "restore-session-desc": "Обнаружено {0} вкладок из предыдущей сессии. Хотите восстановить их?",
            "restore-more": "еще",
            "restore-no": "Нет, спасибо",
            "restore-yes": "Восстановить",
            "session-restored": "Сессия восстановлена",
            "popup-blocked": "Всплывающее окно заблокировано",
            "popups-blocked-count": "Заблокировано",
            "translate-opened": "Переводчик открыт",
            "screenshot-saved": "Скриншот сохранен",

            "btn-extensions": "Расширения",
            "ext-menu-title": "Расширения",
            "ext-install-hint": "Установите .visibility файл",
            "ext-install-from-file": "Установить из файла",
            "zoom-reset-title": "Сбросить масштаб (Ctrl+0)",
            "btn-close-sidebar": "Закрыть",
            "set-perm-on-request": "По запросу",
            "perm-deny": "Запретить",
            "perm-allow": "Разрешить",
            "perm-unknown-origin": "неизвестный сайт",
            "perm-generic-desc": "Сайт запрашивает разрешение",
            "perm-media-desc": "Сайт хочет получить доступ к вашей камере и микрофону",
            "perm-geo-desc": "Сайт хочет определить ваше местоположение",
            "perm-notif-desc": "Сайт хочет отправлять вам уведомления",
            "perm-display-desc": "Сайт хочет транслировать содержимое вашего экрана",
            "perm-drm-desc": "Сайт хочет воспроизвести защищённый контент",
            "perm-midi-desc": "Сайт хочет получить доступ к MIDI устройствам",
            "ssl-checking": "Проверка сертификата...",
            "ssl-unencrypted-desc": "Данные передаются без шифрования",
            "ssl-expiring-soon": "Сертификат скоро истекает",
            "ssl-copy-fingerprint": "Копировать отпечаток",
            "ssl-gomp-title": "Проект GOmp Studios",
            "ssl-gomp-desc": "Официальный проект экосистемы GOmp Studios",
            "find-not-found": "Не найдено",
            "tab-sleeping": "(спит)",
            "dialog-crash-title": "Страница перестала отвечать",
            "dialog-crash-msg": "Вкладка перестала отвечать и будет перезагружена.",
            "dialog-unresponsive-title": "Браузер не отвечает",
            "dialog-unresponsive-msg": "Браузер перестал отвечать. Перезагрузить?",
            "dialog-reload": "Перезагрузить",
            "dialog-wait": "Подождать",
            "history-window-title": "История и Закладки"
        },
        en: {
            // App
            "title": "Visibility Browser",
            "btn-minimize": "Minimize",
            "btn-maximize": "Maximize",
            "btn-close": "Close",
            "new-tab-btn": "New Tab (Ctrl+T)",
            "tab-new": "New Tab",
            "tab-close-title": "Close (Ctrl+W)",
            "untitled": "Untitled",
            "incognito-pill": "Incognito",

            // Navbar
            "url-bar": "Search or enter URL...",
            "btn-back": "Back (Alt+←)",
            "btn-forward": "Forward (Alt+→)",
            "btn-reload": "Reload (F5)",
            "btn-home": "Home",
            "btn-bookmark": "Add Bookmark (Ctrl+D)",
            "btn-incognito": "Incognito (Ctrl+Shift+N)",
            "btn-vpn": "VPN",
            "btn-sidebar": "History / Bookmarks (Ctrl+H)",
            "btn-downloads": "Downloads (Ctrl+J)",
            "btn-settings": "Settings",
            "btn-zoom-out": "Zoom Out (Ctrl+-)",
            "btn-zoom-in": "Zoom In (Ctrl+=)",

            // Sidebar & History window
            "sidebar-title": " History & Bookmarks",
            "browser-title": " Browser",
            "tab-history": " History",
            "tab-bookmarks": " Bookmarks",
            "history-search": " Search history...",
            "btn-clear-history": " Clear History",
            "btn-clear-all": " Clear All",
            "empty-history": "History is empty",
            "empty-bookmarks": "No bookmarks",
            "nothing-found": "Nothing found",

            // Downloads
            "dl-title": "Downloads",
            "dl-empty": "No downloads",
            "dl-empty-hint": "Downloaded files will appear here",
            "dl-completed": "Completed",
            "dl-cancelled": "Cancelled",
            "dl-paused": "Paused",
            "dl-interrupted": "Interrupted",
            "dl-open": "Open",
            "dl-folder": "Show in folder",
            "dl-retry": "Retry",
            "dl-resume": "Resume",
            "dl-pause": "Pause",
            "dl-cancel": "Cancel",
            "dl-eta-sec": "remaining",
            "dl-eta-min": "remaining",
            "dl-eta-hr": "remaining",
            "dl-sec": "sec",
            "dl-min": "min",
            "dl-hr": "hr",

            // Settings Modal
            "modal-settings-title": "Settings",
            "stab-general": "General",
            "stab-privacy": "Privacy",
            "stab-appearance": "Appearance",
            "stab-shortcuts": "Shortcuts",
            "stab-vpn": "VPN",

            "set-nav-title": "Navigation",
            "set-language-label": "Language",
            "set-language-desc": "Browser interface language",
            "set-homepage-label": "Homepage",
            "set-homepage-desc": "URL opened by 'Home' button",
            "set-search-label": "Search Engine",
            "set-ua-title": "User Agent",
            "set-ua-label": "User Agent Mode",
            "set-ua-mode-label": "User Agent Mode",
            "set-ua-mode-desc": "Select browser masking mode",
            "set-ua-chrome": "Chrome (default)",
            "set-ua-firefox": "Firefox",
            "set-ua-safari": "Safari",
            "set-ua-custom": "Custom...",
            "set-ua-custom-label": "Custom User Agent",
            "set-default-browser-label": "Default Browser",
            "set-default-browser-desc": "Use Visibility to open all links",
            "set-ntp-recent-label": "Recent on new tab",
            "set-ntp-recent-desc": "Show recently visited sites",
            "set-ntp-shortcuts-label": "Shortcuts on new tab",
            "set-ntp-shortcuts-desc": "Show quick links",

            "set-privacy-title": "History & Data",
            "set-clear-cookies": "Clear cookies & cache",
            "set-clear-cookies-desc": "Removes main session data",
            "btn-clear-cookies": "Clear",
            "set-clear-history": "Clear all history",
            "btn-clear-all-history": "Delete",
            
            "set-permissions-title": "Site Permissions",
            "set-permissions-camera": "Camera & Microphone",
            "set-permissions-camera-desc": "Ask for permission when accessed",
            "set-permissions-geo": "Geolocation",
            "set-permissions-geo-desc": "Ask for permission when accessed",
            "set-permissions-notif": "Notifications",
            "set-permissions-notif-desc": "Ask for permission when accessed",
            "set-permissions-screenshare": "Screen Sharing",
            "set-permissions-screenshare-desc": "Ask for permission when accessed",
            "set-permissions-reset": "Reset All Permissions",
            "set-permissions-reset-desc": "All sites will request permissions again",
            "btn-permissions-reset": "Reset",

            "set-incognito-title": "Incognito",
            "set-incognito-tabs": "Incognito Tabs",
            "set-incognito-desc": "Separate session, no history/cookies",

            "set-appearance-title": "Appearance",
            "set-theme-label": "Theme",
            "set-theme-desc": "Manage browser colors",
            "set-theme-dark": "Dark (default)",
            "set-theme-light": "Light",
            "set-theme-dracula": "Dracula",
            "set-theme-hacker": "Hacker",
            "set-bookmarks-bar-label": "Bookmarks Bar",
            "set-bookmarks-bar-desc": "Show below address bar",
            
            "set-account-title": "Sign in to account",
            "set-profile-title": "Profile",
            "set-account-desc": "Visibility Account",
            "set-account-login-desc": "Sign in to sync bookmarks, settings, and history across devices.",
            "set-account-login": "Sign In",
            "set-account-register": "Create Account",
            "set-account-logout": "Sign Out",
            "set-account-email-placeholder": "Email",
            "set-account-password-placeholder": "Password",
            "set-sync-title": "Synchronization",
            "set-sync-push": "↑ Upload",
            "set-sync-pull": "↓ Download",
            "set-sync-all": "Sync All",
            "set-account-open-profile-btn": "Open →",
            "set-sync-bookmarks": "Bookmarks",
            "set-sync-settings": "Settings",
            "set-sync-status": "Not synced",
            "set-manage-title": "Management",
            "set-open-profile": "Open profile",
            "set-open-profile-desc": "View data on website",

            "set-zoom-title": "Default Zoom",
            "set-zoom-label": "Page Zoom",
            "set-zoom-desc": "Web page content scale",
            "set-ui-scale-label": "UI Scale",
            "set-ui-scale-desc": "Browser element size (tabs, panels, buttons)",

            "set-default-browser-label": "Default Browser",
            "set-default-browser-desc": "Use Visibility to open all links",
            "btn-set-default": "Make Default",

            "btn-settings-cancel": "Cancel",
            "btn-settings-save": "Save",

            // Shortcuts list
            "sh-tabs": "Tabs",
            "sh-new-tab": "New Tab",
            "sh-close-tab": "Close Tab",
            "sh-next-tab": "Next Tab",
            "sh-reopen-tab": "Reopen Closed",
            "sh-nav": "Navigation",
            "sh-url-bar": "Address Bar",
            "sh-reload": "Reload",
            "sh-force-reload": "Force Reload",
            "sh-back-forward": "Back / Forward",
            "sh-tools": "Tools",
            "sh-history": "History",
            "sh-downloads": "Downloads",
            "sh-incognito": "Incognito",
            "sh-bookmark": "Bookmark",
            "sh-zoom": "Zoom +/−/Reset",

            // NTP
            "ntp-search-placeholder": "Enter search query or URL...",
            "ntp-recent-title": "Recent visits",
            "ntp-dino-name": "Dino",

            // VPN
            "vpn-offline": "VPN Offline",
            "vpn-online": "VPN Online",
            "vpn-connecting": "Connecting...",
            "vpn-disconnecting": "Disconnecting...",
            "vpn-select-server": "Select server and click Connect",
            "vpn-connect": "Connect",
            "vpn-disconnect": "Disconnect",
            "vpn-servers-title": "Servers",
            "vpn-sub-title": "Subscription URL (Clash/V2Ray)",
            "vpn-url-placeholder": "https://... (subscription link)",
            "vpn-manual-title": "Add VPN Link Manually",
            "vpn-import": "Import",
            "vpn-add": "Add Link",
            "vpn-empty": "No servers found. Add a subscription or link.",
            "vpn-no-binary": "(!) Xray-core not found. Required for VPN.",
            "vpn-xray-title": "Xray-core not installed",
            "vpn-xray-desc": "Downloading the core may require VPN — enable Happ, Hiddify, v2rayN or another client.",
            "vpn-xray-hint": "Connect to VPN in another app first, then tap Download.",
            "vpn-download-btn": "Download Xray Core",
            "vpn-pending": "Pending...",
            "vpn-downloading": "Downloading...",
            "vpn-selected-label": "Selected: ",
            "vpn-downloading-progress": "Downloading ",
            "vpn-routing-full": "Full tunnel",
            "vpn-routing-split": "Split routing",
            "toast-vpn-no-url": "Enter subscription URL",

            "set-vpn-title": "VPN & routing",
            "set-vpn-sub-url-label": "Subscription URL",
            "set-vpn-sub-url-desc": "Clash / V2Ray subscription — import servers",
            "set-vpn-routing-mode-label": "Routing mode",
            "set-vpn-routing-mode-desc": "Split: blocked-in-Russia services via VPN, rest direct",
            "set-vpn-routing-mode-split-ru": "Split (Russia)",
            "set-vpn-routing-mode-full": "All traffic via VPN",
            "set-vpn-auto-connect-label": "Connect on startup",
            "set-vpn-auto-connect-desc": "Automatically enable VPN when the browser starts",
            "set-vpn-panel-open": "Open VPN",
            "set-vpn-panel-label": "Server management",
            "set-vpn-panel-desc": "Connect, server list and Xray-core download",
            "set-vpn-custom-title": "Extra domains",
            "set-vpn-custom-blocked-label": "Custom VPN domains",
            "set-vpn-custom-blocked-desc": "One per line — only in Split (Russia) mode",

            // Delete History Modal
            "del-hist-title": "Delete History",
            "del-hist-hour": "Last hour",
            "del-hist-day": "Last day",
            "del-hist-week": "Last week",
            "del-hist-month": "Last month",
            "del-hist-all": "Delete Everything",
            "del-hist-confirm": "Clear all history?",

            // SSL Modal
            "ssl-title": " Security Details",
            "ssl-loading": "Loading...",
            "ssl-cert-info": "Loading certificate info...",
            "ssl-not-secure": "Connection not secure",
            "ssl-unencrypted": "This site uses an unencrypted connection.",
            "ssl-issued-to": "Issued to:",
            "ssl-issued-by": "Issued by:",
            "ssl-valid-from": "Valid from:",
            "ssl-valid-to": "Valid to:",
            "ssl-protocol": "Protocol:",
            "ssl-fingerprint": "Fingerprint:",
            "ssl-cert-fail": "Failed to get certificate info.",
            "ssl-ok": "OK",

            // VPN Errors
            "SUB_PARSE_ERROR": "Failed to parse servers from subscription",
            "LINK_FORMAT_ERROR": "Invalid link format",
            "XRAY_START_ERROR": "Xray failed to start",

            // Toasts & Alerts
            "toast-bookmark-added": "Added to bookmarks",
            "toast-bookmark-removed": "Bookmark removed",
            "toast-history-cleared": "History cleared",
            "toast-incognito-open": "Opening incognito window...",
            "toast-download-start": "Downloading: ",
            "toast-download-complete": "Downloaded: ",
            "toast-vpn-error": "VPN Error: ",
            "toast-vpn-imported": "Imported: ",
            "toast-vpn-added": "Added: ",
            "toast-xray-ready": "Xray ready",
            "toast-xray-fail": "Xray Error: ",
            "toast-xray-need-vpn": "Enable VPN (Happ, Hiddify, v2rayN, etc.) to download Xray-core",
            "toast-tab-crashed": "Tab crashed. Reloading...",
            "toast-tab-crash-fail": "Tab is unresponsive. Close and open it again.",
            "toast-gpu-crashed": "Video issue. Reloading...",
            "toast-cookies-cleared": "Cookies & cache cleared",
            "toast-settings-saved": "Settings saved",
            "toast-bookmarks-exported": "Bookmarks exported",
            "toast-bookmarks-imported": "Bookmarks imported",
            "toast-export-failed": "Export failed",
            "toast-import-failed": "Invalid bookmarks file",
            "toast-url-copied": "Link copied",
            "bookmarks-empty-hint": "No bookmarks — press <kbd>Ctrl+D</kbd> or the + button on the left",
            "bookmarks-count": "{n} bookmarks",
            "bookmarks-count-filtered": "{n} of {total}",
            "bm-ctx-open": "Open",
            "bm-ctx-new-tab": "Open in new tab",
            "bm-ctx-copy": "Copy link",
            "bm-ctx-delete": "Remove bookmark",
            "bookmarks-search": "Search bookmarks...",
            "set-export-bookmarks-label": "Export bookmarks",
            "set-export-bookmarks-desc": "Save bookmarks to a JSON file",
            "set-import-bookmarks-label": "Import bookmarks",
            "set-import-bookmarks-desc": "Load bookmarks from a JSON file",
            "set-webrtc-title": "Voice & Video (WebRTC)",
            "set-webrtc-label": "Voice tab mode",
            "set-webrtc-desc": "Discord, Meet, Zoom and others open with full microphone and camera support",
            "set-webrtc-status": "Active",
            "set-about-title": "About",
            "set-about-name": "Visibility Browser",
            "set-about-desc": "Modern browser engine powered by Electron + Chromium",
            "toast-default-browser-success": "Protocols registered. Now select Visibility in Windows settings",
            "toast-default-browser-fail": "Registration failed",
            "toast-download-cancelled": "Cancelled: ",
            "vid-not-found": "Video not found on this page.",
            "vid-pip-fail": "PiP unavailable: ",
            "btn-delete-tooltip": "Delete",
            "btn-cancel": "Cancel",
            "banner-error": "Error",
            "banner-warning": "Warning",
            "banner-success": "Success",
            "banner-info": "Information",
            
            // SSL Certificate v2.0
            "ssl-title": "Security Information",
            "ssl-unsecure": "Insecure Connection",
            "ssl-unsecure-title": "Connection is not secure",
            "ssl-unsecure-desc": "Data transmitted to this site may be intercepted. Do not enter sensitive information.",
            "ssl-secure": "Secure Connection",
            "ssl-expired": "Certificate Expired",
            "ssl-expiring": "Certificate expiring soon",
            "ssl-expired-days": "Expired",
            "ssl-valid-for": "Days remaining",
            "ssl-days": "days",
            "ssl-issued-to": "Issued to",
            "ssl-issued-by": "Issued by",
            "ssl-validity": "Validity Period",
            "ssl-technical": "Technical Details",
            "ssl-from": "From",
            "ssl-to": "To",
            "ssl-protocol": "Protocol",
            "ssl-key-alg": "Key Algorithm",
            "ssl-fingerprint": "SHA-256 Fingerprint",
            "ssl-copy": "Copy",
            "ssl-copied": "Fingerprint copied",
            "ssl-unknown": "Unknown",
            "ssl-error": "Error",
            "ssl-fail-title": "Failed to get certificate info",
            "ssl-fail-desc": "The site may use a self-signed certificate or there are connection issues.",
            
            // Extensions
            "ext-empty": "No extensions installed",
            "ext-default-desc": "Interface extension",
            "ext-official": "Official extension",
            "ext-verified": "Verified extension",
            "ext-delete": "Delete",
            "ext-delete-confirm": "Delete extension",
            "ext-deleted": "Extension deleted. Restart browser (F5)",
            "ext-installed": "Extension installed! Restart browser",
            "ext-install-error": "Extension file error (Invalid format)",
            
            // v2.0 Features
            "bookmarks-exported": "Bookmarks exported",
            "bookmarks-imported": "Bookmarks imported",
            "bookmarks-import-fail": "Import failed",
            "restore-session": "Restore previous session?",
            "restore-session-title": "Restore session?",
            "restore-session-desc": "Found {0} tabs from previous session. Restore them?",
            "restore-more": "more",
            "restore-no": "No, thanks",
            "restore-yes": "Restore",
            "session-restored": "Session restored",
            "popup-blocked": "Popup blocked",
            "popups-blocked-count": "Blocked",
            "translate-opened": "Translator opened",
            "screenshot-saved": "Screenshot saved",

            "btn-extensions": "Extensions",
            "ext-menu-title": "Extensions",
            "ext-install-hint": "Install a .visibility file",
            "ext-install-from-file": "Install from file",
            "zoom-reset-title": "Reset zoom (Ctrl+0)",
            "btn-close-sidebar": "Close",
            "set-perm-on-request": "On request",
            "perm-deny": "Block",
            "perm-allow": "Allow",
            "perm-unknown-origin": "unknown site",
            "perm-generic-desc": "Site is requesting permission",
            "perm-media-desc": "Site wants access to your camera and microphone",
            "perm-geo-desc": "Site wants to know your location",
            "perm-notif-desc": "Site wants to send you notifications",
            "perm-display-desc": "Site wants to share your screen",
            "perm-drm-desc": "Site wants to play protected content",
            "perm-midi-desc": "Site wants access to MIDI devices",
            "ssl-checking": "Checking certificate...",
            "ssl-unencrypted-desc": "Data is sent without encryption",
            "ssl-expiring-soon": "Certificate expiring soon",
            "ssl-copy-fingerprint": "Copy fingerprint",
            "ssl-gomp-title": "GOmp Studios Project",
            "ssl-gomp-desc": "Official GOmp Studios ecosystem project",
            "find-not-found": "Not found",
            "tab-sleeping": "(sleeping)",
            "dialog-crash-title": "Page stopped responding",
            "dialog-crash-msg": "The tab stopped responding and will be reloaded.",
            "dialog-unresponsive-title": "Browser not responding",
            "dialog-unresponsive-msg": "The browser stopped responding. Reload?",
            "dialog-reload": "Reload",
            "dialog-wait": "Wait",
            "history-window-title": "History & Bookmarks"
        }
    };

    let currentLang = 'ru';

    function applyLanguage(lang) {
        currentLang = lang || 'ru';
        window.currentLang = currentLang;
        document.documentElement.lang = currentLang;
        const t = translations[currentLang] || translations.ru;

        // 1. Map IDs to translation keys (text or title)
        const map = {
            "btn-minimize": "title", "btn-maximize": "title", "btn-close": "title",
            "new-tab-btn": "title", "btn-back": "title", "btn-forward": "title",
            "btn-reload": "title", "btn-home": "title", "btn-bookmark": "title",
            "btn-incognito": "title", "btn-vpn": "title", "btn-sidebar": "title",
            "btn-downloads": "title", "btn-settings": "title", "btn-extensions": "title",
            "btn-zoom-out": "title", "btn-zoom-in": "title",
            "btn-close-sidebar": "title",
            "zoom-display": { key: "zoom-reset-title", type: "title" },
            "btn-settings-cancel": "text",
            "btn-clear-cookies": "text", "btn-clear-all-history": "text",
            "vpn-stat-v3": { key: "vpn-offline", type: "text" },
            "vpn-info-v3": { key: "vpn-select-server", type: "text" },
            "btn-tog-v3": { key: "vpn-connect", type: "text" },
            "btn-download-xray": { key: "vpn-download-btn", type: "text" },
            "vpn-xray-title": { key: "vpn-xray-title", type: "text" },
            "vpn-xray-desc": { key: "vpn-xray-desc", type: "text" },
            "vpn-xray-hint": { key: "vpn-xray-hint", type: "text" },
            "vpn-modal-title": { key: "btn-vpn", type: "text" },
            "vpn-servers-head": { key: "vpn-servers-title", type: "text" },
            "vpn-sub-head": { key: "vpn-sub-title", type: "text" },
            "vpn-manual-head": { key: "vpn-manual-title", type: "text" },
            "btn-sub-v3": { key: "vpn-import", type: "text" },
            "btn-add-v3": { key: "vpn-add", type: "text" },
            "btn-cert-ok": { key: "ssl-ok", type: "text" },
            "set-default-browser": { key: "btn-set-default", type: "text" }
        };

        for (const [id, config] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (!el) continue;
            const key = (typeof config === 'string') ? id : config.key;
            const method = (typeof config === 'string') ? config : config.type;

            if (t[key]) {
                if (method === "text") el.textContent = t[key];
                else if (method === "title") el.title = t[key];
            }
        }

        // 2. Specific dynamic text (headers, etc)
        const modalTitles = {
            "Настройки": "modal-settings-title", "Settings": "modal-settings-title",
            "История": "sidebar-title", "History": "sidebar-title", "Браузер": "browser-title",
            "Удалить историю": "del-hist-title", "Delete History": "del-hist-title",
            "Сведения о безопасности": "ssl-title", "Security Details": "ssl-title",
            "Загрузки": "dl-title", "Downloads": "dl-title"
        };

        document.querySelectorAll('.modal-title, .dl-title, .dm-title, h2').forEach(el => {
            for (const [key, val] of Object.entries(modalTitles)) {
                if (el.textContent.includes(key) && t[val]) {
                    const icon = el.querySelector('svg');
                    if (icon) {
                        el.innerHTML = '';
                        el.appendChild(icon);
                        el.appendChild(document.createTextNode(t[val]));
                    } else {
                        el.textContent = t[val];
                    }
                    break;
                }
            }
        });

        const setIconLabel = (id, key) => {
            const el = document.getElementById(id);
            if (!el || !t[key]) return;
            const icon = el.querySelector('svg');
            if (icon) {
                el.innerHTML = '';
                el.appendChild(icon);
                el.appendChild(document.createTextNode(t[key]));
            } else {
                el.textContent = t[key];
            }
        };

        setIconLabel('incognito-pill', 'incognito-pill');
        setIconLabel('sidebar-title', 'sidebar-title');
        setIconLabel('btn-clear-history', 'btn-clear-history');
        setIconLabel('btn-settings-save', 'btn-settings-save');
        document.querySelectorAll('.dl-title').forEach((el) => {
            if (!t['dl-title']) return;
            const icon = el.querySelector('svg');
            if (icon) {
                el.innerHTML = '';
                el.appendChild(icon);
                el.appendChild(document.createTextNode(t['dl-title']));
            } else {
                el.textContent = t['dl-title'];
            }
        });

        // 3. Elements with data-panel or data-stab
        document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
            const p = btn.dataset.panel;
            const label = p === 'history' ? t['tab-history'] : p === 'bookmarks' ? t['tab-bookmarks'] : '';
            if (!label) return;
            const icon = btn.querySelector('svg');
            if (icon) {
                btn.innerHTML = '';
                btn.appendChild(icon);
                btn.appendChild(document.createTextNode(label));
            } else {
                btn.textContent = label;
            }
        });

        document.querySelectorAll('.stab').forEach(btn => {
            const s = btn.dataset.stab;
            const label = t['stab-' + s];
            if (!label) return;
            const icon = btn.querySelector('svg');
            if (icon) {
                btn.innerHTML = '';
                btn.appendChild(icon);
                btn.appendChild(document.createTextNode(label));
            } else {
                btn.textContent = label;
            }
        });

        if (window.iosUI) {
            requestAnimationFrame(() => window.iosUI.refreshAllIndicators());
        }

        // 4. Placeholders
        const placeholders = {
            "url-bar": "url-bar",
            "history-search": "history-search",
            "bookmarks-search": "bookmarks-search",
            "ntp-search-input": "ntp-search-placeholder",
            "vpn-url-v3": "vpn-url-placeholder",
            "vpn-link-input": "vpn-manual-title",
            "set-homepage": "set-homepage-desc"
        };
        for (const [id, key] of Object.entries(placeholders)) {
            const el = document.getElementById(id);
            if (el && t[key]) el.placeholder = t[key];
        }

        // 5. Setting group titles
        document.querySelectorAll('.setting-group-title').forEach(title => {
            const id = title.id;
            if (id && t[id]) title.textContent = t[id];
        });

        // 5.5 Extensions dropdown
        setIconLabel('ext-dropdown-title', 'ext-menu-title');
        const extEmpty = document.getElementById('ext-empty-text');
        if (extEmpty && t['ext-empty']) extEmpty.textContent = t['ext-empty'];
        const extHint = document.getElementById('ext-install-hint');
        if (extHint && t['ext-install-hint']) extHint.textContent = t['ext-install-hint'];
        setIconLabel('btn-ext-install', 'ext-install-from-file');

        // 5.6 Permission "on request" labels
        document.querySelectorAll('.perm-on-request-label').forEach(el => {
            if (t['set-perm-on-request']) el.textContent = t['set-perm-on-request'];
        });

        // 5.7 Shortcuts labels
        const shortcutsLabels = [
            'sh-new-tab', 'sh-close-tab', 'sh-next-tab', 'sh-reopen-tab',
            'sh-url-bar', 'sh-reload', 'sh-force-reload', 'sh-back-forward',
            'sh-history', 'sh-downloads', 'sh-incognito', 'sh-bookmark', 'sh-zoom'
        ];
        for (const id of shortcutsLabels) {
            const el = document.getElementById(id);
            if (el && t[id]) el.textContent = t[id];
        }

        // 6. Settings rows
        document.querySelectorAll('.setting-row').forEach(row => {
            const label = row.querySelector('.setting-label');
            const desc = row.querySelector('.setting-desc');
            const input = row.querySelector('input, select, textarea, button');
            if (!label || !input) return;
            const id = input.id;
            const keyBase = id.replace('set-', '');
            if (t['set-' + keyBase + '-label']) label.textContent = t['set-' + keyBase + '-label'];
            if (desc && t['set-' + keyBase + '-desc']) desc.textContent = t['set-' + keyBase + '-desc'];

            // Also translate select options if needed
            if (input.tagName === 'SELECT') {
                Array.from(input.options).forEach(opt => {
                    const optKey = 'set-' + keyBase + '-' + opt.value;
                    if (t[optKey]) opt.textContent = t[optKey];
                });
            }
        });

        // 6. NTP
        const ntpRecentTitle = document.querySelector('.ntp-recent-title');
        if (ntpRecentTitle && t['ntp-recent-title']) ntpRecentTitle.textContent = t['ntp-recent-title'];
        const ntpDino = document.getElementById('ntp-dino-name');
        if (ntpDino && t['ntp-dino-name']) ntpDino.textContent = t['ntp-dino-name'];

        // 7. VPN Sections
        document.querySelectorAll('.vpn-section-title').forEach(el => {
            if (el.textContent === 'Servers' || el.textContent === 'Серверы') el.textContent = t['vpn-servers-title'];
            if (el.textContent.includes('Subscription') || el.textContent.includes('подписки')) el.textContent = t['vpn-sub-title'];
            if (el.textContent.includes('Manual') || el.textContent.includes('вручную')) el.textContent = t['vpn-manual-title'];
        });
        const vpnImportBtn = document.getElementById('btn-set-vpn-import-sub');
        if (vpnImportBtn && t['vpn-import']) vpnImportBtn.textContent = t['vpn-import'];
        const vpnOpenBtn = document.getElementById('btn-open-vpn-from-settings');
        if (vpnOpenBtn && t['set-vpn-panel-open']) vpnOpenBtn.textContent = t['set-vpn-panel-open'];

        // 8. Delete History Buttons
        document.querySelectorAll('.dm-btn').forEach(btn => {
            if (btn.onclick && btn.onclick.toString().includes('hour')) btn.textContent = t['del-hist-hour'];
            if (btn.onclick && btn.onclick.toString().includes('day')) btn.textContent = t['del-hist-day'];
            if (btn.onclick && btn.onclick.toString().includes('week')) btn.textContent = t['del-hist-week'];
            if (btn.onclick && btn.onclick.toString().includes('month')) btn.textContent = t['del-hist-month'];
            if (btn.classList.contains('danger')) btn.textContent = t['del-hist-all'];
        });
        const dmCancel = document.querySelector('.dm-cancel');
        if (dmCancel) dmCancel.textContent = t['btn-settings-cancel'];

        translateDynamic();

        requestAnimationFrame(() => {
            if (window.iosUI) window.iosUI.refreshAllIndicators();
        });
    }

    // IPC Listeners
    ipcRenderer.on('settings-data', (e, settings) => {
        if (settings.language) {
            applyLanguage(settings.language);
            const sel = document.getElementById('set-language');
            if (sel) sel.value = settings.language;
        }
    });

    ipcRenderer.on('settings-saved', (e, settings) => {
        if (settings.language) applyLanguage(settings.language);
        if (typeof window.applyVpnLabels === 'function') window.applyVpnLabels();
    });

    window.addEventListener('DOMContentLoaded', () => {
        ipcRenderer.send('get-settings');
    });

    // Export if needed for other scripts
    // Expose to window for other scripts
    window.translations = translations;
    window.applyLanguage = applyLanguage;
    window.currentLang = currentLang;

    // Translation helper
    window.t = function (key, fallback) {
        const lang = window.currentLang || 'ru';
        const trans = translations[lang] || translations.ru;
        return trans[key] || fallback || key;
    };

    // --- Runtime Translation Patches ---

    function translateDynamic() {
        // Tab titles
        document.querySelectorAll('.tab-title').forEach(el => {
            const txt = el.textContent.trim();
            if (txt === 'Новая вкладка' || txt === 'New Tab') el.textContent = window.t('tab-new', txt);
            else if (txt === 'Без названия' || txt === 'Untitled') el.textContent = window.t('untitled', txt);
        });

        // Translate specific tooltips using known IDs to avoid expensive querySelectorAll('[title]')
        const tooltips = [
            'btn-back', 'btn-forward', 'btn-reload', 'btn-home', 'btn-bookmark', 
            'btn-incognito', 'btn-vpn', 'btn-sidebar', 'btn-downloads', 'btn-settings',
            'btn-zoom-out', 'btn-zoom-in'
        ];
        tooltips.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.title) {
                const key = id.replace('btn-', 'sh-'); // Many shortcuts keys match button function
                if (translations[currentLang][id]) el.title = translations[currentLang][id];
            }
        });

        // Empty states (limited to sidebar)
        document.querySelectorAll('#sidebar .empty-state-text').forEach(el => {
            const txt = el.textContent.trim();
            if (txt === 'История пуста' || txt === 'History is empty') el.textContent = window.t('empty-history');
            if (txt === 'Нет закладок' || txt === 'No bookmarks') el.textContent = window.t('empty-bookmarks');
            if (txt === 'Ничего не найдено' || txt === 'Nothing found') el.textContent = window.t('nothing-found');
        });
    }

    // Intercept toast messages
    let originalToast = window.toast;
    Object.defineProperty(window, 'toast', {
        get: () => function (msg) {
            if (typeof msg === 'string') {
                // Direct keys
                if (translations[currentLang][msg]) {
                    msg = window.t(msg);
                } else {
                    // Substring replacements for known literal strings
                    const patterns = {
                        'Закладка удалена': 'toast-bookmark-removed',
                        'Bookmark removed': 'toast-bookmark-removed',
                        'Добавлено в закладки': 'toast-bookmark-added',
                        'Added to bookmarks': 'toast-bookmark-added',
                        'История очищена': 'toast-history-cleared',
                        'History cleared': 'toast-history-cleared',
                        'Xray ready': 'toast-xray-ready',
                        'Xray скачан': 'toast-xray-ready',
                        'Открывается окно инкогнито...': 'toast-incognito-open',
                        'Opening incognito window...': 'toast-incognito-open',
                        'Загрузка:': 'toast-download-start',
                        'Downloading:': 'toast-download-start',
                        'Загружено:': 'toast-download-complete',
                        'Downloaded:': 'toast-download-complete',
                        'Видео не найдено на этой странице.': 'vid-not-found',
                        'Video not found on this page.': 'vid-not-found'
                    };
                    for (const [pattern, key] of Object.entries(patterns)) {
                        if (msg.includes(pattern)) msg = msg.replace(pattern, window.t(key));
                    }
                    // Generic error key replacements
                    const errKeys = ['SUB_PARSE_ERROR', 'LINK_FORMAT_ERROR', 'XRAY_START_ERROR'];
                    for (const k of errKeys) {
                        if (msg.includes(k)) msg = msg.replace(k, window.t(k));
                    }
                }
            }
            if (typeof originalToast === 'function') originalToast(msg);
            else console.log("Toast:", msg);
        },
        set: (v) => { originalToast = v; },
        configurable: true
    });

    window.addEventListener('load', () => {
        translateDynamic();
        
        // Final check on title
        if (document.title === 'Visibility Browser') {
            document.title = window.t('title', 'Visibility Browser');
        }
    });

})();
