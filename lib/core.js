// Общие функции сервера: проверка входа через Telegram, база данных Supabase, файлы, бот.
const crypto = require('crypto');

const BOT_TOKEN = (process.env.BOT_TOKEN || '').trim();
const SB_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SB_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(/[,\s]+/)
  .filter(Boolean)
  .map(Number);
const BUCKET = 'files';

// ---------- ошибки ----------
function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}

// ---------- Supabase ----------
function sbHeaders(extra) {
  const h = Object.assign({ apikey: SB_KEY }, extra || {});
  // Старые ключи (JWT) передаются ещё и как Bearer; новые (sb_secret_...) — только в apikey.
  if (!SB_KEY.startsWith('sb_')) h.Authorization = 'Bearer ' + SB_KEY;
  return h;
}

async function db(path, opts) {
  opts = opts || {};
  const headers = sbHeaders({ 'Content-Type': 'application/json' });
  if (opts.prefer) headers.Prefer = opts.prefer;
  const res = await fetch(SB_URL + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error('DB ' + res.status + ': ' + text);
  return text ? JSON.parse(text) : null;
}

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

async function storage(path, method, body) {
  const res = await fetch(SB_URL + '/storage/v1/' + path, {
    method,
    headers: sbHeaders({ 'Content-Type': 'application/json' }),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Storage ' + res.status + ': ' + text);
  return text ? JSON.parse(text) : null;
}

// Ссылка, по которой браузер админа сам загрузит файл в хранилище (минуя сервер).
async function signUpload(objectPath) {
  const r = await storage('object/upload/sign/' + BUCKET + '/' + encodePath(objectPath), 'POST', {});
  return SB_URL + '/storage/v1' + r.url;
}

// Временная ссылка на скачивание (1 час) — только для учеников с доступом.
async function signDownload(objectPath, fileName) {
  const r = await storage('object/sign/' + BUCKET + '/' + encodePath(objectPath), 'POST', { expiresIn: 3600 });
  const url = SB_URL + '/storage/v1' + r.signedURL;
  return url + (url.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(fileName || '');
}

async function removeObject(objectPath) {
  await storage('object/' + BUCKET, 'DELETE', { prefixes: [objectPath] });
}

// ---------- Telegram ----------
function checkInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => k + '=' + v)
    .sort()
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (calc.length !== hash.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const authDate = Number(params.get('auth_date')) || 0;
  if (Date.now() / 1000 - authDate > 7 * 24 * 3600) return null; // сессия не старше 7 дней
  try {
    const user = JSON.parse(params.get('user'));
    return user && user.id ? user : null;
  } catch (e) {
    return null;
  }
}

async function tg(method, payload) {
  const res = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  return res.json();
}

function appUrlFrom(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return 'https://' + host;
}

function openAppButton(appUrl, text) {
  return { inline_keyboard: [[{ text, web_app: { url: appUrl } }]] };
}

// ---------- ученики ----------
async function getStudent(tgId) {
  const rows = await db('students?tg_id=eq.' + Number(tgId) + '&select=*');
  return rows[0] || null;
}

async function requireAccess(ctx) {
  if (ctx.isAdmin) return;
  const s = await getStudent(ctx.user.id);
  if (!s || s.status !== 'active') fail(403, 'closed');
}

// Порядок уроков по всему курсу: модуль → урок.
async function loadStructure() {
  const modules = await db('modules?select=id,position,title&order=position.asc,id.asc');
  const lessons = await db(
    'lessons?select=id,module_id,position,title,duration,youtube_url&order=position.asc,id.asc'
  );
  return modules.map(m => ({
    id: m.id,
    position: m.position,
    title: m.title,
    lessons: lessons
      .filter(l => l.module_id === m.id)
      .map(l => ({
        id: l.id,
        position: l.position,
        title: l.title,
        duration: l.duration,
        hasVideo: !!l.youtube_url,
        label: m.position + '.' + l.position
      }))
  }));
}

// ---------- обёртка для запросов приложения ----------
function handler(fn) {
  return async (req, res) => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
      if (!BOT_TOKEN || !SB_URL || !SB_KEY) return res.status(500).json({ error: 'config' });
      let body = req.body || {};
      if (typeof body === 'string') body = body ? JSON.parse(body) : {};
      const user = checkInitData(req.headers['x-init-data']);
      if (!user) return res.status(401).json({ error: 'auth' });
      const ctx = {
        user,
        isAdmin: ADMIN_IDS.includes(Number(user.id)),
        body,
        appUrl: appUrlFrom(req)
      };
      const out = await fn(ctx);
      res.status(200).json(out || { ok: true });
    } catch (e) {
      console.error(e);
      res.status(e.status || 500).json({ error: e.status ? e.message : 'server' });
    }
  };
}

module.exports = {
  BOT_TOKEN, SB_URL, SB_KEY, ADMIN_IDS,
  fail, db, signUpload, signDownload, removeObject,
  checkInitData, tg, appUrlFrom, openAppButton,
  getStudent, requireAccess, loadStructure, handler
};
