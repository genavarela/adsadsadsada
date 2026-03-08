// api/deliver.js v2
export async function deliverOrder({ productName, customerEmail, orderId }) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  console.log('DELIVER_V2 START', productName, customerEmail);
  console.log('SUPABASE_URL:', SUPABASE_URL ? 'OK' : 'FALTA');
  console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'OK' : 'FALTA');

  // 1. Buscar stock
  const searchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/stock?product=eq.${encodeURIComponent(productName)}&delivered=eq.false&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const items = await searchRes.json();
  console.log('STOCK ITEMS:', JSON.stringify(items));

  if (!items.length) {
    console.log('NO STOCK');
    await sendAdminAlert({ productName, customerEmail, orderId });
    return { success: false, reason: 'no_stock' };
  }

  const item = items[0];

  // 2. Marcar entregada
  await fetch(`${SUPABASE_URL}/rest/v1/stock?id=eq.${item.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      delivered: true,
      delivered_at: new Date().toISOString(),
      order_id: orderId,
      customer_email: customerEmail,
    }),
  });

  // 3. Enviar email
  console.log('SENDING EMAIL TO:', customerEmail);
  const emailPayload = {
    from: 'SowyStore <pedidos@sowy.store>',
    to: customerEmail,
    subject: `Tu ${productName} — Orden #${orderId}`,
    html: buildEmailHtml({ productName, credentials: item.credentials, orderId }),
  };
  console.log('EMAIL PAYLOAD:', JSON.stringify(emailPayload));

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(emailPayload),
  });

  const resendData = await r.json();
  console.log('RESEND STATUS:', r.status);
  console.log('RESEND RESPONSE:', JSON.stringify(resendData));

  if (!r.ok) {
    return { success: false, reason: 'email_failed', detail: resendData };
  }

  console.log('DELIVER_V2 DONE');
  return { success: true };
}

function buildEmailHtml({ productName, credentials, orderId }) {
  const credHtml = Object.entries(credentials || {})
    .map(([k, v]) => `<tr><td style="padding:8px 12px;color:#888;font-size:13px;border-bottom:1px solid #222">${k}</td><td style="padding:8px 12px;font-family:monospace;font-weight:600;border-bottom:1px solid #222">${v}</td></tr>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="background:#0a0a0a;font-family:sans-serif;color:#eee;margin:0;padding:0">
<div style="max-width:520px;margin:40px auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">
  <div style="padding:32px;border-bottom:1px solid #222;text-align:center">
    <div style="font-size:22px"><strong>Sowy</strong>Store</div>
  </div>
  <div style="padding:32px">
    <p style="color:#888;font-size:13px">Orden #${orderId}</p>
    <h2 style="font-weight:400">Tu ${productName} está listo ✅</h2>
    <table style="width:100%;border-collapse:collapse;background:#0a0a0a;border:1px solid #222;border-radius:10px">${credHtml}</table>
  </div>
  <div style="padding:16px;text-align:center;border-top:1px solid #222">
    <p style="color:#444;font-size:12px">sowy.store</p>
  </div>
</div>
</body></html>`;
}

async function sendAdminAlert({ productName, customerEmail, orderId }) {
  if (!process.env.RESEND_API_KEY || !process.env.ADMIN_EMAIL) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'SowyStore <pedidos@sowy.store>',
      to: process.env.ADMIN_EMAIL,
      subject: `⚠️ Sin stock: ${productName} — #${orderId}`,
      html: `<p><b>Producto:</b> ${productName}<br><b>Cliente:</b> ${customerEmail}</p>`,
    }),
  });
}
