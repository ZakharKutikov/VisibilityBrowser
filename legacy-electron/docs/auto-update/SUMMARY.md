# Документация по автообновлению — Сводка

## Созданные файлы

| Файл | Описание |
|------|----------|
| `README.md` | Полная документация по настройке |
| `vps-setup.sh` | Скрипт для автоматической настройки VPS |
| `upload-update.bat` | Скрипт для загрузки обновлений с Windows |
| `generate-latest.js` | Генератор latest.yml вручную |
| `latest.yml` | Пример файла версий |
| `SUMMARY.md` | Этот файл |

## Быстрый старт

### 1. Настройка VPS (один раз)

Загрузи `vps-setup.sh` на сервер и запусти:
```bash
sudo bash vps-setup.sh
```

Или вручную:
```bash
# Установка
sudo apt install nginx certbot python3-certbot-nginx

# Директория
sudo mkdir -p /var/www/updates
sudo chown -R $USER:$USER /var/www/updates

# Nginx config (см. README.md)
sudo nano /etc/nginx/sites-available/updates

# HTTPS
sudo certbot --nginx -d api.gomp.su
```

### 2. Публикация обновления

#### Вариант А: Автоматически (рекомендуется)
```bash
npm run build
upload-update.bat 2.0.1
```

#### Вариант Б: Вручную
```bash
# Сборка
npm run build

# Генерация latest.yml (если нужно)
node docs/auto-update/generate-latest.js 2.0.1 "dist/Visibility Browser Setup 2.0.1.exe"

# Загрузка
scp dist/latest.yml root@api.gomp.su:/var/www/updates/
scp "dist/Visibility Browser Setup 2.0.1.exe" root@api.gomp.su:/var/www/updates/
```

## Как это работает

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ Visibility      │  HTTP   │  api.gomp.su   │  check  │  latest.yml    │
│ Browser         │ ───────>│  (nginx)        │ ───────>│  (version)     │
│ (electron)      │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
         │                           │                           │
         │                           │                           │
         │                    new version?                      │
         │                           │                           │
         │                    ┌──────┴──────┐                   │
         │                    │  Да — скачать│                   │
         │                    │  .exe файл   │                   │
         │                    └─────────────┘                   │
         │                           │                           │
         │<──────────────────────────┘                           │
         │                                                    │
         │         Скачивание с прогрессом                     │
         │         "45% · 3.45 MB/s"                          │
         │                                                    │
         │<────────────────────────────────────────────────────┘
         │
         │         Установка и перезапуск
         │         "Перезапуск..."
         ▼
   ┌─────────────┐
   │ Новая версия │
   └─────────────┘
```

## Структура URL

| URL | Назначение |
|-----|------------|
| `https://api.gomp.su/latest.yml` | Файл с версией и хэшами |
| `https://api.gomp.su/Visibility Browser Setup X.X.X.exe` | Установщик |

## Требования к файлам

### latest.yml
```yaml
version: 2.0.1                              # Версия (должна быть > текущей)
files:
  - url: Visibility Browser Setup 2.0.1.exe # Имя файла
    sha512: base64_sha512_hash              # Хэш SHA512 в base64
    size: 98765432                          # Размер в байтах
path: Visibility Browser Setup 2.0.1.exe
sha512: base64_sha512_hash                  # Тот же хэш
releaseDate: '2026-04-13T10:00:00.000Z'     # ISO дата
```

### Важно
- **Имя файла** должно совпадать в `url` и фактическом файле
- **sha512** используется для проверки целостности
- **Размер** используется для прогресса загрузки
- **Версия** сравнивается с `package.json` текущей версией

## Отладка

### На клиенте (браузер)
Открой DevTools (F12) → Console, должны быть сообщения:
```
[AUTO-UPDATE] Checking for update...
[AUTO-UPDATE] Update available: 2.0.1
[AUTO-UPDATE] Download progress: 45.2% @ 3.45 MB/s
[AUTO-UPDATE] Update downloaded: 2.0.1
[AUTO-UPDATE] Installing and restarting...
```

### На сервере (VPS)
```bash
# Логи nginx
sudo tail -f /var/log/nginx/access.log

# Проверка файлов
ls -la /var/www/updates/
cat /var/www/updates/latest.yml

# Проверка URL
curl -I https://api.gomp.su/latest.yml
curl https://api.gomp.su/latest.yml
```

## Безопасность

- Используй **HTTPS** (Let's Encrypt)
- Храни `latest.yml` и `.exe` в `/var/www/updates`
- Убедись что права `644` для файлов, `755` для директорий
- sha512 защищает от подмены файла

## Обновление кода

Если нужно изменить URL сервера:

1. `main.js` строка 311: `url: 'https://api.gomp.su'`
2. `package.json` строка 41: `"url": "https://api.gomp.su"`
3. `upload-update.bat` строка 8: `set VPS_IP=...` и `set VPS_USER=...`

Пересобрать и загрузить новую версию.
