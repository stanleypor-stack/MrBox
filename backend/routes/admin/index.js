const express = require("express");

const vip = require("../../services/vip");
const User = require("../../database/models/User");
const Box = require("../../database/models/Box");
const Item = require("../../database/models/Item");
const Order = require("../../database/models/Order");
const BoxOpen = require("../../database/models/BoxOpen");
const Deal = require("../../database/models/Deal");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const Verification = require("../../database/models/Verification");
const SupportThread = require("../../database/models/SupportThread");
const AdminLog = require("../../database/models/AdminLog");
const AffiliateCode = require("../../database/models/AffiliateCode");
const Settings = require("../../database/models/Settings");
const Race = require("../../database/models/Race");
const Challenge = require("../../database/models/Challenge");
const Promotion = require("../../database/models/Promotion");
const InventoryItem = require("../../database/models/InventoryItem");

const { autorizar, soloAdmin } = require("../../middleware/auth");
const admin = require("../../services/admin");
const soporte = require("../../services/support");
const eco = require("../../services/boxes/economia");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

/*
  TODO EL PANEL PIDE SESION Y RANGO.

  Va una sola vez acá arriba y no ruta por ruta: una ruta nueva que se
  olvide del guardia es una puerta abierta, y eso pasa siempre.
*/
router.use(autorizar(true), soloAdmin());

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[admin] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/** Página y tamaño, con topes. Lo usan casi todas las listas. */
function paginar(req, porDefecto = 25) {
  const pagina = Math.max(1, Number(req.query.page) || 1);
  const porPagina = Math.min(200, Math.max(1, Number(req.query.perPage) || porDefecto));
  return { pagina, porPagina, saltar: (pagina - 1) * porPagina };
}

/* ══ El tablero ═══════════════════════════════════════════════════ */

/**
 * LOS NUMEROS DE ARRIBA.
 *
 * Todo sale del LIBRO, no de contadores: si un número de acá no coincide
 * con la suma de las transacciones, el que está mal es el número.
 */
