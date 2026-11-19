/**
 * LA PANTALLA DE AFILIADOS, DEL LADO DEL SOCIO.
 *
 * Todo lo que ve un socio sale de acá: su rango, la escalera entera, sus
 * campañas con el modelo de cada una, lo que trajo cada una, el embudo de
 * sus referidos y el botón de cobrar.
 *
 * DE DONDE SALEN LOS NUMEROS
 *
 * Los jugadores y lo jugado salen de los contadores de la campaña, que se
 * mueven con cada apertura. Lo DEPOSITADO sale del libro, que es el único
 * lugar donde eso está de verdad. El embudo sale de las fichas de
 * conversión. Ningún número de esta pantalla se calcula dos veces en dos
 * lugares distintos.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const AffiliateCode = require("../../database/models/AffiliateCode");
const AffiliateConversion = require("../../database/models/AffiliateConversion");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const User = require("../../database/models/User");
const afiliados = require("../../services/affiliates");
const wallet = require("../../services/wallet");
const { autorizar } = require("../../middleware/auth");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[afiliados] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/* Crear campañas, cambiar códigos y cobrar van con freno. */
const freno = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AFFILIATE_RATE_LIMIT) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED" } },
});

/* El nombre se tapa a medias, con la misma regla que los live pulls: el
   socio reconoce al suyo sin que esto sea una lista de nombres de
   jugadores con lo que deposita cada uno al lado. */
const { enmascarar } = require("../boxes");

/** Una campaña, como la ve su dueño. */
function resumirCampana(c, rango) {
  const cobra = afiliados.comoCobra({ modelo: c.modelo, rango });

  return {
    _id: c._id,
    code: c.code,
    nombre: c.nombre || c.code,
    canal: c.canal || "",
    modelo: c.modelo,
    /* Lo que paga HOY, que sale del rango y no de la campaña. */
    cobra,
    /* Un porcentaje puesto a mano manda sobre el del rango. */
    aMano: Number(c.comision) > 0 ? Number(c.comision) : null,
    activo: !!c.activo,
    venceEl: c.venceEl || null,
    clics: c.clics || 0,
    jugadores: c.jugadores || 0,
    jugadoPorLosSuyosSc: sc(c.jugadoPorLosSuyosSc || 0),
    ganadoSc: sc(c.ganadoSc || 0),
    cobradoSc: sc(c.cobradoSc || 0),
    porCobrarSc: sc(Math.max(0, (c.ganadoSc || 0) - (c.cobradoSc || 0))),
    creadaEl: c.createdAt,
  };
}

/**
 * TODA LA PANTALLA, EN UNA SOLA LLAMADA.
 *
 * Se arma de una porque la pantalla se mira entera: partirla en cinco
 * pedidos hace cinco viajes para dibujar una sola cosa.
 */
