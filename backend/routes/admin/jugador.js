const express = require("express");

const User = require("../../database/models/User");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const BoxOpen = require("../../database/models/BoxOpen");
const InventoryItem = require("../../database/models/InventoryItem");
const Order = require("../../database/models/Order");
const Address = require("../../database/models/Address");
const SessionEvent = require("../../database/models/SessionEvent");
const Verification = require("../../database/models/Verification");
const Redemption = require("../../database/models/Redemption");
const Deal = require("../../database/models/Deal");
const AffiliateCode = require("../../database/models/AffiliateCode");

const admin = require("../../services/admin");
const vip = require("../../services/vip");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[admin] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/**
 * LA FICHA DE UN JUGADOR, COMPLETA.
 *
 * Todo lo que hace falta para contestarle a alguien que escribe, sin
 * tener que abrir cinco pantallas: lo que tiene, lo que jugó, lo que
 * compró, lo que sacó, sus cajas, sus pedidos, sus direcciones, sus
 * sesiones, su verificación y sus trabas.
 *
 * SE PIDE POR PARTES
 *
 * La ficha trae el resumen; cada solapa --movimientos, aperturas,
 * inventario, pedidos, accesos-- se pide cuando se abre. Traer todo
 * junto son seis consultas pesadas para alguien que casi siempre
 * quiere mirar una sola.
 */

/* ── Las solapas ───────────────────────────────────────────────────── */

const SOLAPAS = {
  async movimientos(id, pagina) {
    const porPagina = 25;
    const [filas, total] = await Promise.all([
      BalanceTransaction.find({ user: id })
        .sort({ createdAt: -1 })
        .skip((pagina - 1) * porPagina)
        .limit(porPagina)
        .lean(),
      BalanceTransaction.countDocuments({ user: id }),
    ]);

    return {
      items: filas.map((m) => ({
        _id: m._id,
        createdAt: m.createdAt,
        type: m.type,
        amountSc: sc(m.amountSc),
        balanceAfter: sc(m.balanceAfter),
        label: (m.reference && m.reference.label) || m.reason || "",
      })),
      total,
      pages: Math.max(1, Math.ceil(total / porPagina)),
    };
  },

  async aperturas(id, pagina) {
    const porPagina = 25;
    const [filas, total] = await Promise.all([
      BoxOpen.find({ user: id, demo: { $ne: true } })
        .sort({ createdAt: -1 })
        .skip((pagina - 1) * porPagina)
        .limit(porPagina)
        .lean(),
      BoxOpen.countDocuments({ user: id, demo: { $ne: true } }),
    ]);

    return {
      items: filas.map((a) => ({
        _id: a._id,
        createdAt: a.createdAt,
        caja: a.boxName,
        premio: a.premio.name,
        precioSc: sc(a.priceSc),
        premioSc: sc(a.premio.valueSc),
        gratis: !!a.conAperturaGratis,
        /* La prueba del sorteo, para poder rehacerla si alguien duda. */
        nonce: a.nonce,
        hmac: a.hmac,
      })),
      total,
      pages: Math.max(1, Math.ceil(total / porPagina)),
    };
  },

  async inventario(id, pagina) {
    const porPagina = 25;
    const [filas, total] = await Promise.all([
      InventoryItem.find({ user: id })
        .sort({ createdAt: -1 })
        .skip((pagina - 1) * porPagina)
        .limit(porPagina)
        .lean(),
      InventoryItem.countDocuments({ user: id }),
    ]);

    return {
      items: filas.map((i) => ({
        _id: i._id,
        createdAt: i.createdAt,
        name: i.name,
        valueSc: sc(i.valueSc),
        rarity: i.rarity,
        estado: i.state,
        imageUrl: i.imageUrl,
      })),
      total,
      pages: Math.max(1, Math.ceil(total / porPagina)),
    };
  },

  async pedidos(id) {
    const filas = await Order.find({ user: id }).sort({ createdAt: -1 }).limit(50).lean();
    return {
      items: filas.map((p) => ({
        _id: p._id,
        codigo: String(p._id).slice(-6).toUpperCase(),
        createdAt: p.createdAt,
        estado: p.estado,
        valorSc: sc(p.valorSc),
        cuantos: (p.items || []).length,
        destino: p.destino ? `${p.destino.ciudad}, ${p.destino.pais}` : "",
        seguimiento: p.seguimiento || "",
      })),
      total: filas.length,
      pages: 1,
    };
  },

  async canjes(id) {
    const filas = await Redemption.find({ user: id }).sort({ createdAt: -1 }).limit(50).lean();
    return {
      items: filas.map((r) => ({
        _id: r._id,
        createdAt: r.createdAt,
        montoSc: sc(r.montoSc),
        moneda: `${r.moneda} · ${r.red}`,
        direccion: r.direccion,
        estado: r.estado,
        motivo: r.motivo || "",
      })),
      total: filas.length,
      pages: 1,
    };
  },

  async accesos(id) {
    const [sesiones, direcciones] = await Promise.all([
      SessionEvent.find({ user: id }).sort({ createdAt: -1 }).limit(25).lean(),
      Address.find({ user: id }).lean(),
    ]);

    return {
      items: sesiones.map((s) => ({
        _id: s._id,
        createdAt: s.createdAt,
        tipo: s.tipo,
        dispositivo: s.dispositivo,
        desde: s.desde,
        ok: s.ok,
      })),
      direcciones: direcciones.map((d) => ({
        _id: d._id,
        nombre: d.nombre,
        calle: d.calle,
        ciudad: d.ciudad,
        provincia: d.provincia,
        codigoPostal: d.codigoPostal,
        pais: d.pais,
        predeterminada: !!d.predeterminada,
      })),
      total: sesiones.length,
      pages: 1,
    };
  },
};

