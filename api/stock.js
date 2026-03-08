// api/stock.js
// GET  /api/stock          → conteo de stock por producto (público, para la tienda)
// GET  /api/stock?admin=1  → lista completa con credenciales (requiere ADMIN_TOKEN)
// POST /api/stock          → agregar cuentas (requiere ADMIN_TOKEN)
// DELETE /api/stock?id=X   → eliminar cuenta (requiere ADMIN_TOKEN)

const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SUPABASE_KEY = () => process.env.SUPABASE_SERVICE_KEY;

function checkAdmin(req) {
  const token = req.headers['x-admin-token'];
  return token === process.env.ADMIN_TOKEN;
}

export default async function handler(req, res) {
  // ── GET ──
  if (req.method === 'GET') {
    const isAdmin = req.query.admin === '1' && checkAdmin(req);

    if (isAdmin) {
      // Admin: devolver todo el stock con credenciales
      const r = await fetch(
        `${SUPABASE_URL()}/rest/v1/stock?order=created_at.desc`,
        { headers: { apikey: SUPABASE_KEY(), Authorization: `Bearer ${SUPABASE_KEY()}` } }
      );
      return res.status(200).json(await r.json());
    } else {
      // Público: solo conteo disponible por producto
      const r = await fetch(
        `${SUPABASE_URL()}/rest/v1/stock?delivered=eq.false&select=product`,
        { headers: { apikey: SUPABASE_KEY(), Authorization: `Bearer ${SUPABASE_KEY()}` } }
      );
      const items = await r.json();
      const counts = {};
      items.forEach(i => { counts[i.product] = (counts[i.product] || 0) + 1; });
      return res.status(200).json(counts);
    }
  }

  // ── POST — agregar cuentas ──
  if (req.method === 'POST') {
    if (!checkAdmin(req)) return res.status(401).json({ error: 'No autorizado' });

    const { product, credentials } = req.body;
    if (!product || !credentials) return res.status(400).json({ error: 'Faltan datos' });

    // credentials puede ser un array (bulk) o un objeto (single)
    const items = Array.isArray(credentials)
      ? credentials.map(c => ({ product, credentials: c }))
      : [{ product, credentials }];

    const r = await fetch(`${SUPABASE_URL()}/rest/v1/stock`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY(),
        Authorization: `Bearer ${SUPABASE_KEY()}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(items),
    });
    return res.status(200).json(await r.json());
  }

  // ── DELETE — eliminar cuenta ──
  if (req.method === 'DELETE') {
    if (!checkAdmin(req)) return res.status(401).json({ error: 'No autorizado' });

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Falta id' });

    await fetch(`${SUPABASE_URL()}/rest/v1/stock?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY(), Authorization: `Bearer ${SUPABASE_KEY()}` },
    });
    return res.status(200).json({ deleted: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
