import http from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const PORT = 3000;
const USERS_FILE = './users.json';
const clients = new Map();
const COLORS = ['#2f81f7','#3fb950','#f78166','#d2a8ff','#ffa657','#79c0ff','#56d364','#ff7b72'];

function loadUsers() {
  if (!existsSync(USERS_FILE)) return {};
  try { return JSON.parse(readFileSync(USERS_FILE, 'utf8')); } catch { return {}; }
}
function saveUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function hash(str) {
  return createHash('sha256').update(str).digest('hex');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost`);

  if (req.method === 'POST' && url.pathname === '/api/register') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        if (!username || !password) return json(res, 400, { error: 'Нужны логин и пароль' });
        const u = String(username).trim().slice(0, 32);
        const p = String(password);
        if (u.length < 2) return json(res, 400, { error: 'Логин минимум 2 символа' });
        if (p.length < 4) return json(res, 400, { error: 'Пароль минимум 4 символа' });
        const users = loadUsers();
        if (users[u.toLowerCase()]) return json(res, 409, { error: 'Логин уже занят' });
        users[u.toLowerCase()] = { username: u, hash: hash(p) };
        saveUsers(users);
        json(res, 200, { ok: true, username: u });
      } catch { json(res, 400, { error: 'Неверный запрос' }); }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        if (!username || !password) return json(res, 400, { error: 'Нужны логин и пароль' });
        const users = loadUsers();
        const u = users[String(username).trim().toLowerCase()];
        if (!u || u.hash !== hash(String(password))) return json(res, 401, { error: 'Неверный логин или пароль' });
        json(res, 200, { ok: true, username: u.username });
      } catch { json(res, 400, { error: 'Неверный запрос' }); }
    });
    return;
  }

  res.writeHead(200); res.end('ok');
});

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const wss = new WebSocketServer({ server });

function send(ws, data) { if (ws.readyState === 1) ws.send(JSON.stringify(data)); }
function broadcast(data) { for (const [ws] of clients) send(ws, data); }
function getUserList() { return [...clients.values()].map(u => ({ username: u.username, color: u.color })); }

let colorIdx = 0;

wss.on('connection', (ws) => {
  let user = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'join') {
      const username = String(msg.username || 'Аноним').slice(0, 32);
      const color = COLORS[colorIdx++ % COLORS.length];
      user = { username, color };
      clients.set(ws, user);
      broadcast({ type: 'users', users: getUserList() });
    } else if (msg.type === 'pizdets' && user) {
      broadcast({ type: 'pizdets', username: user.username, t: Date.now() });
    }
  });

  ws.on('close', () => {
    if (user) { clients.delete(ws); broadcast({ type: 'users', users: getUserList() }); }
  });

  ws.on('error', () => { if (user) clients.delete(ws); });
});

server.listen(PORT, () => console.log(`Server on :${PORT}`));
