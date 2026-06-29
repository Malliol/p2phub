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