/* ── La ficha ──────────────────────────────────────────────────────── */

router.get("/players/:id/full", async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select("+balanceSc +bonoPendienteSc").lean();
    if (!u) throw errorDe("NOT_FOUND");

    const [porTipo, aperturas, deals, inventario, vendido, codigos, kyc, pedidos, canjes, mismaIp] =
      await Promise.all([
        BalanceTransaction.aggregate([
          { $match: { user: u._id } },
          { $group: { _id: "$type", total: { $sum: "$amountSc" }, n: { $sum: 1 } } },
        ]),
        BoxOpen.countDocuments({ user: u._id, demo: { $ne: true } }),
        Deal.countDocuments({ user: u._id }),
        InventoryItem.aggregate([
          { $match: { user: u._id, state: "held" } },
          { $group: { _id: null, n: { $sum: 1 }, valor: { $sum: "$valueSc" } } },
        ]),
        InventoryItem.aggregate([
          { $match: { user: u._id, state: "sold" } },
          { $group: { _id: null, n: { $sum: 1 }, valor: { $sum: "$valueSc" } } },
        ]),
        AffiliateCode.find({ owner: u._id }).lean(),
        Verification.find({ user: u._id }).sort({ nivel: 1 }).lean(),
        Order.countDocuments({ user: u._id }),
        Redemption.countDocuments({ user: u._id, estado: { $in: ["pending", "approved"] } }),
        /* Otras cuentas que entraron desde el mismo lado. No acusa a
           nadie: es una fila para mirar. */
        (async () => {
          const mias = await SessionEvent.find({ user: u._id }).distinct("desde");
          if (!mias.length) return [];
          const otras = await SessionEvent.find({ desde: { $in: mias }, user: { $ne: u._id } })
            .distinct("user");
          if (!otras.length) return [];
          return User.find({ _id: { $in: otras.slice(0, 10) } }).select("username").lean();
        })(),
      ]);

    const de = (t) => {
      const f = porTipo.find((x) => x._id === t);
      return f ? sc(f.total) : 0;
    };

    const rango = vip.rangoDe(vip.jugadoParaVip(u), u.rangoManual);

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
          referredBy: u.referredBy || null,
          createdAt: u.createdAt,
          lastSeenAt: u.lastSeenAt,
          trabas: u.trabas || {},
          notaInterna: u.notaInterna || "",
          rangoManual: u.rangoManual || "",
          limites: u.limites || {},
        },

        rango: { nombre: rango.nombre, color: rango.color, progreso: rango.progreso, siguiente: rango.siguiente },

        /* Los números que contestan "¿quién es este jugador?". */
        numeros: {
          compradoSc: de("purchase"),
          canjeadoSc: Math.abs(de("redemption")),
          jugadoSc: sc(Math.abs(de("box_open")) + Math.abs(de("deal"))),
          devueltoSc: de("item_sold"),
          regaladoSc: sc(de("race_prize") + de("challenge") + de("rakeback") + de("promo_code") + de("affiliate")),
          aperturas,
          deals,
          pedidos,
          canjesAbiertos: canjes,
          inventarioSc: sc((inventario[0] && inventario[0].valor) || 0),
          inventarioN: (inventario[0] && inventario[0].n) || 0,
          vendidoSc: sc((vendido[0] && vendido[0].valor) || 0),
        },

        /*
          LO QUE DEJO LA CASA CON EL.

          Lo que jugó menos lo que se llevó. En rojo quiere decir que
          esta cuenta, hasta hoy, le costó plata al sitio: no es malo
          en sí --la suerte existe-- pero es lo primero que hay que
          mirar antes de regalarle algo.
        */
        margenSc: sc(
          Math.abs(de("box_open")) + Math.abs(de("deal"))
          - de("item_sold")
          - (de("race_prize") + de("challenge") + de("rakeback") + de("promo_code") + de("affiliate"))
        ),

        codigos: codigos.map((c) => ({
          code: c.code,
          jugadores: c.jugadores || 0,
          ganadoSc: sc(c.ganadoSc || 0),
          cobradoSc: sc(c.cobradoSc || 0),
        })),

        verificaciones: kyc.map((v) => ({
          _id: v._id,
          nivel: v.nivel,
          estado: v.estado,
          motivo: v.motivo,
          adjuntos: v.adjuntos || [],
          createdAt: v.createdAt,
          revisadoEl: v.revisadoEl,
        })),

        multicuentas: mismaIp.map((o) => o.username),
        rangos: vip.tabla().map((r) => r.nombre),
      },
    });
  } catch (err) {
    return responderError(res, err, "player.full");
  }
});

