# Sangre Nómade Adventure · tienda-trekk

Tienda web de **ropa y equipamiento de trekking** (multimarcas). Catálogo en **Firebase Firestore**, checkout por **WhatsApp**. Stack: **Next.js 16**, **React 19**, **Tailwind CSS 4**.

## Requisitos

- **Node.js** ≥ 20.9 ([`.nvmrc`](./.nvmrc) opcional: `20`)
- Cuenta **Firebase** (proyecto con Firestore)
- Opcional: **Vercel** para deploy

## Configuración local

1. Clonar el repo e instalar dependencias:

```bash
npm ci
```

2. Variables de entorno: copiá [`.env.example`](./.env.example) a `.env.local` y completá las claves **públicas** de Firebase (mismo valor que en la consola del proyecto → Configuración del proyecto → Tus apps).

3. **Firestore:** publicá las reglas para lectura del catálogo. En el repo está [`firestore.rules`](./firestore.rules); podés desplegarlas con Firebase CLI o pegarlas en la consola.

4. Levantar desarrollo:

```bash
npm run dev
```

Abrí **http://127.0.0.1:3000** (este proyecto usa `--hostname 127.0.0.1`). Más detalles en [`CÓMO-CORRER.md`](./CÓMO-CORRER.md).

## Scripts

| Comando        | Uso                          |
|----------------|------------------------------|
| `npm run dev`  | Servidor de desarrollo       |
| `npm run build`| Build de producción          |
| `npm run start`| Servidor tras `build`        |
| `npm run lint` | ESLint                       |

## Deploy en Vercel

- El proyecto incluye [`vercel.json`](./vercel.json) (`next build` + `npm ci`).
- En Vercel → **Settings → Environment Variables**, cargá las mismas variables que en `.env.local` (ver `.env.example`).
- Conectá el repositorio de GitHub y cada push a `main` puede generar un deploy (según tu configuración).

## Estructura útil

- `app/page.tsx` — UI principal, carrito, catálogo
- `app/firebase/config.ts` — inicialización cliente de Firebase
- `public/logo-sangre-nomade.png` — logo de marca

## Licencia

Privado (proyecto del emprendimiento).
