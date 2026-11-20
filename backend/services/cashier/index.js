const Redemption = require("../../database/models/Redemption");
const Settings = require("../../database/models/Settings");
const User = require("../../database/models/User");
const wallet = require("../wallet");
const { MONEDAS, buscar } = require("./monedas");
const oxapay = require("./oxapay");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

/**
 * LA CAJA: PLATA QUE ENTRA Y PLATA QUE SALE.
 *
 * Comprar SC y canjearlos. Las dos puntas pasan por OxaPay, que es la
 * pasarela que eligió Dani.
 *
 * DEPOSITAR NO INVENTA UNA DIRECCION
 *
 * La dirección de depósito la da la pasarela. Si la pasarela no está
 * conectada, esto devuelve "no hay" y la pantalla lo dice: NUNCA una
 * dirección de mentira. Alguien podría mandarle plata de verdad.
 *
 * CANJEAR SE PIDE, NO SE COBRA SOLO
 *
 * El saldo se descuenta al pedir --si no, diez pedidos del mismo saldo
 * se podrían cobrar todos-- y el pago lo hace una persona desde el
 * panel. Rechazar devuelve el saldo.
 */

/** La lista de monedas, como la dibuja la pantalla. */
function monedas() {
  return MONEDAS.map((m) => ({
    nombre: m.nombre,
    ticker: m.ticker,
    color: m.color,
    letra: m.letra,
    redes: m.redes,
  }));
}

/* ── Depositar ─────────────────────────────────────────────────────── */

/**
 * Una dirección para que el jugador mande cripto.
 *
 * Devuelve `{ conectada: false }` mientras la pasarela no esté
 * configurada, y la pantalla muestra el cartel en vez de un QR.
 */
async function direccionDeDeposito({ userId, ticker, red }) {
  const par = buscar(ticker, red);
  if (!par) throw errorDe("NOT_FOUND", { ticker, red });

  /*
    EL MINIMO DE LA CADENA, QUE NO ES EL NUESTRO.

    `canjeMinimoSc` son nuestros 50 dolares. `retiroMinimo` es lo que la
    red exige para mover esa moneda, en unidades de la moneda. Estaba
    en la lista y no lo miraba nadie: la pantalla lo mostraba y el
    servidor lo ignoraba, asi que un canje por debajo del minimo salia
    de acá y lo rebotaba la pasarela, con el saldo ya descontado.
  */
  const piso = Number(par.red.retiroMinimo) || 0;
  if (piso > 0) {
    try {
      const { cuanto } = await oxapay.aMoneda(monto, par.moneda.ticker);
      if (cuanto < piso) {
        throw errorDe("BELOW_MINIMUM", {
          minimoSc: sc(cfg.canjeMinimoSc),
          minimoDeLaRed: piso,
          ticker: par.moneda.ticker,
        });
      }
    } catch (err) {
      /* Si lo que fallo es la cotizacion, se deja pasar: el canje nace
         pendiente y la conversion se vuelve a hacer al pagar, que es
         donde de verdad importa. Lo que no se hace es inventar. */
      if (err && err.code) throw err;
      logger.warn(`[cashier] sin cotizacion para el minimo de ${par.moneda.ticker}: ${err.message}`);
    }
  }

  if (!oxapay.configurada()) {
    return {
      conectada: false,
      moneda: par.moneda.ticker,
      red: par.red.clave,
      confirmaciones: par.red.confirmaciones,
      demora: par.red.demora,
    };
  }

  const direccion = await oxapay.direccionDeDeposito({
    userId,
    ticker: par.moneda.ticker,
    red: par.red.clave,
  });

  return {
    conectada: true,
    direccion: direccion.address,
    memo: direccion.memo || "",
    vence: direccion.expiresAt || null,
    moneda: par.moneda.ticker,
    red: par.red.clave,
    confirmaciones: par.red.confirmaciones,
    demora: par.red.demora,
  };
}

