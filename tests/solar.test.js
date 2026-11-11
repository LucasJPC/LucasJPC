const test = require('node:test');
const assert = require('node:assert');
const { calculate, seasonal } = require('../public/js/solar.js');

const base = { monthlyKwh: 400, tariff: 100, hsp: 4.6, lat: -32.9, costPerKwp: 1000000, co2Factor: 0.35 };

test('dimensiona ~ consumo anual / (HSP*PR*365)', () => {
  const r = calculate(base);
  const expected = (400 * 12) / (4.6 * 0.8 * 365);
  assert.ok(Math.abs(r.kwp - expected) < 0.3, `${r.kwp} vs ${expected}`);
  assert.ok(r.coverageReal > 0.95 && r.coverageReal <= 1);
});
test('el perfil estacional promedia 1 y el pico es en diciembre (hemisferio sur)', () => {
  const s = seasonal(-33);
  assert.ok(Math.abs(s.reduce((a, b) => a + b) / 12 - 1) < 1e-9);
  assert.equal(s.indexOf(Math.max(...s)), 11);
});
test('la superficie limita el sistema', () => {
  const r = calculate({ ...base, roofArea: 8 });
  assert.equal(r.limitedByRoof, true);
  assert.ok(r.panels <= 3 && r.coverageReal < 1);
});
test('peor orientación => más paneles', () => {
  assert.ok(calculate({ ...base, orientation: 'S' }).panels > calculate(base).panels);
});
test('recupero e IRR consistentes', () => {
  const r = calculate(base);
  assert.ok(r.payback > 0 && r.payback < 25);
  assert.ok(r.irr > 0);
  assert.ok(Math.abs(r.net - (r.totalSaving - r.cost)) < 1e-6);
});
test('sin recupero dentro del horizonte', () => {
  const r = calculate({ ...base, costPerKwp: 1e9 });
  assert.equal(r.payback, null);
});
