// Lógica compartida del formulario de contacto: valida y envía el correo con Resend.
// Variables de entorno: RESEND_API_KEY (obligatoria), CONTACT_TO (destino), CONTACT_FROM (opcional).
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

// Rate limit simple por IP (en memoria; suficiente para frenar ráfagas en una instancia).
const hits = new Map();
function limited(ip, now = Date.now()) {
  const arr = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 5;
}

async function sendContact(body, { ip = 'x', env = process.env, fetchImpl = fetch } = {}) {
  const b = body && typeof body === 'object' ? body : {};
  if (b.website) return { status: 200, body: { ok: true } }; // honeypot: los bots lo completan; se ignora en silencio
  const name = String(b.name ?? '').trim();
  const email = String(b.email ?? '').trim();
  const message = String(b.message ?? '').trim();
  if (!name || name.length > 100) return { status: 400, body: { error: 'Ingresá tu nombre.' } };
  if (!EMAIL.test(email) || email.length > 200) return { status: 400, body: { error: 'Ingresá un email válido.' } };
  if (!message || message.length > 4000) return { status: 400, body: { error: 'Escribí tu mensaje (máx. 4000 caracteres).' } };
  if (limited(ip)) return { status: 429, body: { error: 'Demasiados envíos. Probá de nuevo en unos minutos.' } };
  if (!env.RESEND_API_KEY || !env.CONTACT_TO) return { status: 503, body: { error: 'El envío de mensajes no está configurado todavía.' } };

  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.CONTACT_FROM || 'SolarAndes Web <onboarding@resend.dev>',
      to: [env.CONTACT_TO],
      reply_to: email,
      subject: `Nuevo contacto web: ${name.replace(/[\r\n]+/g, ' ').slice(0, 80)}`,
      text: `Nombre: ${name}\nEmail: ${email}\n\n${message}`,
      html: `<p><b>Nombre:</b> ${esc(name)}<br><b>Email:</b> ${esc(email)}</p><p>${esc(message).replace(/\n/g, '<br>')}</p>`,
    }),
  });
  if (!res.ok) return { status: 502, body: { error: 'No se pudo enviar el mensaje. Intentá de nuevo más tarde.' } };
  return { status: 200, body: { ok: true } };
}

module.exports = { sendContact, limited };
