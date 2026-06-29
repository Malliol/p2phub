// app.js — логика ОСГОворим (ES-модуль).
// Чистые функции вынесены в lib.js (их покрывают тесты), здесь — работа
// с DOM, WebTorrent (файлы) и PeerJS (чат).

import {
  fmtBytes,
  escapeHtml,
  isMagnetUri,
  trimHistory,
  parseHistory,
} from "./lib.js";

console.log("ОСГОворим: приложение загружено.");

const statusEl = document.getElementById("status");
if (statusEl) {
  statusEl.textContent = "готов";
}

// PWA: регистрируем service worker, чтобы приложение можно было установить
// и открывать офлайн (Этап 2). На file:// не работает — только по http/https.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(() => console.log("ОСГОворим: service worker зарегистрирован."))
      .catch((err) => console.warn("ОСГОворим: SW не зарегистрирован:", err));
  });
}

// ===================== ЭТАП 3: ФАЙЛЫ (WebTorrent) =====================
// Один общий клиент WebTorrent на всё приложение. Создаём лениво —
// только когда пользователь реально что-то отправляет или скачивает.
// Публичные WebRTC-трекеры — помогают пирам найти друг друга в браузере.
const TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.webtorrent.dev",
  "wss://tracker.files.fm:7073/announce",
];

let wt = null;
function getTorrentClient() {
  if (!wt) {
    if (typeof WebTorrent === "undefined") {
      throw new Error("Библиотека WebTorrent не загрузилась (нет интернета?).");
    }
    wt = new WebTorrent();
  }
  return wt;
}

// --- Раздача файла ---
const fileInput = document.getElementById("fileInput");
const shareBtn = document.getElementById("shareBtn");
const seedInfo = document.getElementById("seedInfo");
const seedStatus = document.getElementById("seedStatus");
const magnetOut = document.getElementById("magnetOut");
const copyBtn = document.getElementById("copyBtn");

if (shareBtn) shareBtn.addEventListener("click", () => fileInput.click());

if (fileInput)
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
            `пиров: ${torrent.numPeers}. Держи вкладку открытой, ` +
            `пока друг качает.`);
        update();
        torrent.on("wire", update);
      });
    } catch (e) {
      seedInfo.classList.remove("hidden");
      seedStatus.innerHTML = `<span class="err">${e.message}</span>`;
    }
  });

if (copyBtn)
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(magnetOut.value);
      copyBtn.textContent = "Скопировано ✓";
      setTimeout(() => (copyBtn.textContent = "Скопировать ссылку"), 1500);
    } catch {
      magnetOut.select();
    }
  });

// --- Скачивание файла ---
const magnetIn = document.getElementById("magnetIn");
const downloadBtn = document.getElementById("downloadBtn");
const dlInfo = document.getElementById("dlInfo");
const dlBar = document.getElementById("dlBar");
const dlStatus = document.getElementById("dlStatus");
const dlResult = document.getElementById("dlResult");

