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

export type PeriodoResumen = "hoy" | "7dias" | "mes" | "historico";

export type FilaInventarioResumen =
  | { tipo: "agotado" | "bajo" | "estable"; product: Product }
  | { tipo: "sin_tope"; count: number };

export type EmbudoEtapaResumen = {
  key: PedidoEstado;
  titulo: string;
  count: number;
  monto: number;
  detalle: string;
  pie: string;
  tono: "naranja" | "verde" | "tenue" | "rojo";
};

export type ResumenOperativo = {
  etiquetaMes: string;
  facturacion: number;
  pedidosRegistrados: number;
  pedidosConfirmados: number;
  deltaPct: number | null;
  ticketPromedio: number;
  deltaTicketPct: number | null;
  unidadesPorCanasta: number;
  logisticaPendientes: number;
  logisticaRecibidos: number;
  logisticaTaller: number;
  pendientesConfirmar: number;
  stockCritico: { name: string; stock: number } | null;
  alertasStock: number;
  itemsTienda: number;
  bajoStock: number;
  agotados: number;
  embudo: EmbudoEtapaResumen[];
  totalLista: number;
  montoNoCancelado: number;
  cantidadActivos: number;
  modificacionPendienteCliente: number;
  clienteConfirmoSinVista: number;
  tasaPasoPct: number | null;
  tasaDesercionPct: number | null;
  horasPromedioTaller: number | null;
  ventana7: { cantidad: number; monto: number };
  ventana30: { cantidad: number; monto: number };
  inventario: FilaInventarioResumen[];
  publicados: number;
  unidadesConTope: number;
  stockControlado: number;
  sinTope: number;
  consejo: string;
};

