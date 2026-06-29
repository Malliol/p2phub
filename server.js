import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = 3000;
const clients = new Map();
const COLORS = ['#2f81f7','#3fb950','#f78166','#d2a8ff','#ffa657','#79c0ff','#56d364','#ff7b72'];

const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
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
    if (user) {
      clients.delete(ws);
      broadcast({ type: 'users', users: getUserList() });
    }
  });

  ws.on('error', () => { if (user) clients.delete(ws); });
});

server.listen(PORT, () => console.log(`Server on :${PORT}`));
