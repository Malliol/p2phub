// server.js — WebSocket чат-сервер. Все подключённые пользователи в одной комнате.
import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = 3000;
const clients = new Map(); // ws -> { username, color, id }
const COLORS = ['#2f81f7','#3fb950','#f78166','#d2a8ff','#ffa657','#79c0ff','#56d364','#ff7b72'];
const history = []; // последние 100 сообщений
const MAX_HISTORY = 100;

const server = http.createServer((req, res) => {
  res.writeHead(200); res.end('ok');
});

const wss = new WebSocketServer({ server });

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function broadcast(data, exclude = null) {
  for (const [ws] of clients) {
    if (ws !== exclude) send(ws, data);
  }
}

function broadcastAll(data) {
  for (const [ws] of clients) send(ws, data);
}

function getUserList() {
  return [...clients.values()].map(u => ({ username: u.username, color: u.color }));
}

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

      // Отправляем новому пользователю историю и список онлайн
      send(ws, { type: 'init', users: getUserList(), history });

      // Уведомляем остальных
      const joinMsg = { type: 'system', text: `${username} вошёл в чат`, users: getUserList(), t: Date.now() };
      broadcast(joinMsg, ws);

    } else if (msg.type === 'message' && user) {
      const text = String(msg.text || '').trim().slice(0, 2000);
      if (!text) return;
      const data = { type: 'message', username: user.username, color: user.color, text, t: Date.now() };
      history.push(data);
      if (history.length > MAX_HISTORY) history.shift();
      broadcastAll(data);

    } else if (msg.type === 'pizdets' && user) {
      broadcastAll({ type: 'pizdets', username: user.username, t: Date.now() });
    }
  });

  ws.on('close', () => {
    if (user) {
      clients.delete(ws);
      broadcast({ type: 'system', text: `${user.username} вышел`, users: getUserList(), t: Date.now() });
    }
  });

  ws.on('error', () => {
    if (user) clients.delete(ws);
  });
});

server.listen(PORT, () => console.log(`Chat server on :${PORT}`));