/* ── Canjear ───────────────────────────────────────────────────────── */

/**
 * Lo que la pantalla de canje necesita saber antes de que escriban nada.
 *
 * El mínimo, lo que se puede sacar y qué falta --verificación, bono sin
 * jugar-- porque enterarse DESPUES de escribir el monto y la dirección
 * es la peor forma de enterarse.
 */
async function antesDeCanjear(user) {
  const cfg = await Settings.leer();
  const saldo = await wallet.saldoDe(user._id);
  const pendientes = await Redemption.countDocuments({
    user: user._id,
    estado: { $in: ["pending", "approved"] },
  });

  return {
    minimoSc: sc(cfg.canjeMinimoSc),
    disponibleSc: saldo.canjeableSc,
    balanceSc: saldo.balanceSc,
    /* El bono que todavía hay que jugar no se puede sacar. */
    bonoPendienteSc: saldo.bonoPendienteSc,
    nivel: user.verificationLevel || 0,
    nivelQuePide: nivelQuePide(cfg),
    pendientes,
    monedas: monedas(),
    pasarelaLista: oxapay.listaParaPagar(),
  };
}

/*
  SIN IDENTIDAD VERIFICADA NO SALE PLATA.

  El numero lo dice el panel (Settings.canjeNivelMinimo): nivel 2 --el
  documento-- de entrada, 3 si algun dia hace falta el domicilio. Esto
  es el piso por si el ajuste no esta, no el valor.
*/
const NIVEL_PARA_CANJEAR = 2;

function nivelQuePide(cfg) {
  const n = Number(cfg && cfg.canjeNivelMinimo);
  return Number.isFinite(n) && n >= 1 && n <= 3 ? n : NIVEL_PARA_CANJEAR;
}

/** Cuántos pedidos sin resolver puede tener alguien a la vez. */
const PEDIDOS_A_LA_VEZ = 3;

