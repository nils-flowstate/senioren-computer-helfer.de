'use strict';
// nils-gate: Passwort-Gate mit Botschutz (Proof-of-Work, ALTCHA-kompatibel) und IP-Sperre.
// Keine Abhängigkeiten, Node >= 20.
const http = require('http'), crypto = require('crypto'), fs = require('fs');

const PORT = 3000;
const SECRET = process.env.GATE_SECRET || '';
const PW_HASH = (process.env.GATE_PASSWORD_SHA256 || '').toLowerCase();
if (SECRET.length < 32 || !/^[0-9a-f]{64}$/.test(PW_HASH)) {
  console.error('GATE_SECRET (mind. 32 Zeichen) und GATE_PASSWORD_SHA256 (64 hex) setzen.');
  process.exit(1);
}
const MAX_TRIES = 5;                 // Fehlversuche …
const WINDOW_MS = 48 * 3600e3;       // … innerhalb von 48 h
const BAN_MS = 48 * 3600e3;          // → IP 48 h gesperrt
const SESSION_MS = 12 * 3600e3;      // Server-seitige Höchstdauer einer Sitzung
const CHALLENGE_MS = 10 * 60e3;      // Rechenaufgabe 10 min gültig
const MAXNUMBER = Number(process.env.GATE_POW_MAX || 50000); // Schwierigkeit
const DATA = '/data/gate.json';

let db = { fails: {}, bans: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA, 'utf8'))); } catch {}
let saving = false;
const save = () => { if (saving) return; saving = true; setTimeout(() => { fs.writeFile(DATA, JSON.stringify(db), () => { saving = false; }); }, 200); };

const used = new Map();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const eq = (a, b) => { const A = Buffer.from(String(a)), B = Buffer.from(String(b)); return A.length === B.length && crypto.timingSafeEqual(A, B); };
// Caddy setzt X-Forwarded-For selbst (eingehende Werte untrusted Clients werden verworfen).
const ipOf = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

function bannedUntil(ip) {
  const u = db.bans[ip];
  if (u && u > Date.now()) return u;
  if (u) { delete db.bans[ip]; save(); }
  return 0;
}
function registerFail(ip) {
  const now = Date.now();
  const f = (db.fails[ip] || []).filter((t) => now - t < WINDOW_MS);
  f.push(now);
  if (f.length >= MAX_TRIES) { db.bans[ip] = now + BAN_MS; delete db.fails[ip]; console.log('Adresse für 48 h gesperrt'); }
  else db.fails[ip] = f;
  save();
  return Math.max(0, MAX_TRIES - f.length);
}
function newToken() {
  const p = (Date.now() + SESSION_MS) + '.' + crypto.randomBytes(12).toString('base64url');
  return p + '.' + hmac('session:' + p);
}
function validToken(cookie) {
  const m = /(?:^|;\s*)nils_session=([^;]+)/.exec(cookie || '');
  if (!m) return false;
  const [exp, rnd, sig] = m[1].split('.');
  if (!exp || !rnd || !sig) return false;
  return eq(sig, hmac('session:' + exp + '.' + rnd)) && Number(exp) > Date.now();
}
function send(res, code, obj, headers) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));
  res.end(JSON.stringify(obj));
}
function readJson(req) {
  return new Promise((ok, no) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 4096) { no(new Error('too_large')); req.destroy(); } });
    req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch (e) { no(e); } });
    req.on('error', no);
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of used) if (v < now) used.delete(k);
  for (const ip in db.bans) if (db.bans[ip] < now) delete db.bans[ip];
  for (const ip in db.fails) { db.fails[ip] = db.fails[ip].filter((t) => now - t < WINDOW_MS); if (!db.fails[ip].length) delete db.fails[ip]; }
  save();
}, 10 * 60e3).unref();

http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://gate').pathname;
  const ip = ipOf(req);

  // forward_auth von Caddy: 204 = Zugang, 401 = Lockscreen
  if (path === '/gate/check') {
    res.writeHead(validToken(req.headers.cookie) && !bannedUntil(ip) ? 204 : 401, { 'Cache-Control': 'no-store' });
    return res.end();
  }

  if (path === '/gate/challenge' && req.method === 'GET') {
    const u = bannedUntil(ip);
    if (u) return send(res, 429, { blocked: true, until: u });
    const salt = crypto.randomBytes(12).toString('hex') + '?expires=' + Math.floor((Date.now() + CHALLENGE_MS) / 1000);
    const challenge = sha(salt + crypto.randomInt(MAXNUMBER));
    return send(res, 200, { algorithm: 'SHA-256', challenge, maxnumber: MAXNUMBER, salt, signature: hmac(challenge) });
  }

  if (path === '/gate/login' && req.method === 'POST') {
    const u = bannedUntil(ip);
    if (u) return send(res, 429, { blocked: true, until: u });
    let b;
    try { b = await readJson(req); } catch { return send(res, 400, { error: 'bad_request' }); }
    if (b.website) return send(res, 400, { error: 'challenge' });          // Honeypot: Bots füllen es aus
    const s = b.solution || {};
    const exp = Number((/expires=(\d+)/.exec(String(s.salt)) || [])[1]) * 1000;
    const powOk = typeof s.challenge === 'string' && eq(s.signature, hmac(s.challenge)) && exp > Date.now()
      && sha(String(s.salt) + String(s.number)) === s.challenge && !used.has(s.challenge);
    if (!powOk) return send(res, 400, { error: 'challenge' });
    used.set(s.challenge, exp);                                              // jede Aufgabe nur einmal
    if (!eq(sha(String(b.password || '').trim()), PW_HASH)) {
      const left = registerFail(ip);
      return left === 0 ? send(res, 429, { blocked: true, until: db.bans[ip] }) : send(res, 401, { error: 'password', left });
    }
    delete db.fails[ip]; save();
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    // Session-Cookie: kein Max-Age/Expires → endet mit dem Browser. HttpOnly → für Skripte unsichtbar.
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'nils_session=' + newToken() + '; Path=/; HttpOnly; SameSite=Strict' + secure });
  }

  send(res, 404, { error: 'not_found' });
}).listen(PORT, () => console.log('nils-gate läuft auf :' + PORT));
