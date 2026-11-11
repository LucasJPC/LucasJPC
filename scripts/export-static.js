// Exporta los proyectos y sus imágenes a public/ para hosting estático (Vercel).
// Uso: node server.js (en otra terminal)  y luego  node scripts/export-static.js [http://localhost:3000]
const fs = require('node:fs');
const path = require('node:path');
const base = process.argv[2] || 'http://localhost:3000';
const pub = path.join(__dirname, '..', 'public');

(async () => {
  const projects = await (await fetch(base + '/api/projects')).json();
  fs.mkdirSync(path.join(pub, 'data'), { recursive: true });
  fs.mkdirSync(path.join(pub, 'img'), { recursive: true });
  for (const p of projects) {
    for (const ph of p.photos) {
      const svg = await (await fetch(base + ph.url)).text();
      fs.writeFileSync(path.join(pub, ph.url), svg);
    }
  }
  fs.writeFileSync(path.join(pub, 'data', 'projects.json'), JSON.stringify(projects, null, 2) + '\n');
  console.log(`Exportados ${projects.length} proyectos`);
})();
