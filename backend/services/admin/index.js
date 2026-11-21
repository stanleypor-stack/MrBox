/**
 * LO QUE HACE EL PANEL.
 *
 * Acá vive lo que el panel puede CAMBIAR. Lo que solo lee --listas,
 * números-- está en las rutas, porque es una consulta y nada más.
 *
 * TODO LO QUE CAMBIA ALGO DEJA RASTRO
 *
 * Cada función de este archivo escribe en `AdminLog`: quién, qué, sobre
 * quién, el antes y el después. Sin eso, "¿quién le puso SC 5.000 a
 * esta cuenta?" no tiene respuesta, y el día que haya que preguntarlo
 * va a ser un día malo.
 */

const AdminLog = require("../../database/models/AdminLog");
const SessionEvent = require("../../database/models/SessionEvent");
const User = require("../../database/models/User");
const Box = require("../../database/models/Box");
const Order = require("../../database/models/Order");
const InventoryItem = require("../../database/models/InventoryItem");

const wallet = require("../wallet");
const kyc = require("../verification");
const { sc } = require("../../utils/money");
const avisos = require("../notificaciones");
const { errorDe } = require("../../utils/errors");

/** Deja la marca. Se llama desde todo lo de abajo. */
async function anotar({ admin, evento, sobre, antes, despues, motivo, req }) {
  return AdminLog.create({
    admin: admin._id,
    adminNombre: admin.username,
    evento,
    sobre: sobre || {},
    antes: antes === undefined ? null : antes,
    despues: despues === undefined ? null : despues,
    motivo: String(motivo || "").slice(0, 300),
    desde: req ? SessionEvent.recortarIp(req.ip) : "",
  });
}

/* ── La plata de un jugador ───────────────────────────────────────── */

/**
 * AJUSTAR UN SALDO A MANO.
 *
 * Lo más delicado del panel. Por eso:
 *
 *   - el motivo es OBLIGATORIO y va en el libro, no solo en el registro
 *   - pasa por `wallet.mover`, como cualquier otro movimiento: no hay
 *     una puerta de atrás que escriba el saldo directo
 *   - queda como `manual`, que se ve distinto en el extracto del
 *     jugador: si le aparece plata de la nada, tiene que poder leer
 *     por qué
 */
async function ajustarSaldo({ admin, userId, montoSc, motivo, req }) {
  const razon = String(motivo || "").trim();
  if (razon.length < 3) throw errorDe("REASON_REQUIRED");

  const monto = sc(montoSc);
  if (!Number.isFinite(monto) || monto === 0) throw errorDe("INVALID_AMOUNT", { campo: "monto" });

  const antes = await wallet.saldoDe(userId);

  const r = await wallet.mover({
    userId,
    amountSc: monto,
    type: "manual",
    byAdmin: admin._id,
    reason: razon,
    reference: { kind: "admin", id: admin._id, label: admin.username },
  });

  const despues = await wallet.saldoDe(userId);
  const quien = await User.findById(userId).select("username").lean();

  await anotar({
    admin,
    evento: "balance.adjust",
    sobre: { tipo: "user", id: userId, nombre: quien ? quien.username : "" },
    antes: { balanceSc: antes.balanceSc },
    despues: { balanceSc: despues.balanceSc },
    motivo: razon,
    req,
  });

  return { ...r, ...despues };
}

/**
 * CERRAR O REABRIR UNA CUENTA.
 *
 * Cerrada, no entra ni con el token que tenga: lo revisa `autorizar` en
 * cada pedido. No se le toca el saldo: lo que tiene sigue siendo suyo,
 * y si el cierre fue un error se reabre y queda como estaba.
 */
async function cerrarCuenta({ admin, userId, cerrar, motivo, req }) {
  const razon = String(motivo || "").trim();
  if (cerrar && razon.length < 3) throw errorDe("REASON_REQUIRED");

  const antes = await User.findById(userId).select("username banned").lean();
  if (!antes) throw errorDe("ITEM_NOT_FOUND", {}, 404);

  /* Nadie se cierra la cuenta a sí mismo desde el panel: es la forma
     más rápida de quedarse sin panel. */
  if (String(userId) === String(admin._id)) throw errorDe("NOT_ON_YOURSELF");

  await User.updateOne({ _id: userId }, { $set: { banned: !!cerrar } });

  await anotar({
    admin,
    evento: cerrar ? "user.ban" : "user.unban",
    sobre: { tipo: "user", id: userId, nombre: antes.username },
    antes: { banned: !!antes.banned },
    despues: { banned: !!cerrar },
    motivo: razon,
    req,
  });

  return { banned: !!cerrar };
}

/* ── Las cajas ────────────────────────────────────────────────────── */

/** Prender o apagar una caja. */
async function publicarCaja({ admin, boxId, live, req }) {
  const caja = await Box.findById(boxId).select("name slug live").lean();
  if (!caja) throw errorDe("BOX_NOT_FOUND", {}, 404);

  await Box.updateOne({ _id: boxId }, { $set: { live: !!live } });

  await anotar({
    admin,
    evento: live ? "box.publish" : "box.unpublish",
    sobre: { tipo: "box", id: boxId, nombre: caja.name },
    antes: { live: !!caja.live },
    despues: { live: !!live },
    req,
  });

  return { live: !!live };
}

