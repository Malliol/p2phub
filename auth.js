// auth.js — регистрация, вход, сессия. Без зависимостей.
// Пароли хранятся как SHA-256 хеш (Web Crypto API) в localStorage.
// При переходе на сервер заменить хранилище на API-запросы.

const USERS_KEY = "osgovorim-users";
const SESSION_KEY = "osgovorim-session";

async function sha256(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function registerUser(username, password) {
  const name = username.trim().toLowerCase();
  if (!name || name.length < 2) throw new Error("Имя слишком короткое (мин. 2 символа)");
  if (name.length > 32) throw new Error("Имя слишком длинное (макс. 32 символа)");
  if (!/^[a-zа-яё0-9_]+$/iu.test(name)) throw new Error("Только буквы, цифры и _");
  if (password.length < 4) throw new Error("Пароль минимум 4 символа");

  const users = loadUsers();
  if (users[name]) throw new Error("Пользователь уже существует");

  const hash = await sha256(password);
  users[name] = { hash, createdAt: Date.now() };
  saveUsers(users);
  return name;
}

export async function loginUser(username, password) {
  const name = username.trim().toLowerCase();
  const users = loadUsers();
  const user = users[name];
  if (!user) throw new Error("Пользователь не найден");

  const hash = await sha256(password);
  if (hash !== user.hash) throw new Error("Неверный пароль");

  const session = { username: name, loginAt: Date.now() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return name;
}

export function getCurrentUser() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    return s && s.username ? s.username : null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}
