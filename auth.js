const SESSION_KEY = "osgovorim-session";

export function getCurrentUser() {
  return sessionStorage.getItem(SESSION_KEY) || null;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function registerUser(username, password) {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
}

export async function loginUser(username, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка входа');
  sessionStorage.setItem(SESSION_KEY, data.username);
}
