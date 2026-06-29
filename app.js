// app.js — логика ОСГОворим.
// Чистые функции — lib.js, авторизация — auth.js.

import { fmtBytes, escapeHtml, isMagnetUri, trimHistory, parseHistory } from "./lib.js";
import { registerUser, loginUser, getCurrentUser, logout } from "./auth.js";

// ===== АВТОРИЗАЦИЯ =====

const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");
const authForm = document.getElementById("authForm");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authSubmit = document.getElementById("authSubmit");
const logoutBtn = document.getElementById("logoutBtn");
const userBadge = document.getElementById("userBadge");

let isRegisterMode = false;

function setAuthMode(register) {
  isRegisterMode = register;
  tabLogin.classList.toggle("active", !register);
  tabRegister.classList.toggle("active", register);
  authSubmit.textContent = register ? "Зарегистрироваться" : "Войти";
  authError.textContent = "";
  authError.classList.add("hidden");
  authPassword.autocomplete = register ? "new-password" : "current-password";
}

tabLogin.addEventListener("click", () => setAuthMode(false));
tabRegister.addEventListener("click", () => setAuthMode(true));

function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove("hidden");
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = authUsername.value.trim();
  const password = authPassword.value;
  authSubmit.disabled = true;
  authError.classList.add("hidden");
  try {
    if (isRegisterMode) {
      await registerUser(username, password);
      await loginUser(username, password);
    } else {
      await loginUser(username, password);
    }
    showApp(getCurrentUser());
  } catch (err) {
    showAuthError(err.message);
  } finally {
    authSubmit.disabled = false;
  }
});

function showApp(username) {
  authScreen.classList.add("hidden");
  authScreen.style.display = "none";
  appScreen.classList.remove("hidden");
  userBadge.textContent = `Вы вошли как: ${username}`;
  initApp(username);
}

function showAuthScreen() {
  appScreen.classList.add("hidden");
  authScreen.style.display = "";
  authScreen.classList.remove("hidden");
  authPassword.value = "";
  authError.classList.add("hidden");
}

logoutBtn.addEventListener("click", () => {
  logout();
  if (peer) { try { peer.destroy(); } catch {} peer = null; }
  conn = null;
  connections = [];
  showAuthScreen();
});

// Старт: проверяем сессию
const currentUser = getCurrentUser();
if (currentUser) {
  showApp(currentUser);
} else {
  authScreen.style.display = "";
}

// ===== PWA: SERVICE WORKER =====

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch((err) => console.warn("SW не зарегистрирован:", err));
  });
}

// ===== КНОПКА «ПИЗДЕЦ» =====

const pizdetsBtn = document.getElementById("pizdetsBtn");

function showPizdetsToast(text) {
  let toast = document.getElementById("pizdetsToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "pizdetsToast";
    toast.className = "pizdets-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

pizdetsBtn.addEventListener("click", () => {
  const msg = "__PIZDETS__";

  // отправить всем подключённым пирам
  let sent = 0;
  for (const c of connections) {
    if (c && c.open) { c.send(msg); sent++; }
  }
  if (conn && conn.open && !connections.includes(conn)) {
    conn.send(msg); sent++;
  }

  pizdetsBtn.classList.add("fired");
  setTimeout(() => pizdetsBtn.classList.remove("fired"), 500);

  const label = sent > 0
    ? `Пиздец отправлен ${sent} собеседник${sent === 1 ? "у" : "ам"}`
    : "Пиздец! (нет подключений)";
  showPizdetsToast(label);

  // системное уведомление, если разрешено
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("ОСГОворим: Пиздец!", { body: "Экстренное уведомление от собеседника." });
  }
});

// ===== ОСНОВНАЯ ЛОГИКА (запускается после входа) =====

const TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.webtorrent.dev",
  "wss://tracker.files.fm:7073/announce",
];

let wt = null;
let peer = null;
let conn = null;
let connections = []; // все активные соединения (для broadcast)
let currentUsername = null;

