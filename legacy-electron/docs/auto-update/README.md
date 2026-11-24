# Настройка автообновления Visibility Browser

## Домен
`api.gomp.su` — сервер для раздачи обновлений

## Структура на VPS

```
/var/www/updates/
├── latest.yml              # Файл с версией и хэшами
├── Visibility Browser Setup 2.0.1.exe  # Установщик
└── Visibility Browser Setup 2.0.2.exe  # Следующая версия
```

## 1. Настройка Nginx

Создай файл `/etc/nginx/sites-available/updates`:

```nginx
server {
    listen 80;
    server_name api.gomp.su;
    root /var/www/updates;
    
    # Enable CORS for electron-updater
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
    
    location / {
        autoindex on;
        try_files $uri $uri/ =404;
    }
    
    # Cache control for yml files (no cache)
    location ~* \.yml$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }
}
```

Активируй:
```bash
sudo ln -s /etc/nginx/sites-available/updates /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 2. HTTPS (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.gomp.su
```

## 3. Создание папки

```bash
sudo mkdir -p /var/www/updates
sudo chown -R $USER:$USER /var/www/updates
```

## 4. Генерация latest.yml

Файл `latest.yml` должен содержать:

```yaml
version: 2.0.1
files:
  - url: Visibility Browser Setup 2.0.1.exe
    sha512: a1b2c3d4e5f6... (sha512 hash файла)
    size: 98765432
path: Visibility Browser Setup 2.0.1.exe
sha512: a1b2c3d4e5f6...
releaseDate: '2026-04-13T10:00:00.000Z'
```

### Генерация через electron-builder

При сборке `npm run build` electron-builder автоматически создаст:
- `latest.yml`
- `Visibility Browser Setup X.X.X.exe`

## 5. Загрузка обновлений

### Вариант 1: SCP
```bash
scp dist/latest.yml user@your-server:/var/www/updates/
scp "dist/Visibility Browser Setup 2.0.1.exe" user@your-server:/var/www/updates/
```

### Вариант 2: rsync
```bash
rsync -avz --progress dist/ user@your-server:/var/www/updates/
```

### Вариант 3: Web upload
```bash
# Зайти на сервер и скачать wget-ом
cd /var/www/updates
wget https://your-build-server.com/Visibility%20Browser%20Setup%202.0.1.exe
```

## 6. Проверка

Открой в браузере:
- `https://api.gomp.su/latest.yml` — должен показать YAML
- `https://api.gomp.su/` — должен показать список файлов

## 7. Как работает

1. Браузер при старте запрашивает `https://api.gomp.su/latest.yml`
2. Сравнивает `version` с текущей версией в `package.json`
3. Если новее — скачивает `.exe` файл
4. Показывает прогресс: `45% · 3.45 MB/s`
5. После скачивания: `Перезапуск...`
6. Устанавливает обновление и перезапускает браузер

## Важно

- **Версия** в `package.json` должна меняться при каждом релизе
- **Имя файла** должно содержать версию (для кэширования)
- **sha512** в `latest.yml` должен соответствовать реальному файлу
- **Размер файла** в байтах в `latest.yml`

## Отладка

Если обновление не работает, проверь логи:
```bash
# На клиенте (DevTools console или терминал)
# Должно быть:
# [AUTO-UPDATE] Checking for update...
# [AUTO-UPDATE] Update available: 2.0.1
# [AUTO-UPDATE] Download progress: 45.2% @ 3.45 MB/s
# [AUTO-UPDATE] Update downloaded: 2.0.1
# [AUTO-UPDATE] Installing and restarting...

# На сервере
sudo tail -f /var/log/nginx/access.log
```
