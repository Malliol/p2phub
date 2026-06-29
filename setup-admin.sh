#!/bin/bash
# Прокидываем admin API через nginx /admin -> :3001

# Запускаем admin.js если не запущен
pkill -f admin.js 2>/dev/null; sleep 1
node /var/www/p2phub/admin.js &
sleep 1
echo "admin.js PID: $(pgrep -f admin.js)"

# Добавляем location в nginx конфиг
cat > /etc/nginx/sites-available/p2phub << 'NGINX'
server {
    listen 80;
    server_name _;
    root /var/www/p2phub;
    index index.html;

    location /admin {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

nginx -t && systemctl reload nginx && echo "=== ГОТОВО ==="
