(() => {
  const $ = (id) => document.getElementById(id);
  const S = window.Solar;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let bill = null; // datos extraídos de la factura (para el informe)

  // Selects
  $('city').innerHTML = ['AR', 'CL'].map((c) => `<optgroup label="${c === 'AR' ? 'Argentina' : 'Chile'}">${S.CITIES.filter((x) => x.country === c).map((x) => `<option>${x.name}</option>`).join('')}</optgroup>`).join('');
  $('city').value = 'Rosario';

  const cityObj = () => S.CITIES.find((c) => c.name === $('city').value);
  const num = (id) => parseFloat($(id).value);
  const cur = () => S.CURRENCIES[$('currency').value];
  const fmt = (n, d = 0) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: d });
  const money = (n) => `${cur().symbol} ${fmt(n)}`;

  function syncCurrencyToCity() {
    if ($('currency').value !== 'USD') $('currency').value = cityObj().country === 'CL' ? 'CLP' : 'ARS';
  }

  function syncDefaults(which) {
    if (which !== 'city') { $('costPerKwp').value = cur().costPerKwp; }
    if (which !== 'currency') $('hsp').value = cityObj().hsp;
    document.querySelectorAll('.cur').forEach((e) => (e.textContent = cur().symbol));
  }

  function inputs() {
    return {
      monthlyKwh: num('monthlyKwh'), tariff: num('tariff'), hsp: num('hsp'), lat: cityObj().lat,
      coverage: num('coverage') / 100, panelW: num('panelW'), performance: num('performance') / 100,
      orientation: $('orientation').value, costPerKwp: num('costPerKwp'), roofArea: num('roofArea') || 0,
      tariffGrowth: num('tariffGrowth') / 100, degradation: num('degradation') / 100, co2Factor: cur().co2,
    };
  }

  function chart(r) {
    const W = 560, H = 220, pad = { l: 40, r: 8, t: 10, b: 24 };
    const max = Math.max(...r.monthly.map((m) => Math.max(m.generation, m.consumption))) * 1.1;
    const bw = (W - pad.l - pad.r) / 12;
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
    const bars = r.monthly.map((m, i) => `<rect x="${pad.l + i * bw + bw * 0.15}" y="${y(m.generation)}" width="${bw * 0.7}" height="${H - pad.b - y(m.generation)}" fill="#f5b301" rx="2"><title>${m.name}: ${fmt(m.generation)} kWh</title></rect><text x="${pad.l + i * bw + bw / 2}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#6b7280">${m.name}</text>`).join('');
    const ticks = [0, 0.5, 1].map((t) => { const v = (max / 1.1) * t; return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e8e2d0"/><text x="${pad.l - 4}" y="${y(v) + 3}" font-size="10" text-anchor="end" fill="#6b7280">${fmt(v)}</text>`; }).join('');
    const cy = y(r.monthly[0].consumption);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Generación mensual estimada frente al consumo">${ticks}${bars}<line x1="${pad.l}" x2="${W - pad.r}" y1="${cy}" y2="${cy}" stroke="#14213d" stroke-width="2" stroke-dasharray="5 4"/></svg>
    <div class="legend"><span><i style="background:#f5b301"></i>Generación (kWh/mes)</span><span><i style="background:#14213d"></i>Tu consumo</span></div>`;
  }

  function cashChart(r) {
    const W = 560, H = 180, pad = { l: 56, r: 8, t: 10, b: 22 };
    const vals = [-r.cost, ...r.flow.map((f) => f.cumulative)];
    const min = Math.min(...vals), max = Math.max(...vals);
    const x = (i) => pad.l + (i / (vals.length - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - min) / (max - min || 1));
    const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const zero = y(0);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Flujo acumulado a 25 años"><line x1="${pad.l}" x2="${W - pad.r}" y1="${zero}" y2="${zero}" stroke="#14213d" stroke-dasharray="4 3"/><polyline points="${pts}" fill="none" stroke="#c78a00" stroke-width="3"/><text x="${pad.l - 4}" y="${y(max) + 4}" font-size="10" text-anchor="end" fill="#6b7280">${fmt(max / 1e6, 1)}M</text><text x="${pad.l - 4}" y="${y(min)}" font-size="10" text-anchor="end" fill="#6b7280">${fmt(min / 1e6, 1)}M</text><text x="${pad.l}" y="${H - 6}" font-size="10" fill="#6b7280">Año 0</text><text x="${W - pad.r}" y="${H - 6}" font-size="10" text-anchor="end" fill="#6b7280">Año ${r.flow.length}</text></svg>`;
  }

  function render() {
    const i = inputs();
    const out = $('results');
    if (!(i.monthlyKwh > 0) || !(i.tariff >= 0) || !(i.hsp > 0)) { out.innerHTML = '<p class="muted">Completá consumo, tarifa y ciudad para ver el resultado.</p>'; return; }
    const r = S.calculate(i);
    const today = new Date().toLocaleDateString('es-AR');
    const billBlock = bill ? `<div class="panel"><h3>Datos de la factura</h3><table class="rep">
      ${bill.utility ? `<tr><td>Distribuidora</td><td>${esc(bill.utility)}</td></tr>` : ''}
      ${bill.account ? `<tr><td>N° de suministro/cliente</td><td>${esc(bill.account)}</td></tr>` : ''}
      ${bill.consumptionKwh ? `<tr><td>Consumo facturado</td><td>${fmt(bill.consumptionKwh)} kWh${bill.days ? ` en ${bill.days} días` : ''}</td></tr>` : ''}
      ${bill.amount ? `<tr><td>Importe total</td><td>${money(bill.amount)}</td></tr>` : ''}
      ${bill.file ? `<tr><td>Archivo</td><td>${esc(bill.file)}</td></tr>` : ''}</table></div>` : '';
    out.innerHTML = `
      <h2>Informe solar — ${esc($('city').value)} <span class="muted" style="font-weight:400;font-size:.8rem">${today}</span></h2>
      ${r.limitedByRoof ? `<div class="alert">⚠ La superficie disponible limita el sistema: cubre ${fmt(r.coverageReal * 100)}% de tu consumo.</div>` : ''}
      <div class="kpis">
        <div class="kpi"><b>${fmt(r.kwp, 2)} kWp</b><span>Potencia recomendada</span></div>
        <div class="kpi"><b>${r.panels}</b><span>Paneles de ${i.panelW} W</span></div>
        <div class="kpi"><b>${fmt(r.area)} m²</b><span>Superficie necesaria</span></div>
        <div class="kpi"><b>${fmt(r.yearGen)} kWh</b><span>Generación año 1</span></div>
        <div class="kpi"><b>${money(r.year1Saving / 12)}</b><span>Ahorro mensual (año 1)</span></div>
        <div class="kpi"><b>${r.payback ? fmt(r.payback, 1) + ' años' : '> ' + r.flow.length + ' años'}</b><span>Recupero de la inversión</span></div>
      </div>
      ${billBlock}
      <div class="panel"><h3>Generación mensual estimada</h3>${chart(r)}</div>
      <div class="panel"><h3>Resumen económico (${r.flow.length} años)</h3><table class="rep">
        <tr><td>Inversión estimada</td><td>${money(r.cost)}</td></tr>
        <tr><td>Ahorro año 1</td><td>${money(r.year1Saving)}</td></tr>
        <tr><td>Ahorro acumulado ${r.flow.length} años</td><td>${money(r.totalSaving)}</td></tr>
        <tr><td>Beneficio neto</td><td>${money(r.net)}</td></tr>
        <tr><td>TIR</td><td>${r.irr == null ? '—' : fmt(r.irr * 100, 1) + ' %'}</td></tr>
        <tr><td>Cobertura del consumo</td><td>${fmt(r.coverageReal * 100)} %</td></tr>
        ${r.surplus > 1 ? `<tr><td>Excedente anual</td><td>${fmt(r.surplus)} kWh</td></tr>` : ''}
      </table>${cashChart(r)}</div>
      <div class="panel"><h3>Impacto ambiental</h3><table class="rep">
        <tr><td>CO₂ evitado por año</td><td>${fmt(r.co2, 2)} t</td></tr>
        <tr><td>Equivalente en árboles</td><td>≈ ${fmt(r.trees)}</td></tr></table></div>
      <p class="print-only muted small">Estimación orientativa: horas sol pico ${i.hsp} kWh/m²/día, rendimiento ${fmt(i.performance * 100)}%, orientación ${esc($('orientation').selectedOptions[0].text)}, costo ${money(i.costPerKwp)}/kWp, tarifa ${money(i.tariff)}/kWh con aumento anual de ${fmt(i.tariffGrowth * 100)}%. No reemplaza un estudio técnico ni una cotización.</p>
      <div class="actions"><button class="btn" id="print" type="button">🖨 Descargar informe (PDF)</button><button class="btn alt" id="quote" type="button">Pedir cotización</button></div>`;
    $('print').onclick = () => window.print();
    $('quote').onclick = () => {
      const msg = `Quiero una cotización de sistema solar residencial.\nCiudad: ${$('city').value}\nConsumo mensual: ${fmt(i.monthlyKwh)} kWh\nSistema estimado: ${fmt(r.kwp, 2)} kWp (${r.panels} paneles de ${i.panelW} W)\nInversión estimada: ${money(r.cost)}\nAhorro año 1: ${money(r.year1Saving)}`;
      try { sessionStorage.setItem('quoteMsg', msg); } catch (e) {}
      location.href = '/#contacto';
    };
  }

  // ---------- Lectura de la factura ----------
  async function extractText(file) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let p = 1; p <= Math.min(pdf.numPages, 6); p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      let line = '';
      let lastY = null;
      for (const it of content.items) {
        const y = it.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 3) { text += line + '\n'; line = ''; }
        line += it.str + ' ';
        lastY = y;
      }
      text += line + '\n';
    }
    return text;
  }

  function setBillBox(kind, html) {
    const b = $('bill-result');
    b.hidden = false;
    b.className = 'bill-result ' + kind;
    b.innerHTML = html;
  }

  async function handleFile(file) {
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { setBillBox('err', 'El archivo debe ser un PDF.'); return; }
    if (file.size > 15 * 1024 * 1024) { setBillBox('err', 'El PDF supera los 15 MB.'); return; }
    $('upload-msg').textContent = 'Leyendo ' + file.name + '…';
    try {
      const text = await extractText(file);
      const d = BillParser.parse(text, S.CITIES);
      $('upload-msg').textContent = 'La lectura se hace en tu navegador: el archivo no sale de tu equipo.';
      if (d.textLength < 40) { bill = null; setBillBox('err', 'Este PDF no tiene texto seleccionable (parece escaneado o una foto). Cargá los datos a mano.'); return; }
      if (!d.found.consumption && !d.found.amount) { bill = null; setBillBox('warn', 'No pude identificar consumo ni importe en esta factura. Completá los datos a mano.'); return; }
      bill = Object.assign(d, { file: file.name });
      const applied = [];
      if (d.monthlyKwh) { $('monthlyKwh').value = d.monthlyKwh; applied.push(`Consumo mensual: <b>${fmt(d.monthlyKwh)} kWh</b>`); }
      if (d.tariff) { $('tariff').value = d.tariff; applied.push(`Tarifa: <b>${money(d.tariff)}/kWh</b>${d.tariffDerived ? ' (estimada)' : ''}`); }
      if (d.currency) { $('currency').value = d.currency; syncDefaults('currency'); }
      if (d.city) { $('city').value = d.city; syncCurrencyToCity(); syncDefaults('currency'); syncDefaults('city'); applied.push(`Ciudad: <b>${esc(d.city)}</b>`); }
      const miss = [];
      if (!d.city) miss.push('Ciudad no detectada: elegila en el formulario.');
      setBillBox(d.confidence >= 2 && !miss.length ? '' : 'warn',
        `<strong>✅ Factura leída${d.utility ? ' (' + esc(d.utility) + ')' : ''}.</strong> Se completó:<ul>${applied.map((a) => `<li>${a}</li>`).join('')}</ul>` +
        (d.notes.length || miss.length ? `<ul>${[...d.notes, ...miss].map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '') +
        '<p class="muted small" style="margin:6px 0 0">Revisá que los valores coincidan con tu factura; podés corregirlos a mano.</p>');
      render();
    } catch (e) {
      console.error(e);
      $('upload-msg').textContent = 'La lectura se hace en tu navegador: el archivo no sale de tu equipo.';
      setBillBox('err', 'No se pudo leer el PDF (¿está dañado o protegido con contraseña?). Cargá los datos a mano.');
    }
  }

  $('file').addEventListener('change', (e) => { handleFile(e.target.files[0]); e.target.value = ''; });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

  $('city').addEventListener('change', () => { syncCurrencyToCity(); syncDefaults(); render(); });
  $('currency').addEventListener('change', () => { syncDefaults('currency'); render(); });
  $('coverage').addEventListener('input', () => { $('covLabel').textContent = $('coverage').value; });
  $('form').addEventListener('input', render);
  $('form').addEventListener('submit', (e) => e.preventDefault());
  syncDefaults();
  render();
})();
