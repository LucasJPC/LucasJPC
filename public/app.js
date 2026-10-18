const map = L.map('map').setView([-33.5, -71], 4);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
const layer = L.layerGroup().addTo(map);
const detail = document.getElementById('detail');
const fmt = (n) => Number(n).toLocaleString('es-CL');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function videoHtml(url) {
  if (!url) return '';
  const yt = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  return yt ? `<iframe src="https://www.youtube.com/embed/${yt[1]}" allowfullscreen></iframe>`
            : `<video src="${esc(url)}" controls></video>`;
}

function show(p) {
  detail.innerHTML = `<h3>${esc(p.name)}</h3><p class="muted">${esc(p.city)} · ${esc(p.type)} · ${esc(p.year)}</p>
    ${p.photos.map((f) => `<img src="${esc(f.url)}" alt="${esc(f.caption)}" loading="lazy">`).join('')}
    ${videoHtml(p.video_url)}<p>${esc(p.description)}</p>
    <table><tr><td>Potencia</td><td>${fmt(p.power_kwp)} kWp</td></tr><tr><td>Paneles</td><td>${fmt(p.panels)}</td></tr>
    <tr><td>Generación anual</td><td>${fmt(p.annual_kwh)} kWh</td></tr><tr><td>CO₂ evitado</td><td>${fmt(p.co2_tons)} t/año</td></tr></table>`;
}

async function load(type = '') {
  const projects = await (await fetch('/api/projects' + (type ? `?type=${type}` : ''))).json();
  layer.clearLayers();
  projects.forEach((p) => L.marker([p.lat, p.lng]).addTo(layer).bindTooltip(p.name).on('click', () => show(p)));
  if (projects.length) map.fitBounds(projects.map((p) => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 8 });
  if (!type) {
    document.getElementById('s-count').textContent = projects.length;
    document.getElementById('s-mw').textContent = (projects.reduce((a, p) => a + p.power_kwp, 0) / 1000).toFixed(1);
    document.getElementById('s-co2').textContent = fmt(projects.reduce((a, p) => a + p.co2_tons, 0));
    const vids = projects.filter((p) => p.video_url);
    if (vids.length) document.getElementById('video-list').innerHTML = vids.map((p) => `<figure>${videoHtml(p.video_url)}<figcaption>${esc(p.name)}</figcaption></figure>`).join('');
  }
}

document.getElementById('filters').addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  document.querySelectorAll('#filters button').forEach((b) => b.classList.toggle('on', b === e.target));
  load(e.target.dataset.type);
});
load();
