const express = require("express");
const rateLimit = require("express-rate-limit");

const { autorizar } = require("../../middleware/auth");
const caja = require("../../services/cashier");
const oxapay = require("../../services/cashier/oxapay");
const wallet = require("../../services/wallet");
const Settings = require("../../database/models/Settings");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const User = require("../../database/models/User");
const DepositoAvisado = require("../../database/models/DepositoAvisado");
const afiliados = require("../../services/affiliates");
const cajas = require("../../services/boxes");
const PromoCode = require("../../database/models/PromoCode");
const WalletTx = require("../../database/models/WalletTx");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[wallet] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/**
 * LA CAJA, DEL LADO DEL JUGADOR.
 *
 * Comprar SC y pedir un canje. Las reglas están en services/cashier;
 * acá solo entra y sale lo que la pantalla necesita.
 */

/* Pedir direcciones y canjes es caro y sensible: va con freno. */
const freno = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED" } },
});

/** Las monedas y sus redes. Se puede mirar sin cuenta. */
router.get("/coins", autorizar(false), async (req, res) => {
  try {
    const cfg = await Settings.leer();
    return res.json({
      success: true,
      data: {
        monedas: caja.monedas(),
        minimoDepositoSc: 10,
        minimoCanjeSc: sc(cfg.canjeMinimoSc),
        bonoPorDeposito: cfg.bonoPorDeposito,
        conectada: oxapay.configurada(),
      },
    });
  } catch (err) {
    return responderError(res, err, "coins");
  }
});

/* Todo lo de abajo pide sesión. */
router.use(autorizar(true));

/**
 * UNA DIRECCION PARA DEPOSITAR.
 *
 * Si la pasarela no está conectada devuelve `conectada: false` y la
 * pantalla muestra el cartel. Nunca una dirección inventada.
 */
router.get("/deposit", freno, async (req, res) => {
  try {
    const datos = await caja.direccionDeDeposito({
      userId: req.user._id,
      ticker: req.query.coin || "USDT",
      red: req.query.network || "",
    });
    return res.json({ success: true, data: datos });
  } catch (err) {
    return responderError(res, err, "deposit");
  }
});

/**
 * EL HASH DE UN PAGO HECHO DESDE LA BILLETERA.
 *
 * Lo anota y nada más: NO acredita, no decide y no se le cree. El saldo
 * lo sigue acreditando el aviso de la pasarela cuando la red confirma.
 *
 * Existe para soporte: "pagué y no me llegó" sin un hash no se puede
 * mirar, y con el hash se abre el explorador y se ve si la transferencia
 * salió, a dónde fue y cuántas confirmaciones lleva.
 */
router.post("/deposit/tx", freno, async (req, res) => {
  try {
    const hash = String(req.body.hash || "").trim().slice(0, 120);
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw errorDe("INVALID_AMOUNT", { campo: "hash" });

    await WalletTx.updateOne(
      { hash },
      {
        $setOnInsert: {
          user: req.user._id,
          hash,
          ticker: String(req.body.coin || "").slice(0, 10).toUpperCase(),
          red: String(req.body.network || "").slice(0, 20),
          direccion: String(req.body.address || "").slice(0, 120),
        },
      },
      { upsert: true }
    );

    return res.json({ success: true });
  } catch (err) {
    return responderError(res, err, "deposit/tx");
  }
});

/** Lo que hay que saber antes de pedir un canje. */
router.get("/withdraw", async (req, res) => {
  try {
    return res.json({ success: true, data: await caja.antesDeCanjear(req.user) });
  } catch (err) {
    return responderError(res, err, "withdraw");
  }
});

/** Pedirlo. Descuenta el saldo y deja el pedido esperando revisión. */
router.post("/withdraw", freno, async (req, res) => {
  try {
    const pedido = await caja.pedirCanje({
      user: req.user,
      montoSc: req.body.montoSc,
      ticker: req.body.coin,
      red: req.body.network,
      direccion: req.body.address,
    });

    return res.json({
      success: true,
      data: { pedido, ...(await wallet.saldoDe(req.user._id)) },
    });
  } catch (err) {
    return responderError(res, err, "withdraw.create");
  }
});

/**
 * UN CODIGO, DEL TIPO QUE SEA.
 *
 * El jugador escribe "un código": no tiene por qué saber si el suyo es
 * de un afiliado o de una promoción. Acá se averigua, se hace lo que
 * corresponda y se contesta qué pasó.
 *
 * Y CUANDO NO ENTRA, SE DICE POR QUE NO ENTRA
 *
 * "Ese código no existe" para todo es la peor respuesta posible:
 * mandaba a alguien a revisar cómo lo escribió cuando el problema era
 * que el código era el suyo propio, o que ya tenía uno puesto. Cada
 * caso tiene su mensaje.
 *
 * EL CODIGO DE AFILIADO SE PONE UNA SOLA VEZ
 *
 * Normalmente al registrarse, pero la mitad de la gente se entera
 * después. El que ya tiene uno no lo puede cambiar: si no, el primer
 * socio pierde al jugador que trajo.
 */
