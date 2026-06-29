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
});

const existingUser = getCurrentUser();
if (existingUser) {
  authScreen.classList.add("hidden");
  startApp(existingUser);
}

// ===== PWA =====
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

// ===== TOAST =====
const toastEl = document.getElementById("toast");
let toastTimer;
function showToast(text) {
  toastEl.textContent = text;
  toastEl.className = "toast show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3500);
}

// ===== WS =====
let ws = null;

const wsStatus    = document.getElementById("wsStatus");
const connDot     = document.getElementById("connDot");
const userList    = document.getElementById("userList");
const onlineCount = document.getElementById("onlineCount");
const pizdetsBtn  = document.getElementById("pizdetsBtn");

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
  ws.onopen    = () => ws.send(JSON.stringify({ type: "join", username }));
  ws.onmessage = (e) => { try { handleMsg(JSON.parse(e.data)); } catch {} };
  ws.onclose   = () => { setStatus("нет соединения", "error"); setTimeout(() => connectWS(username), 3000); };
  ws.onerror   = () => setStatus("ошибка", "error");
}

function wsSend(data) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(data));
}

function renderUsers(users) {
  onlineCount.textContent = users.length;
  userList.innerHTML = "";
  if (!users.length) {
    userList.innerHTML = '<li class="online-empty">Никого нет онлайн</li>';
    return;
  }
  for (const u of users) {
    const li = document.createElement("li");
    li.className = "user-item";
    const av = document.createElement("div");
    av.className = "user-avatar";
    av.style.background = u.color || "var(--accent)";
    av.textContent = u.username[0].toUpperCase();
    const nm = document.createElement("span");
    nm.className = "user-name";
    nm.textContent = u.username;
    if (u.username === currentUsername) {
      const me = document.createElement("span");
      me.className = "user-name-me";
      me.textContent = "(я)";
      nm.appendChild(me);
    }
    li.append(av, nm);
    userList.appendChild(li);
  }
}

function handleMsg(msg) {
  switch (msg.type) {
    case "users":
      setStatus("в сети", "online");
      renderUsers(msg.users || []);
      break;
    case "pizdets":
      showToast(`⚠️ ПИЗДЕЦ от ${msg.username}!`);
      pizdetsBtn.classList.add("fire");
      setTimeout(() => pizdetsBtn.classList.remove("fire"), 420);
      if (Notification.permission === "granted") {
        new Notification("⚠️ ПИЗДЕЦ!", { body: `Сигнал от ${msg.username}` });
      }
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      break;
  }
}

pizdetsBtn.addEventListener("click", () => {
  wsSend({ type: "pizdets" });
  pizdetsBtn.classList.add("fire");
  setTimeout(() => pizdetsBtn.classList.remove("fire"), 420);
  showToast("Пиздец отправлен всем!");
});

// ===== START =====
function startApp(username) {
  currentUsername = username;
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  if (Notification.permission === "default") Notification.requestPermission();
  connectWS(username);
}
