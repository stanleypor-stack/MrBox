const express = require("express");

const InventoryItem = require("../../database/models/InventoryItem");
const BoxOpen = require("../../database/models/BoxOpen");
const UserSeed = require("../../database/models/UserSeed");
const Settings = require("../../database/models/Settings");
const User = require("../../database/models/User");

const { autorizar } = require("../../middleware/auth");
const envios = require("../../services/shipping");
const cajas = require("../../services/boxes");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[inventory] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/* ── Lo que tiene ─────────────────────────────────────────────────── */

/**
 * EL INVENTARIO.
 *
 * Lo que gano y todavia no vendio ni mando a su casa.
 *
 * Viene con `puedeEnviarse` ya resuelto por objeto, y no solo con el
 * nivel de verificacion: la pantalla no tiene que saber la regla de los
 * SC 1.000 ni rehacerla. Si esa regla cambia, cambia en un lugar.
 */
router.get("/", autorizar(true), async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const usuario = await User.findById(req.user._id);

    const estado = String(req.query.state || "held");
    const filtro = { user: req.user._id };
    if (estado !== "all") filtro.state = estado;

    /* El piso de verificacion para enviar lo dice el panel. */
    const nivelEnvio = Number(cfg.envioNivelMinimo) || 3;

    const ORDENES = { nuevo: { createdAt: -1 }, caro: { valueSc: -1 }, barato: { valueSc: 1 } };
    const orden = ORDENES[req.query.sort] || ORDENES.nuevo;

    const pagina = Math.max(1, Number(req.query.page) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(req.query.perPage) || 36));

    const [lista, total, resumen] = await Promise.all([
      InventoryItem.find(filtro).sort(orden).skip((pagina - 1) * porPagina).limit(porPagina).lean(),
      InventoryItem.countDocuments(filtro),
      InventoryItem.aggregate([
        { $match: { user: req.user._id, state: "held" } },
        { $group: { _id: null, cuantos: { $sum: 1 }, valor: { $sum: "$valueSc" } } },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        items: lista.map((o) => ({
          _id: o._id,
          name: o.name,
          imageUrl: o.imageUrl,
          rarity: o.rarity,
          valueSc: sc(o.valueSc),
          state: o.state,
          shippable: o.shippable,
          /* Lo que se le paga si lo vende, ya calculado con la tasa. */
          seVendePorSc: sc(o.valueSc * (cfg.tasaDeRecompra ?? 1)),
          /* Si lo puede mandar a su casa, y si no, por que. */
          puedeEnviarse: o.shippable && usuario.puedeEnviar(o.valueSc, nivelEnvio, cfg.envioQuePideNivel3Sc),
          porQueNoSeEnvia: !o.shippable
            ? "ITEM_NOT_SHIPPABLE"
            : (usuario.trabas && usuario.trabas.envio)
              ? "SHIPPING_LOCKED"
            : usuario.puedeEnviar(o.valueSc, nivelEnvio, cfg.envioQuePideNivel3Sc)
              ? null
              : o.valueSc > cfg.envioQuePideNivel3Sc
                ? "NECESITA_NIVEL_3"
                : `NECESITA_NIVEL_${nivelEnvio}`,
          createdAt: o.createdAt,
        })),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
        resumen: {
          cuantos: (resumen[0] && resumen[0].cuantos) || 0,
          valorSc: sc((resumen[0] && resumen[0].valor) || 0),
        },
        verificationLevel: usuario.verificationLevel,
        /* Lo que pide el envio, para que la pantalla lo diga sin adivinar. */
        envioNivelMinimo: nivelEnvio,
        envioQuePideNivel3Sc: sc(cfg.envioQuePideNivel3Sc),
      },
    });
  } catch (err) {
    return responderError(res, err, "listar");
  }
});

/** Vender un objeto por SC. */
router.post("/:id/sell", autorizar(true), async (req, res) => {
  try {
    const r = await cajas.vender({ user: req.user, inventoryItemId: req.params.id });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "vender");
  }
});

/**
 * Vender VARIOS de una.
 *
 * El boton "vender todo" del diseno. Se venden de a uno y se cuenta lo
 * que salio bien: si uno falla --ya estaba vendido, por ejemplo-- los
 * demas se venden igual. Cortar todo porque uno fallo seria peor.
 */
