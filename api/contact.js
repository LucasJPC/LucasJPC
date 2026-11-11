// Función serverless de Vercel: POST /api/contact
const { sendContact } = require('../lib/send-contact');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método no permitido' }); }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  try {
    const out = await sendContact(req.body, { ip });
    res.status(out.status).json(out.body);
  } catch (e) {
    res.status(500).json({ error: 'Error interno.' });
  }
};
