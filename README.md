# Sangre Nómade Adventure · tienda-trekk

Tienda web de **ropa y equipamiento de trekking** (multimarcas). Catálogo en **Firebase Firestore**, checkout por **WhatsApp**. Stack: **Next.js 16**, **React 19**, **Tailwind CSS 4**.

## Requisitos

- **Node.js** ≥ 20.9 ([`.nvmrc`](./.nvmrc) opcional: `20`)
- Cuenta **Firebase** (proyecto con **Firestore**, **Storage** y **Authentication**)
- Opcional: **Vercel** para deploy

## Configuración local

1. Clonar el repo e instalar dependencias:

```bash
npm ci
```

2. Variables de entorno: copiá [`.env.example`](./.env.example) a `.env.local` y completá las claves **públicas** de Firebase (mismo valor que en la consola del proyecto → Configuración del proyecto → Tus apps).

3. **Firestore y Storage:** en [`firestore.rules`](./firestore.rules) y [`storage.rules`](./storage.rules) reemplazá **`tu-correo-admin@gmail.com`** por el **mismo email** con el que vas a crear el usuario administrador. Publicá ambas reglas (Firebase CLI o consola: Firestore → Reglas, Storage → Reglas).

4. **Authentication:** en Firebase Console → **Authentication** → método **Correo/contraseña** (activar) → **Users** → agregar usuario con ese email y una contraseña segura.

5. **Storage:** en la consola, creá el bucket por defecto si el proyecto aún no tiene Storage. Las fotos de producto se guardan bajo la carpeta `productos/`.

6. **Agregar productos desde la web:** en el pie de página, enlace **«Agregar productos al catálogo»** → iniciá sesión con el usuario del paso 4 → elegí **«Enlace público»** (recomendado si no tenés Storage) o **«Subir archivo»** (Firebase Storage). Con enlace: subí la imagen a un servicio gratuito (p. ej. [ImgBB](https://imgbb.com)), copiá la **URL directa** que termine en `.jpg` / `.png` y pegala en el formulario. Con **otro dominio** de imagen, agregalo en [`next.config.ts`](next.config.ts) bajo `images.remotePatterns`.

7. Levantar desarrollo:

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
- `app/components/AdminCatalogoPanel.tsx` — alta de productos con foto (requiere Auth + reglas)
- `app/firebase/config.ts` — inicialización cliente de Firebase
- `public/logo-sangre-nomade.png` — logo de marca

## Licencia

Privado (proyecto del emprendimiento).
