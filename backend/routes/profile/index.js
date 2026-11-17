const express = require("express");

const BalanceTransaction = require("../../database/models/BalanceTransaction");
const BoxOpen = require("../../database/models/BoxOpen");
const InventoryItem = require("../../database/models/InventoryItem");
const AffiliateCode = require("../../database/models/AffiliateCode");
const User = require("../../database/models/User");

const { autorizar } = require("../../middleware/auth");
const afiliados = require("../../services/affiliates");
const wallet = require("../../services/wallet");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[profile] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/* ── Los movimientos ──────────────────────────────────────────────── */

/**
 * EL EXTRACTO DEL JUGADOR.
 *
 * Todo lo que entró y salió de su saldo, con el saldo de antes y el de
 * después en cada renglón. Es lo mismo que ve el panel en Movements,
 * filtrado a una sola cuenta.
 *
 * Que el jugador pueda ver esto no es un lujo: es lo que convierte "me
 * faltan SC 40" en una conversación de dos minutos en vez de una pelea.
 */
router.get("/transactions", autorizar(true), async (req, res) => {
  try {
    const pagina = Math.max(1, Number(req.query.page) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(req.query.perPage) || 25));

    const filtro = { user: req.user._id };

    /* Se puede pedir un tipo solo: "mostrame solo mis compras". */
    if (req.query.type) {
      const tipos = String(req.query.type).split(",").map((t) => t.trim()).filter(Boolean);
      if (tipos.length) filtro.type = { $in: tipos };
    }

    const [filas, total] = await Promise.all([
      BalanceTransaction.find(filtro)
        .sort({ createdAt: -1 })
        .skip((pagina - 1) * porPagina)
        .limit(porPagina)
        .lean(),
      BalanceTransaction.countDocuments(filtro),
    ]);

    return res.json({
      success: true,
      data: {
        items: filas.map((f) => ({
          _id: f._id,
          type: f.type,
          amountSc: sc(f.amountSc),
          balanceAfter: sc(f.balanceAfter),
          /* El motivo legible. Para un ajuste a mano es lo único que
             explica por qué cambió el saldo. */
          label: (f.reference && f.reference.label) || "",
          reason: f.reason || "",
          createdAt: f.createdAt,
        })),
        page: pagina,
        perPage: porPagina,
        total,
        pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "transactions");
  }
});

/* ── Los números del jugador ──────────────────────────────────────── */

/**
 * CUANTO JUGO, CUANTO ABRIO, CUANTO TIENE.
 *
 * `jugadoSc` es el número que manda: de él salen el rango VIP, el puesto
 * en las carreras y el rakeback. Se lee del contador del usuario y NO se
 * recalcula sumando aperturas, a propósito: el contador es lo que usan
 * todas las demás pantallas, así que si estuviera mal, mostrar otra cosa
 * acá escondería el problema en vez de mostrarlo.
 *
 * Igual se devuelve el total sumado aparte, para poder compararlos: si
 * un día no coinciden, hay algo que arreglar y conviene verlo.
 */
router.get("/stats", autorizar(true), async (req, res) => {
  try {
    const id = req.user._id;

    const [usuario, saldo, aperturas, sumas, inventario] = await Promise.all([
      User.findById(id).lean(),
      wallet.saldoDe(id),
      BoxOpen.countDocuments({ user: id, demo: { $ne: true } }),
      BalanceTransaction.aggregate([
        { $match: { user: id } },
        { $group: { _id: "$type", total: { $sum: "$amountSc" }, cuantos: { $sum: 1 } } },
      ]),
      InventoryItem.aggregate([
        { $match: { user: id, state: "held" } },
        { $group: { _id: null, cuantos: { $sum: 1 }, valor: { $sum: "$valueSc" } } },
      ]),
    ]);

    const porTipo = Object.fromEntries(sumas.map((s) => [s._id, { total: sc(s.total), cuantos: s.cuantos }]));
    const de = (t) => (porTipo[t] ? porTipo[t].total : 0);

    /* Lo jugado, pero sumado desde el libro, para poder comparar. */
    const jugadoSegunElLibro = sc(Math.abs(de("box_open")) + Math.abs(de("deal")));

    return res.json({
      success: true,
      data: {
        ...saldo,

        /* El que manda. */
        jugadoSc: sc(usuario.jugadoSc),
        jugadoSegunElLibro,
        cuadra: Math.abs(sc(usuario.jugadoSc) - jugadoSegunElLibro) < 0.01,

        aperturas,
        compradoSc: de("purchase"),
        canjeadoSc: Math.abs(de("redemption")),
        vendidoSc: de("item_sold"),
        ganadoDeAfiliadosSc: de("affiliate"),

        inventario: {
          cuantos: (inventario[0] && inventario[0].cuantos) || 0,
          valorSc: sc((inventario[0] && inventario[0].valor) || 0),
        },

        verificationLevel: usuario.verificationLevel,
        freeOpens: usuario.freeOpens,
        miembroDesde: usuario.createdAt,
      },
    });
  } catch (err) {
    return responderError(res, err, "stats");
  }
});

/* ── Afiliados ────────────────────────────────────────────────────── */

/**
 * LO QUE EL SOCIO VE DE SU CODIGO.
 *
 * Cuántos trajo, cuánto jugaron, cuánto ganó y cuánto le queda por
 * cobrar.
 */
router.get("/affiliate", autorizar(true), async (req, res) => {
  try {
    const codigos = await AffiliateCode.find({ owner: req.user._id }).lean();

    const total = codigos.reduce(
      (acc, c) => ({
        jugadores: acc.jugadores + (c.jugadores || 0),
        jugadoSc: sc(acc.jugadoSc + (c.jugadoPorLosSuyosSc || 0)),
        ganadoSc: sc(acc.ganadoSc + (c.ganadoSc || 0)),
        cobradoSc: sc(acc.cobradoSc + (c.cobradoSc || 0)),
      }),
      { jugadores: 0, jugadoSc: 0, ganadoSc: 0, cobradoSc: 0 }
    );

    return res.json({
      success: true,
      data: {
        codigos: codigos.map((c) => ({
          _id: c._id,
          code: c.code,
          tramo: c.tramo,
          comision: c.comision,
          activo: c.activo,
          jugadores: c.jugadores || 0,
          jugadoPorLosSuyosSc: sc(c.jugadoPorLosSuyosSc || 0),
          ganadoSc: sc(c.ganadoSc || 0),
          cobradoSc: sc(c.cobradoSc || 0),
          porCobrarSc: sc(Math.max(0, (c.ganadoSc || 0) - (c.cobradoSc || 0))),
        })),
        total: { ...total, porCobrarSc: sc(Math.max(0, total.ganadoSc - total.cobradoSc)) },

        /* Quién lo trajo a él, si alguien lo trajo. */
        miCodigoDeEntrada: req.user.affiliateCode || null,
      },
    });
  } catch (err) {
    return responderError(res, err, "affiliate");
  }
});

router.post("/affiliate/claim", autorizar(true), async (req, res) => {
  try {
    const r = await afiliados.cobrar({ userId: req.user._id, codigoId: req.body.codigoId });
    return res.json({ success: true, data: { ...r, ...(await wallet.saldoDe(req.user._id)) } });
  } catch (err) {
    return responderError(res, err, "affiliate/claim");
  }
});

module.exports = router;