async function laPantalla(usuario) {
  const codigos = await AffiliateCode.find({ owner: usuario._id }).sort({ createdAt: 1 }).lean();
  const rango = afiliados.rangoDe(usuario);

  const total = codigos.reduce(
    (acc, c) => ({
      jugadores: acc.jugadores + (c.jugadores || 0),
      clics: acc.clics + (c.clics || 0),
      jugadoSc: sc(acc.jugadoSc + (c.jugadoPorLosSuyosSc || 0)),
      ganadoSc: sc(acc.ganadoSc + (c.ganadoSc || 0)),
      cobradoSc: sc(acc.cobradoSc + (c.cobradoSc || 0)),
    }),
    { jugadores: 0, clics: 0, jugadoSc: 0, ganadoSc: 0, cobradoSc: 0 }
  );

  /* EL EMBUDO. Cuántos de los que trajo están en cada estado. */
  const porEstado = await AffiliateConversion.aggregate([
    { $match: { owner: usuario._id } },
    { $group: { _id: "$estado", cuantos: { $sum: 1 }, montoSc: { $sum: "$montoSc" } } },
  ]);

  const embudo = { nuevo: 0, deposito: 0, califica: 0, pagado: 0, anulado: 0 };
  let enEsperaSc = 0;
  for (const f of porEstado) {
    if (embudo[f._id] !== undefined) embudo[f._id] = f.cuantos;
    if (f._id === "califica") enEsperaSc = sc(f.montoSc);
  }

  /* Los que trajo, y lo que cada uno depositó y jugó. */
  const traidos = await User.find({ referredBy: usuario._id })
    .select("username createdAt jugadoSc affiliateCode verificationLevel")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const compras = traidos.length
    ? await BalanceTransaction.aggregate([
      { $match: { user: { $in: traidos.map((u) => u._id) }, type: "purchase" } },
      { $group: { _id: "$user", total: { $sum: "$amountSc" } } },
    ])
    : [];

  const deposito = new Map(compras.map((c) => [String(c._id), sc(c.total)]));

  /* El estado de cada referido, para que el socio vea a quién le falta qué. */
  const fichas = traidos.length
    ? await AffiliateConversion.find({ user: { $in: traidos.map((u) => u._id) }, owner: usuario._id })
      .select("user estado montoSc liberaEl")
      .lean()
    : [];

  const porJugador = new Map(fichas.map((f) => [String(f.user), f]));

  const referidos = traidos.map((u) => {
    const f = porJugador.get(String(u._id));
    return {
      _id: u._id,
      username: enmascarar(u.username),
      desde: u.createdAt,
      jugadoSc: sc(u.jugadoSc),
      depositadoSc: deposito.get(String(u._id)) || 0,
      codigo: u.affiliateCode || "",
      estado: f ? f.estado : "nuevo",
      /* Lo que esa cabeza le va a dejar, si es de las que pagan por cabeza. */
      montoSc: f ? sc(f.montoSc) : 0,
      liberaEl: f ? f.liberaEl : null,
    };
  });

  const r = afiliados.reglas();

  return {
    /* MI RANGO, y el siguiente, que no sube solo. */
    rango,
    escalera: afiliados.rangos(),
    pidioRangoEl: usuario.pidioRangoEl || null,
    telegram: r.telegram,

    /* LAS REGLAS, para que la pantalla no las invente. */
    reglas: {
      houseEdgePct: r.houseEdgePct,
      cpaDepositoSc: r.cpaDepositoSc,
      cpaJugadoSc: r.cpaJugadoSc,
      cpaNivelKyc: r.cpaNivelKyc,
      cpaEsperaDias: r.cpaEsperaDias,
      modelosAbiertos: r.modelos,
      comoMaximo: afiliados.COMO_MAXIMO,
    },

    campanas: codigos.map((c) => resumirCampana(c, rango)),

    total: {
      ...total,
      depositadoSc: sc(referidos.reduce((a, x) => a + x.depositadoSc, 0)),
      porCobrarSc: sc(Math.max(0, total.ganadoSc - total.cobradoSc)),
      enEsperaSc,
    },

    embudo,
    referidos,

    /* EL BONO QUE SE LLEVA EL QUE ENTRA CON SU CODIGO. Siempre, con los
       cuatro modelos: es lo primero que pregunta todo socio. */
    bonoParaElAmigo: rango.bonoPct,

    /* Quién lo trajo a él, si alguien lo trajo. */
    miCodigoDeEntrada: usuario.affiliateCode || null,
  };
}

router.get("/", autorizar(true), async (req, res) => {
  try {
    return res.json({ success: true, data: await laPantalla(req.user) });
  } catch (err) {
    return responderError(res, err, "affiliates");
  }
});

/** La escalera sola, para la pantalla de rangos. Se puede mirar sin cuenta. */
router.get("/ranks", autorizar(false), async (req, res) => {
  try {
    const r = afiliados.reglas();
    return res.json({
      success: true,
      data: {
        escalera: afiliados.rangos(),
        houseEdgePct: r.houseEdgePct,
        modelosAbiertos: r.modelos,
        telegram: r.telegram,
        mio: req.user ? afiliados.rangoDe(req.user).numero : null,
      },
    });
  } catch (err) {
    return responderError(res, err, "affiliates/ranks");
  }
});

/**
 * CREAR UNA CAMPAÑA.
 *
 * El modelo se elige acá y queda fijo: cambiarlo después dejaría al socio
 * eligiendo, cada fin de mes, el modelo que más le hubiera convenido para
 * los jugadores que ya trajo.
 */
router.post("/campaigns", autorizar(true), freno, async (req, res) => {
  try {
    const campana = await afiliados.crearCampana({
      usuario: req.user,
      nombre: req.body.nombre,
      code: req.body.code,
      canal: req.body.canal,
      modelo: req.body.modelo,
    });

    return res.json({
      success: true,
      data: { campana: resumirCampana(campana.toObject(), afiliados.rangoDe(req.user)) },
    });
  } catch (err) {
    return responderError(res, err, "affiliates/campaigns");
  }
});

/**
 * RETOCAR UNA CAMPAÑA.
 *
 * El nombre, el canal, y prenderla o apagarla. El modelo y los números
 * NO: los números son del rango y el modelo es de por vida.
 */
