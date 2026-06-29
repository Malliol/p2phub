# Сервер ОСГОворим — инструкция подключения

## Данные сервера
- **IP:** 144.31.63.224
- **OS:** Ubuntu 26.04 LTS
- **Проект:** /var/www/p2phub
- **Сайт:** http://144.31.63.224

## Подключение через Admin API (основной способ)

SSH заблокирован провайдером. Управление через HTTP Admin API:

```bash
curl -s -X POST http://144.31.63.224/admin \
  -H "x-token: p2phub-admin-7x9k" \
  -d "КОМАНДА_ЗДЕСЬ"
```

### Примеры
```bash
# Проверить сервер
curl -s -X POST http://144.31.63.224/admin -H "x-token: p2phub-admin-7x9k" -d "whoami && uptime"

# Обновить проект из git
curl -s -X POST http://144.31.63.224/admin -H "x-token: p2phub-admin-7x9k" -d "cd /var/www/p2phub && git pull origin main"

# Перезапустить nginx
curl -s -X POST http://144.31.63.224/admin -H "x-token: p2phub-admin-7x9k" -d "systemctl reload nginx"

# Смотреть логи nginx
curl -s -X POST http://144.31.63.224/admin -H "x-token: p2phub-admin-7x9k" -d "tail -20 /var/log/nginx/error.log"
```

## VNC консоль (если Admin API недоступен)
- Панель провайдера: senko.network
- Логин панели: nm20079090@gmail.com
- Сервер: vm621815
- root пароль: Superparol1220

## Репозиторий
- GitHub: github.com/Malliol/p2phub
- Основная ветка: main
- Ветка разработки: claude/explore-project-repo-c86qmc

## Nginx конфиг
- Сайт: /etc/nginx/sites-available/p2phub
- /admin → проксируется на localhost:3001 (Admin API, Node.js)

## Запустить Admin API после перезагрузки
```bash
curl -fsSL https://raw.githubusercontent.com/Malliol/p2phub/main/admin.js -o /tmp/admin.js && node /tmp/admin.js &
```
