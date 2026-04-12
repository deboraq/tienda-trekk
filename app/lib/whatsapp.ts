/** Número de la tienda (solo dígitos, formato wa.me). */
export const WHATSAPP_NUMERO_TIENDA = "5493515416836";

/** Mensaje prellenado: botón flotante, asesoramiento, etc. */
export const MENSAJE_WHATSAPP_CONSULTA_GENERAL =
  "¡Hola Sangre Nómade! Tengo una consulta sobre...";

/**
 * Normaliza a dígitos para wa.me (Argentina).
 * Acepta +54 9 351 …, 9 351 …, 351 … sin prefijo, etc.
 */
export function normalizarTelefonoWa(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10 || d.length > 15) return null;
  if (d.startsWith("54")) return d.length >= 12 ? d : null;
  if (d.startsWith("9") && d.length >= 10) return `54${d}`;
  if (d.length === 10) return `549${d}`;
  if (d.length === 11 && d.startsWith("15")) return `549${d.slice(2)}`;
  return `54${d}`;
}

export function construirMensajeWhatsAppPedidoCliente(opts: {
  pedidoId: string;
  items: { name: string; quantity: number }[];
  total: number;
  /** Si true, aclara que hubo ajuste (cuando edites el pedido en el panel). */
  pedidoActualizado?: boolean;
}): string {
  const lineas = opts.items
    .map((i) => `• ${i.name} ×${i.quantity}`)
    .join("\n");
  const ref = opts.pedidoId.length > 12 ? `${opts.pedidoId.slice(0, 8)}…` : opts.pedidoId;
  const avisoActualizado = opts.pedidoActualizado
    ? "\n_Actualizamos el pedido respecto al pedido original._\n"
    : "\n";
  return (
    `¡Hola! Te escribimos desde *Sangre Nómade Adventure*.${avisoActualizado}` +
    `*Tu pedido* (ref: \`${ref}\`):\n${lineas}\n\n` +
    `*Total estimado:* $${opts.total.toLocaleString("es-AR")}\n\n` +
    `Por favor confirmame si te sirve así o escribinos cualquier duda. ¡Gracias!`
  );
}

export function urlWhatsAppParaNumero(telefonoDigitos: string, mensaje: string): string {
  return `https://wa.me/${telefonoDigitos}?text=${encodeURIComponent(mensaje)}`;
}

export function urlWhatsAppTiendaConsultaGeneral(): string {
  return urlWhatsAppParaNumero(
    WHATSAPP_NUMERO_TIENDA,
    MENSAJE_WHATSAPP_CONSULTA_GENERAL
  );
}
