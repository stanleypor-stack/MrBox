const express = require("express");

const User = require("../../database/models/User");
const Box = require("../../database/models/Box");
const Banner = require("../../database/models/Banner");
const PromoCode = require("../../database/models/PromoCode");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const SessionEvent = require("../../database/models/SessionEvent");
const RakebackClaim = require("../../database/models/RakebackClaim");

const vip = require("../../services/vip");
const admin = require("../../services/admin");
const caja = require("../../services/cashier");
const oxapay = require("../../services/cashier/oxapay");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger, ultimasLineas } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[admin] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/**
 * LAS PANTALLAS QUE FALTABAN DEL PANEL.
 *
 * El panel del diseño tiene treinta y tres secciones. Las que mueven
 * plata o catálogo están en `index.js`; acá están las que MIRAN: pagos,
 * canjes, riesgo, analítica, rangos, segmentos, la portada, los banners
 * y el registro.
 *
 * TODO SALE DEL LIBRO O DE LA BASE
 *
 * Ninguna guarda un contador propio. "Compró 612 veces" se cuenta
 * contando compras; si el número sorprende, se puede ir a mirar las
 * filas que lo formaron. Un contador no se puede auditar: solo se puede
 * creer o no.
 *
 * LO QUE TODAVIA NO EXISTE, LO DICE
 *
 * Monedas, códigos promocionales, páginas legales y buscadores son
 * pantallas que esperan algo que aún no está (OxaPay, sobre todo).
 * Devuelven la lista vacía y un motivo, en vez de números inventados:
 * un panel que miente es peor que uno incompleto.
 */

const DIA = 24 * 60 * 60 * 1000;

function desdeDias(req, porDefecto = 14) {
  const dias = Math.min(365, Math.max(1, Number(req.query.days) || porDefecto));
  return { dias, desde: new Date(Date.now() - dias * DIA) };
}