router.get("/dashboard", async (req, res) => {
  try {
    const dias = Math.min(90, Math.max(1, Number(req.query.days) || 14));
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const [porTipo, jugadores, nuevos, cajasVivas, pendientes] = await Promise.all([
      BalanceTransaction.aggregate([
        { $match: { createdAt: { $gte: desde } } },
        { $group: { _id: "$type", total: { $sum: "$amountSc" }, cuantos: { $sum: 1 } } },
      ]),
      User.countDocuments({ rank: "user" }),
      User.countDocuments({ rank: "user", createdAt: { $gte: desde } }),
      Box.countDocuments({ live: true }),
      Promise.all([
        Order.countDocuments({ estado: { $in: ["pending", "packing"] } }),
        Verification.countDocuments({ estado: "pending" }),
        Box.countDocuments({ creator: { $ne: null }, approvalState: "pending" }),
        SupportThread.countDocuments({ estado: "waiting_us" }),
      ]),
    ]);

    const de = (t) => {
      const f = porTipo.find((x) => x._id === t);
      return f ? sc(f.total) : 0;
    };
    const cuantos = (t) => {
      const f = porTipo.find((x) => x._id === t);
      return f ? f.cuantos : 0;
    };

    const jugadoSc = sc(Math.abs(de("box_open")) + Math.abs(de("deal")));
    const pagadoSc = sc(de("item_sold") < 0 ? 0 : 0); // los premios no pasan por el libro
    const compradoSc = sc(de("purchase"));
    const canjeadoSc = sc(Math.abs(de("redemption")));

    /*
      EL MARGEN DE VERDAD.

      Lo jugado menos lo que volvió en objetos vendidos, menos lo que se
      pagó en carreras, desafíos, rakeback y comisiones. Es la cuenta
      que importa y la única que no miente: un margen calculado como
      "8% de lo jugado" sería el margen TEORICO, que es otra cosa.
    */
    const devueltoSc = sc(de("item_sold"));
    const regaladoSc = sc(
      de("race_prize") + de("challenge") + de("rakeback")
      + de("affiliate") + de("promo_code") + de("creator_share")
    );
    const margenSc = sc(jugadoSc - devueltoSc - regaladoSc);

    /* La curva de lo jugado por día. */
    const serie = await BalanceTransaction.aggregate([
      { $match: { type: { $in: ["box_open", "deal"] }, createdAt: { $gte: desde } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: { $abs: "$amountSc" } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    /* Las cajas más abiertas del período. */
    const top = await BoxOpen.aggregate([
      { $match: { demo: { $ne: true }, createdAt: { $gte: desde } } },
      { $group: { _id: "$boxName", aperturas: { $sum: 1 }, jugadoSc: { $sum: "$priceSc" } } },
      { $sort: { jugadoSc: -1 } },
      { $limit: 5 },
    ]);

    return res.json({
      success: true,
      data: {
        dias,
        jugadoSc,
        compradoSc,
        canjeadoSc,
        devueltoSc,
        regaladoSc,
        margenSc,
        margenPct: jugadoSc > 0 ? Math.round((margenSc / jugadoSc) * 10000) / 100 : 0,
        aperturas: cuantos("box_open"),
        deals: cuantos("deal"),
        compras: cuantos("purchase"),
        canjes: cuantos("redemption"),
        pagadoSc,
        jugadores,
        nuevos,
        cajasVivas,
        pendientes: {
          pedidos: pendientes[0],
          verificaciones: pendientes[1],
          cajasDeComunidad: pendientes[2],
          soporte: pendientes[3],
        },
        serie: serie.map((s) => ({ dia: s._id, jugadoSc: sc(s.total) })),
        top: top.map((t) => ({ name: t._id, aperturas: t.aperturas, jugadoSc: sc(t.jugadoSc) })),
      },
    });
  } catch (err) {
    return responderError(res, err, "dashboard");
  }
});

/* ══ Los jugadores ════════════════════════════════════════════════ */

router.get("/players", async (req, res) => {
  try {
    const { pagina, porPagina, saltar } = paginar(req);
    const filtro = {};

    const texto = String(req.query.q || "").trim();
    if (texto) {
      const esc = texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filtro.$or = [
        { username: { $regex: esc, $options: "i" } },
        { email: { $regex: esc, $options: "i" } },
      ];
    }
    if (req.query.banned === "true") filtro.banned = true;
    if (req.query.rank) filtro.rank = String(req.query.rank);

    const [filas, total] = await Promise.all([
      User.find(filtro)
        .sort({ createdAt: -1 })
        .skip(saltar)
        .limit(porPagina)
        .select("+balanceSc +bonoPendienteSc")
        .lean(),
      User.countDocuments(filtro),
    ]);

    return res.json({
      success: true,
      data: {
        items: filas.map((u) => ({
          _id: u._id,
          username: u.username,
          email: u.email,
          rank: u.rank,
          banned: !!u.banned,
          verificationLevel: u.verificationLevel,
          balanceSc: sc(u.balanceSc),
          jugadoSc: sc(u.jugadoSc),
          freeOpens: u.freeOpens,
          /* El rango puesto a mano y el que le toca hoy: la pagina de
             rangos los muestra al mover a alguien. */
          rangoManual: u.rangoManual || "",
          rango: vip.rangoDe(vip.jugadoParaVip(u), u.rangoManual).nombre,
          createdAt: u.createdAt,
          lastSeenAt: u.lastSeenAt,
        })),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "players");
  }
});

/** La ficha de uno: todo lo que hace falta para contestarle. */
router.get("/players/:id", async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select("+balanceSc +bonoPendienteSc").lean();
    if (!u) throw errorDe("ITEM_NOT_FOUND", {}, 404);

    const [movimientos, aperturas, inventario, codigos, kycFilas, pedidos] = await Promise.all([
      BalanceTransaction.find({ user: u._id }).sort({ createdAt: -1 }).limit(25).lean(),
      BoxOpen.countDocuments({ user: u._id, demo: { $ne: true } }),
      InventoryItem.aggregate([
        { $match: { user: u._id, state: "held" } },
        { $group: { _id: null, cuantos: { $sum: 1 }, valor: { $sum: "$valueSc" } } },
      ]),
      AffiliateCode.find({ owner: u._id }).lean(),
      Verification.find({ user: u._id }).sort({ nivel: 1 }).lean(),
      Order.find({ user: u._id }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    return res.json({
      success: true,
      data: {
        jugador: {
          _id: u._id,
          username: u.username,
          email: u.email,
          rank: u.rank,
          banned: !!u.banned,
          verificationLevel: u.verificationLevel,
          balanceSc: sc(u.balanceSc),
          bonoPendienteSc: sc(u.bonoPendienteSc),
          jugadoSc: sc(u.jugadoSc),
          freeOpens: u.freeOpens,
          affiliateCode: u.affiliateCode || "",
          limites: u.limites || {},
          createdAt: u.createdAt,
          lastSeenAt: u.lastSeenAt,
        },
        aperturas,
        inventario: {
          cuantos: (inventario[0] && inventario[0].cuantos) || 0,
          valorSc: sc((inventario[0] && inventario[0].valor) || 0),
        },
        movimientos: movimientos.map((m) => ({
          _id: m._id,
          type: m.type,
          amountSc: sc(m.amountSc),
          balanceAfter: sc(m.balanceAfter),
          label: (m.reference && m.reference.label) || "",
          reason: m.reason || "",
          createdAt: m.createdAt,
        })),
        codigos: codigos.map((c) => ({
          code: c.code, jugadores: c.jugadores || 0,
          ganadoSc: sc(c.ganadoSc || 0), cobradoSc: sc(c.cobradoSc || 0),
        })),
        /* De la verificación, el ESTADO. Nunca los datos ni los
           archivos: para mirarlos hay una ruta propia que deja rastro. */
        verificaciones: kycFilas.map((v) => ({
          nivel: v.nivel, estado: v.estado, motivo: v.motivo,
          adjuntos: v.adjuntos, createdAt: v.createdAt, revisadoEl: v.revisadoEl,
        })),
        pedidos: pedidos.map((p) => ({
          _id: p._id, estado: p.estado, valorSc: sc(p.valorSc),
          cuantos: (p.items || []).length, createdAt: p.createdAt,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "player");
  }
});

router.post("/players/:id/balance", async (req, res) => {
  try {
    const r = await admin.ajustarSaldo({
      admin: req.user,
      userId: req.params.id,
      montoSc: req.body.montoSc,
      motivo: req.body.motivo,
      req,
    });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "players/balance");
  }
});

router.post("/players/:id/ban", async (req, res) => {
  try {
    const r = await admin.cerrarCuenta({
      admin: req.user,
      userId: req.params.id,
      cerrar: !!req.body.cerrar,
      motivo: req.body.motivo,
      req,
    });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "players/ban");
  }
});

/* ══ Los movimientos ══════════════════════════════════════════════ */

router.get("/movements", async (req, res) => {
  try {
    const { pagina, porPagina, saltar } = paginar(req, 50);
    const filtro = {};
    if (req.query.type) filtro.type = { $in: String(req.query.type).split(",") };

    const [filas, total, suma] = await Promise.all([
      BalanceTransaction.find(filtro)
        .sort({ createdAt: -1 })
        .skip(saltar)
        .limit(porPagina)
        .populate("user", "username")
        .lean(),
      BalanceTransaction.countDocuments(filtro),
      BalanceTransaction.aggregate([
        { $match: filtro },
        { $group: { _id: null, total: { $sum: { $abs: "$amountSc" } } } },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        items: filas.map((m) => ({
          _id: m._id,
          username: m.user ? m.user.username : "—",
          type: m.type,
          amountSc: sc(m.amountSc),
          balanceAfter: sc(m.balanceAfter),
          label: (m.reference && m.reference.label) || "",
          reason: m.reason || "",
          createdAt: m.createdAt,
        })),
        movidoSc: sc(suma.length ? suma[0].total : 0),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "movements");
  }
});

/* ══ Las cajas ════════════════════════════════════════════════════ */

router.get("/boxes", async (req, res) => {
  try {
    const { pagina, porPagina, saltar } = paginar(req, 50);
    const filtro = { creator: null };

    const texto = String(req.query.q || "").trim();
    if (texto) {
      const esc = texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filtro.name = { $regex: esc, $options: "i" };
    }

    const [filas, total] = await Promise.all([
      Box.find(filtro).sort({ opens: -1 }).skip(saltar).limit(porPagina).lean(),
      Box.countDocuments(filtro),
    ]);

    /*
      EL RETORNO REAL, DE LO QUE DE VERDAD PASO.

      El teórico es 92% en todas por construcción. El real sale de las
      aperturas: lo que salió en premios sobre lo que entró. Con pocas
      aperturas no dice nada --por eso viaja `pocasAperturas`-- pero con
      miles, una caja lejos del 92% es una caja con un problema.
    */
    const ids = filas.map((b) => b._id);
    const reales = await BoxOpen.aggregate([
      { $match: { box: { $in: ids }, demo: { $ne: true } } },
      {
        $group: {
          _id: "$box",
          entro: { $sum: "$priceSc" },
          salio: { $sum: "$premio.valueSc" },
          cuantas: { $sum: 1 },
        },
      },
    ]);
    const porCaja = new Map(reales.map((r) => [String(r._id), r]));

    return res.json({
      success: true,
      data: {
        items: filas.map((b) => {
          const r = porCaja.get(String(b._id));
          const real = r && r.entro > 0 ? Math.round((r.salio / r.entro) * 10000) / 100 : null;
          return {
            _id: b._id,
            slug: b.slug,
            name: b.name,
            category: b.category,
            imageUrl: b.imageUrl,
            priceSc: sc(b.priceSc),
            retorno: Math.round((b.retorno || 0) * 10000) / 100,
            retornoReal: real,
            pocasAperturas: !r || r.cuantas < 2000,
            cuantosObjetos: (b.prizes || []).length,
            opens: b.opens || 0,
            live: !!b.live,
            featured: !!b.featured,
            markedNew: !!b.markedNew,
            riesgo: eco.riesgoDe(b.prizes, b.priceSc),
          };
        }),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "boxes");
  }
});

/** Una caja con sus premios, para el editor. */
router.get("/boxes/:id", async (req, res) => {
  try {
    const b = await Box.findById(req.params.id).lean();
    if (!b) throw errorDe("BOX_NOT_FOUND", {}, 404);

    const revision = eco.revisarCaja(b, { esDeComunidad: !!b.creator });

    return res.json({
      success: true,
      data: {
        ...b,
        priceSc: sc(b.priceSc),
        precioSugerido: eco.precioDe(b.prizes),
        pagoPromedio: eco.pagoPromedio(b.prizes),
        retornoReal: eco.retornoReal(b.prizes, b.priceSc),
        sumaDeChances: eco.sumaDeChances(b.prizes),
        revision,
      },
    });
  } catch (err) {
    return responderError(res, err, "box");
  }
});

/**
 * GUARDAR UNA CAJA.
 *
 * El precio se recalcula SIEMPRE de los premios, salvo que esté marcada
 * `precioAMano`. Escribir un precio cualquiera sobre una tabla de
 * premios es como se rompe el 92% sin que nadie se entere.
 */
router.put("/boxes/:id", async (req, res) => {
  try {
    const b = await Box.findById(req.params.id);
    if (!b) throw errorDe("BOX_NOT_FOUND", {}, 404);

    const antes = { name: b.name, priceSc: sc(b.priceSc), cuantos: b.prizes.length };

    if (req.body.name !== undefined) b.name = String(req.body.name).trim().slice(0, 60);
    if (req.body.category !== undefined) b.category = String(req.body.category).trim().slice(0, 40);
    if (req.body.featured !== undefined) b.featured = !!req.body.featured;
    if (req.body.markedNew !== undefined) b.markedNew = !!req.body.markedNew;
    if (req.body.precioAMano !== undefined) b.precioAMano = !!req.body.precioAMano;

    if (Array.isArray(req.body.prizes)) {
      const ids = req.body.prizes.map((p) => p.item);
      const objetos = await Item.find({ _id: { $in: ids } }).lean();
      const porId = new Map(objetos.map((o) => [String(o._id), o]));

      b.prizes = req.body.prizes.map((p) => {
        const o = porId.get(String(p.item));
        if (!o) throw errorDe("ITEM_NOT_FOUND", { cual: String(p.item) }, 404);
        return {
          item: o._id,
          name: o.name,
          valueSc: sc(o.valueSc),
          imageUrl: o.imageUrl,
          rarity: o.rarity,
          chance: Number(p.chance) || 0,
        };
      });
    }

    const revision = eco.revisarCaja(b, { esDeComunidad: !!b.creator });
    if (!revision.ok) throw errorDe("BOX_NOT_VALID", { errores: revision.errores });

    if (b.precioAMano && req.body.priceSc !== undefined) {
      b.priceSc = sc(req.body.priceSc);
    } else {
      b.priceSc = eco.precioDe(b.prizes);
    }

    b.pagoPromedio = eco.pagoPromedio(b.prizes);
    b.retorno = eco.retornoReal(b.prizes, b.priceSc);
    await b.save();

    await admin.anotar({
      admin: req.user,
      evento: "box.edit",
      sobre: { tipo: "box", id: b._id, nombre: b.name },
      antes,
      despues: { name: b.name, priceSc: sc(b.priceSc), cuantos: b.prizes.length },
      req,
    });

    return res.json({ success: true, data: { _id: b._id, priceSc: sc(b.priceSc), retorno: b.retorno, revision } });
  } catch (err) {
    return responderError(res, err, "boxes/save");
  }
});

router.post("/boxes/:id/live", async (req, res) => {
  try {
    const r = await admin.publicarCaja({ admin: req.user, boxId: req.params.id, live: !!req.body.live, req });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "boxes/live");
  }
});

/* ══ Las cajas de la comunidad ════════════════════════════════════ */

router.get("/community", async (req, res) => {
  try {
    const { pagina, porPagina, saltar } = paginar(req);
    const filtro = { creator: { $ne: null } };
    if (req.query.estado) filtro.approvalState = String(req.query.estado);

    const [filas, total] = await Promise.all([
      Box.find(filtro)
        .sort({ approvalState: 1, createdAt: -1 })
        .skip(saltar)
        .limit(porPagina)
        .populate("creator", "username")
        .lean(),
      Box.countDocuments(filtro),
    ]);

    return res.json({
      success: true,
      data: {
        items: filas.map((b) => ({
          _id: b._id,
          slug: b.slug,
          name: b.name,
          description: b.description || "",
          creador: b.creator ? b.creator.username : "—",
          priceSc: sc(b.priceSc),
          retorno: Math.round((b.retorno || 0) * 10000) / 100,
          cuantosObjetos: (b.prizes || []).length,
          estado: b.live ? "live" : b.approvalState,
          motivoDelRechazo: b.motivoDelRechazo || "",
          opens: b.opens || 0,
          ganadoPorElCreadorSc: sc(b.ganadoPorElCreadorSc || 0),
          portada: b.portada || {},
          prizes: (b.prizes || []).map((p) => ({
            name: p.name, valueSc: sc(p.valueSc), chance: p.chance, rarity: p.rarity, imageUrl: p.imageUrl,
          })),
          createdAt: b.createdAt,
        })),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "community");
  }
});

router.post("/community/:id/review", async (req, res) => {
  try {
    const r = await admin.revisarCajaDeComunidad({
      admin: req.user,
      boxId: req.params.id,
      aprobar: !!req.body.aprobar,
      motivo: req.body.motivo,
      req,
    });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "community/review");
  }
});

/* ══ El catálogo ══════════════════════════════════════════════════ */

router.get("/items", async (req, res) => {
  try {
    const { pagina, porPagina, saltar } = paginar(req, 50);
    const filtro = {};

    const texto = String(req.query.q || "").trim();
    if (texto) {
      const esc = texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filtro.$or = [
        { name: { $regex: esc, $options: "i" } },
        { brand: { $regex: esc, $options: "i" } },
        { sku: { $regex: esc, $options: "i" } },
      ];
    }
    if (req.query.category) filtro.category = String(req.query.category);

    const [filas, total] = await Promise.all([
      Item.find(filtro).sort({ valueSc: -1 }).skip(saltar).limit(porPagina).lean(),
      Item.countDocuments(filtro),
    ]);

    /* En cuántas cajas está cada uno: el dato que hace falta antes de
       cambiarle el precio a algo. */
    const ids = filas.map((i) => i._id);
    const enCajas = await Box.aggregate([
      { $match: { "prizes.item": { $in: ids } } },
      { $unwind: "$prizes" },
      { $match: { "prizes.item": { $in: ids } } },
      { $group: { _id: "$prizes.item", cuantas: { $sum: 1 } } },
    ]);
    const uso = new Map(enCajas.map((e) => [String(e._id), e.cuantas]));

    return res.json({
      success: true,
      data: {
        items: filas.map((i) => ({
          _id: i._id,
          sku: i.sku,
          name: i.name,
          brand: i.brand,
          category: i.category,
          valueSc: sc(i.valueSc),
          rarity: i.rarity,
          imageUrl: i.imageUrl,
          shippable: !!i.shippable,
          stock: i.stock,
          active: !!i.active,
          enCajas: uso.get(String(i._id)) || 0,
        })),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "items");
  }
});

/**
 * CAMBIARLE ALGO A UN OBJETO.
 *
 * Cambiar el valor REPRECIA todas las cajas que lo tienen: el precio de
 * una caja sale de sus premios. Se hace acá mismo y no "después",
 * porque una caja con un objeto que cambió de precio y un precio viejo
 * es una caja que ya no devuelve el 92%.
 */
router.put("/items/:id", async (req, res) => {
  try {
    const o = await Item.findById(req.params.id);
    if (!o) throw errorDe("ITEM_NOT_FOUND", {}, 404);

    const antes = { name: o.name, valueSc: sc(o.valueSc), active: o.active };

    if (req.body.name !== undefined) o.name = String(req.body.name).trim().slice(0, 120);
    if (req.body.brand !== undefined) o.brand = String(req.body.brand).trim().slice(0, 60);
    if (req.body.category !== undefined) o.category = String(req.body.category).trim().slice(0, 40);
    if (req.body.rarity !== undefined) o.rarity = String(req.body.rarity);
    if (req.body.shippable !== undefined) o.shippable = !!req.body.shippable;
    if (req.body.active !== undefined) o.active = !!req.body.active;
    if (req.body.stock !== undefined) {
      o.stock = req.body.stock === null || req.body.stock === "" ? null : Number(req.body.stock);
    }

    const cambiaElValor = req.body.valueSc !== undefined && sc(req.body.valueSc) !== sc(o.valueSc);
    if (cambiaElValor) {
      const nuevo = sc(req.body.valueSc);
      if (!(nuevo > 0)) throw errorDe("INVALID_AMOUNT", { campo: "valueSc" });
      o.valueSc = nuevo;
    }

    await o.save();

    let repreciadas = 0;
    if (cambiaElValor) {
      const cajas = await Box.find({ "prizes.item": o._id });
      for (const caja of cajas) {
        caja.prizes = caja.prizes.map((p) => (
          String(p.item) === String(o._id) ? { ...p.toObject(), valueSc: o.valueSc, name: o.name } : p
        ));
        caja.pagoPromedio = eco.pagoPromedio(caja.prizes);
        if (!caja.precioAMano) caja.priceSc = eco.precioDe(caja.prizes);
        caja.retorno = eco.retornoReal(caja.prizes, caja.priceSc);
        await caja.save();
        repreciadas += 1;
      }
    }

    await admin.anotar({
      admin: req.user,
      evento: "item.edit",
      sobre: { tipo: "item", id: o._id, nombre: o.name },
      antes,
      despues: { name: o.name, valueSc: sc(o.valueSc), active: o.active, repreciadas },
      req,
    });

    return res.json({ success: true, data: { _id: o._id, valueSc: sc(o.valueSc), repreciadas } });
  } catch (err) {
    return responderError(res, err, "items/save");
  }
});

/* ══ Los pedidos ══════════════════════════════════════════════════ */

router.get("/orders", async (req, res) => {
  try {
    const { pagina, porPagina, saltar } = paginar(req);
    const filtro = {};
    if (req.query.estado) filtro.estado = String(req.query.estado);

    const [filas, total, porEstado] = await Promise.all([
      Order.find(filtro)
        .sort({ estado: 1, createdAt: 1 })
        .skip(saltar)
        .limit(porPagina)
        .populate("user", "username verificationLevel")
        .lean(),
      Order.countDocuments(filtro),
      Order.aggregate([{ $group: { _id: "$estado", cuantos: { $sum: 1 } } }]),
    ]);

    return res.json({
      success: true,
      data: {
        items: filas.map((o) => ({
          _id: o._id,
          codigo: "MB-" + String(o._id).slice(-6).toUpperCase(),
          username: o.user ? o.user.username : "—",
          verificationLevel: o.user ? o.user.verificationLevel : 0,
          estado: o.estado,
          items: (o.items || []).map((i) => ({ name: i.name, valueSc: sc(i.valueSc) })),
          valorSc: sc(o.valorSc),
          destino: o.destino,
          transportista: o.transportista || "",
          seguimiento: o.seguimiento || "",
          motivo: o.motivo || "",
          createdAt: o.createdAt,
          despachadoEl: o.despachadoEl,
        })),
        porEstado: Object.fromEntries(porEstado.map((e) => [e._id, e.cuantos])),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "orders");
  }
});

router.post("/orders/:id/state", async (req, res) => {
  try {
    const r = await admin.moverPedido({
      admin: req.user,
      orderId: req.params.id,
      estado: req.body.estado,
      transportista: req.body.transportista,
      seguimiento: req.body.seguimiento,
      motivo: req.body.motivo,
      req,
    });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "orders/state");
  }
});

/* ══ La verificación ══════════════════════════════════════════════ */

router.get("/verification", async (req, res) => {
  try {
    const estado = String(req.query.estado || "pending");
    const filas = await Verification.find({ estado })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate("user", "username email verificationLevel createdAt")
      .lean();

    const cuentas = await Verification.aggregate([
      { $group: { _id: "$estado", cuantos: { $sum: 1 } } },
    ]);

    return res.json({
      success: true,
      data: {
        items: filas.map((v) => ({
          _id: v._id,
          userId: v.user ? v.user._id : null,
          username: v.user ? v.user.username : "—",
          email: v.user ? v.user.email : "",
          nivelActual: v.user ? v.user.verificationLevel : 0,
          nivel: v.nivel,
          estado: v.estado,
          adjuntos: v.adjuntos || [],
          motivo: v.motivo || "",
          createdAt: v.createdAt,
        })),
        porEstado: Object.fromEntries(cuentas.map((c) => [c._id, c.cuantos])),
      },
    });
  } catch (err) {
    return responderError(res, err, "verification");
  }
});

/**
 * LOS DATOS DE UNA VERIFICACION.
 *
 * Esta es LA ruta delicada del panel: devuelve el nombre real, el
 * documento y la dirección de una persona. Por eso:
 *
 *   - se pide por su cuenta, no viene en la lista
 *   - deja rastro de quién miró qué y cuándo
 *   - los archivos van aparte todavía (`/files`), porque mirar los
 *     datos no es lo mismo que descargar una foto del pasaporte
 */
router.get("/verification/:id/data", async (req, res) => {
  try {
    const v = await Verification.findById(req.params.id)
      .select("+datos")
      .populate("user", "username")
      .lean();
    if (!v) throw errorDe("ITEM_NOT_FOUND", {}, 404);

    await admin.anotar({
      admin: req.user,
      evento: "kyc.view",
      sobre: { tipo: "user", id: v.user ? v.user._id : null, nombre: v.user ? v.user.username : "" },
      despues: { nivel: v.nivel },
      req,
    });

    return res.json({ success: true, data: { nivel: v.nivel, datos: v.datos || {}, adjuntos: v.adjuntos || [] } });
  } catch (err) {
    return responderError(res, err, "verification/data");
  }
});

router.get("/verification/:id/files/:campo", async (req, res) => {
  try {
    const v = await Verification.findById(req.params.id)
      .select("+archivos")
      .populate("user", "username")
      .lean();
    if (!v) throw errorDe("ITEM_NOT_FOUND", {}, 404);

    const archivo = (v.archivos || []).find((a) => a.campo === req.params.campo);
    if (!archivo) throw errorDe("ITEM_NOT_FOUND", {}, 404);

    await admin.anotar({
      admin: req.user,
      evento: "kyc.file",
      sobre: { tipo: "user", id: v.user ? v.user._id : null, nombre: v.user ? v.user.username : "" },
      despues: { nivel: v.nivel, campo: req.params.campo },
      req,
    });

    return res.json({ success: true, data: { campo: archivo.campo, nombre: archivo.nombre, contenido: archivo.contenido } });
  } catch (err) {
    return responderError(res, err, "verification/file");
  }
});

router.post("/verification/:userId/:nivel", async (req, res) => {
  try {
    const r = await admin.revisarVerificacion({
      admin: req.user,
      userId: req.params.userId,
      nivel: req.params.nivel,
      aprobar: !!req.body.aprobar,
      motivo: req.body.motivo,
      req,
    });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "verification/review");
  }
});

/* ══ Lo que se mira y no se toca ══════════════════════════════════ */

/*
  Los socios no están acá: tienen su propio archivo (./afiliados), con la
  lista, la ficha de cada uno, los pedidos de rango, la cola de pagos por
  cabeza y la escalera editable.
*/

/** Las carreras: las tres vivas y las que cerraron. */
router.get("/races", async (req, res) => {
  try {
    const filas = await Race.find({}).sort({ estado: 1, hasta: -1 }).limit(60).lean();
    return res.json({
      success: true,
      data: {
        items: filas.map((c) => ({
          _id: c._id,
          tipo: c.tipo,
          desde: c.desde,
          hasta: c.hasta,
          premioTotalSc: sc(c.premioTotalSc),
          puestosQueCobran: (c.reparto || []).length,
          estado: c.estado,
          lider: (c.ganadores && c.ganadores[0]) ? c.ganadores[0].username : "—",
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "races");
  }
});

/** Los desafíos, con cuántos cupos se llevaron. */
router.get("/challenges", async (req, res) => {
  try {
    const filas = await Challenge.find({}).sort({ hasta: -1 }).limit(100).populate("box", "name").lean();
    return res.json({
      success: true,
      data: {
        items: filas.map((d) => ({
          _id: d._id,
          caja: d.box ? d.box.name : d.boxName,
          multiplicador: d.multiplicador,
          premioSc: sc(d.premioSc),
          cupos: d.cupos,
          cuposUsados: d.cuposUsados || 0,
          desde: d.desde,
          hasta: d.hasta,
          activo: !!d.activo,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "challenges");
  }
});

/** Las promociones, en crudo: el panel las edita en su idioma. */
router.get("/promotions", async (req, res) => {
  try {
    const filas = await Promotion.find({}).sort({ orden: 1 }).lean();
    return res.json({ success: true, data: { items: filas } });
  } catch (err) {
    return responderError(res, err, "promotions");
  }
});

/** El registro de lo que hizo el equipo. */
router.get("/activity", async (req, res) => {
  try {
    const { pagina, porPagina, saltar } = paginar(req, 50);
    const [filas, total] = await Promise.all([
      AdminLog.find({}).sort({ createdAt: -1 }).skip(saltar).limit(porPagina).lean(),
      AdminLog.countDocuments({}),
    ]);

    return res.json({
      success: true,
      data: {
        items: filas.map((l) => ({
          _id: l._id,
          admin: l.adminNombre,
          evento: l.evento,
          sobre: l.sobre,
          antes: l.antes,
          despues: l.despues,
          motivo: l.motivo,
          desde: l.desde,
          createdAt: l.createdAt,
        })),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "activity");
  }
});

/** Quién puede entrar al panel. */
router.get("/team", async (req, res) => {
  try {
    const filas = await User.find({ rank: { $in: ["support", "admin", "owner"] } })
      .sort({ rank: 1 })
      .lean();

    return res.json({
      success: true,
      data: {
        items: filas.map((u) => ({
          _id: u._id,
          username: u.username,
          email: u.email,
          rank: u.rank,
          lastSeenAt: u.lastSeenAt,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "team");
  }
});

/* ══ La configuración ═════════════════════════════════════════════ */

router.get("/settings", async (req, res) => {
  try {
    const cfg = await Settings.leer();

    /*
      LOS QUE NUNCA SE GUARDARON, CON SU VALOR DE VERDAD.

      `default:` de Mongoose solo corre cuando se CREA el documento: la
      configuracion del sitio se creo hace meses, asi que un campo
      agregado despues viene vacio y el panel lo dibujaba apagado...
      mientras el sitio lo trataba como encendido. Un interruptor que
      miente es peor que no tenerlo.

      Los valores de abajo son los mismos que usan los servicios
      (services/feed, services/support) cuando el campo no esta.
    */
    const p = cfg.pulls || {};
    const completo = Object.assign({}, cfg, {
      pulls: {
        relleno: p.relleno !== false,
        porMinuto: p.porMinuto || 90,
        baratosPct: p.baratosPct == null ? 85 : p.baratosPct,
        topeSc: p.topeSc || 10,
      },
    });

    return res.json({ success: true, data: completo });
  } catch (err) {
    return responderError(res, err, "settings");
  }
});

/**
 * GUARDAR LA CONFIGURACION.
 *
 * Solo el dueño. No es desconfianza: son los números que deciden cuánto
 * devuelve el sitio y cuánto se puede sacar, y una lista corta de gente
 * que los puede mover es más fácil de mirar que un registro largo.
 */
router.put("/settings", soloAdmin(["owner"]), async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const antes = JSON.parse(JSON.stringify(cfg));

    /*
      LO QUE SE PUEDE TOCAR, UNO POR UNO.

      Una lista blanca y no `{ ...req.body }`: con el cuerpo entero,
      cualquiera que mande `{ key: "otra" }` o un campo que mañana
      exista se lo guarda sin que nadie lo haya pensado.

      Las que llevan punto son las de adentro de un grupo. Van como
      ruta --"deals.margen"-- para pisar SOLO ese valor: con el grupo
      entero, mandar `deals: { margen: 0.1 }` borraria las otras cuatro
      perillas del grupo.
    */
    const permitidos = [
      /* El sitio */
      "siteName", "maintenance",
      /* Las cajas */
      "retornoObjetivo", "topePremioSc", "cajasALaVez", "tasaDeRecompra",
      /* La comunidad */
      "parteDelCreador", "objetosPorCajaDeComunidad.min", "objetosPorCajaDeComunidad.max",
      /* Regalos y bono */
      "aperturasDeRegalo", "aperturasDeDemo",
      "bonoPorDeposito.normal", "bonoPorDeposito.destacado", "vecesAJugarElBono",
      "bonoDeBienvenida.activo", "bonoDeBienvenida.pct", "bonoDeBienvenida.topeSc",
      "bonoDeBienvenida.vecesAJugar",
      "bonoDeBienvenida.minutos", "canjePideDosFirmas",
      "pisoDeCarreraSc.daily", "pisoDeCarreraSc.weekly", "pisoDeCarreraSc.monthly",
      "minimoDeCorredores",
      /* Canjes y envios */
      "canjeMinimoSc", "canjeNivelMinimo", "envioQuePideNivel3Sc", "envioNivelMinimo",
      /* Deals */
      "deals.chanceMinima", "deals.chanceMaxima", "deals.margen",
      "deals.ruedasALaVez", "deals.tiradasGratisPorItem",
      /* Carreras */
      "pozosDeCarrera", "pozosDeCarrera.daily", "pozosDeCarrera.weekly", "pozosDeCarrera.monthly",
      /* Soporte */
      "soporte.respuestaAutomatica", "soporte.horarioMostrado",
      /* La cinta de Live Pulls */
      "pulls.relleno", "pulls.porMinuto", "pulls.baratosPct", "pulls.topeSc",
    ];

    const cambios = {};
    for (const campo of permitidos) {
      const valor = campo.includes(".")
        ? campo.split(".").reduce((o, k) => (o == null ? undefined : o[k]), req.body)
        : req.body[campo];
      if (valor !== undefined) cambios[campo] = valor;
    }
    if (!Object.keys(cambios).length) throw errorDe("INVALID_AMOUNT", { campo: "settings" });

    /*
      `runValidators` es lo que impide que el retorno quede en 150%.
      Los topes estan en el esquema (min/max) y sin esto un `updateOne`
      no los mira: el esquema los aplica al crear, no al actualizar.
    */
    await Settings.updateOne({}, { $set: cambios }, { upsert: true, runValidators: true });

    await admin.anotar({
      admin: req.user,
      evento: "settings.edit",
      sobre: { tipo: "settings", nombre: "site" },
      antes,
      despues: cambios,
      req,
    });

    return res.json({ success: true, data: await Settings.leer() });
  } catch (err) {
    return responderError(res, err, "settings/save");
  }
});

/* ══ Deals, para mirarlos ═════════════════════════════════════════ */

router.get("/deals", async (req, res) => {
  try {
    const dias = Math.min(90, Math.max(1, Number(req.query.days) || 14));
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const resumen = await Deal.aggregate([
      { $match: { demo: { $ne: true }, createdAt: { $gte: desde } } },
      {
        $group: {
          _id: null,
          tiros: { $sum: 1 },
          jugadoSc: { $sum: "$stakeSc" },
          ganadoSc: { $sum: { $cond: ["$gano", "$valueSc", 0] } },
        },
      },
    ]);

    const r = resumen[0] || { tiros: 0, jugadoSc: 0, ganadoSc: 0 };
    const margen = r.jugadoSc > 0
      ? Math.round(((r.jugadoSc - r.ganadoSc) / r.jugadoSc) * 10000) / 100
      : 0;

    const ultimos = await Deal.find({ demo: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(25)
      .populate("user", "username")
      .lean();

    return res.json({
      success: true,
      data: {
        dias,
        tiros: r.tiros,
        jugadoSc: sc(r.jugadoSc),
        ganadoSc: sc(r.ganadoSc),
        margenPct: margen,
        items: ultimos.map((d) => ({
          _id: d._id,
          username: d.user ? d.user.username : "—",
          itemName: d.itemName,
          valueSc: sc(d.valueSc),
          chance: d.chance,
          stakeSc: sc(d.stakeSc),
          gano: d.gano,
          createdAt: d.createdAt,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "deals");
  }
});

/* ══ Soporte ═════════════════════════════════════════════════════ */

/**
 * LA BANDEJA.
 *
 * Ordenada por lo ultimo que paso, y con la cuenta de lo que espera
 * respuesta arriba. Lo que espera respuesta NO es un campo que alguien
 * marca: es el estado, y el estado lo mueve quien escribe (ver
 * services/support).
 */
router.get("/support", async (req, res) => {
  try {
    const datos = await soporte.bandeja({
      estado: req.query.estado || "",
      asignado: req.query.asignado || "",
      q: req.query.q || "",
      page: Number(req.query.page) || 1,
      perPage: Number(req.query.perPage) || 25,
    });

    return res.json({ success: true, data: datos });
  } catch (err) {
    return responderError(res, err, "support");
  }
});

/** Las respuestas guardadas, para no escribir veinte veces lo mismo. */
router.get("/support/canned", async (req, res) => {
  try {
    return res.json({ success: true, data: { items: await soporte.respuestasGuardadas() } });
  } catch (err) {
    return responderError(res, err, "support.canned");
  }
});

/** Una conversacion, con la ficha corta de quien escribe al costado. */
router.get("/support/:id", async (req, res) => {
  try {
    return res.json({ success: true, data: await soporte.verDelEquipo(req.params.id) });
  } catch (err) {
    return responderError(res, err, "support.thread");
  }
});

/** Contestar. Contestar tambien es hacerse cargo: queda asignada. */
router.post("/support/:id/reply", async (req, res) => {
  try {
    const hilo = await soporte.responder({
      hiloId: req.params.id,
      admin: req.user,
      texto: req.body.texto,
      cerrar: !!req.body.cerrar,
    });

    /*
      No va al registro del panel a proposito.

      El registro es para lo que cambia plata o cuentas: un ajuste, un
      cierre, un precio. Si ademas guardara cada respuesta de chat, el
      dia que haya que auditar un ajuste habria que buscarlo entre
      cuatro mil mensajes de "hola, ya te lo reviso".
    */
    return res.json({ success: true, data: hilo });
  } catch (err) {
    return responderError(res, err, "support.reply");
  }
});

/** Cerrarla, reabrirla o pasarsela a alguien. */
router.post("/support/:id/state", async (req, res) => {
  try {
    const hilo = await soporte.mover({
      hiloId: req.params.id,
      estado: req.body.estado,
      asignado: req.body.asignado === undefined ? undefined : (req.body.asignado || null),
    });
    return res.json({ success: true, data: hilo });
  } catch (err) {
    return responderError(res, err, "support.state");
  }
});

/*
  Las pantallas que MIRAN --pagos, canjes, riesgo, analitica, rangos,
  segmentos, portada, banners y registro-- viven en su propio archivo.
  Este ya tiene mil lineas de lo que TOCA plata y catalogo.
*/
router.use(require("./extra"));

/*
  LOS AFILIADOS: los socios, la ficha de cada uno, los pedidos de rango,
  la cola de pagos por cabeza y la escalera de los cuatro modelos.

  VA ANTES DE `./editar` A PROPOSITO. Ese archivo tiene un comodín
  --`put("/:cosa/:id")`-- que se come cualquier ruta de dos tramos, y si
  se monta primero, `/affiliates/ladder` nunca llega hasta acá.
*/
router.use(require("./afiliados"));

/*
  Y lo que se CREA y se EDITA desde el panel: carreras, promociones,
  codigos, desafios, banners, las filas de la portada y los rangos.
*/
router.use(require("./editar"));

/*
  Y la FICHA de un jugador, que es la pantalla mas grande del panel:
  sus numeros, sus movimientos, sus aperturas, su inventario, sus
  pedidos, sus accesos, su verificacion y sus trabas.
*/
router.use(require("./jugador"));

/* Y una CARRERA por dentro: quien va ganando, quien cobro y quien no. */
router.use(require("./carreras"));

module.exports = router;