function capitalizar(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function unidadesPedido(p: Pedido): number {
  return p.items.reduce((s, i) => s + (i.quantity || 0), 0);
}

function pedidosEnPeriodo(pedidos: Pedido[], periodo: PeriodoResumen, now: Date): Pedido[] {
  if (periodo === "historico") return pedidos;
  const tNow = now.getTime();
  const hoy = inicioDelDia(now);
  if (periodo === "hoy") {
    return pedidos.filter((p) => {
      const t = p.createdAt?.getTime();
      return t !== undefined && inicioDelDia(new Date(t)) === hoy;
    });
  }
  if (periodo === "7dias") {
    const desde = tNow - 7 * 86_400_000;
    return pedidos.filter((p) => {
      const t = p.createdAt?.getTime();
      return t !== undefined && t >= desde;
    });
  }
  const desdeMes = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return pedidos.filter((p) => {
    const t = p.createdAt?.getTime();
    return t !== undefined && t >= desdeMes;
  });
}

function pedidosPeriodoAnterior(pedidos: Pedido[], periodo: PeriodoResumen, now: Date): Pedido[] | null {
  if (periodo === "historico") return null;
  const tNow = now.getTime();
  const hoy = inicioDelDia(now);
  if (periodo === "hoy") {
    const ayer = hoy - 86_400_000;
    return pedidos.filter((p) => {
      const t = p.createdAt?.getTime();
      return t !== undefined && inicioDelDia(new Date(t)) === ayer;
    });
  }
  if (periodo === "7dias") {
    const hasta = tNow - 7 * 86_400_000;
    const desde = tNow - 14 * 86_400_000;
    return pedidos.filter((p) => {
      const t = p.createdAt?.getTime();
      return t !== undefined && t >= desde && t < hasta;
    });
  }
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const inicioAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  return pedidos.filter((p) => {
    const t = p.createdAt?.getTime();
    return t !== undefined && t >= inicioAnt && t < inicioMes;
  });
}

function metricasGrupo(lista: Pedido[]) {
  let registrados = lista.length;
  let confirmados = 0;
  let facturacion = 0;
  let unidades = 0;
  for (const p of lista) {
    if (p.status !== "cancelado") {
      confirmados++;
      facturacion += montoPedido(p);
      unidades += unidadesPedido(p);
    }
  }
  return { registrados, confirmados, facturacion, unidades };
}

function horasPromedioTaller(lista: Pedido[]): number | null {
  const now = Date.now();
  const horas: number[] = [];
  for (const p of lista) {
    if (p.status !== "en_preparacion" || !p.createdAt) continue;
    horas.push((now - p.createdAt.getTime()) / 3_600_000);
  }
  if (!horas.length) return null;
  return horas.reduce((a, b) => a + b, 0) / horas.length;
}

export function calcularResumenOperativo(
  pedidos: Pedido[],
  productos: Product[],
  periodo: PeriodoResumen,
  now = new Date()
): ResumenOperativo {
  const enPeriodo = pedidosEnPeriodo(pedidos, periodo, now);
  const anterior = pedidosPeriodoAnterior(pedidos, periodo, now);
  const m = metricasGrupo(enPeriodo);
  const mAnt = anterior ? metricasGrupo(anterior) : null;
  const deltaPct =
    mAnt && mAnt.facturacion > 0
      ? ((m.facturacion - mAnt.facturacion) / mAnt.facturacion) * 100
      : null;

  const porEstado: Record<PedidoEstado, { count: number; monto: number }> = {
    recibido: { count: 0, monto: 0 },
    en_preparacion: { count: 0, monto: 0 },
    enviado: { count: 0, monto: 0 },
    entregado: { count: 0, monto: 0 },
    cancelado: { count: 0, monto: 0 },
  };
  for (const p of enPeriodo) {
    if (p.status in porEstado) {
      porEstado[p.status].count++;
      porEstado[p.status].monto += montoPedido(p);
    }
  }

  const noCancel = m.confirmados;
  const total = m.registrados;
  const avanzados =
    porEstado.en_preparacion.count + porEstado.enviado.count + porEstado.entregado.count;
  const enCursoNoCancel =
    porEstado.recibido.count +
    porEstado.en_preparacion.count +
    porEstado.enviado.count +
    porEstado.entregado.count;
  const tasaPasoPct = enCursoNoCancel > 0 ? (avanzados / enCursoNoCancel) * 100 : null;
  const tasaDesercionPct = total > 0 ? (porEstado.cancelado.count / total) * 100 : null;
  const horasTaller = horasPromedioTaller(enPeriodo);
  const ticketPromedio = m.confirmados > 0 ? m.facturacion / m.confirmados : 0;
  const ticketAnt = mAnt && mAnt.confirmados > 0 ? mAnt.facturacion / mAnt.confirmados : 0;
  const deltaTicketPct = ticketAnt > 0 ? ((ticketPromedio - ticketAnt) / ticketAnt) * 100 : null;

  const stock = calcularResumenStock(productos);
  const vivos = pedidos.filter((p) => p.status === "recibido" || p.status === "en_preparacion");
  const resumenPed = calcularResumenPedidos(pedidos);

  const agotados = productos.filter(productoSinStock);
  const bajos = productos.filter(
    (p) => stockTieneLimite(p) && !productoSinStock(p) && (p.stock as number) <= UMBRAL_BAJO_STOCK
  );
  const estables = productos.filter(
    (p) => stockTieneLimite(p) && (p.stock as number) > UMBRAL_BAJO_STOCK
  );
  const sinTopeProds = productos.filter((p) => !stockTieneLimite(p));

  const inventario: FilaInventarioResumen[] = [
    ...agotados.map((product) => ({ tipo: "agotado" as const, product })),
    ...bajos.map((product) => ({ tipo: "bajo" as const, product })),
    ...estables.slice(0, 1).map((product) => ({ tipo: "estable" as const, product })),
  ];
  if (sinTopeProds.length > 0) {
    inventario.push({ tipo: "sin_tope", count: sinTopeProds.length });
  }

  const stockCritico = stock.criticos[0] ?? null;
  let consejo =
    "El catálogo está estable. Actualizá el inventario cuando cambie lo que hay en el depósito.";
  if (stock.agotados > 0) {
    consejo = `Hay ${stock.agotados} producto${stock.agotados === 1 ? "" : "s"} en cero. Ingresá stock para no frenar el checkout.`;
  } else if (stock.bajoStock > 0) {
    consejo = `Hay ${stock.bajoStock} producto${stock.bajoStock === 1 ? "" : "s"} con stock bajo (1–5 u.). Conviene reponer antes del fin de semana.`;
  }

  const embudo: EmbudoEtapaResumen[] = [
    {
      key: "recibido",
      titulo: "1. Recibido",
      count: porEstado.recibido.count,
      monto: porEstado.recibido.monto,
      detalle:
        porEstado.recibido.count === 0
          ? "Sin pedidos nuevos en este período."
          : "Pedidos nuevos listos para armar.",
      pie:
        tasaPasoPct === null
          ? "Sin tasa de paso"
          : `Tasa de paso: ${Math.round(tasaPasoPct)}%`,
      tono: "naranja",
    },
    {
      key: "en_preparacion",
      titulo: "2. En taller",
      count: porEstado.en_preparacion.count,
      monto: porEstado.en_preparacion.monto,
      detalle: "Armado del paquete y control antes de despachar.",
      pie:
        horasTaller === null
          ? "Sin tiempo promedio"
          : `Tiempo prom: ${horasTaller.toFixed(1)}h`,
      tono: "naranja",
    },
    {
      key: "enviado",
      titulo: "3. Enviado",
      count: porEstado.enviado.count,
      monto: porEstado.enviado.monto,
      detalle: "En camino al destinatario.",
      pie: porEstado.enviado.count > 0 ? "En tránsito" : "Sin envíos",
      tono: "verde",
    },
    {
      key: "entregado",
      titulo: "4. Entregado",
      count: porEstado.entregado.count,
      monto: porEstado.entregado.monto,
      detalle: "Destino confirmado por el destinatario.",
      pie: `Ciclo: ${porEstado.entregado.count} u.`,
      tono: "tenue",
    },
    {
      key: "cancelado",
      titulo: "Cancelados",
      count: porEstado.cancelado.count,
      monto: porEstado.cancelado.monto,
      detalle:
        porEstado.cancelado.count === 0
          ? "Sin cancelaciones en este período."
          : "Pedidos cancelados o rechazados.",
      pie:
        tasaDesercionPct === null
          ? "Sin tasa de deserción"
          : `Tasa de deserción: ${Math.round(tasaDesercionPct)}%`,
      tono: "rojo",
    },
  ];

  return {
    etiquetaMes: capitalizar(now.toLocaleDateString("es-AR", { month: "long" })),
    facturacion: m.facturacion,
    pedidosRegistrados: m.registrados,
    pedidosConfirmados: m.confirmados,
    deltaPct,
    ticketPromedio,
    deltaTicketPct,
    unidadesPorCanasta: m.confirmados > 0 ? m.unidades / m.confirmados : 0,
    logisticaPendientes: vivos.length,
    logisticaRecibidos: pedidos.filter((p) => p.status === "recibido").length,
    logisticaTaller: pedidos.filter((p) => p.status === "en_preparacion").length,
    pendientesConfirmar: resumenPed.modificacionPendienteCliente,
    stockCritico,
    alertasStock: stock.agotados + stock.bajoStock,
    itemsTienda: stock.totalProductos,
    bajoStock: stock.bajoStock,
    agotados: stock.agotados,
    embudo,
    totalLista: enPeriodo.length,
    montoNoCancelado: m.facturacion,
    cantidadActivos: noCancel,
    modificacionPendienteCliente: resumenPed.modificacionPendienteCliente,
    clienteConfirmoSinVista: resumenPed.clienteConfirmoSinVista,
    tasaPasoPct,
    tasaDesercionPct,
    horasPromedioTaller: horasTaller,
    ventana7: resumenPed.enVentana(7),
    ventana30: resumenPed.enVentana(30),
    inventario,
    publicados: stock.totalProductos,
    unidadesConTope: stock.conLimite.unidades,
    stockControlado: stock.conLimite.productos,
    sinTope: stock.sinLimite,
    consejo,
  };
}

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
