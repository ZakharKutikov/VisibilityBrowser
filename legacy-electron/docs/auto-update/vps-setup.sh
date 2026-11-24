#!/bin/bash
# Скрипт для настройки VPS (Ubuntu/Debian)
# Запустить на сервере: sudo bash vps-setup.sh

echo "=========================================="
echo "Настройка сервера автообновлений"
echo "Домен: api.gomp.su"
echo "=========================================="

# 1. Установка nginx
apt update
apt install -y nginx certbot python3-certbot-nginx

# 2. Создание директории
mkdir -p /var/www/updates
chown -R www-data:www-data /var/www/updates
chmod 755 /var/www/updates

# 3. Создание nginx config
cat > /etc/nginx/sites-available/updates << 'EOF'
server {
    listen 80;
    server_name api.gomp.su;
    root /var/www/updates;
    index index.html;
    
    # Enable CORS for electron-updater
    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept" always;
    
    # No caching for yml files
    location ~* \.yml$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }
    
    # Autoindex for directory listing (optional)
    location / {
        autoindex on;
        try_files $uri $uri/ =404;
    }
}
EOF

# 4. Активация сайта
ln -sf /etc/nginx/sites-available/updates /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default  # Отключаем дефолтный

# 5. Проверка и перезапуск nginx
nginx -t
systemctl restart nginx

# 6. Установка HTTPS (интерактивно)
echo ""
echo "=========================================="
echo "Запуск certbot для HTTPS..."
echo "Следуйте инструкциям на экране"
echo "=========================================="
certbot --nginx -d api.gomp.su --non-interactive --agree-tos --email your-email@example.com

# 7. Создание тестового файла
cat > /var/www/updates/latest.yml << 'EOF'
version: 2.0.0
files:
  - url: Visibility Browser Setup 2.0.0.exe
    sha512: placeholder_hash_placeholder_hash_placeholder_hash_placeholder_hash_placeholder_hash_placeholder_hash_placeholder_hash_placeholder_hash_
    size: 0
path: Visibility Browser Setup 2.0.0.exe
sha512: placeholder_hash_placeholder_hash_placeholder_hash_placeholder_hash_placeholder_hash_placeholder_hash_placeholder_hash_placeholder_hash_
releaseDate: '2026-04-13T00:00:00.000Z'
EOF

chown www-data:www-data /var/www/updates/latest.yml

echo ""
echo "=========================================="
echo "Готово! Проверьте:"
echo "  HTTP:  http://api.gomp.su/"
echo "  HTTPS: https://api.gomp.su/"
echo ""
echo "Для загрузки обновлений используйте:"
echo "  scp latest.yml root@api.gomp.su:/var/www/updates/"
echo "  scp 'Visibility Browser Setup X.X.X.exe' root@api.gomp.su:/var/www/updates/"
echo "=========================================="