router.post("/code", freno, async (req, res) => {
  try {
    const texto = codigoEscrito(req.body.code);
    if (!texto) throw errorDe("CODE_NOT_FOUND");

    /* ── ¿Es de un afiliado? ──────────────────────────────────── */
    const codigo = await afiliados.buscarCodigo(texto);
    if (codigo) {
      const duenoId = String((codigo.owner && codigo.owner._id) || codigo.owner);
      if (duenoId === String(req.user._id)) throw errorDe("OWN_CODE");
      if (req.user.referredBy) throw errorDe("CODE_ALREADY_USED");
      if (!codigo.sirve()) throw errorDe("CODE_EXPIRED");

      await afiliados.atarAlSocio(req.user, texto);

      /*
        El porcentaje lo contesta el servicio, que es el que sabe el
        rango del socio: del 5% al 10%. Calcularlo acá con el número
        normal le mostraba de menos al jugador de un socio grande, y
        después se le acreditaba de más, que es peor que no decirle nada.
      */
      const pct = await afiliados.bonoDe(codigo);

      return res.json({
        success: true,
        data: { tipo: "afiliado", code: codigo.code, bonoPct: Math.round(pct * 1000) / 10 },
      });
    }

    /* ── ¿Es de una promoción? ────────────────────────────────── */
    const promo = await PromoCode.findOne({ codigo: texto.replace(/[^A-Z0-9]/g, "") });
    if (promo) {
      const r = await canjearPromo(req.user, promo);

      /*
        El `tipo` de la promoción --saldo o aperturas-- se llama igual
        que el tipo de código, así que va con otro nombre: con los dos
        como `tipo`, el de adentro pisaba al de afuera y la pantalla
        mostraba el mensaje equivocado.
      */
      return res.json({ success: true, data: { ...r, tipo: "promo", tipoPromo: r.tipo } });
    }

    throw errorDe("CODE_NOT_FOUND");
  } catch (err) {
    return responderError(res, err, "code");
  }
});

/**
 * CANJEAR UN CODIGO PROMOCIONAL.
 *
 * El de una campaña: da saldo o cajas gratis, una sola vez por persona.
 *
 * LO QUE IMPIDE EL DOBLE CANJE ES EL INDICE, NO UN `IF`
 *
 * La fila de uso se crea ANTES de mover la plata, con un índice único
 * por (código, jugador). Dos clics al mismo tiempo: el segundo choca
 * contra el índice y no acredita. Preguntando "¿ya lo usó?" y después
 * acreditando, los dos pasan.
 *
 * Está como función aparte porque lo usan DOS pantallas: la de
 * recompensas y el "¿tenés un código?" del cajón, que acepta cualquiera
 * de los dos tipos.
 */
async function canjearPromo(usuario, codigo) {
  /* Soporte le puede frenar las promociones a una cuenta sin cerrarla. */
  if (usuario.trabas && usuario.trabas.promos) throw errorDe("PROMOS_LOCKED", {}, 403);
  if (!codigo.sirve()) throw errorDe("CODE_EXPIRED");

  if (codigo.minimoJugadoSc > 0 && sc(usuario.jugadoSc) < codigo.minimoJugadoSc) {
    throw errorDe("BELOW_MINIMUM", { minimoJugadoSc: codigo.minimoJugadoSc });
  }

  /* La marca primero: es la que decide quién gana la carrera. */
  let uso;
  try {
    uso = await PromoCode.PromoUse.create({
      code: codigo._id,
      user: usuario._id,
      montoSc: codigo.montoSc,
      aperturas: codigo.aperturas,
    });
  } catch (err) {
    if (err && err.code === 11000) throw errorDe("CODE_ALREADY_USED");
    throw err;
  }

  try {
    if (codigo.tipo === "saldo" && codigo.montoSc > 0) {
      await wallet.mover({
        userId: usuario._id,
        amountSc: sc(codigo.montoSc),
        type: "promo_code",
        reference: { kind: "promoCode", id: codigo._id, label: codigo.codigo },
      });
    }

    if (codigo.tipo === "aperturas" && codigo.aperturas > 0) {
      await cajas.regalarCajasDeBienvenida(usuario._id);
    }
  } catch (err) {
    /* No se pudo dar: se borra la marca para que lo pueda reintentar. */
    await PromoCode.PromoUse.deleteOne({ _id: uso._id });
    throw err;
  }

  await PromoCode.updateOne({ _id: codigo._id }, { $inc: { usos: 1 } });

  return {
    codigo: codigo.codigo,
    tipo: codigo.tipo,
    montoSc: sc(codigo.montoSc),
    aperturas: codigo.aperturas,
    ...(await wallet.saldoDe(usuario._id)),
  };
}

