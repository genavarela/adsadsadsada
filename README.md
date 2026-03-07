# SowyStore — Guía de deploy en Vercel

## Estructura del proyecto

```
sowystore/
├── public/
│   └── index.html        ← tu tienda
├── api/
│   ├── create-payment.js ← crea la factura en NOWPayments
│   ├── check-status.js   ← el frontend consulta si llegó el pago
│   └── webhook.js        ← NOWPayments avisa cuando se confirma
├── vercel.json           ← config de rutas
├── package.json
└── .env.example          ← variables de entorno (copiá como .env.local)
```

---

## Paso 1 — Subir a GitHub

1. Creá un repo en github.com (puede ser privado)
2. En la carpeta del proyecto:
```bash
git init
git add .
git commit -m "SowyStore inicial"
git remote add origin https://github.com/TU_USUARIO/sowystore.git
git push -u origin main
```

---

## Paso 2 — Conectar con Vercel

1. Entrá a vercel.com → "Add New Project"
2. Importá el repo de GitHub que acabás de crear
3. Dejá todo por defecto y hacé clic en "Deploy"
4. Vercel te da una URL tipo: `https://sowystore.vercel.app`

---

## Paso 3 — Configurar variables de entorno en Vercel

1. En Vercel → tu proyecto → **Settings → Environment Variables**
2. Agregá estas 3 variables:

| Variable                  | Valor                              |
|---------------------------|------------------------------------|
| `NOWPAYMENTS_API_KEY`     | Tu API key de NOWPayments          |
| `NOWPAYMENTS_IPN_SECRET`  | Tu IPN Secret de NOWPayments       |
| `SITE_URL`                | `https://tu-tienda.vercel.app`     |

3. Después de agregar las variables → **Redeploy** (Deployments → botón ··· → Redeploy)

---

## Paso 4 — Configurar NOWPayments

1. Entrá a **nowpayments.io** → login
2. Ir a **Store Settings**:
   - **IPN Callback URL**: `https://tu-tienda.vercel.app/api/webhook`
   - Copiá el **IPN Secret** que aparece ahí y pegalo en Vercel
3. Ir a **Account → Currencies → LTC**:
   - Ponés tu dirección de Litecoin personal (de Binance, Trust Wallet, etc.)
   - Esto hace que los pagos lleguen directamente a tu wallet

---

## Paso 5 — Probar con el producto "Prueba" ($0.04)

1. Abrí tu tienda en Vercel
2. Añadí "Prueba" al carrito
3. Checkout → LTC → Pagar
4. Debería aparecer una dirección LTC real y un monto en LTC
5. Si enviás esos LTC, en ~10 segundos el estado cambia a "Confirmado"

---

## Flujo completo

```
Cliente → Checkout LTC
       → /api/create-payment  → NOWPayments crea factura
       → Muestra dirección + monto LTC
       → Frontend polling /api/check-status cada 10 seg
       → Cliente envía LTC
       → NOWPayments detecta → llama /api/webhook
       → Estado cambia a "confirmed"
       → Frontend muestra pantalla de éxito
       → LTC llega a tu wallet automáticamente
```

---

## Notas

- NOWPayments retiene una comisión del 0.5% por pago
- Los pagos expiran a los 20 minutos si el cliente no envía
- Para ver todos los pagos: nowpayments.io → Transactions
- Para desarrollo local: instalá Vercel CLI (`npm i -g vercel`) y corré `vercel dev`
