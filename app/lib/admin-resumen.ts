import type { Pedido, PedidoEstado, Product } from "../types";
import {
  pedidoClienteConfirmoNoVistoPorAdmin,
  pedidoTieneConfirmacionPendienteCliente,
} from "./pedidos";
import { productoSinStock, stockTieneLimite } from "./product-stock";

const UMBRAL_BAJO_STOCK = 5;

export type ResumenPedidosAdmin = {
  totalEnLista: number;
  porEstado: Record<PedidoEstado, number>;
  montoPedidosActivos: number;
  /** Pedidos no cancelados (incluye recibido… entregado). */
  cantidadActivos: number;
  modificacionPendienteCliente: number;
  clienteConfirmoSinVista: number;
  /** Pedidos creados en los últimos `dias` días. */
  enVentana: (dias: number) => { cantidad: number; monto: number };
};

export type ResumenStockAdmin = {
  totalProductos: number;
  conLimite: { productos: number; unidades: number };
  sinLimite: number;
  agotados: number;
  bajoStock: number;
  /** Nombre + stock (solo con límite). */
  criticos: { name: string; stock: number }[];
};

function montoPedido(p: Pedido): number {
  return typeof p.total === "number" && Number.isFinite(p.total) ? p.total : 0;
}

export function calcularResumenPedidos(pedidos: Pedido[]): ResumenPedidosAdmin {
  const porEstado = {
    recibido: 0,
    en_preparacion: 0,
    enviado: 0,
    entregado: 0,
    cancelado: 0,
  } satisfies Record<PedidoEstado, number>;

  let montoPedidosActivos = 0;
  let cantidadActivos = 0;

  for (const p of pedidos) {
    const st = p.status;
    if (st in porEstado) {
      porEstado[st as PedidoEstado]++;
    }
    if (st !== "cancelado") {
      cantidadActivos++;
      montoPedidosActivos += montoPedido(p);
    }
  }

  const modificacionPendienteCliente = pedidos.filter(
    pedidoTieneConfirmacionPendienteCliente
  ).length;
  const clienteConfirmoSinVista = pedidos.filter(
    pedidoClienteConfirmoNoVistoPorAdmin
  ).length;

  const enVentana = (dias: number) => {
    const ms = dias * 24 * 60 * 60 * 1000;
    const desde = Date.now() - ms;
    let cantidad = 0;
    let monto = 0;
    for (const p of pedidos) {
      const t = p.createdAt?.getTime();
      if (t === undefined || Number.isNaN(t) || t < desde) continue;
      cantidad++;
      if (p.status !== "cancelado") monto += montoPedido(p);
    }
    return { cantidad, monto };
  };

  return {
    totalEnLista: pedidos.length,
    porEstado,
    montoPedidosActivos,
    cantidadActivos,
    modificacionPendienteCliente,
    clienteConfirmoSinVista,
    enVentana,
  };
}

export function calcularResumenStock(productos: Product[]): ResumenStockAdmin {
  let conLimite = 0;
  let unidades = 0;
  let sinLimite = 0;
  let agotados = 0;
  let bajoStock = 0;
  const criticos: { name: string; stock: number }[] = [];

  for (const p of productos) {
    if (stockTieneLimite(p)) {
      conLimite++;
      const s = p.stock as number;
      unidades += s;
      if (productoSinStock(p)) {
        agotados++;
        criticos.push({ name: p.name, stock: s });
      } else if (s > 0 && s <= UMBRAL_BAJO_STOCK) {
        bajoStock++;
        criticos.push({ name: p.name, stock: s });
      }
    } else {
      sinLimite++;
    }
  }

  criticos.sort((a, b) => a.stock - b.stock);

  return {
    totalProductos: productos.length,
    conLimite: { productos: conLimite, unidades },
    sinLimite,
    agotados,
    bajoStock,
    criticos: criticos.slice(0, 12),
  };
}

function inicioDelDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function montoPedidoSafe(p: Pedido): number {
  return typeof p.total === "number" && Number.isFinite(p.total) ? p.total : 0;
}

export type KpisAdminDia = {
  ingresosHoy: number;
  ingresosAyer: number;
  deltaPctVsAyer: number | null;
  ticketPromedioHoy: number;
  confirmadosHoy: number;
  aDespachar: number;
  minutosArmadoEst: number;
  visitasNoMedidas: true;
};

export function calcularKpisAdminDia(pedidos: Pedido[]): KpisAdminDia {
  const hoy = inicioDelDia(new Date());
  const ayer = hoy - 86_400_000;
  const activosHoy = pedidos.filter((p) => {
    const t = p.createdAt?.getTime();
    return t !== undefined && inicioDelDia(new Date(t)) === hoy && p.status !== "cancelado";
  });
  const activosAyer = pedidos.filter((p) => {
    const t = p.createdAt?.getTime();
    return t !== undefined && inicioDelDia(new Date(t)) === ayer && p.status !== "cancelado";
  });
  const ingresosHoy = activosHoy.reduce((s, p) => s + montoPedidoSafe(p), 0);
  const ingresosAyer = activosAyer.reduce((s, p) => s + montoPedidoSafe(p), 0);
  const deltaPctVsAyer =
    ingresosAyer > 0 ? ((ingresosHoy - ingresosAyer) / ingresosAyer) * 100 : null;
  const aDespachar = pedidos.filter(
    (p) => p.status === "recibido" || p.status === "en_preparacion"
  ).length;
  return {
    ingresosHoy,
    ingresosAyer,
    deltaPctVsAyer,
    ticketPromedioHoy: activosHoy.length ? ingresosHoy / activosHoy.length : 0,
    confirmadosHoy: activosHoy.length,
    aDespachar,
    minutosArmadoEst: aDespachar * 20,
    visitasNoMedidas: true,
  };
}

export type FiltroEstadoPedidos =
  | "todos"
  | "nuevos"
  | PedidoEstado;

export type FiltroPeriodoPedidos = "todos" | "hoy" | "7d" | "mes";

export function filtrarPedidosAdmin(
  pedidos: Pedido[],
  opts: {
    busqueda: string;
    estado: FiltroEstadoPedidos;
    periodo: FiltroPeriodoPedidos;
  }
): Pedido[] {
  const q = opts.busqueda.trim().toLowerCase();
  const ahora = Date.now();
  const hoy = inicioDelDia(new Date());
  return pedidos.filter((p) => {
    if (opts.estado === "nuevos") {
      if (p.status !== "recibido") return false;
    } else if (opts.estado !== "todos" && p.status !== opts.estado) {
      return false;
    }
    if (opts.periodo === "hoy") {
      const t = p.createdAt?.getTime();
      if (t === undefined || inicioDelDia(new Date(t)) !== hoy) return false;
    } else if (opts.periodo === "7d") {
      const t = p.createdAt?.getTime();
      if (t === undefined || t < ahora - 7 * 86_400_000) return false;
    } else if (opts.periodo === "mes") {
      const t = p.createdAt?.getTime();
      if (t === undefined || t < ahora - 30 * 86_400_000) return false;
    }
    if (!q) return true;
    const hay = [
      p.id,
      p.userEmail,
      p.clientPhone ?? "",
      ...p.items.map((i) => i.name),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
