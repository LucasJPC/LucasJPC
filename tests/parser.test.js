const test = require('node:test');
const assert = require('node:assert');
const { parse, parseNum } = require('../public/js/bill-parser.js');
const { CITIES } = require('../public/js/solar.js');

test('parseNum formatos es-AR / en-US', () => {
  assert.equal(parseNum('1.234,56'), 1234.56);
  assert.equal(parseNum('1,234.56'), 1234.56);
  assert.equal(parseNum('$ 85.430,12'), 85430.12);
  assert.equal(parseNum('345,5'), 345.5);
  assert.equal(parseNum('1.234'), 1234);
});

const cases = [
  ['bimestral con días', 'EPE\nPeríodo facturado: 01/09/2026 al 30/10/2026 (60 días)\nEnergía activa consumida: 780 kWh\nTOTAL A PAGAR: $ 92.662,35\nRosario', { monthlyKwh: 390, amount: 92662.35, city: 'Rosario' }],
  ['mensual por fechas', 'Consumo del período: 312 kWh\nPeríodo desde 01/10/2026 hasta 31/10/2026\nTotal a pagar $ 58.900', { monthlyKwh: 312, amount: 58900 }],
  ['etiqueta y valor en líneas separadas', 'Consumo total\n450 kWh\nImporte total\n$ 71.250,00\nBimestre', { monthlyKwh: 225, amount: 71250 }],
  ['valor antes de la unidad con "Consumo:"', 'Consumo: 1.234 kWh\nDías facturados: 62\nTotal factura: $ 210.000,50', { monthlyKwh: 617, amount: 210000.5 }],
  ['tabla de conceptos', 'Concepto Cantidad Unidad Precio Importe\nCargo variable 520 kWh 0,1500 78,00\nTOTAL $ 12.340,00\nCórdoba', { amount: 12340, city: 'Córdoba' }],
];
for (const [name, text, exp] of cases) {
  test('factura: ' + name, () => {
    const r = parse(text, CITIES);
    for (const [k, v] of Object.entries(exp)) assert.equal(r[k], v, `${k}: esperado ${v}, obtenido ${r[k]}`);
  });
}

test('sin texto útil no inventa datos', () => {
  const r = parse('Hola mundo sin números', CITIES);
  assert.equal(r.found.consumption, undefined);
  assert.equal(r.found.amount, undefined);
});