router.patch("/campaigns/:id", autorizar(true), async (req, res) => {
  try {
    const cambios = {};
    if (req.body.nombre !== undefined) {
      cambios.nombre = String(req.body.nombre).trim().slice(0, 60);
    }
    if (req.body.canal !== undefined) cambios.canal = String(req.body.canal).trim().slice(0, 30);
    if (req.body.activo !== undefined) cambios.activo = !!req.body.activo;

    if (!Object.keys(cambios).length) throw errorDe("NOT_FOUND");

    const campana = await AffiliateCode.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { $set: cambios },
      { new: true }
    ).lean();
    if (!campana) throw errorDe("CODE_NOT_FOUND");

    return res.json({
      success: true,
      data: { campana: resumirCampana(campana, afiliados.rangoDe(req.user)) },
    });
  } catch (err) {
    return responderError(res, err, "affiliates/campaigns/edit");
  }
});

/**
 * CAMBIARLE EL TEXTO AL CODIGO.
 *
 * El que viene por defecto sale del nombre y es feo, y el socio lo va a
 * poner en un video. Cambiarlo NO rompe los enlaces viejos: el jugador
 * queda atado al socio, no al texto.
 *
 * Lo único que no se puede es pisar el código de otro, y eso lo impide el
 * índice único de la colección, no un `if`.
 */
router.post("/campaigns/:id/code", autorizar(true), freno, async (req, res) => {
  try {
    const limpio = String(req.body.code || "")
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 16);
    if (limpio.length < 3) throw errorDe("CODE_TOO_SHORT", { code: limpio });

    const mia = await AffiliateCode.findOne({ _id: req.params.id, owner: req.user._id });
    if (!mia) throw errorDe("CODE_NOT_FOUND");

    const viejo = mia.code;
    try {
      await AffiliateCode.updateOne({ _id: mia._id }, { $set: { code: limpio } });
    } catch (err) {
      if (err && err.code === 11000) throw errorDe("CODE_TAKEN", { code: limpio });
      throw err;
    }

    /* Los que entraron con el texto viejo siguen atados por `referredBy`,
       pero su `affiliateCode` apuntaría a un texto que ya no existe. */
    await User.updateMany({ affiliateCode: viejo }, { $set: { affiliateCode: limpio } });

    return res.json({ success: true, data: { code: limpio } });
  } catch (err) {
    return responderError(res, err, "affiliates/campaigns/code");
  }
});

/** El socio cobra lo de una campaña. */
router.post("/campaigns/:id/claim", autorizar(true), freno, async (req, res) => {
  try {
    const r = await afiliados.cobrar({ userId: req.user._id, codigoId: req.params.id });
    return res.json({
      success: true,
      data: { ...r, ...(await wallet.saldoDe(req.user._id)) },
    });
  } catch (err) {
    return responderError(res, err, "affiliates/claim");
  }
});

/**
 * PEDIR QUE LE MIREN EL RANGO.
 *
 * Queda anotado y se le devuelve el Telegram del equipo. No sube nada: el
 * rango lo otorga una persona, mirando el tráfico que trajo.
 */
router.post("/rank/request", autorizar(true), freno, async (req, res) => {
  try {
    /* Una sola vez por semana: el pedido es para que alguien lo mire, y
       mirarlo tres veces en un día no cambia el resultado. */
    const antes = req.user.pidioRangoEl ? new Date(req.user.pidioRangoEl).getTime() : 0;
    if (antes && Date.now() - antes < 7 * 24 * 60 * 60 * 1000) {
      throw errorDe("RANK_ALREADY_ASKED", { desdeEl: req.user.pidioRangoEl });
    }

    const r = await afiliados.pedirRango(req.user._id);
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "affiliates/rank/request");
  }
});

/**
 * ALGUIEN TOCO UN ENLACE DE CAMPAÑA.
 *
 * Lo único que no sale del libro. Sirve para que el socio vea cuántos
 * clics le dejan cuántos registros, que es la cuenta que de verdad le
 * importa. No pide sesión: el que toca el enlace todavía no tiene.
 */
router.post("/click/:code", freno, async (req, res) => {
  try {
    const code = String(req.params.code || "").toUpperCase().slice(0, 16);
    await AffiliateCode.updateOne({ code, activo: true }, { $inc: { clics: 1 } });
    return res.json({ success: true });
  } catch (err) {
    return responderError(res, err, "affiliates/click");
  }
});

module.exports = router;
module.exports.laPantalla = laPantalla;
module.exports.resumirCampana = resumirCampana;
