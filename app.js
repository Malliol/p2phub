import { registerUser, loginUser, getCurrentUser, logout } from "./auth.js";

let currentUsername = null;

// ===== AUTH =====
const authScreen   = document.getElementById("authScreen");
const appScreen    = document.getElementById("appScreen");
const authForm     = document.getElementById("authForm");
const tabLogin     = document.getElementById("tabLogin");
const tabRegister  = document.getElementById("tabRegister");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const authError    = document.getElementById("authError");
const authSubmit   = document.getElementById("authSubmit");
const logoutBtn    = document.getElementById("logoutBtn");

let isRegisterMode = false;

function setAuthMode(reg) {
  isRegisterMode = reg;
  tabLogin.classList.toggle("active", !reg);
  tabRegister.classList.toggle("active", reg);
  authSubmit.textContent = reg ? "Зарегистрироваться" : "Войти";
  authError.classList.add("hidden");
  authPassword.autocomplete = reg ? "new-password" : "current-password";
}
tabLogin.addEventListener("click",    () => setAuthMode(false));
tabRegister.addEventListener("click", () => setAuthMode(true));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authSubmit.disabled = true;
  authError.classList.add("hidden");
  try {
    const u = authUsername.value.trim();
    const p = authPassword.value;
    if (isRegisterMode) { await registerUser(u, p); }
    await loginUser(u, p);
    startApp(getCurrentUser());
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove("hidden");
  } finally {
    authSubmit.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => {
  logout();
  closeWS();
  appScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");
  authPassword.value = "";
  messagesEl.innerHTML = '<div class="messages-empty" id="messagesEmpty">Напиши первое сообщение</div>';
});

const currentUser = getCurrentUser();
if (currentUser) {
  authScreen.classList.add("hidden");
  startApp(currentUser);
}

// ===== PWA =====
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

// ===== TOAST =====
const toastEl = document.getElementById("toast");
let toastTimer;
function showToast(text, type) {
  toastEl.textContent = text;
  toastEl.className = "toast show" + (type === "info" ? " info" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3000);
}

// ===== CHAT =====
let ws = null;

const wsStatus    = document.getElementById("wsStatus");
const connDot     = document.getElementById("connDot");
const messagesEl  = document.getElementById("messages");
const msgInput    = document.getElementById("msgInput");
const sendBtn     = document.getElementById("sendBtn");
const userList    = document.getElementById("userList");
const onlineCount = document.getElementById("onlineCount");
const pizdetsBtn  = document.getElementById("pizdetsBtn");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar     = document.getElementById("sidebar");

function setStatus(text, state) {
  wsStatus.textContent = text;
  connDot.className = "conn-dot" + (state ? " " + state : "");
}

function getWsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

function closeWS() {
  if (ws) { try { ws.close(); } catch {} ws = null; }
}

function connectWS(username) {
  closeWS();
  setStatus("подключение…", "");
  ws = new WebSocket(getWsUrl());
  ws.onopen  = () => ws.send(JSON.stringify({ type: "join", username }));
  ws.onmessage = (e) => { try { handleMsg(JSON.parse(e.data)); } catch {} };
  ws.onclose = () => { setStatus("нет соединения", "error"); setTimeout(() => connectWS(username), 3000); };
  ws.onerror = () => setStatus("ошибка", "error");
}

function wsSend(data) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(data));
}

function fmtTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

function getEmptyEl() { return document.getElementById("messagesEmpty"); }

function appendMsg(data) {
  getEmptyEl()?.remove();
  const mine = data.username === currentUsername;
  const row = document.createElement("div");
  row.className = `msg-row ${mine ? "mine" : "theirs"}`;

  if (!mine) {
    const meta = document.createElement("div");
    meta.className = "msg-meta";
    meta.style.color = data.color || "var(--muted)";
    meta.textContent = data.username;
    row.appendChild(meta);
  }

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = data.text;
  row.appendChild(bubble);

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = fmtTime(data.t);
  row.appendChild(time);

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendSys(text) {
  const el = document.createElement("div");
  el.className = "sys-msg";
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendPizdets(username) {
  getEmptyEl()?.remove();
  const el = document.createElement("div");
  el.className = "pizdets-msg";
  el.textContent = `⚠️ ПИЗДЕЦ от ${username}`;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderUsers(users) {
  onlineCount.textContent = users.length;
  userList.innerHTML = "";
  for (const u of users) {
    const li = document.createElement("li");
    li.className = "user-item";
    const av = document.createElement("div");
    av.className = "user-avatar";
    av.style.background = u.color || "var(--accent)";
    av.textContent = u.username[0].toUpperCase();
    const nm = document.createElement("span");
    nm.className = "user-name";
    nm.textContent = u.username + (u.username === currentUsername ? " (я)" : "");
    li.append(av, nm);
    userList.appendChild(li);
  }
}

function handleMsg(msg) {
  switch (msg.type) {
    case "init":
      setStatus("в сети", "online");
      renderUsers(msg.users || []);
      for (const m of (msg.history || [])) {
        if (m.type === "message") appendMsg(m);
        else if (m.type === "pizdets") appendPizdets(m.username);
      }
      break;
    case "message":
      appendMsg(msg);
      if (msg.username !== currentUsername && document.hidden && Notification.permission === "granted") {
        new Notification(`${msg.username}: ${msg.text.slice(0, 80)}`);
      }
      break;
    case "system":
      appendSys(msg.text);
      renderUsers(msg.users || []);
      break;
    case "pizdets":
      appendPizdets(msg.username);
      showToast(`⚠️ Пиздец от ${msg.username}!`);
      if (Notification.permission === "granted") {
        new Notification("ОСГОворим: ПИЗДЕЦ!", { body: `Сигнал от ${msg.username}` });
      }
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      break;
  }
}

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !ws || ws.readyState !== 1) return;
  wsSend({ type: "message", text });
  msgInput.value = "";
}

sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

pizdetsBtn.addEventListener("click", () => {
  wsSend({ type: "pizdets" });
  pizdetsBtn.classList.add("fire");
  setTimeout(() => pizdetsBtn.classList.remove("fire"), 400);
  showToast("Пиздец отправлен всем!");
});

sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("closed"));

// ===== PWA INSTALL =====
const installBanner = document.getElementById("installBanner");
const installBtn    = document.getElementById("installBtn");
const installClose  = document.getElementById("installClose");
const installHint   = document.getElementById("installHint");
let deferredPrompt  = null;
const isStandalone  = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIos         = /iphone|ipad|ipod/i.test(navigator.userAgent);

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!isStandalone) installBanner.classList.remove("hidden");
});
installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBanner.classList.add("hidden");
});
installClose.addEventListener("click", () => installBanner.classList.add("hidden"));
window.addEventListener("appinstalled", () => installBanner.classList.add("hidden"));
if (isIos && !isStandalone) {
  installHint.textContent = 'Safari → Поделиться → На экран «Домой»';
  installBtn.classList.add("hidden");
  installBanner.classList.remove("hidden");
}

// ===== START =====
function startApp(username) {
  currentUsername = username;
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  if (Notification.permission === "default") Notification.requestPermission();
  connectWS(username);
}
