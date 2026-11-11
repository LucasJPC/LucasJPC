// Motor de cálculo solar residencial. Funciona en navegador (window.Solar) y Node (module.exports).
(function (root) {
  // Horas sol pico (HSP) promedio anual, kWh/m²/día en plano inclinado óptimo. Valores aproximados.
  const CITIES = [
    { name: 'Rosario', country: 'AR', lat: -32.95, hsp: 4.6 },
    { name: 'Santa Fe', country: 'AR', lat: -31.63, hsp: 4.7 },
    { name: 'Rafaela', country: 'AR', lat: -31.25, hsp: 4.8 },
    { name: 'Reconquista', country: 'AR', lat: -29.15, hsp: 4.9 },
    { name: 'Buenos Aires', country: 'AR', lat: -34.6, hsp: 4.4 },
    { name: 'Córdoba', country: 'AR', lat: -31.42, hsp: 5.0 },
    { name: 'Mendoza', country: 'AR', lat: -32.89, hsp: 5.4 },
    { name: 'San Juan', country: 'AR', lat: -31.54, hsp: 5.6 },
    { name: 'Salta', country: 'AR', lat: -24.78, hsp: 5.6 },
    { name: 'Tucumán', country: 'AR', lat: -26.82, hsp: 5.0 },
    { name: 'Resistencia', country: 'AR', lat: -27.45, hsp: 4.7 },
    { name: 'Posadas', country: 'AR', lat: -27.37, hsp: 4.6 },
    { name: 'Neuquén', country: 'AR', lat: -38.95, hsp: 5.0 },
    { name: 'Mar del Plata', country: 'AR', lat: -38.0, hsp: 4.3 },
    { name: 'Bariloche', country: 'AR', lat: -41.13, hsp: 4.0 },
    { name: 'Ushuaia', country: 'AR', lat: -54.8, hsp: 2.9 },
    { name: 'Calama', country: 'CL', lat: -22.46, hsp: 7.0 },
    { name: 'Antofagasta', country: 'CL', lat: -23.65, hsp: 6.5 },
    { name: 'La Serena', country: 'CL', lat: -29.9, hsp: 5.4 },
    { name: 'Santiago', country: 'CL', lat: -33.45, hsp: 5.3 },
    { name: 'Talca', country: 'CL', lat: -35.43, hsp: 4.9 },
    { name: 'Concepción', country: 'CL', lat: -36.83, hsp: 4.2 },
    { name: 'Temuco', country: 'CL', lat: -38.74, hsp: 4.0 },
    { name: 'Puerto Montt', country: 'CL', lat: -41.47, hsp: 3.4 },
  ];

  // Costo instalado aproximado por kWp y moneda (editable por el usuario).
  const CURRENCIES = {
    ARS: { symbol: '$', costPerKwp: 1300000, locale: 'es-AR', co2: 0.31 },
    CLP: { symbol: '$', costPerKwp: 1100000, locale: 'es-CL', co2: 0.35 },
    USD: { symbol: 'US$', costPerKwp: 1100, locale: 'es-AR', co2: 0.4 },
  };

  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Pérdida por orientación del techo respecto al norte (hemisferio sur) e inclinación.
  const ORIENTATION = { N: 1, NE: 0.95, NO: 0.95, E: 0.85, O: 0.85, SE: 0.75, SO: 0.75, S: 0.62, PLANO: 0.9 };

  // Perfil estacional (promedio 1): máximo en diciembre, más marcado a mayor latitud.
  function seasonal(lat) {
    const amp = Math.min(0.55, 0.1 + 0.009 * Math.abs(lat));
    const f = MONTHS.map((_, m) => 1 + amp * Math.cos((2 * Math.PI * (m - 11.5 + (lat > 0 ? 6 : 0))) / 12));
    const avg = f.reduce((a, b) => a + b, 0) / 12;
    return f.map((x) => x / avg);
  }

  /**
   * @param {object} i
   *  monthlyKwh, tariff (moneda/kWh), hsp, lat, coverage (0-1), panelW, performance (0-1),
   *  orientation, costPerKwp, roofArea (m², opcional), tariffGrowth (0-1/año), degradation (0-1/año),
   *  fixedCharge (cargo fijo mensual que no se ahorra, opcional), exportKwh... (no incluido)
   */
  function calculate(i) {
    const o = Object.assign(
      { coverage: 1, panelW: 550, performance: 0.8, orientation: 'N', tariffGrowth: 0.05, degradation: 0.005, years: 25, lat: -33, panelArea: 2.6 },
      i
    );
    const orient = ORIENTATION[o.orientation] ?? 1;
    const annualKwh = o.monthlyKwh * 12;
    const dailyPerKwp = o.hsp * o.performance * orient; // kWh/día por kWp
    let kwp = (annualKwh * o.coverage) / (dailyPerKwp * 365);
    let panels = Math.max(1, Math.ceil((kwp * 1000) / o.panelW));
    let limitedByRoof = false;
    if (o.roofArea > 0) {
      const maxPanels = Math.floor(o.roofArea / o.panelArea);
      if (maxPanels < panels) { panels = Math.max(1, maxPanels); limitedByRoof = true; }
    }
    kwp = (panels * o.panelW) / 1000;
    const season = seasonal(o.lat);
    const monthly = MONTHS.map((name, m) => {
      const gen = kwp * dailyPerKwp * season[m] * DAYS[m];
      return { name, generation: gen, consumption: o.monthlyKwh };
    });
    const yearGen = monthly.reduce((a, b) => a + b.generation, 0);
    // Autoconsumo neto (medición neta / balance): se compensa hasta el consumo anual.
    const usedKwh = Math.min(yearGen, annualKwh);
    const coverageReal = annualKwh ? usedKwh / annualKwh : 0;
    const year1Saving = usedKwh * o.tariff;
    const cost = kwp * o.costPerKwp;
    let cum = -cost, payback = null, total = 0;
    const flow = [];
    for (let y = 1; y <= o.years; y++) {
      const gen = yearGen * Math.pow(1 - o.degradation, y - 1);
      const t = o.tariff * Math.pow(1 + o.tariffGrowth, y - 1);
      const s = Math.min(gen, annualKwh) * t;
      const prev = cum;
      cum += s; total += s;
      if (payback === null && cum >= 0) payback = y - 1 + (s ? -prev / s : 0);
      flow.push({ year: y, saving: s, cumulative: cum });
    }
    const tir = irr([-cost, ...flow.map((f) => f.saving)]);
    return {
      kwp, panels, limitedByRoof, area: panels * o.panelArea, yearGen, monthly, coverageReal,
      year1Saving, cost, payback, totalSaving: total, net: total - cost, flow, irr: tir,
      co2: yearGen * (o.co2Factor ?? 0.35) / 1000, trees: Math.round((yearGen * (o.co2Factor ?? 0.35)) / 22),
      surplus: Math.max(0, yearGen - annualKwh),
    };
  }

  function irr(cf) {
    let lo = -0.9, hi = 5;
    const npv = (r) => cf.reduce((a, c, t) => a + c / Math.pow(1 + r, t), 0);
    if (npv(lo) * npv(hi) > 0) return null;
    for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; npv(lo) * npv(mid) <= 0 ? (hi = mid) : (lo = mid); }
    return (lo + hi) / 2;
  }

  const api = { CITIES, CURRENCIES, MONTHS, ORIENTATION, calculate, seasonal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Solar = api;
})(typeof window !== 'undefined' ? window : globalThis);