function getTorrentClient() {
  if (!wt) {
    if (typeof WebTorrent === "undefined") throw new Error("WebTorrent не загрузился.");
    wt = new WebTorrent();
  }
  return wt;
}

function initApp(username) {
  currentUsername = username;

  // запросить разрешение на уведомления
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  initFiles();
  initChat(username);
  initPWA();
}

// ===== ФАЙЛЫ =====

function initFiles() {
  const fileInput = document.getElementById("fileInput");
  const shareBtn = document.getElementById("shareBtn");
  const seedInfo = document.getElementById("seedInfo");
  const seedStatus = document.getElementById("seedStatus");
  const magnetOut = document.getElementById("magnetOut");
  const copyBtn = document.getElementById("copyBtn");
  const magnetIn = document.getElementById("magnetIn");
  const downloadBtn = document.getElementById("downloadBtn");
  const dlInfo = document.getElementById("dlInfo");
  const dlBar = document.getElementById("dlBar");
  const dlStatus = document.getElementById("dlStatus");
  const dlResult = document.getElementById("dlResult");

  shareBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const client = getTorrentClient();
      seedInfo.classList.remove("hidden");
      seedStatus.textContent = `Готовлю «${file.name}» к раздаче…`;
      client.seed(file, { announce: TRACKERS }, (torrent) => {
        magnetOut.value = torrent.magnetURI;
        const update = () =>
          (seedStatus.innerHTML =
            `<span class="ok">Раздаётся</span> «${file.name}» · ` +
            `пиров: ${torrent.numPeers}. Держи вкладку открытой.`);
        update();
        torrent.on("wire", update);
      });
    } catch (e) {
      seedInfo.classList.remove("hidden");
      seedStatus.innerHTML = `<span class="err">${e.message}</span>`;
    }
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(magnetOut.value);
      copyBtn.textContent = "Скопировано ✓";
      setTimeout(() => (copyBtn.textContent = "Скопировать ссылку"), 1500);
    } catch { magnetOut.select(); }
  });

  downloadBtn.addEventListener("click", () => {
    const uri = magnetIn.value.trim();
    if (!uri) return;
    if (!isMagnetUri(uri)) {
      dlInfo.classList.remove("hidden");
      dlStatus.innerHTML = '<span class="err">Это не magnet-ссылка.</span>';
      return;
    }
    try {
      const client = getTorrentClient();
      dlInfo.classList.remove("hidden");
      dlResult.innerHTML = "";
      dlBar.style.width = "0%";
      dlStatus.textContent = "Ищу пиров…";
      client.add(uri, { announce: TRACKERS }, (torrent) => {
        torrent.on("download", () => {
          dlBar.style.width = (torrent.progress * 100).toFixed(0) + "%";
          dlStatus.textContent =
            `Качаю: ${(torrent.progress * 100).toFixed(0)}% · ` +
            `${fmtBytes(torrent.downloadSpeed)}/с · пиров: ${torrent.numPeers}`;
        });
        torrent.on("done", () => {
          dlBar.style.width = "100%";
          dlStatus.innerHTML = `<span class="ok">Готово!</span>`;
          torrent.files.forEach((f) => {
            f.getBlobURL((err, url) => {
              if (err) return;
              const a = document.createElement("a");
              a.href = url; a.download = f.name;
              a.textContent = `💾 Сохранить «${f.name}» (${fmtBytes(f.length)})`;
              a.className = "btn btn-sm";
              a.style.cssText = "display:inline-block;margin-top:8px";
              dlResult.appendChild(a);
            });
          });
        });
      });
    } catch (e) {
      dlInfo.classList.remove("hidden");
      dlStatus.innerHTML = `<span class="err">${e.message}</span>`;
    }
  });
}

// ===== ЧАТ =====

// Ключ истории привязан к пользователю: osgovorim-chat-<username>
function historyKey(username) { return `osgovorim-chat-${username}`; }

function loadHistory(username) {
  return parseHistory(localStorage.getItem(historyKey(username)));
}
function saveHistory(username, list) {
  localStorage.setItem(historyKey(username), JSON.stringify(trimHistory(list)));
}

