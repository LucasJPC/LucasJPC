// Servidor sin dependencias: sirve /public y expone la API de proyectos (SQLite).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new DatabaseSync(path.join(__dirname, 'data', 'solar.db'));
db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,          -- residencial | comercial | industrial
  city TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  description TEXT,
  power_kwp REAL,              -- datos técnicos
  panels INTEGER,
  annual_kwh REAL,
  co2_tons REAL,
  year INTEGER,
  video_url TEXT
);
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT
);`);

if (db.prepare('SELECT COUNT(*) c FROM projects').get().c === 0) {
  const seed = [
    ['Planta Solar Atacama', 'industrial', 'Calama', -22.4546, -68.9294, 'Planta fotovoltaica para operación minera.', 5200, 9400, 11200000, 5600, 2023],
    ['Residencial Los Olivos', 'residencial', 'Santiago', -33.4489, -70.6693, 'Sistema on-grid para vivienda familiar.', 6.5, 12, 9800, 4.9, 2024],
    ['Centro Comercial Sol', 'comercial', 'La Serena', -29.9027, -71.2519, 'Techos solares para centro comercial.', 480, 860, 780000, 390, 2022],
    ['Bodega Agroindustrial Maule', 'industrial', 'Talca', -35.4264, -71.6554, 'Autoconsumo para cámaras de frío.', 350, 630, 520000, 260, 2023],
    ['Hotel Costa Sur', 'comercial', 'Puerto Montt', -41.4693, -72.9424, 'Agua caliente y electricidad solar.', 85, 150, 98000, 49, 2024],
  ];
  const ins = db.prepare(`INSERT INTO projects (name,type,city,lat,lng,description,power_kwp,panels,annual_kwh,co2_tons,year) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const ph = db.prepare('INSERT INTO photos (project_id,url,caption) VALUES (?,?,?)');
  seed.forEach((s) => {
    const { lastInsertRowid: id } = ins.run(...s);
    ph.run(id, `/img/${id}-1.svg`, 'Vista general');
    ph.run(id, `/img/${id}-2.svg`, 'Paneles instalados');
  });
}

const withPhotos = (p) => ({ ...p, photos: db.prepare('SELECT url, caption FROM photos WHERE project_id = ?').all(p.id) });

function placeholder(name, n) {
  const hue = (name.length * 37 + n * 50) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="hsl(${hue},60%,92%)"/><g fill="hsl(${hue},60%,35%)">${Array.from({ length: 12 }, (_, i) => `<rect x="${60 + (i % 4) * 140}" y="${90 + Math.floor(i / 4) * 80}" width="120" height="64" rx="4" opacity=".85"/>`).join('')}</g><circle cx="560" cy="60" r="30" fill="#f5b301"/></svg>`;
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon' };
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' });

  if (url.pathname === '/api/projects') {
    const type = url.searchParams.get('type');
    const rows = type ? db.prepare('SELECT * FROM projects WHERE type = ?').all(type) : db.prepare('SELECT * FROM projects').all();
    return json(res, 200, rows.map(withPhotos));
  }
  const m = url.pathname.match(/^\/api\/projects\/(\d+)$/);
  if (m) {
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(m[1]));
    return p ? json(res, 200, withPhotos(p)) : json(res, 404, { error: 'No encontrado' });
  }
  const im = url.pathname.match(/^\/img\/(\d+)-(\d+)\.svg$/);
  if (im) {
    const p = db.prepare('SELECT name FROM projects WHERE id = ?').get(Number(im[1]));
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end(placeholder(p ? p.name : 'x', Number(im[2])));
  }

  const file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