/** Una solapa de la ficha. */
router.get("/players/:id/:solapa", async (req, res) => {
  try {
    const traer = Object.hasOwn(SOLAPAS, req.params.solapa) ? SOLAPAS[req.params.solapa] : null;
    if (!traer) throw errorDe("NOT_FOUND");

    const datos = await traer(req.params.id, Math.max(1, Number(req.query.page) || 1));
    return res.json({ success: true, data: datos });
  } catch (err) {
    return responderError(res, err, "player.tab");
  }
});

/* ── Lo que el equipo le puede hacer ───────────────────────────────── */

/**
 * LAS TRABAS.
 *
 * Frenan una parte de la cuenta sin cerrarla: el canje, el envío, las
 * promociones o las carreras. Piden motivo, porque una traba sin
 * motivo no la puede explicar nadie tres semanas después.
 */
router.post("/players/:id/locks", async (req, res) => {
  try {
    const motivo = String(req.body.motivo || "").trim();
    if (motivo.length < 3) throw errorDe("REASON_REQUIRED");

    const antes = await User.findById(req.params.id).select("username trabas").lean();
    if (!antes) throw errorDe("NOT_FOUND");

    const trabas = {
      canje: !!req.body.canje,
      envio: !!req.body.envio,
      promos: !!req.body.promos,
      carreras: !!req.body.carreras,
      motivo,
      puestaEl: new Date(),
    };

    await User.updateOne({ _id: antes._id }, { $set: { trabas } });

    await admin.anotar({
      admin: req.user,
      evento: "player.locks",
      sobre: { tipo: "user", id: antes._id, nombre: antes.username },
      antes: antes.trabas || {},
      despues: trabas,
      motivo,
      req,
    });

    return res.json({ success: true, data: { trabas } });
  } catch (err) {
    return responderError(res, err, "player.locks");
  }
});