/** Limpia lo que escribió el jugador. Los de afiliado llevan - y _. */
function codigoEscrito(texto) {
  return String(texto || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
}

router.post("/promo", freno, async (req, res) => {
  try {
    /*
      La traba va PRIMERO, antes de mirar si el código existe: una
      cuenta frenada no tiene por qué poder averiguar qué códigos hay
      probando uno por uno.
    */
    if (req.user.trabas && req.user.trabas.promos) throw errorDe("PROMOS_LOCKED", {}, 403);

    const texto = codigoEscrito(req.body.code).replace(/[^A-Z0-9]/g, "");
    if (!texto) throw errorDe("CODE_NOT_FOUND");

    const codigo = await PromoCode.findOne({ codigo: texto });
    if (!codigo) throw errorDe("CODE_NOT_FOUND");

    return res.json({ success: true, data: await canjearPromo(req.user, codigo) });
  } catch (err) {
    return responderError(res, err, "promo");
  }
});

/** Los míos. */
router.get("/withdrawals", async (req, res) => {
  try {
    return res.json({ success: true, data: { items: await caja.mios(req.user._id) } });
  } catch (err) {
    return responderError(res, err, "withdrawals");
  }
});

/** Cancelarlo mientras nadie lo miró. */
router.post("/withdrawals/:id/cancel", async (req, res) => {
  try {
    const pedido = await caja.cancelar(req.user._id, req.params.id);
    return res.json({
      success: true,
      data: { pedido, ...(await wallet.saldoDe(req.user._id)) },
    });
  } catch (err) {
    return responderError(res, err, "withdrawals.cancel");
  }
});

module.exports = router;

/* ══ El aviso de la pasarela ═════════════════════════════════════ */

/**
 * EL AVISO DE PAGO DE OXAPAY.
 *
 * Va aparte y sin `autorizar`: lo llama OxaPay, no un jugador. Lo que
 * lo protege es la FIRMA: sin ella, cualquiera que sepa la dirección se
 * acredita SC mandando un JSON.
 *
 * Y la idempotencia: el mismo pago avisado dos veces --pasa, los
 * proveedores reintentan-- no puede acreditar dos veces. La fila del
 * libro con ese `track_id` es la que lo impide.
 */
const aviso = express.Router();

aviso.post("/oxapay", express.raw({ type: "*/*" }), async (req, res) => {
  const crudo = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body || {});

  try {
    if (!oxapay.avisoEsDeOxaPay(crudo, req.headers.hmac || req.headers["x-signature"])) {
      logger.warn("[oxapay] aviso con firma que no cierra");
      return res.status(401).json({ success: false });
    }

    const datos = JSON.parse(crudo || "{}");
    const estado = String(datos.status || "").toLowerCase();
    const trackId = String(datos.track_id || datos.trackId || "");
    const userId = String(datos.order_id || "");

    /* Solo cuando está confirmado de verdad. */
    if (estado !== "paid" && estado !== "confirmed") return res.json({ success: true, ignorado: estado });

    const monto = sc(Number(datos.amount) || 0);
    if (!userId || monto <= 0 || !trackId) return res.json({ success: true, ignorado: "incompleto" });

    const jugador = await User.findById(userId).select("referredBy affiliateCode").lean();
    if (!jugador) return res.json({ success: true, ignorado: "sin jugador" });

    /*
      LA MARCA SE PONE ANTES DE MOVER LA PLATA.

      El indice unico del `trackId` es lo que impide acreditar dos
      veces. Preguntar "¿ya esta?" y despues acreditar deja una ventana:
      dos avisos del mismo pago a la vez --las pasarelas reintentan--
      leen los dos que no esta y acreditan los dos.
    */
    let marca;
    try {
      marca = await DepositoAvisado.create({
        trackId,
        pasarela: "oxapay",
        user: userId,
        montoSc: monto,
      });
    } catch (err) {
      if (err && err.code === 11000) return res.json({ success: true, repetido: true });
      throw err;
    }

    /*
      El bono por código de afiliado lo calcula el servicio, que es el
      que sabe si ese código es de los destacados --10% en vez de 5%--
      y si sigue vivo. Calcularlo acá con el porcentaje normal le
      pagaba de menos a los socios grandes.
    */
    const cfg = await Settings.leer();
    const { bonoSc } = await afiliados.bonoDeCompra(jugador, monto);
    const bono = sc(bonoSc);

    await wallet.mover({
      userId,
      amountSc: sc(monto + bono),
      type: "purchase",
      bonoSc: bono * (cfg.vecesAJugarElBono || 0),
      reference: { kind: "oxapay", label: trackId },
    });

    await DepositoAvisado.updateOne({ _id: marca._id }, { $set: { acreditado: true } });

    logger.info(`[oxapay] acreditado SC ${monto} (+${bono}) a ${userId}`);
    return res.json({ success: true });
  } catch (err) {
    logger.error("[oxapay] aviso:", err.message);
    return res.status(500).json({ success: false });
  }
});

module.exports.aviso = aviso;
