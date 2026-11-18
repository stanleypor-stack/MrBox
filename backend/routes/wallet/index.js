const express = require("express");
const rateLimit = require("express-rate-limit");

const { autorizar } = require("../../middleware/auth");
const caja = require("../../services/cashier");
const oxapay = require("../../services/cashier/oxapay");
const wallet = require("../../services/wallet");
const Settings = require("../../database/models/Settings");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const User = require("../../database/models/User");
const afiliados = require("../../services/affiliates");
const cajas = require("../../services/boxes");
const PromoCode = require("../../database/models/PromoCode");
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
 * ATAR UN CODIGO DE AFILIADO DESPUES.
 *
 * El código normalmente se pone al registrarse, pero la mitad de la
 * gente se entera del código DESPUES. Esto deja ponerlo mientras
 * todavía no tenga uno: el que ya tiene no lo puede cambiar, porque si
 * no, el primer socio pierde al jugador que trajo.
 */
router.post("/code", freno, async (req, res) => {
  try {
    if (req.user.referredBy) throw errorDe("CODE_ALREADY_USED");

    const codigo = await afiliados.atarAlSocio(req.user, req.body.code);
    if (!codigo) throw errorDe("CODE_NOT_FOUND");

    const cfg = await Settings.leer();
    const pct = codigo.tramo === "destacado" ? cfg.bonoPorDeposito.destacado : cfg.bonoPorDeposito.normal;

    return res.json({
      success: true,
      data: { code: codigo.code, bonoPct: Math.round(pct * 1000) / 10 },
    });
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
 */
router.post("/promo", freno, async (req, res) => {
  try {
    const texto = String(req.body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
    if (!texto) throw errorDe("CODE_NOT_FOUND");

    const codigo = await PromoCode.findOne({ codigo: texto });
    if (!codigo) throw errorDe("CODE_NOT_FOUND");
    if (!codigo.sirve()) throw errorDe("CODE_EXPIRED");

    if (codigo.minimoJugadoSc > 0 && sc(req.user.jugadoSc) < codigo.minimoJugadoSc) {
      throw errorDe("BELOW_MINIMUM", { minimoJugadoSc: codigo.minimoJugadoSc });
    }

    /* La marca primero: es la que decide quién gana la carrera. */
    let uso;
    try {
      uso = await PromoCode.PromoUse.create({
        code: codigo._id,
        user: req.user._id,
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
          userId: req.user._id,
          amountSc: sc(codigo.montoSc),
          type: "promo_code",
          reference: { kind: "promoCode", id: codigo._id, label: codigo.codigo },
        });
      }

      if (codigo.tipo === "aperturas" && codigo.aperturas > 0) {
        await cajas.regalarCajasDeBienvenida(req.user._id);
      }
    } catch (err) {
      /* No se pudo dar: se borra la marca para que lo pueda reintentar. */
      await PromoCode.PromoUse.deleteOne({ _id: uso._id });
      throw err;
    }

    await PromoCode.updateOne({ _id: codigo._id }, { $inc: { usos: 1 } });

    return res.json({
      success: true,
      data: {
        codigo: codigo.codigo,
        tipo: codigo.tipo,
        montoSc: sc(codigo.montoSc),
        aperturas: codigo.aperturas,
        ...(await wallet.saldoDe(req.user._id)),
      },
    });
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

    const yaEsta = await BalanceTransaction.findOne({
      type: "purchase",
      "reference.kind": "oxapay",
      "reference.label": trackId,
    }).lean();
    if (yaEsta) return res.json({ success: true, repetido: true });

    const jugador = await User.findById(userId).select("referredBy affiliateCode").lean();
    if (!jugador) return res.json({ success: true, ignorado: "sin jugador" });

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

    logger.info(`[oxapay] acreditado SC ${monto} (+${bono}) a ${userId}`);
    return res.json({ success: true });
  } catch (err) {
    logger.error("[oxapay] aviso:", err.message);
    return res.status(500).json({ success: false });
  }
});

module.exports.aviso = aviso;