async function pedirCanje({ user, montoSc, ticker, red, direccion }) {
  const cfg = await Settings.leer();
  const monto = sc(montoSc);

  if (!Number.isFinite(monto) || monto <= 0) throw errorDe("INVALID_AMOUNT", { montoSc });
  if (monto < sc(cfg.canjeMinimoSc)) {
    throw errorDe("BELOW_MINIMUM", { minimoSc: sc(cfg.canjeMinimoSc) });
  }

  /*
    LA TRABA PRIMERO.

    Antes que el nivel y antes que el saldo: si soporte frenó el canje
    de esta cuenta, no hace falta mirar nada mas. `redemptionLock` es
    la que pone el control automatico; `trabas.canje`, una persona.
  */
  if (user.banned || user.redemptionLock || (user.trabas && user.trabas.canje)) {
    throw errorDe("REDEMPTION_LOCKED");
  }

  const pide = nivelQuePide(cfg);
  if ((user.verificationLevel || 0) < pide) {
    throw errorDe("VERIFICATION_LEVEL_TOO_LOW", { nivel: pide });
  }

  const par = buscar(ticker, red);
  if (!par) throw errorDe("NOT_FOUND", { ticker, red });

  const limpia = String(direccion || "").trim();
  /* Una dirección de cripto no tiene espacios y no es corta. No se
     valida más que eso a propósito: cada cadena tiene su formato y una
     expresión regular desactualizada rebota pagos buenos. */
  if (limpia.length < 20 || limpia.length > 200 || /\s/.test(limpia)) {
    throw errorDe("INVALID_AMOUNT", { campo: "direccion" });
  }

  /*
    EL TOPE LO DECIDE LA BASE.

    Contar y despues decidir dejaba pasar veinte pedidos simultaneos
    contra un tope de tres. No creaba plata --cada uno descuenta
    bien-- pero el freno antifraude dejaba de frenar.

    El contador baja al pagar, al rechazar y al cancelar.
  */
  const lugar = await User.findOneAndUpdate(
    { _id: user._id, canjesPendientes: { $lt: PEDIDOS_A_LA_VEZ } },
    { $inc: { canjesPendientes: 1 } }
  ).lean();

  if (!lugar) {
    const cuantos = await Redemption.countDocuments({
      user: user._id,
      estado: { $in: ["pending", "approved"] },
    });
    throw errorDe("TOO_MANY_THREADS", { pendientes: cuantos });
  }

  /*
    EL SALDO SE DESCUENTA ACA.

    `wallet.mover` decide en la base si alcanza, y el bono sin jugar no
    entra en lo canjeable: eso lo resuelve `canjeableSc` antes.
  */
  const saldo = await wallet.saldoDe(user._id);
  if (monto > saldo.canjeableSc + 1e-9) {
    throw errorDe("NOT_ENOUGH_COINS", { faltan: sc(monto - saldo.canjeableSc) });
  }

  const pedido = await Redemption.create({
    user: user._id,
    montoSc: monto,
    moneda: par.moneda.ticker,
    red: par.red.clave,
    direccion: limpia,
    alPedir: {
      verificationLevel: user.verificationLevel || 0,
      jugadoSc: sc(user.jugadoSc),
      balanceSc: saldo.balanceSc,
    },
  });

  try {
    await wallet.mover({
      userId: user._id,
      amountSc: -monto,
      type: "redemption",
      /* Lo canjeable lo vuelve a mirar la base al descontar: el control
         de arriba no sobrevive a dos pedidos al mismo tiempo. */
      soloCanjeable: true,
      reference: { kind: "redemption", id: pedido._id, label: `${par.moneda.ticker} · ${par.red.clave}` },
    });
  } catch (err) {
    /* No se pudo cobrar: el pedido no existe. Mejor borrarlo que
       dejarlo pendiente de algo que nunca se descontó. */
    await Redemption.deleteOne({ _id: pedido._id });
    throw err;
  }

  return resumir(pedido);
}

function resumir(p) {
  return {
    _id: p._id,
    montoSc: sc(p.montoSc),
    moneda: p.moneda,
    red: p.red,
    direccion: p.direccion,
    estado: p.estado,
    motivo: p.motivo,
    createdAt: p.createdAt,
    pagadoEl: p.pagadoEl,
  };
}

async function mios(userId, limite = 20) {
  const filas = await Redemption.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limite)
    .lean();
  return filas.map(resumir);
}

/**
 * Cancelarlo mientras nadie lo miró.
 *
 * Devuelve el saldo. Después de aprobado ya no: en ese momento el pago
 * puede estar saliendo.
 */
async function cancelar(userId, id) {
  const pedido = await Redemption.findOneAndUpdate(
    { _id: id, user: userId, estado: "pending" },
    { $set: { estado: "rejected", motivo: "cancelled by the player", revisadoEl: new Date() } },
    { new: true }
  );
    /* Se libera el lugar: este canje ya no esta en el aire. */
    await User.updateOne(
      { _id: userId, canjesPendientes: { $gt: 0 } },
      { $inc: { canjesPendientes: -1 } }
    );
  if (!pedido) throw errorDe("NOT_FOUND");

  await wallet.mover({
    userId,
    amountSc: sc(pedido.montoSc),
    type: "redemption",
    reference: { kind: "redemption", id: pedido._id, label: "cancelled" },
  });

  return resumir(pedido);
}

/* ── Lo que hace el equipo ─────────────────────────────────────────── */

