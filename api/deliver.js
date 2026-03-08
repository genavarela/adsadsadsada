// api/deliver.js
export async function deliverOrder({ productName, customerEmail, orderId }) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  // 1. Buscar una cuenta disponible en Supabase
  const searchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/stock?product=eq.${encodeURIComponent(productName)}&delivered=eq.false&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const items = await searchRes.json();

  if (!items.length) {
    console.error(`Sin stock para: ${productName}`);
    await sendAdminAlert({ productName, customerEmail, orderId });
    return { success: false, reason: 'no_stock' };
  }

  const item = items[0];

  // 2. Marcar como entregada
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

  // 3. Guardar la orden
  await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: orderId,
      product: productName,
      customer_email: customerEmail,
      status: 'delivered',
    }),
  });

  // 4. Mandar email al cliente
  await sendCredentialsEmail({
    productName,
    credentials: item.credentials,
    customerEmail,
    orderId,
  });

  console.log(`✅ Entregado: ${productName} → ${customerEmail}`);
  return { success: true };
}

async function sendCredentialsEmail({ productName, credentials, customerEmail, orderId }) {
  const credHtml = Object.entries(credentials)
    .map(([key, val]) => `
      <tr>
        <td style="padding:8px 12px;color:#888;font-size:13px;text-transform:capitalize;border-bottom:1px solid #222">${key.replace(/_/g, ' ')}</td>
        <td style="padding:8px 12px;font-family:monospace;font-size:14px;font-weight:600;border-bottom:1px solid #222">${val}</td>
      </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',sans-serif;color:#eee">
  <div style="max-width:520px;margin:40px auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">
    <div style="padding:32px;border-bottom:1px solid #222;text-align:center">
      <div style="font-size:22px;letter-spacing:2px"><strong>Sowy</strong>Store</div>
      <div style="color:#888;font-size:12px;margin-top:6px;letter-spacing:1px;text-transform:uppercase">Entrega automática</div>
    </div>
    <div style="padding:32px">
      <p style="color:#888;font-size:13px;margin:0 0 8px">Orden <strong style="color:#eee">#${orderId}</strong></p>
      <h2 style="margin:0 0 24px;font-size:20px;font-weight:400">Tu <strong>${productName}</strong> está listo ✅</h2>
      <p style="color:#888;font-size:12px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px">Credenciales de acceso</p>
      <table style="width:100%;border-collapse:collapse;background:#0a0a0a;border-radius:10px;border:1px solid #222">${credHtml}</table>
      <div style="margin-top:20px;padding:14px;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px">
        <p style="margin:0;font-size:13px;color:#666;line-height:1.7">⚠️ No compartas estas credenciales. Problemas → Discord.</p>
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #222;text-align:center">
      <p style="margin:0;font-size:12px;color:#444">sowy.store · Soporte por Discord</p>
    </div>
  </div>
</body></html>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'SowyStore <pedidos@sowy.store>',
      to: customerEmail,
      subject: `✅ Tu ${productName} — Orden #${orderId}`,
      html,
    }),
  });
  if (!r.ok) console.error('Resend error:', await r.json());
}

async function sendAdminAlert({ productName, customerEmail, orderId }) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'SowyStore <pedidos@sowy.store>',
      to: process.env.ADMIN_EMAIL,
      subject: `⚠️ Sin stock: ${productName} — #${orderId}`,
      html: `<p><b>Producto:</b> ${productName}<br><b>Cliente:</b> ${customerEmail}<br><b>Orden:</b> ${orderId}</p>`,
    }),
  });
}
