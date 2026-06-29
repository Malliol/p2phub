// app.js — логика P2PHub.
// Этап 1: пока пусто, только проверка, что скрипт подключён.
// Дальше здесь появятся модули файлов (WebTorrent) и сообщений (WebRTC).

console.log("P2PHub: приложение загружено.");

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
      .then(() => console.log("P2PHub: service worker зарегистрирован."))
      .catch((err) => console.warn("P2PHub: SW не зарегистрирован:", err));
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

function fmtBytes(n) {
  if (!n) return "0 Б";
  const u = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return (n / Math.pow(1024, i)).toFixed(1) + " " + u[i];
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
    if (!uri) {
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