async function cola({ estado = "", page = 1, perPage = 25 }) {
  const filtro = {};
  if (estado) filtro.estado = estado;

  const [filas, total, porEstado, pendienteSc] = await Promise.all([
    Redemption.find(filtro)
      .sort({ createdAt: 1 })
      .skip((Math.max(1, page) - 1) * perPage)
      .limit(perPage)
      .populate("user", "username email verificationLevel")
      .populate("revisadoPor", "username")
      .lean(),
    Redemption.countDocuments(filtro),
    Redemption.aggregate([{ $group: { _id: "$estado", n: { $sum: 1 } } }]),
    Redemption.aggregate([
      { $match: { estado: { $in: ["pending", "approved"] } } },
      { $group: { _id: null, t: { $sum: "$montoSc" } } },
    ]),
  ]);

  const cuenta = {};
  for (const f of porEstado) cuenta[f._id] = f.n;

  return {
    items: filas.map((p) => ({
      ...resumir(p),
      userId: p.user && p.user._id,
      username: (p.user && p.user.username) || "—",
      email: (p.user && p.user.email) || "",
      nivel: p.alPedir ? p.alPedir.verificationLevel : 0,
      revisadoPorNombre: (p.revisadoPor && p.revisadoPor.username) || "",
    })),
    total,
    page: Math.max(1, page),
    pages: Math.max(1, Math.ceil(total / perPage)),
    porEstado: cuenta,
    pendienteSc: sc(pendienteSc.length ? pendienteSc[0].t : 0),
  };
}

/**
 * Aprobar, pagar o rechazar.
 *
 * Rechazar DEVUELVE el saldo: se descontó al pedir. Pagar no lo
 * devuelve ni lo vuelve a descontar: la plata ya salió del saldo cuando
 * se pidió, y lo que queda es mandarla.
 */
