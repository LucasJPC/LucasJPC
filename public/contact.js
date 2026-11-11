(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = document.getElementById('contact-status');
  const btn = form.querySelector('button');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    status.textContent = 'Enviando…';
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar el mensaje.');
      status.textContent = '¡Gracias! Recibimos tu mensaje y te contactaremos pronto.';
      status.style.color = '#15803d';
      form.reset();
    } catch (err) {
      status.textContent = err.message;
      status.style.color = '#b91c1c';
    } finally { btn.disabled = false; }
  });
})();
