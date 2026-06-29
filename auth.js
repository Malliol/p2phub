// auth.js — регистрация, вход, сессия. Без зависимостей.
// Пароли хранятся как SHA-256 хеш (Web Crypto API) в localStorage.
// При переходе на сервер заменить хранилище на API-запросы.

const USERS_KEY = "osgovorim-users";
const SESSION_KEY = "osgovorim-session";

// Работает и на HTTP и на HTTPS
async function sha256(str) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Pure JS SHA-256 fallback (для HTTP без secure context)
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const r=(n,d)=>(n>>>d)|(n<<(32-d));
  const bytes=new TextEncoder().encode(str),len=bytes.length;
  const padded=new Uint8Array(((len+9+63)>>6)<<6);
  padded.set(bytes);padded[len]=0x80;
  const dv=new DataView(padded.buffer);
  dv.setUint32(padded.length-4,(len*8)&0xffffffff,false);
  let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  for(let i=0;i<padded.length;i+=64){
    const w=new Uint32Array(64);
    for(let j=0;j<16;j++)w[j]=dv.getUint32(i+j*4,false);
    for(let j=16;j<64;j++){const s0=r(w[j-15],7)^r(w[j-15],18)^(w[j-15]>>>3),s1=r(w[j-2],17)^r(w[j-2],19)^(w[j-2]>>>10);w[j]=(w[j-16]+s0+w[j-7]+s1)>>>0;}
    let[a,b,c,d,e,f,g,hh]=h;
    for(let j=0;j<64;j++){const S1=r(e,6)^r(e,11)^r(e,25),ch=(e&f)^(~e&g),t1=(hh+S1+ch+K[j]+w[j])>>>0,S0=r(a,2)^r(a,13)^r(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    h=h.map((v,i)=>(v+[a,b,c,d,e,f,g,hh][i])>>>0);
  }
  return h.map(v=>v.toString(16).padStart(8,"0")).join("");
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
