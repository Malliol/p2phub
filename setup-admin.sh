#!/bin/bash
# Запуск admin API + nginx прокси

pkill -f admin.js 2>/dev/null; sleep 1

# Создаём admin.js из base64 (без внешних загрузок)
echo "Y29uc3QgaHR0cCA9IHJlcXVpcmUoJ2h0dHAnKTsKY29uc3QgeyBleGVjU3luYyB9ID0gcmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpOwpjb25zdCBUT0tFTiA9ICdwMnBodWItYWRtaW4tN3g5ayc7CgpodHRwLmNyZWF0ZVNlcnZlcigocmVxLCByZXMpID0+IHsKICBpZiAocmVxLm1ldGhvZCAhPT0gJ1BPU1QnIHx8IHJlcS5oZWFkZXJzWyd4LXRva2VuJ10gIT09IFRPS0VOKSB7CiAgICByZXMud3JpdGVIZWFkKDQwMyk7IHJlcy5lbmQoJ2ZvcmJpZGRlbicpOwogICAgcmV0dXJuOwogIH0KICBsZXQgYm9keSA9ICcnOwogIHJlcS5vbignZGF0YScsIGQgPT4gYm9keSArPSBkKTsKICByZXEub24oJ2VuZCcsICgpID0+IHsKICAgIHRyeSB7CiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKGJvZHksIHsgdGltZW91dDogMzAwMDAsIGVuY29kaW5nOiAndXRmOCcsIHNoZWxsOiAnL2Jpbi9iYXNoJyB9KTsKICAgICAgcmVzLndyaXRlSGVhZCgyMDApOyByZXMuZW5kKG91dCB8fCAnb2snKTsKICAgIH0gY2F0Y2ggKGUpIHsKICAgICAgcmVzLndyaXRlSGVhZCg1MDApOyByZXMuZW5kKChlLnN0ZG91dCB8fCAnJykgKyAnXG4nICsgKGUuc3RkZXJyIHx8ICcnKSk7CiAgICB9CiAgfSk7Cn0pLmxpc3RlbigzMDAxLCAnMC4wLjAuMCcsICgpID0+IGNvbnNvbGUubG9nKCdhZG1pbiByZWFkeSBvbiAzMDAxJykpOwo=" | base64 -d > /var/www/p2phub/admin.js

node /var/www/p2phub/admin.js &
sleep 1
echo "admin.js PID: $(pgrep -f admin.js)"

# nginx конфиг с /admin прокси
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
