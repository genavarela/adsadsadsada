// api/check-status.js
import { deliverOrder } from './deliver.js';

// Set para trackear pagos ya entregados
const delivered = new Set();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentId } = req.query;
  if (!paymentId) return res.status(400).json({ error: 'Falta paymentId' });

  try {
    const response = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
      headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY },
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: 'Error NOWPayments', detail: data });

    const isConfirmed = ['confirmed', 'finished', 'sending'].includes(data.payment_status);

    if (isConfirmed && !delivered.has(paymentId)) {
      delivered.add(paymentId);
      
      const orderId = data.order_id || '';
      const parts = orderId.split('|');
      const orderIdClean = parts[0];
      const productName = parts[1] || '';
      const customerEmail = parts[2] || '';

      console.log('CHECK-STATUS: confirmado', productName, '->', customerEmail);

      if (productName && customerEmail) {
        // Esperar el deliver antes de responder
        const result = await deliverOrder({ productName, customerEmail, orderId: orderIdClean });
        console.log('DELIVER RESULT:', JSON.stringify(result));
      }
    }

    return res.status(200).json({
      status: data.payment_status,
      isConfirmed,
      actuallyPaid: data.actually_paid,
      payCurrency: data.pay_currency,
      orderId: data.order_id,
    });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
