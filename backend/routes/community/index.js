const express = require("express");

const Box = require("../../database/models/Box");
const BoxOpen = require("../../database/models/BoxOpen");
const BalanceTransaction = require("../../database/models/BalanceTransaction");

const { autorizar } = require("../../middleware/auth");
const comunidad = require("../../services/community");
const cajas = require("../../services/boxes");
const eco = require("../../services/boxes/economia");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[community] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/** Lo que se le muestra a cualquiera de una caja de la comunidad. */
function resumir(c) {
  return {
    ...cajas.resumenDeCaja(c),
    description: c.description || "",
    portada: c.portada || {},
    creador: c.creator && c.creator.username
      ? { username: c.creator.username }
      : null,
  };
}

/* ── El catálogo de la comunidad ──────────────────────────────────── */

router.get("/boxes", async (req, res) => {
  try {
    const pagina = Math.max(1, Number(req.query.page) || 1);
    const porPagina = Math.min(48, Math.max(1, Number(req.query.perPage) || 24));

    const filtro = { creator: { $ne: null }, live: true };

    const orden = { nuevas: { createdAt: -1 }, caras: { priceSc: -1 }, baratas: { priceSc: 1 } };

    const [filas, total] = await Promise.all([
      Box.find(filtro)
        .sort(orden[req.query.sort] || { opens: -1, createdAt: -1 })
        .skip((pagina - 1) * porPagina)
        .limit(porPagina)
        .populate("creator", "username")
        .lean(),
      Box.countDocuments(filtro),
    ]);

    return res.json({
      success: true,
      data: {
        items: filas.map(resumir),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "boxes");
  }
});

/* ── Las mías ─────────────────────────────────────────────────────── */

router.get("/mine", autorizar(true), async (req, res) => {
  try {
    const panel = await comunidad.panelDe(req.user._id);
    return res.json({
      success: true,
      data: {
        ...panel,
        cajas: panel.cajas.map((c) => ({
          _id: c._id,
          slug: c.slug,
          name: c.name,
          priceSc: sc(c.priceSc),
          retorno: c.retorno,
          live: c.live,
          estado: c.live ? "live" : c.approvalState,
          motivoDelRechazo: c.motivoDelRechazo || "",
          opens: c.opens || 0,
          ganadoSc: sc(c.ganadoPorElCreadorSc || 0),
          portada: c.portada || {},
          cuantosObjetos: (c.prizes || []).length,
          /* Los premios con su peso, para poder volver a editarla. */
          prizes: (c.prizes || []).map((p) => ({
            item: p.item,
            name: p.name,
            valueSc: sc(p.valueSc),
            chance: p.chance,
            peso: p.peso,
            rarity: p.rarity,
            imageUrl: p.imageUrl,
          })),
          createdAt: c.createdAt,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "mine");
  }
});

/**
 * LO QUE GANO EN LOS ULTIMOS 30 DIAS, DIA POR DIA.
 *
 * El gráfico del panel. Sale del LIBRO --las transacciones de tipo
 * `creator_share`-- y no de un contador aparte: un contador se
 * desincroniza y nadie se entera hasta que el creador reclama.
 *
 * Los treinta días salen completos aunque no haya habido nada: un
 * gráfico que salta de un día con plata al siguiente miente sobre la
 * forma de la curva.
 */
router.get("/earnings", autorizar(true), async (req, res) => {
  try {
    const dias = Math.min(90, Math.max(7, Number(req.query.days) || 30));

    /*
      LOS DIAS SE CUENTAN EN UTC, DE PUNTA A PUNTA.

      `$dateToString` de Mongo agrupa en UTC. Si acá se armara la lista
      de días con la medianoche LOCAL del servidor, las dos cuentas
      caerían en días distintos cada vez que el servidor no está en UTC
      --que es casi siempre-- y lo cobrado en las últimas horas no
      aparecería en ningún día de la serie.

      El total del gráfico dejaría de coincidir con el de los pagos, y
      el creador vería que le falta plata que sí cobró.
    */
    const hoy = new Date();
    const desde = new Date(Date.UTC(
      hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - (dias - 1)
    ));

    const filas = await BalanceTransaction.aggregate([
      { $match: { user: req.user._id, type: "creator_share", createdAt: { $gte: desde } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: "$amountSc" },
          cuantas: { $sum: 1 },
        },
      },
    ]);

    const porDia = new Map(filas.map((f) => [f._id, f]));
    const serie = [];
    for (let i = 0; i < dias; i += 1) {
      const d = new Date(desde.getTime() + i * 24 * 60 * 60 * 1000);
      const clave = d.toISOString().slice(0, 10);
      /* Misma clave que arma `$dateToString`: año-mes-día en UTC. */
      const fila = porDia.get(clave);
      serie.push({ dia: clave, ganadoSc: sc(fila ? fila.total : 0), cuantas: fila ? fila.cuantas : 0 });
    }

    /* Y lo que abrieron sus cajas en el mismo tramo, para "por apertura". */
    const mias = await Box.find({ creator: req.user._id }).select("_id").lean();
    const aperturas = await BoxOpen.countDocuments({
      box: { $in: mias.map((m) => m._id) },
      demo: { $ne: true },
      createdAt: { $gte: desde },
    });

    const ganado = sc(serie.reduce((a, s) => a + s.ganadoSc, 0));

    return res.json({
      success: true,
      data: {
        dias,
        serie,
        ganadoSc: ganado,
        aperturas,
        porAperturaSc: aperturas ? sc(ganado / aperturas) : 0,
      },
    });
  } catch (err) {
    return responderError(res, err, "earnings");
  }
});

/* ── Los pagos, uno por uno ───────────────────────────────────────── */

router.get("/payments", autorizar(true), async (req, res) => {
  try {
    const porPagina = Math.min(100, Math.max(1, Number(req.query.perPage) || 25));
    const filas = await BalanceTransaction.find({ user: req.user._id, type: "creator_share" })
      .sort({ createdAt: -1 })
      .limit(porPagina)
      .lean();

    return res.json({
      success: true,
      data: {
        items: filas.map((f) => ({
          _id: f._id,
          caja: (f.reference && f.reference.label) || "",
          amountSc: sc(f.amountSc),
          createdAt: f.createdAt,
        })),
        totalSc: sc(filas.reduce((a, f) => a + f.amountSc, 0)),
      },
    });
  } catch (err) {
    return responderError(res, err, "payments");
  }
});

/* ── Armar una ────────────────────────────────────────────────────── */

/**
 * LO QUE COSTARIA ESTA CAJA.
 *
 * El editor lo pide en cada cambio para mostrar el precio mientras se
 * arma. No guarda nada: es la misma cuenta que hace `guardar`, hecha de
 * prueba. Así el creador ve lo que va a pasar antes de que pase.
 */
router.post("/quote", async (req, res) => {
  try {
    const premios = await comunidad.premiosDesdeElPedido(req.body.premios);
    const revision = eco.revisarCaja({ prizes: premios }, { esDeComunidad: true });
    const precio = eco.precioDe(premios);

    return res.json({
      success: true,
      data: {
        priceSc: precio,
        pagoPromedio: revision.pagoPromedio,
        retorno: eco.retornoReal(premios, precio),
        ok: revision.ok,
        errores: revision.errores,
        avisos: revision.avisos,
        premios: premios.map((p) => ({
          item: p.item, name: p.name, valueSc: p.valueSc,
          chance: p.chance, peso: p.peso, rarity: p.rarity, imageUrl: p.imageUrl,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "quote");
  }
});

router.post("/", autorizar(true), async (req, res) => {
  try {
    const caja = await comunidad.guardar({
      user: req.user,
      nombre: req.body.name,
      descripcion: req.body.description,
      premios: req.body.premios,
      portada: req.body.portada,
    });
    return res.json({ success: true, data: resumir(caja) });
  } catch (err) {
    return responderError(res, err, "create");
  }
});

router.put("/:id", autorizar(true), async (req, res) => {
  try {
    const caja = await comunidad.guardar({
      user: req.user,
      boxId: req.params.id,
      nombre: req.body.name,
      descripcion: req.body.description,
      premios: req.body.premios,
      portada: req.body.portada,
    });
    return res.json({ success: true, data: resumir(caja) });
  } catch (err) {
    return responderError(res, err, "update");
  }
});

router.post("/:id/submit", autorizar(true), async (req, res) => {
  try {
    const caja = await comunidad.mandarARevisar({ user: req.user, boxId: req.params.id });
    return res.json({ success: true, data: { estado: caja.approvalState } });
  } catch (err) {
    return responderError(res, err, "submit");
  }
});

router.delete("/:id", autorizar(true), async (req, res) => {
  try {
    return res.json({ success: true, data: await comunidad.borrar({ user: req.user, boxId: req.params.id }) });
  } catch (err) {
    return responderError(res, err, "delete");
  }
});

module.exports = router;
