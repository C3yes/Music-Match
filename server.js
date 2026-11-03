// Music Match - serveur (zéro dépendance). Local : node server.js  |  Render : démarre avec "node server.js"
const http = require('http'), os = require('os'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const PORT = +process.env.PORT || 3000;
const TOKEN = process.env.HOST_KEY || crypto.randomBytes(4).toString('hex');
let game = { phase: 'lobby', q: 0, seq: 0 }, voteStart = 0, players = {}, answers = {}, ver = 1;

function lan() {
  for (const l of Object.values(os.networkInterfaces()))
    for (const i of l || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  return 'localhost';
}
const CLOUD = !!(process.env.RENDER || process.env.PUBLIC_URL);
const BASE = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://${lan()}:${PORT}`).replace(/\/$/, '');
const plist = () => Object.entries(players).map(([id, p]) => ({ id, ...p }));
const json = (res, o, c = 200) => { res.writeHead(c, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
const readBody = req => new Promise(r => {
  let b = ''; req.on('data', c => { b += c; if (b.length > 2e5) req.destroy(); });
  req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } });
});

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const isHost = u.searchParams.get('k') === TOKEN;

  // Le client interroge ce point toutes les ~1 s ; réponse minimale si rien n'a changé.
  if (u.pathname === '/api/poll') {
    const out = { v: ver, host: isHost };
    if (+u.searchParams.get('v') !== ver) {
      out.game = game;
      if (isHost) { out.players = plist(); out.answers = answers; }
    }
    return json(res, out);
  }
  if (u.pathname === '/api/info') return json(res, { joinUrl: BASE + '/', host: isHost });
  if (u.pathname === '/api/me') {
    const id = u.searchParams.get('id'), p = players[id];
    return json(res, p ? { exists: true, ...p, a: (answers[id] || {}).a || {} } : { exists: false });
  }
  if (req.method === 'POST') {
    const b = await readBody(req), id = String(b.id || '').slice(0, 40);
    if (u.pathname === '/api/join') {
      const name = String(b.name || '').trim().slice(0, 24);
      if (!id || !name || (!players[id] && Object.keys(players).length >= 300)) return json(res, { ok: false }, 400);
      players[id] = { name, avatar: String(b.avatar || '🎧').slice(0, 8) };
      ver++; return json(res, { ok: true });
    }
    if (u.pathname === '/api/answer') {
      const o = +b.o;
      if (!players[id] || game.phase !== 'vote' || b.q !== game.q || !(o >= 0 && o < 4)) return json(res, { ok: false, reason: 'closed' });
      const a = (answers[id] = answers[id] || { a: {} }).a;
      if (a[b.q]) return json(res, { ok: false, reason: 'dup' });
      const t = Math.min(30000, Date.now() - voteStart);
      a[b.q] = { o, t }; ver++; return json(res, { ok: true, t });
    }
    if (u.pathname === '/api/game') {
      if (b.k !== TOKEN || !b.state) return json(res, { ok: false }, 403);
      const prev = game.phase; game = b.state;
      if (game.phase === 'vote' && prev !== 'vote') voteStart = Date.now();
      if (game.phase === 'lobby' || (game.phase === 'ready' && game.q === 0)) answers = {};
      ver++; return json(res, { ok: true });
    }
    return json(res, { ok: false }, 404);
  }
  fs.readFile(path.join(__dirname, 'index.html'), (e, d) => {
    if (e) { res.writeHead(500); return res.end('index.html introuvable'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(d);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('\n🎧  The Ultimate Music Match\n');
  console.log('  Écran animateur :  ' + (CLOUD ? BASE : 'http://localhost:' + PORT) + '/?k=' + TOKEN);
  console.log('  Lien participants (déjà dans le QR) :  ' + BASE + '/\n');
});