/** Las filas del libro de un tipo, con el nombre de quien las hizo. */
async function delLibro(tipo, { desde, page = 1, perPage = 25 }) {
  const filtro = { type: tipo };
  if (desde) filtro.createdAt = { $gte: desde };

  const [filas, total, suma] = await Promise.all([
    BalanceTransaction.find(filtro)
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate("user", "username email")
      .lean(),
    BalanceTransaction.countDocuments(filtro),
    BalanceTransaction.aggregate([{ $match: filtro }, { $group: { _id: null, t: { $sum: "$amountSc" } } }]),
  ]);

  return {
    items: filas.map((f) => ({
      _id: f._id,
      createdAt: f.createdAt,
      userId: f.user && f.user._id,
      username: (f.user && f.user.username) || "—",
      amountSc: sc(f.amountSc),
      balanceAfter: sc(f.balanceAfter),
      label: (f.reference && f.reference.label) || f.reason || "",
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    totalSc: sc(suma.length ? Math.abs(suma[0].t) : 0),
  };
}

/* ══ Pagos ═══════════════════════════════════════════════════════ */

/**
 * LAS COMPRAS DE SC.
 *
 * Salen del libro, que es donde están de verdad. Cuando entre OxaPay,
 * cada fila va a poder decir además con qué moneda y en qué red se
 * pagó; hasta entonces dice lo que sabemos, que es cuánto y cuándo.
 */
router.get("/payments", async (req, res) => {
  try {
    const { dias, desde } = desdeDias(req);
    const datos = await delLibro("purchase", {
      desde,
      page: Number(req.query.page) || 1,
      /* Con tope, como el resto: sin el, `?perPage=9999999` se lleva
         la coleccion entera de una. */
      perPage: Math.min(200, Math.max(1, Number(req.query.perPage) || 25)),
    });

    return res.json({
      success: true,
      data: {
        ...datos,
        dias,
        promedioSc: datos.total ? sc(datos.totalSc / datos.total) : 0,
        /* La pasarela todavía no está conectada. */
        pasarela: "oxapay",
        conectada: oxapay.configurada(),
      },
    });
  } catch (err) {
    return responderError(res, err, "payments");
  }
});

/* ══ Canjes ══════════════════════════════════════════════════════ */

/**
 * LA COLA DE CANJES.
 *
 * Lo mas viejo arriba: el que pidio primero espera menos. El saldo ya
 * se le descontó al pedir, asi que rechazar DEVUELVE la plata y pagar
 * no la vuelve a tocar (ver services/cashier).
 */
router.get("/redemptions", async (req, res) => {
  try {
    const datos = await caja.cola({
      estado: req.query.estado || "",
      page: Number(req.query.page) || 1,
      /* Con tope, como el resto: sin el, `?perPage=9999999` se lleva
         la coleccion entera de una. */
      perPage: Math.min(200, Math.max(1, Number(req.query.perPage) || 25)),
    });

    return res.json({
      success: true,
      data: { ...datos, listaParaPagar: oxapay.listaParaPagar() },
    });
  } catch (err) {
    return responderError(res, err, "redemptions");
  }
});

/** Aprobar, pagar o rechazar. Todo queda en el registro del panel. */
router.post("/redemptions/:id/:accion", async (req, res) => {
  try {
    const pedido = await caja.resolver({
      admin: req.user,
      id: req.params.id,
      accion: req.params.accion,
      motivo: req.body.motivo,
    });

    await admin.anotar({
      admin: req.user,
      evento: "redemption." + req.params.accion,
      sobre: { tipo: "redemption", id: pedido._id, nombre: pedido.moneda + " " + pedido.montoSc },
      despues: { estado: pedido.estado },
      motivo: req.body.motivo || "",
      req,
    });

    return res.json({ success: true, data: pedido });
  } catch (err) {
    return responderError(res, err, "redemptions.resolve");
  }
});

/* ══ Riesgo ══════════════════════════════════════════════════════ */

/**
 * LAS SEÑALES QUE SE PUEDEN MIRAR HOY.
 *
 * Tres, y las tres salen de datos que ya tenemos:
 *
 *  - cuentas que entran desde la misma IP;
 *  - quien se refirió a sí mismo;
 *  - quien canjeó más de lo que jugó.
 *
 * Ninguna es una acusación: son filas para MIRAR. Cerrar una cuenta
 * sigue siendo una decisión de una persona, con su motivo escrito, y
 * queda en el registro del panel.
 */
router.get("/risk", async (req, res) => {
  try {
    const { desde: desdeCuando } = desdeDias(req, 30);

    const [porIp, propios, canjes] = await Promise.all([
      SessionEvent.aggregate([
        /* `desde` es la IP ya recortada: alcanza para ver que dos
           cuentas entran del mismo lado sin guardar la IP entera. */
        { $match: { createdAt: { $gte: desdeCuando }, desde: { $ne: "" } } },
        { $group: { _id: "$desde", usuarios: { $addToSet: "$user" }, ultimo: { $max: "$createdAt" } } },
        { $match: { $expr: { $gt: [{ $size: "$usuarios" }, 1] } } },
        { $sort: { ultimo: -1 } },
        { $limit: 40 },
      ]),
      /* Referirse a uno mismo: el servicio ya lo impide, pero una
         cuenta vieja o un arreglo a mano podrian tenerlo igual. */
      User.aggregate([
        { $match: { referredBy: { $ne: null } } },
        { $match: { $expr: { $eq: ["$referredBy", "$_id"] } } },
        { $project: { username: 1 } },
        { $limit: 40 },
      ]),
      BalanceTransaction.aggregate([
        { $match: { type: { $in: ["redemption", "box_open", "deal"] } } },
        {
          $group: {
            _id: "$user",
            canjeado: { $sum: { $cond: [{ $eq: ["$type", "redemption"] }, { $abs: "$amountSc" }, 0] } },
            jugado: { $sum: { $cond: [{ $ne: ["$type", "redemption"] }, { $abs: "$amountSc" }, 0] } },
          },
        },
        { $match: { canjeado: { $gt: 0 }, $expr: { $gt: ["$canjeado", "$jugado"] } } },
        { $limit: 40 },
      ]),
    ]);

    /* Los nombres, de una sola vez. */
    const ids = new Set();
    for (const f of porIp) for (const u of f.usuarios) ids.add(String(u));
    for (const c of canjes) ids.add(String(c._id));

    const gente = await User.find({ _id: { $in: [...ids] } }).select("username").lean();
    const nombre = new Map(gente.map((u) => [String(u._id), u.username]));

    const items = [];

    for (const f of porIp) {
      items.push({
        _id: "ip-" + f._id,
        senal: "shared_ip",
        cuentas: f.usuarios.map((u) => nombre.get(String(u)) || "?").join(", "),
        detalle: f.usuarios.length + " · " + f._id,
        cuando: f.ultimo,
      });
    }

    for (const u of propios) {
      items.push({
        _id: "self-" + u._id,
        senal: "self_referral",
        cuentas: u.username,
        detalle: "referredBy = self",
        cuando: null,
      });
    }

    for (const c of canjes) {
      items.push({
        _id: "out-" + c._id,
        senal: "cashed_out_more",
        cuentas: nombre.get(String(c._id)) || "?",
        detalle: `SC ${sc(c.canjeado)} / SC ${sc(c.jugado)}`,
        cuando: null,
      });
    }

    return res.json({
      success: true,
      data: {
        items,
        total: items.length,
        porSenal: {
          shared_ip: porIp.length,
          self_referral: propios.length,
          cashed_out_more: canjes.length,
        },
      },
    });
  } catch (err) {
    return responderError(res, err, "risk");
  }
});

/* ══ Analítica ═══════════════════════════════════════════════════ */

/**
 * EL EMBUDO Y LOS MESES.
 *
 * Cuánta gente se anotó, cuánta compró alguna vez y cuánto compró cada
 * una, mes por mes. Es la pantalla que contesta "¿esto crece?".
 */
router.get("/analytics", async (req, res) => {
  try {
    const { dias, desde } = desdeDias(req);

    const [nuevos, compradores, porMes, jugadoPorMes] = await Promise.all([
      User.countDocuments({ rank: "user", createdAt: { $gte: desde } }),
      BalanceTransaction.distinct("user", { type: "purchase", createdAt: { $gte: desde } }),
      User.aggregate([
        { $match: { rank: "user" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            jugadores: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 12 },
      ]),
      BalanceTransaction.aggregate([
        {
          $group: {
            _id: {
              mes: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
              tipo: "$type",
            },
            total: { $sum: { $abs: "$amountSc" } },
            gente: { $addToSet: "$user" },
          },
        },
      ]),
    ]);

    const mes = new Map();
    for (const f of jugadoPorMes) {
      const m = mes.get(f._id.mes) || { compradoSc: 0, jugadoSc: 0, compradores: 0 };
      if (f._id.tipo === "purchase") { m.compradoSc = sc(f.total); m.compradores = f.gente.length; }
      if (f._id.tipo === "box_open" || f._id.tipo === "deal") m.jugadoSc = sc(m.jugadoSc + f.total);
      mes.set(f._id.mes, m);
    }

    const items = porMes.map((p) => {
      const m = mes.get(p._id) || {};
      return {
        _id: p._id,
        mes: p._id,
        jugadores: p.jugadores,
        compradores: m.compradores || 0,
        compradoSc: m.compradoSc || 0,
        jugadoSc: m.jugadoSc || 0,
      };
    });

    const compradoTotal = await BalanceTransaction.aggregate([
      { $match: { type: "purchase", createdAt: { $gte: desde } } },
      { $group: { _id: null, t: { $sum: "$amountSc" } } },
    ]);
    const comprado = sc(compradoTotal.length ? compradoTotal[0].t : 0);

    return res.json({
      success: true,
      data: {
        items,
        total: items.length,
        dias,
        nuevos,
        compradores: compradores.length,
        conversionPct: nuevos ? Math.round((compradores.length / nuevos) * 1000) / 10 : 0,
        porCompradorSc: compradores.length ? sc(comprado / compradores.length) : 0,
        compradoSc: comprado,
      },
    });
  } catch (err) {
    return responderError(res, err, "analytics");
  }
});

/* ══ Rangos VIP ══════════════════════════════════════════════════ */

/**
 * LOS NUEVE RANGOS, CON CUANTA GENTE HAY EN CADA UNO.
 *
 * La tabla sale del servicio --es la misma que ve el jugador-- y la
 * cuenta de gente sale de contar cuánto jugó cada uno. Si acá dijera
 * otra cosa que la pantalla del Club VIP, una de las dos estaría
 * mintiendo.
 */
router.get("/ranks", async (req, res) => {
  try {
    const tabla = vip.tabla();

    /*
      CADA RANGO CON SU GENTE Y SU PLATA.

      No alcanza con "cuántos hay en Gold": la pregunta de verdad es
      cuánto juega Gold, cuánto deposita y cuánto se le devuelve. Eso
      es lo que dice si un rango está bien puesto o si se está
      regalando rakeback a gente que no mueve nada.
    */
    const gente = await User.find({ rank: "user" }).select("jugadoSc rangoManual").lean();

    const deQuien = new Map(); // userId -> rango
    const porRango = new Map(); // rango -> { jugadores, jugadoSc }
    for (const u of gente) {
      const r = vip.rangoDe(vip.jugadoParaVip(u), u.rangoManual);
      deQuien.set(String(u._id), r.nombre);
      const a = porRango.get(r.nombre) || { jugadores: 0, jugadoSc: 0 };
      a.jugadores += 1;
      a.jugadoSc += Number(u.jugadoSc) || 0;
      porRango.set(r.nombre, a);
    }

    /* Lo comprado y lo devuelto, por persona, del LIBRO. */
    const porPersona = await BalanceTransaction.aggregate([
      { $match: { type: { $in: ["purchase", "rakeback"] } } },
      { $group: { _id: { u: "$user", t: "$type" }, total: { $sum: "$amountSc" } } },
    ]);

    const compras = new Map();
    const rakes = new Map();
    for (const f of porPersona) {
      const rango = deQuien.get(String(f._id.u));
      if (!rango) continue;
      const donde = f._id.t === "purchase" ? compras : rakes;
      donde.set(rango, (donde.get(rango) || 0) + f.total);
    }

    const { desde } = desdeDias(req);
    const rake = await BalanceTransaction.aggregate([
      { $match: { type: "rakeback", createdAt: { $gte: desde } } },
      { $group: { _id: null, t: { $sum: "$amountSc" } } },
    ]);

    const total = gente.length || 1;

    return res.json({
      success: true,
      data: {
        items: tabla.map((r) => {
          const a = porRango.get(r.nombre) || { jugadores: 0, jugadoSc: 0 };
          return {
            _id: r.nombre,
            numero: r.numero,
            rango: r.nombre,
            color: r.color,
            desdeSc: r.desde,
            /* El del periodo semanal, que es el que mira todo el mundo. */
            rakebackPct: Math.round(r.rakeback.weekly * 10000) / 100,
            rakebackDiarioPct: Math.round(r.rakeback.daily * 10000) / 100,
            rakebackMensualPct: Math.round(r.rakeback.monthly * 10000) / 100,
            beneficios: r.beneficios.filter((b) => b.tiene).length,
            jugadores: a.jugadores,
            parte: Math.round((a.jugadores / total) * 1000) / 10,
            jugadoSc: sc(a.jugadoSc),
            compradoSc: sc(compras.get(r.nombre) || 0),
            rakebackSc: sc(rakes.get(r.nombre) || 0),
            /* Lo que juega cada uno de este rango, en promedio. */
            porCabezaSc: a.jugadores ? sc(a.jugadoSc / a.jugadores) : 0,
          };
        }),
        total: tabla.length,
        jugadores: gente.length,
        rakebackSc: sc(rake.length ? rake[0].t : 0),
        conRango: [...porRango.entries()].filter(([k]) => k !== "Bronze").reduce((a, [, v]) => a + v.jugadores, 0),
        reclamos: await RakebackClaim.countDocuments(),
        beneficios: vip.BENEFICIOS,
      },
    });
  } catch (err) {
    return responderError(res, err, "ranks");
  }
});

/* ══ Segmentos ═══════════════════════════════════════════════════ */

/**
 * GRUPOS DE GENTE, DEFINIDOS POR UNA REGLA.
 *
 * No son listas guardadas: son reglas que se cuentan cada vez que se
 * abre la pantalla. Una lista guardada envejece --"los que nunca
 * compraron" incluye mañana a gente que ya compró-- y el día que se use
 * para mandar una promoción, la manda al que no corresponde.
 */
router.get("/segments", async (req, res) => {
  try {
    const hace3 = new Date(Date.now() - 3 * DIA);
    const hace14 = new Date(Date.now() - 14 * DIA);

    const compradores = await BalanceTransaction.distinct("user", { type: "purchase" });
    const jugaronHace14 = await BalanceTransaction.distinct("user", {
      type: { $in: ["box_open", "deal"] },
      createdAt: { $gte: hace14 },
    });

    const [nuncaCompro, dejaronDeJugar, grandes, nuevos, verificados] = await Promise.all([
      User.countDocuments({ rank: "user", _id: { $nin: compradores }, createdAt: { $lte: hace3 } }),
      User.countDocuments({ rank: "user", _id: { $in: compradores, $nin: jugaronHace14 } }),
      User.countDocuments({ rank: "user", jugadoSc: { $gte: 5000 } }),
      User.countDocuments({ rank: "user", createdAt: { $gte: hace3 } }),
      User.countDocuments({ rank: "user", verificationLevel: { $gte: 2 } }),
    ]);

    const items = [
      { _id: "never_bought", regla: "purchases = 0 · joined > 3 days ago", jugadores: nuncaCompro },
      { _id: "stopped_playing", regla: "purchases >= 1 · no opens in 14 days", jugadores: dejaronDeJugar },
      { _id: "big_players", regla: "played >= SC 5,000", jugadores: grandes },
      { _id: "brand_new", regla: "joined in the last 3 days", jugadores: nuevos },
      { _id: "verified", regla: "verification level >= 2", jugadores: verificados },
    ];

    return res.json({
      success: true,
      data: {
        items,
        total: items.length,
        jugadores: await User.countDocuments({ rank: "user" }),
        masGrande: items.reduce((a, s) => (!a || s.jugadores > a.jugadores ? s : a), null),
      },
    });
  } catch (err) {
    return responderError(res, err, "segments");
  }
});

/* ══ La portada ══════════════════════════════════════════════════ */

/**
 * LAS FILAS DE LA PORTADA.
 *
 * Qué muestra la portada, en qué orden y con qué regla. Son las mismas
 * cuatro que arma `/api/boxes/rows` más las dos piezas fijas de arriba:
 * los banners y la cinta de Live Pulls.
 */
router.get("/home", async (req, res) => {
  try {
    const [banners, populares, destacadas, lujo, baratas, generosas] = await Promise.all([
      Banner.countDocuments({ visible: true }),
      Box.countDocuments({ live: true }),
      Box.countDocuments({ live: true, $or: [{ featured: true }, { markedNew: true }] }),
      Box.countDocuments({ live: true, priceSc: { $gte: 200 } }),
      Box.countDocuments({ live: true, priceSc: { $lt: 5 } }),
      Box.countDocuments({ live: true, retorno: { $gt: 0 } }),
    ]);

    const items = [
      { _id: "banners", orden: 1, fila: "rows.banners", regla: "rows.bannersRule", cuantas: banners, visible: banners > 0 },
      { _id: "pulls", orden: 2, fila: "rows.pulls", regla: "rows.pullsRule", cuantas: null, visible: true },
      { _id: "popular", orden: 3, fila: "rows.popular", regla: "rows.popularRule", cuantas: Math.min(14, populares), visible: populares > 0 },
      { _id: "featured", orden: 4, fila: "rows.featured", regla: "rows.featuredRule", cuantas: Math.min(14, destacadas), visible: destacadas > 0 },
      { _id: "luxury", orden: 5, fila: "rows.luxury", regla: "rows.luxuryRule", cuantas: Math.min(14, lujo), visible: lujo > 0 },
      { _id: "cheap", orden: 6, fila: "rows.cheap", regla: "rows.cheapRule", cuantas: Math.min(14, baratas), visible: baratas > 0 },
      { _id: "generous", orden: 7, fila: "rows.generous", regla: "rows.generousRule", cuantas: Math.min(14, generosas), visible: generosas > 0 },
    ];

    return res.json({ success: true, data: { items, total: items.length } });
  } catch (err) {
    return responderError(res, err, "home");
  }
});

/* ══ Banners ═════════════════════════════════════════════════════ */

router.get("/banners", async (req, res) => {
  try {
    const items = await Banner.find({}).sort({ orden: 1 }).lean();
    return res.json({
      success: true,
      data: {
        items: items.map((b) => ({
          _id: b._id,
          clave: b.clave,
          foto: b.foto,
          titulo: b.titulo,
          destino: b.destino,
          orden: b.orden,
          visible: b.visible,
        })),
        total: items.length,
        visibles: items.filter((b) => b.visible).length,
      },
    });
  } catch (err) {
    return responderError(res, err, "banners");
  }
});

/** Mostrarlo o esconderlo. Lo demás --arte y destino-- por ahora se siembra. */
router.post("/banners/:id/visible", async (req, res) => {
  try {
    const antes = await Banner.findById(req.params.id).lean();
    if (!antes) throw errorDe("NOT_FOUND");

    const visible = !!req.body.visible;
    await Banner.updateOne({ _id: antes._id }, { $set: { visible } });

    await admin.anotar({
      admin: req.user,
      evento: "banner.visible",
      sobre: { tipo: "banner", id: antes._id, nombre: antes.clave },
      antes: { visible: antes.visible },
      despues: { visible },
    });

    return res.json({ success: true, data: { visible } });
  } catch (err) {
    return responderError(res, err, "banners.visible");
  }
});

/* ══ El registro del servidor ════════════════════════════════════ */

router.get("/logs", async (req, res) => {
  try {
    const items = ultimasLineas(
      Math.min(200, Math.max(1, Number(req.query.perPage) || 100)),
      req.query.nivel || ""
    ).map((l, i) => ({ _id: "l" + i, ...l }));

    return res.json({
      success: true,
      data: {
        items,
        total: items.length,
        /* Para que nadie lo confunda con un registro de verdad. */
        enMemoria: true,
      },
    });
  } catch (err) {
    return responderError(res, err, "logs");
  }
});

/* ══ Lo que todavía no existe ════════════════════════════════════ */

/**
 * CUATRO PANTALLAS QUE ESPERAN ALGO.
 *
 * Monedas y códigos promocionales esperan a OxaPay y a su modelo;
 * legales y buscadores esperan a que se escriban las páginas. Devuelven
 * vacío con un motivo, y la pantalla lo dice en el idioma de quien
 * mira. Lo que NO hacen es inventar filas para verse llenas.
 */
function pendiente(clave) {
  return (req, res) => res.json({
    success: true,
    data: { items: [], total: 0, pendiente: clave },
  });
}

/**
 * LAS MONEDAS QUE SE ACEPTAN.
 *
 * Salen de la misma lista que usa la caja del sitio
 * (services/cashier/monedas.js): si acá dijera otra cosa que la
 * pantalla de depósito, una de las dos estaría mintiendo.
 */
router.get("/coins", async (req, res) => {
  try {
    const items = [];
    for (const m of caja.monedas()) {
      for (const r of m.redes) {
        items.push({
          _id: m.ticker + "-" + r.clave,
          moneda: m.nombre + " (" + m.ticker + ")",
          red: r.nombre + " · " + r.clave,
          confirmaciones: r.confirmaciones,
          demora: r.demora,
          activa: oxapay.configurada(),
        });
      }
    }

    return res.json({
      success: true,
      data: { items, total: items.length, conectada: oxapay.configurada() },
    });
  } catch (err) {
    return responderError(res, err, "coins");
  }
});
/**
 * LOS CODIGOS PROMOCIONALES.
 *
 * `usos` sale de contar las filas de uso, no de un contador: un
 * contador se puede desincronizar y entonces el panel dice que un
 * codigo se uso ochenta veces cuando se uso ochenta y dos.
 */
router.get("/promo", async (req, res) => {
  try {
    const items = await PromoCode.find({}).sort({ createdAt: -1 }).limit(100).lean();
    const usos = await PromoCode.PromoUse.aggregate([
      { $group: { _id: "$code", n: { $sum: 1 } } },
    ]);
    const porCodigo = new Map(usos.map((u) => [String(u._id), u.n]));

    const dados = await PromoCode.PromoUse.aggregate([
      { $group: { _id: null, sc: { $sum: "$montoSc" } } },
    ]);

    return res.json({
      success: true,
      data: {
        items: items.map((c) => ({
          _id: c._id,
          codigo: c.codigo,
          tipo: c.tipo,
          premio: c.tipo === "saldo" ? `SC ${sc(c.montoSc)}` : `${c.aperturas} cajas`,
          montoSc: sc(c.montoSc),
          aperturas: c.aperturas,
          usos: porCodigo.get(String(c._id)) || 0,
          usosMaximos: c.usosMaximos,
          minimoSc: sc(c.minimoJugadoSc),
          minimoJugadoSc: sc(c.minimoJugadoSc),
          hasta: c.hasta,
          activo: c.activo,
        })),
        total: items.length,
        vivos: items.filter((c) => c.activo).length,
        dadoSc: sc(dados.length ? dados[0].sc : 0),
      },
    });
  } catch (err) {
    return responderError(res, err, "promo");
  }
});
router.get("/legal", pendiente("legalPages"));
router.get("/seo", pendiente("seo"));

module.exports = router;