function initChat(username) {
  const myIdEl = document.getElementById("myId");
  const copyIdBtn = document.getElementById("copyIdBtn");
  const peerIdEl = document.getElementById("peerId");
  const connectBtn = document.getElementById("connectBtn");
  const connStatus = document.getElementById("connStatus");
  const chatEl = document.getElementById("chat");
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const statusEl = document.getElementById("status");

  function renderMsg(text, who, name) {
    if (text === "__PIZDETS__") {
      showPizdetsToast("⚠️ Пиздец от собеседника!");
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("ОСГОворим: Пиздец!", { body: "Экстренное уведомление." });
      }
      return;
    }
    const div = document.createElement("div");
    div.className = "msg " + (who === "me" ? "me" : "them");
    const label = who === "me" ? (username) : (name || "собеседник");
    div.innerHTML = `<span class="who">${escapeHtml(label)}</span>${escapeHtml(text)}`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function addMessage(text, who, name) {
    renderMsg(text, who, name);
    if (text === "__PIZDETS__") return;
    const hist = loadHistory(username);
    hist.push({ text, who, name, t: Date.now() });
    saveHistory(username, hist);
  }

  // восстановить историю
  loadHistory(username).forEach((m) => renderMsg(m.text, m.who, m.name));

  function setupConnection(c) {
    conn = c;
    if (!connections.includes(c)) connections.push(c);
    connStatus.textContent = "соединение…";
    c.on("open", () => {
      connStatus.innerHTML = `<span class="ok">подключено</span> к ${escapeHtml(c.peer)}`;
      statusEl.textContent = "подключено";
    });
    c.on("data", (data) => addMessage(String(data), "them", c.peer));
    c.on("close", () => {
      connections = connections.filter((x) => x !== c);
      if (conn === c) { conn = null; connStatus.textContent = "соединение закрыто"; }
      if (connections.length === 0) statusEl.textContent = "не подключено";
    });
    c.on("error", (e) => {
      connStatus.innerHTML = `<span class="err">ошибка: ${e.type || e}</span>`;
    });
  }

  function initPeer() {
    if (typeof Peer === "undefined") {
      connStatus.innerHTML = '<span class="err">PeerJS не загрузился.</span>';
      return;
    }
    peer = new Peer();
    peer.on("open", (id) => { myIdEl.value = id; statusEl.textContent = "готов"; });
    peer.on("connection", (c) => setupConnection(c));
    peer.on("error", (e) => {
      connStatus.innerHTML = `<span class="err">PeerJS: ${e.type || e}</span>`;
    });
  }

  copyIdBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(myIdEl.value);
      copyIdBtn.textContent = "Скопировано ✓";
      setTimeout(() => (copyIdBtn.textContent = "Копировать"), 1500);
    } catch { myIdEl.select(); }
  });

  connectBtn.addEventListener("click", () => {
    const id = peerIdEl.value.trim();
    if (!id || !peer) return;
    setupConnection(peer.connect(id));
  });

  function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;
    const active = conn && conn.open ? conn : connections.find((c) => c.open);
    if (!active) {
      connStatus.innerHTML = '<span class="err">сначала подключись к другу</span>';
      return;
    }
    active.send(text);
    addMessage(text, "me", username);
    msgInput.value = "";
  }

  sendBtn.addEventListener("click", sendMessage);
  msgInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

  initPeer();
}

// ===== PWA =====

function initPWA() {
  const installBar = document.getElementById("installBar");
  const installBtn = document.getElementById("installBtn");
  const installHint = document.getElementById("installHint");

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone) {
      installBtn.style.display = "";
      installHint.textContent = "";
      installBar.classList.remove("hidden");
    }
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBar.classList.add("hidden");
  });

  window.addEventListener("appinstalled", () => installBar.classList.add("hidden"));

  if (isIos && !isStandalone) {
    installBtn.style.display = "none";
    installHint.textContent = 'Установить: кнопка «Поделиться» → «На экран «Домой»».';
    installBar.classList.remove("hidden");
  }
}
