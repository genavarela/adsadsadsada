// api/webhook.js
import crypto from 'crypto';
import { deliverOrder } from './deliver.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('=== WEBHOOK RECIBIDO ===');
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body));

  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

  if (ipnSecret) {
    const receivedSig = req.headers['x-nowpayments-sig'];
    if (receivedSig) {
      const sortedBody = sortObjectKeys(req.body);
      const expectedSig = crypto
        .createHmac('sha512', ipnSecret)
        .update(JSON.stringify(sortedBody))
        .digest('hex');

      console.log('Firma recibida:', receivedSig);
      console.log('Firma esperada:', expectedSig);

      if (receivedSig !== expectedSig) {
        console.warn('⚠️ Firma inválida — igual procesando para debug');
        // NO rechazamos, solo logueamos para debug
      } else {
        console.log('✅ Firma válida');
      }
    } else {
      console.log('Sin header de firma — continuando igual');
    }
  }

  const { payment_status, order_id, actually_paid, pay_currency } = req.body;
  console.log(`Orden: ${order_id} | Estado: ${payment_status}`);

  const estadosValidos = ['confirmed', 'finished', 'partially_paid'];
  if (estadosValidos.includes(payment_status)) {
    // order_id formato: "ORD-XXXXX|NombreProducto|email@cliente.com"
    const parts = (order_id || '').split('|');
    const orderId = parts[0];
    const productName = parts[1] || '';
    const customerEmail = parts[2] || '';

    console.log(`Entregando: ${productName} → ${customerEmail}`);

    if (productName && customerEmail) {
      const result = await deliverOrder({ productName, customerEmail, orderId });
      console.log('Resultado deliver:', JSON.stringify(result));
    } else {
      console.error('❌ order_id sin producto o email:', order_id);
    }
  } else {
    console.log(`Estado ${payment_status} ignorado (no es pago final)`);
  }

  return res.status(200).json({ received: true });
}

function sortObjectKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  return Object.keys(obj).sort().reduce((sorted, key) => {
    sorted[key] = sortObjectKeys(obj[key]);
    return sorted;
  }, {});
}
