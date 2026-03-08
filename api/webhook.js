// api/webhook.js
import crypto from 'crypto';
import { deliverOrder } from './deliver.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (ipnSecret) {
    const receivedSig = req.headers['x-nowpayments-sig'];
    const sortedBody = sortObjectKeys(req.body);
    const expectedSig = crypto
      .createHmac('sha512', ipnSecret)
      .update(JSON.stringify(sortedBody))
      .digest('hex');
    if (receivedSig !== expectedSig) {
      console.warn('Webhook firma inválida');
      return res.status(400).json({ error: 'Firma inválida' });
    }
  }

  const { payment_status, order_id, actually_paid, pay_currency } = req.body;
  console.log(`Webhook: Orden ${order_id} — Estado: ${payment_status}`);

  if (['confirmed', 'finished'].includes(payment_status)) {
    // order_id formato: "ORD-XXXXX|NombreProducto|email@cliente.com"
    const parts = order_id.split('|');
    const orderId = parts[0];
    const productName = parts[1] || '';
    const customerEmail = parts[2] || '';

    if (productName && customerEmail) {
      await deliverOrder({ productName, customerEmail, orderId });
    } else {
      console.error('order_id sin producto o email:', order_id);
    }
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