/**
 * APROBAR O RECHAZAR UNA CAJA DE LA COMUNIDAD.
 *
 * Aprobar la pone al aire. Rechazar guarda el motivo, que es lo que el
 * creador va a leer: "no" sin motivo lo único que logra es que la
 * mande de nuevo igual.
 */
async function revisarCajaDeComunidad({ admin, boxId, aprobar, motivo, req }) {
  const caja = await Box.findById(boxId).select("name creator approvalState live").lean();
  if (!caja) throw errorDe("BOX_NOT_FOUND", {}, 404);
  if (!caja.creator) throw errorDe("BOX_NOT_FOUND", {}, 404);

  const razon = String(motivo || "").trim();
  if (!aprobar && razon.length < 3) throw errorDe("REASON_REQUIRED");

  await Box.updateOne({ _id: boxId }, {
    $set: {
      approvalState: aprobar ? "approved" : "rejected",
      live: !!aprobar,
      motivoDelRechazo: aprobar ? "" : razon,
    },
  });

  await anotar({
    admin,
    evento: aprobar ? "community.approve" : "community.reject",
    sobre: { tipo: "box", id: boxId, nombre: caja.name },
    antes: { approvalState: caja.approvalState, live: !!caja.live },
    despues: { approvalState: aprobar ? "approved" : "rejected", live: !!aprobar },
    motivo: razon,
    req,
  });

  return { approvalState: aprobar ? "approved" : "rejected", live: !!aprobar };
}

/* ── Los pedidos ──────────────────────────────────────────────────── */

const PASOS = ["pending", "packing", "shipped", "delivered", "cancelled"];

/**
 * MOVER UN PEDIDO DE ESTADO.
 *
 * `shipped` pide transportista y seguimiento: un pedido despachado sin
 * número es un pedido que el jugador no puede seguir, y entonces
 * escribe a soporte.
 *
 * `cancelled` devuelve los objetos al inventario. Si no, el jugador se
 * queda sin el objeto Y sin el paquete.
 */
async function moverPedido({ admin, orderId, estado, transportista, seguimiento, motivo, req }) {
  if (!PASOS.includes(estado)) throw errorDe("INVALID_AMOUNT", { campo: "estado" });

  const pedido = await Order.findById(orderId);
  if (!pedido) throw errorDe("ITEM_NOT_FOUND", {}, 404);

  const antes = pedido.estado;

  if (estado === "shipped") {
    const quien = String(transportista || "").trim();
    const numero = String(seguimiento || "").trim();
    if (!quien || !numero) throw errorDe("TRACKING_REQUIRED");
    pedido.transportista = quien.slice(0, 80);
    pedido.seguimiento = numero.slice(0, 80);
    pedido.despachadoEl = new Date();
  }

  if (estado === "delivered") pedido.entregadoEl = new Date();

  if (estado === "cancelled") {
    const razon = String(motivo || "").trim();
    if (razon.length < 3) throw errorDe("REASON_REQUIRED");
    pedido.motivo = razon.slice(0, 300);

    /* Los objetos vuelven al inventario. Solo los que siguen atados a
       ESTE pedido: si uno ya se devolvió por otro camino, no se toca. */
    await InventoryItem.updateMany(
      { order: pedido._id, state: "requested" },
      { $set: { state: "held", order: null } }
    );
  }

  pedido.estado = estado;
  await pedido.save();

  /*
    AL JUGADOR SOLO SE LE AVISA CUANDO SALE.

    "Preparando" y "entregado" los mira en sus pedidos; el unico
    momento en que la campanita le sirve es cuando el paquete se fue y
    hay un numero de seguimiento para mirar.
  */
  if (estado === "shipped") {
    await avisos.avisar({
      userId: pedido.user,
      tipo: "envio",
      clave: "notif.shipped",
      datos: { transportista: pedido.transportista, seguimiento: pedido.seguimiento },
      destino: "/profile?tab=pedidos",
    });
  }

  await anotar({
    admin,
    evento: `order.${estado}`,
    sobre: { tipo: "order", id: pedido._id, nombre: String(pedido._id).slice(-6).toUpperCase() },
    antes: { estado: antes },
    despues: { estado, transportista: pedido.transportista, seguimiento: pedido.seguimiento },
    motivo: pedido.motivo,
    req,
  });

  return { estado, transportista: pedido.transportista, seguimiento: pedido.seguimiento };
}

/* ── La verificación ──────────────────────────────────────────────── */

async function revisarVerificacion({ admin, userId, nivel, aprobar, motivo, req }) {
  const razon = String(motivo || "").trim();
  if (!aprobar && razon.length < 3) throw errorDe("REASON_REQUIRED");

  const quien = await User.findById(userId).select("username verificationLevel").lean();
  if (!quien) throw errorDe("ITEM_NOT_FOUND", {}, 404);

  const r = await kyc.resolver({ adminId: admin._id, userId, nivel, aprobar, motivo: razon });

  await anotar({
    admin,
    evento: aprobar ? "kyc.approve" : "kyc.reject",
    sobre: { tipo: "user", id: userId, nombre: quien.username },
    antes: { nivel: quien.verificationLevel },
    despues: { nivel: r.nivelActual },
    motivo: razon,
    req,
  });

  return r;
}

module.exports = {
  anotar,
  ajustarSaldo,
  cerrarCuenta,
  publicarCaja,
  revisarCajaDeComunidad,
  moverPedido,
  revisarVerificacion,
  PASOS,
};