if (downloadBtn)
  downloadBtn.addEventListener("click", () => {
    const uri = magnetIn.value.trim();
    if (!uri) return;
    if (!isMagnetUri(uri)) {
      dlInfo.classList.remove("hidden");
      dlStatus.innerHTML =
        '<span class="err">Это не похоже на magnet-ссылку.</span>';
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
          dlStatus.innerHTML = `<span class="ok">Готово!</span> Файлы получены.`;
          torrent.files.forEach((f) => {
            f.getBlobURL((err, url) => {
              if (err) return;
              const a = document.createElement("a");
              a.href = url;
              a.download = f.name;
              a.textContent = `💾 Сохранить «${f.name}» (${fmtBytes(f.length)})`;
              a.className = "btn btn-sm";
              a.style.display = "inline-block";
              a.style.marginTop = "8px";
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

// ===================== ЭТАП 4: ЧАТ (WebRTC через PeerJS) =====================
const myIdEl = document.getElementById("myId");
const copyIdBtn = document.getElementById("copyIdBtn");
const peerIdEl = document.getElementById("peerId");
const connectBtn = document.getElementById("connectBtn");
const connStatus = document.getElementById("connStatus");
const chatEl = document.getElementById("chat");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

let peer = null; // наш узел в сети PeerJS
let conn = null; // текущее соединение с собеседником

// --- история чата (хранится локально в браузере) ---
const HISTORY_KEY = "osgovorim-chat";
function loadHistory() {
  return parseHistory(localStorage.getItem(HISTORY_KEY));
}
function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimHistory(list)));
}
function renderMsg(text, who) {
  const div = document.createElement("div");
  div.className = "msg " + (who === "me" ? "me" : "them");
  div.innerHTML =
    `<span class="who">${who === "me" ? "я" : "собеседник"}</span>` +
    escapeHtml(text);
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}
function addMessage(text, who) {
  renderMsg(text, who);
  const hist = loadHistory();
  hist.push({ text, who, t: Date.now() });
  saveHistory(hist);
}

// показать сохранённую переписку при загрузке
if (chatEl) loadHistory().forEach((m) => renderMsg(m.text, m.who));

// --- настройка соединения с собеседником ---
function setupConnection(c) {
  conn = c;
  connStatus.textContent = "соединение…";
  c.on("open", () => {
    connStatus.innerHTML = `<span class="ok">подключено</span> к ${c.peer}`;
  });
  c.on("data", (data) => addMessage(String(data), "them"));
  c.on("close", () => {
    connStatus.textContent = "соединение закрыто";
    conn = null;
  });
  c.on("error", (e) => {
    connStatus.innerHTML = `<span class="err">ошибка: ${e.type || e}</span>`;
  });
}

// --- создаём свой узел ---
function initPeer() {
  if (typeof Peer === "undefined") {
    if (connStatus)
      connStatus.innerHTML =
        '<span class="err">PeerJS не загрузился (нет интернета?).</span>';
    return;
  }
  peer = new Peer(); // случайный ID с публичного signaling-сервера
  peer.on("open", (id) => {
    myIdEl.value = id;
  });
  peer.on("connection", (c) => setupConnection(c)); // кто-то подключился к нам
  peer.on("error", (e) => {
    if (connStatus)
      connStatus.innerHTML = `<span class="err">PeerJS: ${e.type || e}</span>`;
  });
}

// --- обработчики кнопок ---
if (copyIdBtn)
  copyIdBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(myIdEl.value);
      copyIdBtn.textContent = "Скопировано ✓";
      setTimeout(() => (copyIdBtn.textContent = "Копировать"), 1500);
    } catch {
      myIdEl.select();
    }
  });

if (connectBtn)
  connectBtn.addEventListener("click", () => {
    const id = peerIdEl.value.trim();
    if (!id || !peer) return;
    setupConnection(peer.connect(id));
  });

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;
  if (!conn || !conn.open) {
    connStatus.innerHTML =
      '<span class="err">сначала подключись к другу</span>';
    return;
  }
  conn.send(text);
  addMessage(text, "me");
  msgInput.value = "";
}
if (sendBtn) sendBtn.addEventListener("click", sendMessage);
if (msgInput)
  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

// запускаем узел чата при загрузке (нужен интернет для signaling)
if (myIdEl) initPeer();

// ===================== КНОПКА УСТАНОВКИ ПРИЛОЖЕНИЯ (PWA) =====================
const installBar = document.getElementById("installBar");
const installBtn = document.getElementById("installBtn");
const installHint = document.getElementById("installHint");

// уже запущено как установленное приложение?
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

let deferredPrompt = null;

// Android / десктоп Chrome: браузер сообщает, что установка доступна.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBar && !isStandalone) {
    installBtn.style.display = "";
    installHint.textContent = "";
    installBar.classList.remove("hidden");
  }
});

if (installBtn)
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBar.classList.add("hidden");
  });

// после установки прячем панель
window.addEventListener("appinstalled", () => {
  if (installBar) installBar.classList.add("hidden");
});

// iPhone (Safari): системного окна установки нет — показываем инструкцию.
if (installBar && isIos && !isStandalone) {
  installBtn.style.display = "none";
  installHint.textContent =
    'Установить на iPhone: кнопка «Поделиться» → «На экран «Домой»».';
  installBar.classList.remove("hidden");
}
