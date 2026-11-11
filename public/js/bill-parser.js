// Extrae datos de una factura eléctrica a partir de su texto (PDF con texto). window.BillParser / Node.
(function (root) {
  // "1.234,56" | "1,234.56" | "1234,5" | "345" -> número
  function parseNum(s) {
    s = String(s).replace(/[^\d.,-]/g, '');
    if (!s) return NaN;
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (lc > -1) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    else if (ld > -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return parseFloat(s);
  }

  const NUM = '(\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{1,4})?|\\d+(?:[.,]\\d+)?)';
  const norm = (t) => t.replace(/ /g, ' ').replace(/[ \t]+/g, ' ');

  function parseDate(s) {
    const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!m) return null;
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(Date.UTC(y, +m[2] - 1, +m[1]));
  }

  function parse(rawText, cities) {
    const text = norm(rawText);
    const flat = text.replace(/\n/g, ' ');
    const out = { found: {}, notes: [] };

    // --- Consumo (kWh) ---
    const kwhAll = [...flat.matchAll(new RegExp(NUM + '\\s*kwh', 'gi'))].map((m) => ({ v: parseNum(m[1]), i: m.index }));
    const labeled = [];
    const lab = /(consumo(?:\s+(?:total|facturado|del per[ií]odo|energ[ií]a|activa|registrado))?|energ[ií]a\s+(?:activa|consumida|facturada)|kwh\s+consumidos)/gi;
    for (const m of flat.matchAll(lab)) {
      const win = flat.slice(m.index, m.index + 110);
      const k = win.match(new RegExp(NUM + '\\s*kwh', 'i')) || win.match(new RegExp('(?:[:=]\\s*)' + NUM + '(?!\\s*[,.]?\\d)', 'i'));
      if (k) { const v = parseNum(k[1]); if (v > 5 && v < 50000) labeled.push(v); }
    }
    let kwh = null;
    if (labeled.length) kwh = labeled[0];
    else {
      const ok = kwhAll.map((k) => k.v).filter((v) => v > 5 && v < 50000);
      if (ok.length) kwh = Math.max(...ok);
    }
    if (kwh) { out.consumptionKwh = kwh; out.found.consumption = true; }

    // --- Período facturado (días) ---
    let days = null;
    const d1 = flat.match(/(\d{2,3})\s*d[ií]as/i);
    if (d1 && +d1[1] >= 20 && +d1[1] <= 130) days = +d1[1];
    if (!days) {
      const d2 = flat.match(/d[ií]as\s+(?:facturados|del\s+per[ií]odo|de\s+consumo|facturaci[oó]n)\s*[:=]?\s*(\d{2,3})/i);
      if (d2 && +d2[1] >= 20 && +d2[1] <= 130) days = +d2[1];
    }
    if (!days) {
      const per = flat.match(/(?:per[ií]odo|desde)[^\d]{0,25}(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})[^\d]{1,25}(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
      if (per) {
        const a = parseDate(per[1]), b = parseDate(per[2]);
        if (a && b) { const d = Math.round((b - a) / 864e5); if (d >= 20 && d <= 130) days = d; }
      }
    }
    if (!days && /bimestr|bimensual/i.test(flat)) days = 61;
    if (days) { out.days = days; out.found.days = true; }
    if (kwh) {
      let months = days ? days / 30.4 : 1;
      if (Math.abs(months - Math.round(months)) < 0.12) months = Math.round(months); // 28-33 d => 1 mes, 58-65 d => 2 meses
      out.monthlyKwh = Math.round(months > 0.8 && months < 1.25 ? kwh : kwh / (months < 0.8 ? 1 : months));
      if (days && months >= 1.5) out.notes.push(`El período facturado es de ${days} días: se llevó el consumo a base mensual.`);
      if (!days) out.notes.push('No se pudo detectar el período facturado; se asumió consumo mensual. Verificalo.');
    }

    // --- Importe total ---
    const totalRe = /(total\s+a\s+pagar|importe\s+total|total\s+factura(?:do)?|monto\s+(?:total|a\s+pagar)|total\s+del\s+comprobante|total\s+a\s+abonar|saldo\s+a\s+pagar|total)\b[^\d\n]{0,25}?\$?\s*([\d.,]{3,})/gi;
    const totals = [];
    for (const m of flat.matchAll(totalRe)) {
      const v = parseNum(m[2]);
      if (v > 100) totals.push({ label: m[1].toLowerCase(), v });
    }
    const strong = totals.find((t) => /pagar|importe total|factura|monto|abonar|comprobante/.test(t.label));
    const amount = (strong || totals[totals.length - 1] || {}).v;
    if (amount) { out.amount = amount; out.found.amount = true; }

    // --- Tarifa explícita ($/kWh) ---
    const tar = flat.match(new RegExp('(?:precio|tarifa|cargo\\s+variable|valor)[^\\n$]{0,40}\\$\\s*' + NUM + '\\s*(?:\\/|por)\\s*kwh', 'i'))
      || flat.match(new RegExp('\\$\\s*' + NUM + '\\s*(?:\\/|por)\\s*kwh', 'i'));
    if (tar) { const v = parseNum(tar[1]); if (v > 0) { out.tariff = v; out.found.tariff = true; } }
    if (!out.tariff && amount && kwh) {
      out.tariff = +(amount / kwh).toFixed(2);
      out.tariffDerived = true;
      out.notes.push('La tarifa se estimó como importe total ÷ kWh (incluye cargos fijos e impuestos).');
    }

    // --- Moneda ---
    if (/u\$s|usd|us\$/i.test(flat) && !/\$\s*\d/.test(flat.replace(/us\$|u\$s/gi, ''))) out.currency = 'USD';

    // --- Ciudad / localidad ---
    const list = cities || (root.Solar && root.Solar.CITIES) || [];
    const lower = flat.toLowerCase();
    const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const ls = strip(lower);
    const hit = list.find((c) => ls.includes(strip(c.name)));
    if (hit) { out.city = hit.name; out.found.city = true; }

    // --- Datos informativos ---
    const sup = flat.match(/(?:n[°º.]?\s*(?:de\s*)?(?:suministro|cliente|medidor|cuenta)|suministro|cliente)\s*[:#]?\s*(\d{5,12})/i);
    if (sup) out.account = sup[1];
    const emp = flat.match(/\b(EPE|EDESUR|EDENOR|EDELAP|EPEC|EDEMSA|EDET|Enel|CGE|Saesa|Frontel)\b/i);
    if (emp) out.utility = emp[1].toUpperCase();

    out.confidence = ['consumption', 'amount', 'days'].filter((k) => out.found[k]).length;
    out.textLength = text.trim().length;
    return out;
  }

  const api = { parse, parseNum };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BillParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