async function resolver({ admin, id, accion, motivo = "" }) {
  const pedido = await Redemption.findById(id);
  if (!pedido) throw errorDe("NOT_FOUND");

  if (accion === "reject") {
    if (!motivo || String(motivo).trim().length < 3) throw errorDe("REASON_REQUIRED");

    /*
      EL CAMBIO DE ESTADO ES LA CONDICION DE LA DEVOLUCION.

      Mirar `pedido.estado` y después guardar deja una ventana: dos
      rechazos del mismo pedido --dos pestañas, dos clics, dos personas
      del equipo a la vez-- leen "pending" los dos y devuelven la plata
      los dos. Pasó en la prueba: SC 500 se convirtieron en SC 700.

      Con la condición adentro del filtro, la base deja pasar UNO. El
      que no pasó no devuelve nada.
    */
    const rechazado = await Redemption.findOneAndUpdate(
      { _id: pedido._id, estado: { $in: ["pending", "approved"] } },
      {
        $set: {
          estado: "rejected",
          motivo: String(motivo).trim(),
          revisadoPor: admin._id,
          revisadoEl: new Date(),
        },
      },
      { new: true }
    );

    if (!rechazado) throw errorDe("ALREADY_CLAIMED");
    /* Se libera el lugar: este canje ya no esta en el aire. */
    await User.updateOne(
      { _id: rechazado.user, canjesPendientes: { $gt: 0 } },
      { $inc: { canjesPendientes: -1 } }
    );

    await wallet.mover({
      userId: rechazado.user,
      amountSc: sc(rechazado.montoSc),
      type: "redemption",
      byAdmin: admin._id,
      reason: rechazado.motivo,
      reference: { kind: "redemption", id: rechazado._id, label: "rejected" },
    });

    return resumir(rechazado);
  }

  if (accion === "approve") {
    const aprobado = await Redemption.findOneAndUpdate(
      { _id: pedido._id, estado: "pending" },
      {
        $set: {
          estado: "approved",
          /* Quien aprobo queda aparte de quien paga: `revisadoPor` se
             pisa en el pago y si no, no quedaria rastro de que fueron
             dos personas distintas. */
          aprobadoPor: admin._id,
          revisadoPor: admin._id,
          revisadoEl: new Date(),
        },
      },
      { new: true }
    );
    if (!aprobado) throw errorDe("ALREADY_CLAIMED");
    return resumir(aprobado);
  }

  if (accion === "pay") {
    if (pedido.estado !== "approved") throw errorDe("ALREADY_CLAIMED");
    /* Ver el comentario de arriba: la condicion la decide la base. */

    /*
      EL PAGO LO HACE LA PASARELA.

      Sin clave de pagos no se puede pagar desde acá, y marcarlo
      "pagado" igual seria mentirle al equipo: el panel diria que salio
      y nadie habria mandado nada.
    */
    if (!oxapay.listaParaPagar()) throw errorDe("SOMETHING_WENT_WRONG", { falta: "OXAPAY_PAYOUT_KEY" });

    /*
      Se marca "pagando" ANTES de llamar a la pasarela, con la misma
      condicion adentro del filtro. Si dos personas tocan Pagar a la
      vez, una sola llega a mandar la plata.
    */
    /*
      DOS COSAS ANTES DE SACAR LA PLATA.

      La primera, que no sea el mismo que aprobo. La segunda, que el
      nivel de verificacion SIGA estando: se miro al pedir, y entre el
      pedido y el pago pueden haber pasado horas en las que soporte le
      bajo el nivel o encontro algo.
    */
    const cfgPago = await Settings.leer();

    if (cfgPago.canjePideDosFirmas !== false
        && pedido.aprobadoPor
        && String(pedido.aprobadoPor) === String(admin._id)) {
      throw errorDe("NEEDS_SECOND_PAIR_OF_EYES");
    }

    const duenio = await User.findById(pedido.user)
      .select("verificationLevel banned redemptionLock trabas")
      .lean();

    if (!duenio) throw errorDe("NOT_FOUND");

    if (duenio.banned || duenio.redemptionLock || (duenio.trabas && duenio.trabas.canje)) {
      throw errorDe("REDEMPTION_LOCKED");
    }

    const pide = nivelQuePide(cfgPago);
    if ((duenio.verificationLevel || 0) < pide) {
      throw errorDe("VERIFICATION_LEVEL_TOO_LOW", { nivel: pide });
    }

    const tomado = await Redemption.findOneAndUpdate(
      { _id: pedido._id, estado: "approved" },
      { $set: { estado: "paid", revisadoPor: admin._id, revisadoEl: new Date() } },
      { new: true }
    );
    if (!tomado) throw errorDe("ALREADY_CLAIMED");
    /* Se libera el lugar: este canje ya no esta en el aire. */
    await User.updateOne(
      { _id: tomado.user, canjesPendientes: { $gt: 0 } },
      { $inc: { canjesPendientes: -1 } }
    );

    let salida;
    try {
      salida = await oxapay.pagar({
        montoSc: sc(tomado.montoSc),
        ticker: tomado.moneda,
        red: tomado.red,
        direccion: tomado.direccion,
        referencia: String(tomado._id),
      });
    } catch (err) {
      /* No salio: vuelve a estar aprobado para poder reintentar. */
      await Redemption.updateOne({ _id: tomado._id }, { $set: { estado: "approved" } });
      throw err;
    }

    tomado.pasarelaId = salida.id || "";
    tomado.montoMoneda = Number(salida.montoMoneda) || 0;
    tomado.cotizacion = Number(salida.cotizacion) || 0;
    tomado.pagadoEl = new Date();
    await tomado.save();

    logger.info(
      `[cashier] canje pagado ${tomado._id} · SC ${tomado.montoSc} = ` +
      `${tomado.montoMoneda} ${tomado.moneda} a ${tomado.cotizacion}`
    );
    return resumir(tomado);
  }

  throw errorDe("INVALID_AMOUNT", { accion });
}

module.exports = {
  monedas,
  direccionDeDeposito,
  antesDeCanjear,
  pedirCanje,
  mios,
  cancelar,
  cola,
  resolver,
  NIVEL_PARA_CANJEAR,
  nivelQuePide,
  PEDIDOS_A_LA_VEZ,
};
