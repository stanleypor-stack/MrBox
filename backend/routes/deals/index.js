const express = require("express");

const Item = require("../../database/models/Item");
const Deal = require("../../database/models/Deal");

const { autorizar } = require("../../middleware/auth");
const deals = require("../../services/deals");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[deals] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/* ── El catálogo con el que se juega ──────────────────────────────── */

/**
 * LOS OBJETOS QUE SE PUEDEN PEDIR.
 *
 * El panel de la izquierda de Deals. Es el catálogo entero, filtrable
 * por texto, por precio y ordenable; viene paginado porque son más de
 * mil setecientos objetos y mandarlos todos de una es media hora de
 * teléfono de alguien.
 */
router.get("/items", async (req, res) => {
  try {
    const pagina = Math.max(1, Number(req.query.page) || 1);
    const porPagina = Math.min(60, Math.max(1, Number(req.query.perPage) || 24));

    /* Lo que esta por debajo del valor minimo no se puede jugar, asi
       que no se ofrece: mejor que no aparezca que un error al tocarlo. */
    const filtro = { active: true, valueSc: { $gte: deals.VALOR_MINIMO } };

    const texto = String(req.query.q || "").trim();
    if (texto) {
      const escapado = texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filtro.$or = [
        { name: { $regex: escapado, $options: "i" } },
        { brand: { $regex: escapado, $options: "i" } },
      ];
    }

    const maximo = Number(req.query.max);
    if (Number.isFinite(maximo) && maximo >= deals.VALOR_MINIMO) filtro.valueSc.$lte = maximo;

    const orden = req.query.sort === "asc" ? 1 : -1;

    const [filas, total] = await Promise.all([
      Item.find(filtro)
        .sort({ valueSc: orden, _id: 1 })
        .skip((pagina - 1) * porPagina)
        .limit(porPagina)
        .select("name brand valueSc rarity imageUrl category shippable")
        .lean(),
      Item.countDocuments(filtro),
    ]);

    return res.json({
      success: true,
      data: {
        items: filas.map((f) => ({ ...f, valueSc: sc(f.valueSc) })),
        page: pagina,
        perPage: porPagina,
        total,
        pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "items");
  }
});

/* ── Lo que cuesta un tiro ────────────────────────────────────────── */

/**
 * EL PRECIO, CALCULADO POR EL SERVIDOR.
 *
 * La pantalla hace la misma cuenta para que la barra se mueva sin
 * esperar a nadie, pero el número que vale es este. Si alguna vez las
 * dos no coinciden, la que manda es la de acá, y conviene que se note.
 */
router.get("/quote", async (req, res) => {
  try {
    const objeto = await Item.findById(req.query.itemId).lean();
    if (!objeto || !objeto.active) throw errorDe("ITEM_NOT_FOUND", {}, 404);

    /* El piso depende del objeto: el que manda es la apuesta minima. */
    const piso = deals.chanceMinimaDe(objeto.valueSc);
    const chance = Math.min(deals.CHANCE_MAX, Math.max(piso, Number(req.query.chance) || piso));

    return res.json({
      success: true,
      data: {
        itemId: objeto._id,
        valueSc: sc(objeto.valueSc),
        chance: Math.round(chance * 10000) / 10000,
        apuestaSc: deals.apuestaDe(objeto.valueSc, chance),
        chanceMin: piso,
        chanceMax: deals.CHANCE_MAX,
        apuestaMinimaSc: deals.APUESTA_MINIMA,
      },
    });
  } catch (err) {
    return responderError(res, err, "quote");
  }
});

/* ── Jugar ────────────────────────────────────────────────────────── */

/**
 * UN TIRO DE PRUEBA.
 *
 * Sin cuenta y sin plata. Sirve para entender el juego antes de poner
 * un peso, que a la larga es mejor negocio que esconderlo.
 */
router.post("/demo", async (req, res) => {
  try {
    const salida = await deals.jugar({
      user: { _id: null },
      itemId: req.body.itemId,
      chance: req.body.chance,
      veces: req.body.veces,
      demo: true,
    });
    return res.json({ success: true, data: salida });
  } catch (err) {
    return responderError(res, err, "demo");
  }
});

router.post("/play", autorizar(true), async (req, res) => {
  try {
    const salida = await deals.jugar({
      user: req.user,
      itemId: req.body.itemId,
      chance: req.body.chance,
      veces: req.body.veces,
      demo: false,
    });
    return res.json({ success: true, data: salida });
  } catch (err) {
    return responderError(res, err, "play");
  }
});

/* ── El historial y la prueba ─────────────────────────────────────── */

router.get("/mine", autorizar(true), async (req, res) => {
  try {
    const pagina = Math.max(1, Number(req.query.page) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(req.query.perPage) || 25));

    const filtro = { user: req.user._id, demo: { $ne: true } };

    const [filas, total] = await Promise.all([
      Deal.find(filtro)
        .sort({ createdAt: -1 })
        .skip((pagina - 1) * porPagina)
        .limit(porPagina)
        .lean(),
      Deal.countDocuments(filtro),
    ]);

    return res.json({
      success: true,
      data: {
        items: filas.map((f) => ({
          _id: f._id,
          itemName: f.itemName,
          imageUrl: f.imageUrl,
          rarity: f.rarity,
          valueSc: sc(f.valueSc),
          chance: f.chance,
          stakeSc: sc(f.stakeSc),
          gano: f.gano,
          diferenciaSc: sc((f.gano ? f.valueSc : 0) - f.stakeSc),
          nonce: f.nonce,
          hmac: f.hmac,
          numero: f.numero,
          createdAt: f.createdAt,
        })),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "mine");
  }
});

router.get("/verify/:id", async (req, res) => {
  try {
    return res.json({ success: true, data: await deals.verificar({ dealId: req.params.id }) });
  } catch (err) {
    return responderError(res, err, "verify");
  }
});

module.exports = router;
