// api/create-payment.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, orderId, productName, customerEmail } = req.body;

  if (!amount || !orderId || !productName || !customerEmail) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  // Codificamos producto y email en el order_id para recuperarlos en el webhook
  // Formato: "ORD-XXXXX|NombreProducto|email@cliente.com"
  const fullOrderId = `${orderId}|${productName}|${customerEmail}`;

  try {
    const response = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NOWPAYMENTS_API_KEY,
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',
        pay_currency: 'ltc',
        order_id: fullOrderId,
        order_description: `SowyStore — ${productName}`,
        ipn_callback_url: `${process.env.SITE_URL}/api/webhook`,
        success_url: `${process.env.SITE_URL}/?success=1`,
        cancel_url: `${process.env.SITE_URL}/?cancel=1`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('NOWPayments error:', data);
      return res.status(500).json({ error: 'Error al crear el pago', detail: data });
    }

    return res.status(200).json({
      paymentId: data.payment_id,
      payAddress: data.pay_address,
      payAmount: data.pay_amount,
      payCurrency: data.pay_currency,
      orderId: data.order_id,
      status: data.payment_status,
    });

  } catch (err) {
    console.error('Error interno:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