router.post("/sell-many", autorizar(true), async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 200) : [];
    if (!ids.length) throw errorDe("ITEM_NOT_FOUND", {}, 404);

    let vendidos = 0;
    let totalSc = 0;
    const fallaron = [];

    for (const id of ids) {
      try {
        const r = await cajas.vender({ user: req.user, inventoryItemId: id });
        vendidos += 1;
        totalSc = sc(totalSc + r.vendidoSc);
      } catch (err) {
        fallaron.push({ id, code: err.code || "SOMETHING_WENT_WRONG" });
      }
    }

    const wallet = require("../../services/wallet");
    return res.json({
      success: true,
      data: { vendidos, totalSc, fallaron, ...(await wallet.saldoDe(req.user._id)) },
    });
  } catch (err) {
    return responderError(res, err, "vender-varios");
  }
});

/* ── El sorteo verificable ────────────────────────────────────────── */

/**
 * SUS SEMILLAS.
 *
 * El hash de la del servidor --tapada--, la suya y cuantas lleva
 * abiertas con esta tanda. Es lo que mira antes de jugar.
 */
router.get("/fair/seed", autorizar(true), async (req, res) => {
  try {
    const tanda = await cajas.semillaDe(req.user._id);
    const anteriores = await UserSeed.find({ user: req.user._id, activa: false })
      .select("semillaServidorHash semillaCliente nonce reveladaEn")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.json({
      success: true,
      data: {
        actual: {
          semillaServidorHash: tanda.semillaServidorHash,
          semillaCliente: tanda.semillaCliente,
          nonce: tanda.nonce,
        },
        anteriores,
      },
    });
  } catch (err) {
    return responderError(res, err, "seed");
  }
});

/** Cambiar de semilla. Revela la vieja: a partir de ahi se verifica todo. */
router.post("/fair/rotate", autorizar(true), async (req, res) => {
  try {
    const r = await cajas.rotarSemilla({ user: req.user, semillaCliente: req.body.semillaCliente });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "rotate");
  }
});

/** Rehacer el sorteo de una apertura. */
router.get("/fair/verify/:boxOpenId", autorizar(true), async (req, res) => {
  try {
    const r = await cajas.verificar({ user: req.user, boxOpenId: req.params.boxOpenId });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "verify");
  }
});

/** El historial de aperturas del jugador. */
router.get("/openings", autorizar(true), async (req, res) => {
  try {
    const pagina = Math.max(1, Number(req.query.page) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(req.query.perPage) || 25));

    const [filas, total] = await Promise.all([
      BoxOpen.find({ user: req.user._id, demo: { $ne: true } })
        .sort({ createdAt: -1 })
        .skip((pagina - 1) * porPagina)
        .limit(porPagina)
        .select("boxName boxSlug priceSc premio nonce numero hmac semillaServidorHash conAperturaGratis createdAt")
        .lean(),
      BoxOpen.countDocuments({ user: req.user._id, demo: { $ne: true } }),
    ]);

    return res.json({
      success: true,
      data: {
        items: filas.map((f) => ({
          ...f,
          priceSc: sc(f.priceSc),
          premio: { ...f.premio, valueSc: sc(f.premio.valueSc) },
          /* Lo que gano o perdio en esa apertura, ya restado.

             Con una apertura gratis no puso nada, asi que lo ganado es
             el premio entero: restarle el precio de lista le mostraria
             una perdida que nunca tuvo. */
          diferenciaSc: sc(f.premio.valueSc - (f.conAperturaGratis ? 0 : f.priceSc)),
        })),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "openings");
  }
});

/* ── Mandarlo a una casa ──────────────────────────────── */

/**
 * PEDIR UN ENVIO.
 *
 * Uno o varios objetos a una de sus direcciones. No devuelve plata: ya
 * la pagó cuando abrió la caja.
 */
router.post("/ship", autorizar(true), async (req, res) => {
  try {
    const r = await envios.pedir({
      user: req.user,
      ids: Array.isArray(req.body.ids) ? req.body.ids : [req.body.id].filter(Boolean),
      addressId: req.body.addressId,
    });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "ship");
  }
});

/** Cancela un pedido que todavía no salió, y devuelve los objetos. */
router.post("/ship/:orderId/cancel", autorizar(true), async (req, res) => {
  try {
    const r = await envios.cancelar({ user: req.user, orderId: req.params.orderId });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "ship/cancel");
  }
});

module.exports = router;
