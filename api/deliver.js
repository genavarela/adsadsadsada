// api/deliver.js
export async function deliverOrder({ productName, customerEmail, orderId }) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  console.log('[v0] === INICIANDO ENTREGA ===');
  console.log('[v0] Producto:', productName);
  console.log('[v0] Email:', customerEmail);
  console.log('[v0] Orden:', orderId);
  console.log('[v0] SUPABASE_URL:', SUPABASE_URL ? 'OK' : 'FALTA');
  console.log('[v0] SUPABASE_KEY:', SUPABASE_KEY ? 'OK' : 'FALTA');
  console.log('[v0] RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'OK' : 'FALTA');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[v0] ERROR: Variables de Supabase no configuradas');
    return { success: false, reason: 'missing_supabase_config' };
  }

  // 1. Buscar una cuenta disponible en Supabase
  const searchUrl = `${SUPABASE_URL}/rest/v1/stock?product=eq.${encodeURIComponent(productName)}&delivered=eq.false&limit=1`;
  console.log('[v0] Buscando stock en:', searchUrl);
  
  const searchRes = await fetch(searchUrl, { 
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } 
  });
  
  console.log('[v0] Respuesta Supabase status:', searchRes.status);
  
  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    console.error('[v0] Error buscando stock:', errorText);
    return { success: false, reason: 'supabase_search_error', detail: errorText };
  }
  
  const items = await searchRes.json();
  console.log('[v0] Items encontrados:', JSON.stringify(items));

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
  console.log('[v0] Enviando email con credenciales:', JSON.stringify(item.credentials));
  
  const emailResult = await sendCredentialsEmail({
    productName,
    credentials: item.credentials,
    customerEmail,
    orderId,
  });

  if (!emailResult.success) {
    console.error('[v0] ERROR enviando email:', emailResult.error);
    return { success: false, reason: 'email_failed', detail: emailResult.error };
  }

  console.log(`[v0] ✅ Entregado exitosamente: ${productName} → ${customerEmail}`);
  return { success: true };
}

async function sendCredentialsEmail({ productName, credentials, customerEmail, orderId }) {
  console.log('[v0] === ENVIANDO EMAIL ===');
  console.log('[v0] To:', customerEmail);
  console.log('[v0] Product:', productName);
  
  if (!process.env.RESEND_API_KEY) {
    console.error('[v0] ERROR: RESEND_API_KEY no esta configurada');
    return { success: false, error: 'RESEND_API_KEY no configurada' };
  }

  if (!credentials || typeof credentials !== 'object') {
    console.error('[v0] ERROR: Credenciales invalidas:', credentials);
    return { success: false, error: 'Credenciales invalidas' };
  }

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

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'SowyStore <pedidos@sowy.store>',
        to: customerEmail,
        subject: `Tu ${productName} — Orden #${orderId}`,
        html,
      }),
    });
    
    const responseData = await r.json();
    console.log('[v0] Resend response status:', r.status);
    console.log('[v0] Resend response data:', JSON.stringify(responseData));
    
    if (!r.ok) {
      console.error('[v0] Resend error:', responseData);
      return { success: false, error: JSON.stringify(responseData) };
    }
    
    console.log('[v0] Email enviado exitosamente!');
    return { success: true, data: responseData };
  } catch (err) {
    console.error('[v0] Exception enviando email:', err.message);
    return { success: false, error: err.message };
  }
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
