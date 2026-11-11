const test = require('node:test');
const assert = require('node:assert');
const { sendContact } = require('../lib/send-contact.js');

const env = { RESEND_API_KEY: 're_test', CONTACT_TO: 'dueno@example.com' };
const ok = { name: 'Ana', email: 'ana@example.com', message: 'Hola <b>quiero</b> cotizar' };
let n = 0; const ip = () => 'ip' + n++;

test('envía a Resend con reply_to y HTML escapado', async () => {
  let call;
  const r = await sendContact(ok, { ip: ip(), env, fetchImpl: async (u, o) => { call = { u, o }; return { ok: true }; } });
  assert.equal(r.status, 200);
  const sent = JSON.parse(call.o.body);
  assert.equal(call.u, 'https://api.resend.com/emails');
  assert.equal(call.o.headers.Authorization, 'Bearer re_test');
  assert.deepEqual(sent.to, ['dueno@example.com']);
  assert.equal(sent.reply_to, 'ana@example.com');
  assert.ok(!sent.html.includes('<b>quiero') && sent.html.includes('&lt;b&gt;'));
});
test('valida campos', async () => {
  for (const bad of [{ ...ok, name: '' }, { ...ok, email: 'nope' }, { ...ok, message: '' }, { ...ok, message: 'x'.repeat(4001) }, null]) {
    const r = await sendContact(bad, { ip: ip(), env, fetchImpl: async () => { throw new Error('no debe llamar'); } });
    assert.equal(r.status, 400);
  }
});
test('honeypot: responde ok sin enviar', async () => {
  const r = await sendContact({ ...ok, website: 'spam.com' }, { ip: ip(), env, fetchImpl: async () => { throw new Error('no debe llamar'); } });
  assert.equal(r.status, 200);
});
test('sin configuración devuelve 503', async () => {
  assert.equal((await sendContact(ok, { ip: ip(), env: {}, fetchImpl: async () => ({ ok: true }) })).status, 503);
});
test('error de Resend devuelve 502 sin filtrar detalles', async () => {
  const r = await sendContact(ok, { ip: ip(), env, fetchImpl: async () => ({ ok: false, status: 403 }) });
  assert.equal(r.status, 502);
  assert.ok(!JSON.stringify(r.body).includes('re_test'));
});
test('rate limit: más de 5 envíos por IP', async () => {
  const same = ip(); let last;
  for (let i = 0; i < 6; i++) last = await sendContact(ok, { ip: same, env, fetchImpl: async () => ({ ok: true }) });
  assert.equal(last.status, 429);
});
