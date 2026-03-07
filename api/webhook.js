// api/webhook.js
// NOWPayments llama a esta URL automáticamente cuando cambia el estado de un pago
// Podés usar esto para enviar el email con credenciales automáticamente

import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Verificar firma de NOWPayments (seguridad) ──
  // NOWPayments firma cada webhook con tu IPN Secret
  // Lo encontrás en: NOWPayments dashboard → Store Settings → IPN Secret
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

  if (ipnSecret) {
    const receivedSig = req.headers['x-nowpayments-sig'];
    const sortedBody = sortObjectKeys(req.body);
    const expectedSig = crypto
      .createHmac('sha512', ipnSecret)
      .update(JSON.stringify(sortedBody))
      .digest('hex');

    if (receivedSig !== expectedSig) {
      console.warn('Webhook con firma inválida — ignorado');
      return res.status(400).json({ error: 'Firma inválida' });
    }
  }

  const { payment_status, order_id, actually_paid, pay_currency } = req.body;

  console.log(`Webhook recibido: Orden ${order_id} — Estado: ${payment_status}`);

  // ── Cuando el pago está confirmado ──
  if (['confirmed', 'finished'].includes(payment_status)) {
    console.log(`✅ Pago confirmado: Orden ${order_id} — ${actually_paid} ${pay_currency}`);

    // AQUÍ podés agregar la lógica de entrega automática:
    // Ejemplo: enviar email con las credenciales
    // await sendCredentialsEmail(order_id);
    //
    // Por ahora solo logueamos — agregá tu lógica de entrega abajo:
    // ─────────────────────────────────────────────────
    // const credentials = await getCredentialsForOrder(order_id);
    // await sendEmail({
    //   to: customerEmail,
    //   subject: 'SowyStore — Tu orden llegó',
    //   body: `Tus credenciales: ${credentials}`
    // });
    // ─────────────────────────────────────────────────
  }

  // Siempre responder 200 a NOWPayments para que no reintente
  return res.status(200).json({ received: true });
}

// Función auxiliar para ordenar keys del objeto (requerido para verificar firma)
function sortObjectKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  return Object.keys(obj)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = sortObjectKeys(obj[key]);
      return sorted;
    }, {});
}
