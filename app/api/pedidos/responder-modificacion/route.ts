import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  adminInventarioDisponible,
  getAdminFirestore,
  getFirebaseAdminApp,
} from "@/app/lib/firebase-admin-server";
import { rechazarModificacionPedidoCliente } from "@/app/lib/pedido-inventario-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    if (!token) {
      return NextResponse.json({ error: "Falta el token de sesión." }, { status: 401 });
    }

    if (!adminInventarioDisponible()) {
      return NextResponse.json(
        {
          error:
            "El servidor no tiene configurado FIREBASE_SERVICE_ACCOUNT_JSON. Para rechazar desde la web, agregá la cuenta de servicio en el hosting (Variables de entorno) o avisá a la tienda por WhatsApp.",
        },
        { status: 503 }
      );
    }

    getFirebaseAdminApp();
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const body = (await req.json()) as { pedidoId?: string };
    const pedidoId = body.pedidoId?.trim();

    if (!pedidoId) {
      return NextResponse.json({ error: "Falta el pedido." }, { status: 400 });
    }

    const db = getAdminFirestore();
    const res = await rechazarModificacionPedidoCliente(db, pedidoId, uid);
    if (!res.ok) {
      return NextResponse.json({ error: res.mensaje }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error del servidor.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
