// api/create-payment.js
// Llamado desde el frontend al confirmar pago con LTC
// Crea una factura en NOWPayments y devuelve la dirección + monto

export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, orderId, customerEmail } = req.body;

  if (!amount || !orderId) {
    return res.status(400).json({ error: 'Faltan datos: amount y orderId son requeridos' });
  }

  try {
    const response = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NOWPAYMENTS_API_KEY, // ← tu API key en variables de Vercel
      },
      body: JSON.stringify({
        price_amount: amount,           // monto en USD
        price_currency: 'usd',
        pay_currency: 'ltc',            // cobrar en LTC
        order_id: orderId,
        order_description: `SowyStore - Orden ${orderId}`,
        ipn_callback_url: `${process.env.SITE_URL}/api/webhook`, // URL de tu tienda
        success_url: `${process.env.SITE_URL}/?success=1`,
        cancel_url: `${process.env.SITE_URL}/?cancel=1`,
        // Si querés que el pago llegue a tu wallet personal (Litecoin address):
        // Configurá el "payout wallet" en el dashboard de NOWPayments
        // en: Account → Currencies → LTC → Destination address
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('NOWPayments error:', data);
      return res.status(500).json({ error: 'Error al crear el pago', detail: data });
    }

    // Devolver al frontend lo que necesita mostrar
    return res.status(200).json({
      paymentId: data.payment_id,
      payAddress: data.pay_address,       // dirección LTC donde el cliente envía
      payAmount: data.pay_amount,         // monto exacto en LTC
      payCurrency: data.pay_currency,
      orderId: data.order_id,
      status: data.payment_status,
      expiresAt: data.expiration_estimate_date,
    });

  } catch (err) {
    console.error('Error interno:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
