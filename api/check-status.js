// api/check-status.js
// El frontend llama a este endpoint cada 10 segundos para saber si el pago llegó
// Devuelve el estado del pago

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentId } = req.query;

  if (!paymentId) {
    return res.status(400).json({ error: 'Falta paymentId' });
  }

  try {
    const response = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
      headers: {
        'x-api-key': process.env.NOWPAYMENTS_API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'Error al consultar el pago', detail: data });
    }

    // Estados posibles de NOWPayments:
    // waiting        → esperando que el cliente envíe
    // confirming     → transacción detectada, esperando confirmaciones
    // confirmed      → confirmado (2+ confirmaciones) ✅
    // sending        → procesando envío a tu wallet
    // finished       → completado ✅
    // failed         → falló
    // refunded       → reembolsado
    // expired        → expiró (20 min sin pago)

    const isConfirmed = ['confirmed', 'finished', 'sending'].includes(data.payment_status);

    return res.status(200).json({
      status: data.payment_status,
      isConfirmed,
      actuallyPaid: data.actually_paid,
      payCurrency: data.pay_currency,
      orderId: data.order_id,
    });

  } catch (err) {
    console.error('Error interno:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