/** La nota interna. No la ve el jugador. */
router.post("/players/:id/note", async (req, res) => {
  try {
    const nota = String(req.body.nota || "").trim().slice(0, 2000);
    const antes = await User.findById(req.params.id).select("username notaInterna").lean();
    if (!antes) throw errorDe("NOT_FOUND");

    await User.updateOne({ _id: antes._id }, { $set: { notaInterna: nota } });

    await admin.anotar({
      admin: req.user,
      evento: "player.note",
      sobre: { tipo: "user", id: antes._id, nombre: antes.username },
      antes: { largo: (antes.notaInterna || "").length },
      despues: { largo: nota.length },
      req,
    });

    return res.json({ success: true, data: { nota } });
  } catch (err) {
    return responderError(res, err, "player.note");
  }
});

/**
 * EL RANGO VIP A MANO.
 *
 * Para el traslado desde otro sitio. Nunca BAJA a nadie: si lo jugado
 * ya le da más, manda lo jugado (ver services/vip).
 */
router.post("/players/:id/tier", async (req, res) => {
  try {
    const rango = String(req.body.rango || "").trim();
    const validos = vip.tabla().map((r) => r.nombre);
    if (rango && !validos.includes(rango)) throw errorDe("INVALID_AMOUNT", { rango });

    const motivo = String(req.body.motivo || "").trim();
    if (rango && motivo.length < 3) throw errorDe("REASON_REQUIRED");

    const antes = await User.findById(req.params.id)
      .select("username rangoManual jugadoSc jugadoBaseSc")
      .lean();
    if (!antes) throw errorDe("NOT_FOUND");

    /*
      LA BARRA ARRANCA EN EL PISO DEL RANGO.

      Al que se trae de otro sitio se le pone el rango que ya tenia, y
      lo que vio hasta ahora es una barra en cero con el nombre de un
      rango alto al lado. El piso lo arregla: la barra arranca donde
      arranca ese rango y de ahi cuenta lo que juegue acá.

      Nunca baja: si ya jugo mas que el piso, se queda con lo suyo.
    */
    const piso = rango ? vip.pisoDelRango(rango) : 0;
    const jugadoHoy = Number(antes.jugadoSc) || 0;
    const baseAhora = Number(antes.jugadoBaseSc) || 0;
    const base = rango ? Math.max(baseAhora, Math.max(0, piso - jugadoHoy)) : baseAhora;

    await User.updateOne(
      { _id: antes._id },
      { $set: { rangoManual: rango, jugadoBaseSc: base } }
    );

    await admin.anotar({
      admin: req.user,
      evento: "player.tier",
      sobre: { tipo: "user", id: antes._id, nombre: antes.username },
      antes: { rangoManual: antes.rangoManual || "" },
      despues: { rangoManual: rango },
      motivo,
      req,
    });

    return res.json({ success: true, data: { rangoManual: rango } });
  } catch (err) {
    return responderError(res, err, "player.tier");
  }
});

/** Regalarle aperturas: las tres cajas de bienvenida otra vez. */
router.post("/players/:id/gifts", async (req, res) => {
  try {
    const motivo = String(req.body.motivo || "").trim();
    if (motivo.length < 3) throw errorDe("REASON_REQUIRED");

    const antes = await User.findById(req.params.id).select("username freeOpens").lean();
    if (!antes) throw errorDe("NOT_FOUND");

    const cajas = require("../../services/boxes");
    const dadas = await cajas.regalarCajasDeBienvenida(antes._id);

    /* Y las pruebas gratis, de nuevo: regalarle las cajas de
       bienvenida es volver a ponerlo donde arranca. */
    await User.updateOne({ _id: antes._id }, { $set: { demosUsadas: 0 } });

    await admin.anotar({
      admin: req.user,
      evento: "player.gifts",
      sobre: { tipo: "user", id: antes._id, nombre: antes.username },
      antes: { freeOpens: antes.freeOpens },
      despues: { freeOpens: dadas.length },
      motivo,
      req,
    });

    return res.json({ success: true, data: { cajas: dadas.length } });
  } catch (err) {
    return responderError(res, err, "player.gifts");
  }
});

module.exports = router;
