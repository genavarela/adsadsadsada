// api/deliver.js
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export async function deliverOrder({ productName, customerEmail, orderId }) {
  // Leer stock dinámicamente (sin assert)
  const stockPath = path.join(process.cwd(), 'stock.json');
  const stock = JSON.parse(fs.readFileSync(stockPath, 'utf8'));

  const available = stock[productName];

  if (!available || available.length === 0) {
    console.error(`⚠️ Sin stock para: ${productName}`);
    await sendAdminAlert({ productName, customerEmail, orderId });
    return { success: false, reason: 'no_stock' };
  }

  const credentials = available[0];
  available.splice(0, 1);
  fs.writeFileSync(stockPath, JSON.stringify(stock, null, 2));

  await sendCredentialsEmail({ productName, credentials, customerEmail, orderId });

  console.log(`✅ Entregado: ${productName} → ${customerEmail} (Orden ${orderId})`);
  return { success: true };
}

async function sendCredentialsEmail({ productName, credentials, customerEmail, orderId }) {
  const credHtml = Object.entries(credentials)
    .map(([key, val]) => `
      <tr>
        <td style="padding:8px 12px;color:#888;font-size:13px;text-transform:capitalize;border-bottom:1px solid #222">${key.replace(/_/g,' ')}</td>
        <td style="padding:8px 12px;font-family:monospace;font-size:13px;font-weight:600;border-bottom:1px solid #222">${val}</td>
      </tr>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',sans-serif;color:#eeeeee">
  <div style="max-width:520px;margin:40px auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">
    <div style="padding:32px;border-bottom:1px solid #222;text-align:center">
      <div style="font-size:22px;font-weight:300;letter-spacing:2px">
        <strong style="font-weight:600">Sowy</strong>Store
      </div>
      <div style="color:#888;font-size:12px;margin-top:6px;letter-spacing:1px;text-transform:uppercase">
        Entrega automática de pedido
      </div>
    </div>
    <div style="padding:32px">
      <p style="color:#888;font-size:13px;margin:0 0 8px">Orden <strong style="color:#eee">#${orderId}</strong></p>
      <h2 style="margin:0 0 24px;font-size:20px;font-weight:400">
        Tu <strong>${productName}</strong> está listo ✅
      </h2>
      <p style="color:#888;font-size:13px;margin:0 0 16px;text-transform:uppercase;letter-spacing:1px">
        Credenciales de acceso
      </p>
      <table style="width:100%;border-collapse:collapse;background:#0a0a0a;border-radius:10px;overflow:hidden;border:1px solid #222">
        ${credHtml}
      </table>
      <div style="margin-top:24px;padding:16px;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px">
        <p style="margin:0;font-size:13px;color:#666;line-height:1.7">
          ⚠️ <strong style="color:#888">Importante:</strong> No compartas estas credenciales.
          Si tenés algún problema contactanos en Discord.
        </p>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #222;text-align:center">
      <p style="margin:0;font-size:12px;color:#444">sowy.store · Soporte por Discord</p>
    </div>
  </div>
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'SowyStore <pedidos@sowy.store>',
      to: customerEmail,
      subject: `✅ Tu ${productName} — Orden #${orderId}`,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error('Resend error:', err);
  }
}

async function sendAdminAlert({ productName, customerEmail, orderId }) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'SowyStore <pedidos@sowy.store>',
      to: process.env.ADMIN_EMAIL,
      subject: `⚠️ Sin stock: ${productName} — Orden #${orderId}`,
      html: `
        <p>Se confirmó un pago pero no hay stock disponible.</p>
        <p><strong>Producto:</strong> ${productName}</p>
        <p><strong>Cliente:</strong> ${customerEmail}</p>
        <p><strong>Orden:</strong> ${orderId}</p>
        <p>Contactá al cliente y entregá manualmente.</p>
      `,
    }),
  });
}
