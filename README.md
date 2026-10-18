# Web Empresa Solar

Sitio web + mapa interactivo de proyectos (Leaflet) + API (`/api/projects`) sobre SQLite.

```
node server.js     # Node >= 22.5, sin dependencias → http://localhost:3000
```

- `GET /api/projects[?type=residencial|comercial|industrial]`, `GET /api/projects/:id`
- Tablas `projects` (datos técnicos, `video_url`) y `photos` en `data/solar.db` (se crea y siembra sola).
- Para agregar videos: `UPDATE projects SET video_url='https://youtu.be/XXXXXXXXXXX' WHERE id=1;` (YouTube o .mp4).
