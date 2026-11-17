const express = require("express");
const rateLimit = require("express-rate-limit");

const Box = require("../../database/models/Box");
const BoxOpen = require("../../database/models/BoxOpen");
const InventoryItem = require("../../database/models/InventoryItem");
const UserSeed = require("../../database/models/UserSeed");
const Settings = require("../../database/models/Settings");

const { autorizar } = require("../../middleware/auth");
const cajas = require("../../services/boxes");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[boxes] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/*
  UN LIMITE PROPIO PARA ABRIR.

  Mas alto que el de la entrada --abrir muchas seguidas es lo normal de
  un jugador enganchado-- pero existe: sin el, un script abre cajas tan
  rapido como la red aguante y vacia un saldo en un segundo, y de paso
  deja al servidor sin aire para los demas.
*/
const limiteAbrir = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.OPEN_RATE_LIMIT) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json(errorDe("RATE_LIMITED", {}, 429).aRespuesta()),
});

/* ── El catalogo ──────────────────────────────────────────────────── */

/**
 * LAS CAJAS.
 *
 * Se puede mirar sin cuenta: alguien que todavia no se registro tiene
 * que poder ver que hay y cuanto sale, que es lo que lo hace registrarse.
 */
router.get("/", autorizar(false), async (req, res) => {
  try {
    const filtro = { live: true };

    /* El admin puede pedir tambien las apagadas, para el panel. */
    if (req.query.all === "1" && req.user && ["admin", "owner"].includes(req.user.rank)) {
      delete filtro.live;
    }

    if (req.query.category) filtro.category = String(req.query.category);
    if (req.query.search) {
      const texto = String(req.query.search).trim();
      if (texto) filtro.name = { $regex: texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    /* Por precio: "las de menos de SC 5", "las de mas de SC 200". */
    const min = Number(req.query.min);
    const max = Number(req.query.max);
    if (Number.isFinite(min) || Number.isFinite(max)) {
      filtro.priceSc = {};
      if (Number.isFinite(min)) filtro.priceSc.$gte = min;
      if (Number.isFinite(max)) filtro.priceSc.$lte = max;
    }

    const ORDENES = {
      popular: { opens: -1 },
      nuevas: { createdAt: -1 },
      baratas: { priceSc: 1 },
      caras: { priceSc: -1 },
      nombre: { name: 1 },
    };
    const orden = ORDENES[req.query.sort] || ORDENES.popular;

    const pagina = Math.max(1, Number(req.query.page) || 1);
    const porPagina = Math.min(60, Math.max(1, Number(req.query.perPage) || 24));

    const [lista, total] = await Promise.all([
      Box.find(filtro).sort(orden).skip((pagina - 1) * porPagina).limit(porPagina).lean(),
      Box.countDocuments(filtro),
    ]);

    return res.json({
      success: true,
      data: {
        items: lista.map((c) => {
          const resumen = cajas.resumenDeCaja(c);
          /*
            En la grilla NO viajan los premios enteros: son hasta veinte
            objetos por caja y en una pagina de veinticuatro cajas eso es
            medio megabyte para dibujar unas tarjetas. Va el conteo y el
            mejor premio, que es lo que la tarjeta muestra.
          */
          const mejor = (c.prizes || []).reduce(
            (a, p) => (!a || p.valueSc > a.valueSc ? p : a), null
          );
          return {
            ...resumen,
            prizes: undefined,
            cuantosObjetos: (c.prizes || []).length,
            mejorPremio: mejor
              ? { name: mejor.name, valueSc: sc(mejor.valueSc), rarity: mejor.rarity, imageUrl: mejor.imageUrl }
              : null,
            live: c.live,
          };
        }),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "catalogo");
  }
});

/** Las categorias que existen de verdad, para armar los filtros. */
router.get("/categories", autorizar(false), async (req, res) => {
  try {
    const cats = await Box.distinct("category", { live: true });
    return res.json({ success: true, data: cats.filter(Boolean).sort() });
  } catch (err) {
    return responderError(res, err, "categories");
  }
});

/**
 * UNA CAJA, CON TODOS SUS PREMIOS Y SUS CHANCES.
 *
 * Las chances se muestran. Es lo que diferencia a este sitio de una
 * maquinita: el jugador ve exactamente que puede salir y con que
 * probabilidad, antes de poner un peso.
 */
router.get("/:slug", autorizar(false), async (req, res) => {
  try {
    const caja = await cajas.cajaPorSlug(req.params.slug);
    if (!caja.live && !(req.user && ["admin", "owner"].includes(req.user.rank))) {
      throw errorDe("BOX_NOT_LIVE");
    }
    const cfg = await Settings.leer();

    return res.json({
      success: true,
      data: {
        ...cajas.resumenDeCaja(caja),
        live: caja.live,
        /* Lo que se puede abrir de una, para dibujar el x1..x4. */
        maximoALaVez: cfg.cajasALaVez,
        /* El retorno, a la vista. No tenemos nada que esconder y es el
           numero que un jugador informado quiere ver. */
        retornoMostrado: Math.round((caja.retorno || 0) * 10000) / 100,
      },
    });
  } catch (err) {
    return responderError(res, err, "caja");
  }
});

/* ── Abrir ────────────────────────────────────────────────────────── */

/** De prueba: se sortea igual, no cobra, no paga y no guarda nada. */
router.post("/:slug/demo", autorizar(false), limiteAbrir, async (req, res) => {
  try {
    const r = await cajas.abrir({ user: null, slug: req.params.slug, veces: req.body.veces, demo: true });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "demo");
  }
});

/** La de verdad. */
router.post("/:slug/open", autorizar(true), limiteAbrir, async (req, res) => {
  try {
    const r = await cajas.abrir({ user: req.user, slug: req.params.slug, veces: req.body.veces });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "open");
  }
});

/** Las ultimas aperturas de todo el sitio, para el feed de la portada. */
router.get("/feed/latest", autorizar(false), async (req, res) => {
  try {
    const cuantas = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filas = await BoxOpen.find({ demo: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(cuantas)
      .populate("user", "username avatarUrl")
      .select("boxName boxSlug premio createdAt user")
      .lean();

    return res.json({
      success: true,
      data: filas.map((f) => ({
        _id: f._id,
        /* El nombre se tapa a medias, como en el diseno: se reconoce el
           propio sin exponer el de los demas. */
        username: enmascarar(f.user && f.user.username),
        avatarUrl: (f.user && f.user.avatarUrl) || "",
        boxName: f.boxName,
        boxSlug: f.boxSlug,
        premio: { name: f.premio.name, valueSc: sc(f.premio.valueSc), rarity: f.premio.rarity },
        createdAt: f.createdAt,
      })),
    });
  } catch (err) {
    return responderError(res, err, "feed");
  }
});

function enmascarar(nombre) {
  const n = String(nombre || "");
  if (n.length <= 3) return n;
  return n.slice(0, 1) + "****" + n.slice(-2);
}

module.exports = router;
module.exports.enmascarar = enmascarar;
