# Web Empresa Solar

Sitio web + mapa interactivo de proyectos (Leaflet) + API (`/api/projects`) sobre SQLite.

```
node server.js     # Node >= 22.5, sin dependencias → http://localhost:3000
```

- `GET /api/projects[?type=residencial|comercial|industrial]`, `GET /api/projects/:id`
- Tablas `projects` (datos técnicos, `video_url`) y `photos` en `data/solar.db` (se crea y siembra sola).
- Para agregar videos: `UPDATE projects SET video_url='https://youtu.be/XXXXXXXXXXX' WHERE id=1;` (YouTube o .mp4).

## Calculadora solar residencial (`/calculadora.html`)

- Dimensiona el sistema (kWp, paneles, m²), generación mensual, ahorro, recupero, TIR y CO₂ a 25 años.
- **Subir factura (PDF)**: se lee en el navegador con pdf.js (`public/vendor/`, sin enviar el archivo al servidor) y autocompleta consumo mensual (normaliza facturas bimestrales), tarifa, ciudad y moneda. Los PDF escaneados (sin texto) requieren carga manual.
- El botón «Descargar informe» imprime/guarda el informe en PDF.
- Lógica en `public/js/solar.js` (cálculo; horas sol pico por ciudad y costos editables) y `public/js/bill-parser.js` (extracción de datos).

### Tests y despliegue
- `npm test` corre las pruebas del cálculo y del lector de facturas (`tests/`).
- **Vercel / hosting estático**: `vercel.json` publica `public/`. La calculadora funciona 100 % en el navegador, así que no necesita servidor. El mapa de proyectos de la home sí usa `/api/projects` (Node + SQLite) y requiere correr `node server.js` en un hosting con Node.
