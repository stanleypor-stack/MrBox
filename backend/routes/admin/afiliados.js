/**
 * LOS AFILIADOS, DEL LADO DEL EQUIPO.
 *
 * Cinco pantallas:
 *
 *   1. LOS SOCIOS ....... quién trae, cuánto trae, cuánto nos deja y
 *                         cuánto le pagamos. Con el margen al lado, que
 *                         es el único número que dice si un socio
 *                         conviene.
 *   2. UN SOCIO ......... su ficha: rango, campañas, referidos, lo que
 *                         cobró, lo que tiene en espera y su historial
 *                         de rangos.
 *   3. LOS PEDIDOS ...... quién pidió que le miren el rango, con sus
 *                         números al lado para poder decidir sin salir.
 *   4. LAS CABEZAS ...... la cola de pagos por cabeza: las que esperan
 *                         liberación y las que tienen señales.
 *   5. LA ESCALERA ...... los rangos y las reglas, editables.
 *
 * DE DONDE SALEN LOS NUMEROS
 *
 * Lo que LE PAGAMOS a un socio sale del LIBRO (los movimientos tipo
 * `affiliate`), no del contador de la campaña: el contador dice lo que
 * debería haber cobrado, y el libro dice lo que de verdad se le fue. Si
 * los dos no coinciden, el que está mal es el contador.
 */

const express = require("express");

const User = require("../../database/models/User");
const AffiliateCode = require("../../database/models/AffiliateCode");
const AffiliateConversion = require("../../database/models/AffiliateConversion");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const AdminLog = require("../../database/models/AdminLog");
const Settings = require("../../database/models/Settings");

const admin = require("../../services/admin");
const afiliados = require("../../services/affiliates");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[admin] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

function paginar(req, porDefecto = 25) {
  const pagina = Math.max(1, Number(req.query.page) || 1);
  const porPagina = Math.min(200, Math.max(1, Number(req.query.perPage) || porDefecto));
  return { pagina, porPagina, saltar: (pagina - 1) * porPagina };
}

/* ══ 1. Los socios ════════════════════════════════════════════════ */

/**
 * LA LISTA DE SOCIOS.
 *
 * Una fila por SOCIO, no por campaña: un socio con seis campañas es un
 * socio, y verlo seis veces no deja comparar a nadie con nadie.
 *
 * LO QUE NOS DEJA Y LO QUE LE PAGAMOS, UNO AL LADO DEL OTRO
 *
 * El margen teórico que generó --lo jugado por el house edge-- contra lo
 * que se le pagó. Un socio con margen 400 y pagos 900 se está llevando
 * más de lo que trae, y así se ve de una.
 */
router.get("/affiliates", async (req, res) => {
  try {
    const { pagina, porPagina, saltar } = paginar(req, 25);
    const busca = String(req.query.q || "").trim();
    const modelo = String(req.query.modelo || "").trim();
    const rango = Number(req.query.rango) || 0;

    /* Los socios son los dueños de campañas. */
    const filtro = {};
    if (modelo && afiliados.MODELOS.includes(modelo)) filtro.modelo = modelo;

    const porSocio = await AffiliateCode.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: "$owner",
          campanas: { $sum: 1 },
          modelos: { $addToSet: "$modelo" },
          codigos: { $push: "$code" },
          clics: { $sum: { $ifNull: ["$clics", 0] } },
          jugadores: { $sum: { $ifNull: ["$jugadores", 0] } },
          jugadoSc: { $sum: { $ifNull: ["$jugadoPorLosSuyosSc", 0] } },
          ganadoSc: { $sum: { $ifNull: ["$ganadoSc", 0] } },
          cobradoSc: { $sum: { $ifNull: ["$cobradoSc", 0] } },
          activas: { $sum: { $cond: ["$activo", 1, 0] } },
        },
      },
      { $sort: { jugadoSc: -1 } },
    ]);

    const ids = porSocio.map((s) => s._id);

    const [gente, pagado, cabezas] = await Promise.all([
      User.find({ _id: { $in: ids } })
        .select("username email rangoAfiliado pidioRangoEl createdAt banned")
        .lean(),

      /* LO QUE DE VERDAD SE LE FUE, del libro. */
      BalanceTransaction.aggregate([
        { $match: { user: { $in: ids }, type: "affiliate" } },
        { $group: { _id: "$user", total: { $sum: "$amountSc" } } },
      ]),

      AffiliateConversion.aggregate([
        { $match: { owner: { $in: ids } } },
        { $group: { _id: { owner: "$owner", estado: "$estado" }, cuantos: { $sum: 1 } } },
      ]),
    ]);

    const quien = new Map(gente.map((u) => [String(u._id), u]));
    const pagadoA = new Map(pagado.map((p) => [String(p._id), sc(p.total)]));

    const estados = new Map();
    for (const c of cabezas) {
      const k = String(c._id.owner);
      const actual = estados.get(k) || { nuevo: 0, deposito: 0, califica: 0, pagado: 0, anulado: 0 };
      actual[c._id.estado] = c.cuantos;
      estados.set(k, actual);
    }

    const houseEdge = afiliados.reglas().houseEdgePct / 100;

    let items = porSocio.map((s) => {
      const u = quien.get(String(s._id));
      const r = afiliados.rangoNumero(u && u.rangoAfiliado);
      const jugadoSc = sc(s.jugadoSc);
      /* El margen TEORICO que dejó: con qué comparar lo que se le paga. */
      const margenSc = sc(jugadoSc * houseEdge);
      const pagadoSc = pagadoA.get(String(s._id)) || 0;

      return {
        _id: s._id,
        socio: u ? u.username : "—",
        email: u ? u.email : "",
        banned: !!(u && u.banned),
        desde: u ? u.createdAt : null,

        rango: { numero: r.numero, nombre: r.nombre, bonoPct: r.bonoPct },
        pidioRangoEl: (u && u.pidioRangoEl) || null,

        campanas: s.campanas,
        activas: s.activas,
        modelos: s.modelos,
        codigos: s.codigos.slice(0, 6),

        clics: s.clics,
        jugadores: s.jugadores,
        jugadoSc,
        margenSc,
        ganadoSc: sc(s.ganadoSc),
        cobradoSc: sc(s.cobradoSc),
        porCobrarSc: sc(Math.max(0, s.ganadoSc - s.cobradoSc)),
        pagadoSc,

        /*
          LO QUE NOS QUEDA DE ESE SOCIO.
          Margen que generó menos lo que ya se le pagó. En rojo quiere
          decir que nos cuesta más de lo que trae.
        */
        netoSc: sc(margenSc - pagadoSc),
        /* Y cuánto de cada peso de margen se lleva. */
        tajadaPct: margenSc > 0 ? Math.round((pagadoSc / margenSc) * 1000) / 10 : 0,

        cabezas: estados.get(String(s._id)) || {
          nuevo: 0, deposito: 0, califica: 0, pagado: 0, anulado: 0,
        },
      };
    });

    /* Los filtros que necesitan al usuario ya cargado van acá. */
    if (rango) items = items.filter((x) => x.rango.numero === rango);
    if (busca) {
      const texto = busca.toLowerCase();
      items = items.filter(
        (x) =>
          x.socio.toLowerCase().includes(texto) ||
          x.email.toLowerCase().includes(texto) ||
          x.codigos.some((c) => String(c).toLowerCase().includes(texto))
      );
    }

    const totales = items.reduce(
      (a, x) => ({
        socios: a.socios + 1,
        jugadores: a.jugadores + x.jugadores,
        jugadoSc: sc(a.jugadoSc + x.jugadoSc),
        margenSc: sc(a.margenSc + x.margenSc),
        pagadoSc: sc(a.pagadoSc + x.pagadoSc),
        porCobrarSc: sc(a.porCobrarSc + x.porCobrarSc),
      }),
      { socios: 0, jugadores: 0, jugadoSc: 0, margenSc: 0, pagadoSc: 0, porCobrarSc: 0 }
    );

    const [pidieron, enEspera, conSenales] = await Promise.all([
      User.countDocuments({ pidioRangoEl: { $ne: null } }),
      AffiliateConversion.countDocuments({ estado: "califica" }),
      AffiliateConversion.countDocuments({ estado: "califica", "senales.0": { $exists: true } }),
    ]);

    return res.json({
      success: true,
      data: {
        items: items.slice(saltar, saltar + porPagina),
        total: items.length,
        pagina,
        porPagina,
        totales: {
          ...totales,
          netoSc: sc(totales.margenSc - totales.pagadoSc),
          tajadaPct:
            totales.margenSc > 0
              ? Math.round((totales.pagadoSc / totales.margenSc) * 1000) / 10
              : 0,
        },
        /* Lo que está esperando que alguien lo mire. */
        pendientes: { rangos: pidieron, cabezas: enEspera, senales: conSenales },
        escalera: afiliados.rangos(),
        reglas: afiliados.reglas(),
      },
    });
  } catch (err) {
    return responderError(res, err, "affiliates");
  }
});

/* ══ 3. Los pedidos de rango ══════════════════════════════════════ */

/**
 * QUIEN PIDIO QUE LE MIREN EL RANGO.
 *
 * Con sus números al lado: el que decide tiene que poder hacerlo sin
 * abrir otra pantalla, porque si hay que abrir otra pantalla el pedido
 * se queda sin contestar.
 *
 * Va ANTES de `/affiliates/:userId` a propósito: si no, Express lee
 * "requests" como un id de usuario.
 */
router.get("/affiliates/requests", async (req, res) => {
  try {
    const gente = await User.find({ pidioRangoEl: { $ne: null } })
      .select("username email rangoAfiliado pidioRangoEl createdAt")
      .sort({ pidioRangoEl: 1 })
      .limit(100)
      .lean();

    const ids = gente.map((u) => u._id);

    const [porSocio, pagado] = await Promise.all([
      AffiliateCode.aggregate([
        { $match: { owner: { $in: ids } } },
        {
          $group: {
            _id: "$owner",
            campanas: { $sum: 1 },
            modelos: { $addToSet: "$modelo" },
            jugadores: { $sum: { $ifNull: ["$jugadores", 0] } },
            jugadoSc: { $sum: { $ifNull: ["$jugadoPorLosSuyosSc", 0] } },
          },
        },
      ]),
      BalanceTransaction.aggregate([
        { $match: { user: { $in: ids }, type: "affiliate" } },
        { $group: { _id: "$user", total: { $sum: "$amountSc" } } },
      ]),
    ]);

    const suyo = new Map(porSocio.map((s) => [String(s._id), s]));
    const pagadoA = new Map(pagado.map((p) => [String(p._id), sc(p.total)]));
    const houseEdge = afiliados.reglas().houseEdgePct / 100;

    const items = gente.map((u) => {
      const s = suyo.get(String(u._id)) || { campanas: 0, modelos: [], jugadores: 0, jugadoSc: 0 };
      const margenSc = sc(sc(s.jugadoSc) * houseEdge);
      const pagadoSc = pagadoA.get(String(u._id)) || 0;
      const r = afiliados.rangoNumero(u.rangoAfiliado);
      const sigue = afiliados.rangoNumero(r.numero + 1);

      return {
        _id: u._id,
        socio: u.username,
        email: u.email,
        pidioEl: u.pidioRangoEl,
        rango: { numero: r.numero, nombre: r.nombre },
        /* El que le toca si se le concede: lo que de verdad se decide. */
        siguiente: sigue.numero > r.numero ? { numero: sigue.numero, nombre: sigue.nombre } : null,
        campanas: s.campanas,
        modelos: s.modelos,
        jugadores: s.jugadores,
        jugadoSc: sc(s.jugadoSc),
        margenSc,
        pagadoSc,
        netoSc: sc(margenSc - pagadoSc),
      };
    });

    return res.json({ success: true, data: { items, escalera: afiliados.rangos() } });
  } catch (err) {
    return responderError(res, err, "affiliates/requests");
  }
});

/* ══ 4. La cola de cabezas ════════════════════════════════════════ */

/**
 * LOS PAGOS POR CABEZA, EN COLA.
 *
 * Las que calificaron y esperan la liberación, las que tienen señales y
 * no se van a pagar solas, y las ya pagadas o anuladas para mirar atrás.
 */
router.get("/affiliates/conversions", async (req, res) => {
  try {
    const { pagina, porPagina, saltar } = paginar(req, 50);
    const estado = String(req.query.estado || "califica");
    const soloSenales = req.query.senales === "1";

    const filtro = {};
    if (["nuevo", "deposito", "califica", "pagado", "anulado"].includes(estado)) {
      filtro.estado = estado;
    }
    if (soloSenales) filtro["senales.0"] = { $exists: true };
    if (req.query.owner) filtro.owner = req.query.owner;

    const [filas, total] = await Promise.all([
      AffiliateConversion.find(filtro)
        .sort({ liberaEl: 1, createdAt: -1 })
        .skip(saltar)
        .limit(porPagina)
        .populate("owner", "username rangoAfiliado")
        .populate("user", "username email verificationLevel")
        .populate("code", "code nombre modelo")
        .lean(),
      AffiliateConversion.countDocuments(filtro),
    ]);

    const ahora = Date.now();

    return res.json({
      success: true,
      data: {
        items: filas.map((f) => ({
          _id: f._id,
          estado: f.estado,
          socio: f.owner ? { _id: f.owner._id, username: f.owner.username } : null,
          jugador: f.user
            ? {
              _id: f.user._id,
              username: f.user.username,
              email: f.user.email,
              nivelKyc: f.user.verificationLevel || 0,
            }
            : null,
          campana: f.code ? { _id: f.code._id, code: f.code.code, nombre: f.code.nombre } : null,
          modelo: f.modelo,
          montoSc: sc(f.montoSc),
          depositadoSc: sc(f.depositadoSc),
          jugadoSc: sc(f.jugadoSc),
          nivelKyc: f.nivelKyc || 0,
          senales: f.senales || [],
          calificoEl: f.calificoEl,
          liberaEl: f.liberaEl,
          /* Si ya se puede pagar sin esperar nada. */
          liberada: !!(f.liberaEl && new Date(f.liberaEl).getTime() <= ahora),
          pagadoEl: f.pagadoEl,
          motivo: f.motivo || "",
          desdeEl: f.createdAt,
        })),
        total,
        pagina,
        porPagina,
        reglas: afiliados.reglas(),
      },
    });
  } catch (err) {
    return responderError(res, err, "affiliates/conversions");
  }
});

/**
 * PAGAR UNA CABEZA A MANO.
 *
 * Para las que tienen señales: alguien las miró y dice que están bien.
 * Queda anotado quién lo dijo.
 */
router.post("/affiliates/conversions/:id/pay", async (req, res) => {
  try {
    const motivo = String(req.body.motivo || "").trim();
    if (motivo.length < 3) throw errorDe("REASON_REQUIRED");

    const ficha = await afiliados.pagarCabeza({ fichaId: req.params.id, porQuien: req.user._id });
    if (!ficha) throw errorDe("ALREADY_CLAIMED");

    await admin.anotar({
      admin: req.user,
      evento: "affiliate.cpa.pay",
      sobre: { tipo: "affiliateConversion", id: ficha._id },
      antes: { estado: "califica" },
      despues: { estado: "pagado", montoSc: sc(ficha.montoSc) },
      motivo,
      req,
    });

    return res.json({ success: true, data: { estado: ficha.estado, montoSc: sc(ficha.montoSc) } });
  } catch (err) {
    return responderError(res, err, "affiliates/conversions/pay");
  }
});

/** Frenar una cabeza. Pide motivo y queda en el registro. */
router.post("/affiliates/conversions/:id/void", async (req, res) => {
  try {
    const ficha = await afiliados.anularCabeza({
      fichaId: req.params.id,
      motivo: req.body.motivo,
      porQuien: req.user._id,
    });

    await admin.anotar({
      admin: req.user,
      evento: "affiliate.cpa.void",
      sobre: { tipo: "affiliateConversion", id: ficha._id },
      despues: { estado: "anulado" },
      motivo: req.body.motivo,
      req,
    });

    return res.json({ success: true, data: { estado: ficha.estado } });
  } catch (err) {
    return responderError(res, err, "affiliates/conversions/void");
  }
});

/* ══ 5. La escalera ═══════════════════════════════════════════════ */

/** La escalera y las reglas, como están guardadas. */
router.get("/affiliates/ladder", async (req, res) => {
  try {
    return res.json({
      success: true,
      data: {
        escalera: afiliados.rangos(),
        reglas: afiliados.reglas(),
        modelos: afiliados.MODELOS,
        /* De fábrica, para el botón de "volver a los de siempre". */
        deFabrica: Settings.RANGOS_AFILIADO,
      },
    });
  } catch (err) {
    return responderError(res, err, "affiliates/ladder");
  }
});

/**
 * EDITAR LA ESCALERA.
 *
 * Los rangos con sus tres modelos, y las reglas del pago por cabeza.
 * Cada número se limpia y se le pone tope:
 *
 *   - un revshare arriba del 70% paga más de lo que entra en casi
 *     cualquier mes, y casi siempre es un dedo de más en el teclado
 *   - un bono de jugador arriba del 20% lo paga la casa, no el socio
 *   - el CPA tiene tope de SC 5.000, que ya es absurdo: es para que un
 *     cero de más no se guarde sin que nadie lo note
 */
router.put("/affiliates/ladder", async (req, res) => {
  try {
    const filas = Array.isArray(req.body.escalera) ? req.body.escalera : [];
    if (!filas.length || filas.length > 20) throw errorDe("INVALID_AMOUNT", { rangos: filas.length });

    const pct = (v, tope) => Math.max(0, Math.min(tope, Number(v) || 0));
    const plata = (v) => Math.max(0, Math.min(5000, sc(Number(v) || 0)));

    const escalera = filas.map((r, i) => ({
      nombre: String(r.nombre || `Rango ${i + 1}`).trim().slice(0, 30),
      cpaSc: plata(r.cpaSc),
      revsharePct: pct(r.revsharePct, 70),
      hibridoCpaSc: plata(r.hibridoCpaSc),
      hibridoPct: pct(r.hibridoPct, 70),
      bonoPct: pct(r.bonoPct, 20),
      minimoCobroSc: plata(r.minimoCobroSc),
      pago: ["pedido", "semanal", "mensual"].includes(r.pago) ? r.pago : "pedido",
    }));

    /*
      TIENEN QUE IR DE MENOR A MAYOR.
      Una escalera donde el rango 5 paga menos que el 4 es una escalera
      donde subir de rango le baja la paga a alguien, y eso se descubre
      cuando el socio escribe.
    */
    for (let i = 1; i < escalera.length; i += 1) {
      const a = escalera[i - 1];
      const b = escalera[i];
      if (b.cpaSc < a.cpaSc || b.revsharePct < a.revsharePct || b.bonoPct < a.bonoPct) {
        throw errorDe("INVALID_AMOUNT", { rango: b.nombre, porque: "baja respecto al anterior" });
      }
    }

    const cfg = await Settings.leer();
    const antes = cfg.rangosAfiliado || [];

    const reglas = {
      houseEdgePct: afiliados.reglas().houseEdgePct,
      cpaDepositoSc: plata((req.body.reglas || {}).cpaDepositoSc),
      cpaJugadoSc: plata((req.body.reglas || {}).cpaJugadoSc),
      cpaNivelKyc: Math.max(0, Math.min(3, Number((req.body.reglas || {}).cpaNivelKyc) || 0)),
      cpaEsperaDias: Math.max(0, Math.min(90, Number((req.body.reglas || {}).cpaEsperaDias) || 0)),
      cpaTopeDiario: Math.max(0, Math.min(1000, Number((req.body.reglas || {}).cpaTopeDiario) || 0)),
      telegram: String((req.body.reglas || {}).telegram || "").trim().slice(0, 200),
      modelos: (Array.isArray((req.body.reglas || {}).modelos)
        ? (req.body.reglas || {}).modelos
        : []
      ).filter((m) => afiliados.MODELOS.includes(m)),
    };

    await Settings.updateOne(
      {},
      { $set: { rangosAfiliado: escalera, afiliados: reglas } },
      { upsert: true }
    );

    /* Que la pantalla vea lo guardado al instante, y no los números
       viejos del minuto que todavía tiene en memoria. */
    await afiliados.recargar();

    await admin.anotar({
      admin: req.user,
      evento: "affiliate.ladder.edit",
      sobre: { tipo: "settings", nombre: "afiliados" },
      antes: { cuantos: antes.length },
      despues: { cuantos: escalera.length, modelos: reglas.modelos },
      motivo: req.body.motivo,
      req,
    });

    return res.json({ success: true, data: { escalera, reglas } });
  } catch (err) {
    return responderError(res, err, "affiliates/ladder/edit");
  }
});

/* ══ 2. Un socio por dentro ═══════════════════════════════════════ */

/**
 * LA FICHA DE UN SOCIO.
 *
 * Su rango, sus campañas con lo que paga cada modelo hoy, sus referidos
 * con el estado de cada uno, lo que cobró según el LIBRO, y el historial
 * de lo que el equipo le tocó.
 */
router.get("/affiliates/:userId", async (req, res) => {
  try {
    const u = await User.findById(req.params.userId)
      .select("username email rangoAfiliado pidioRangoEl createdAt banned affiliateCode referredBy")
      .lean();
    if (!u) throw errorDe("NOT_FOUND");

    const rango = afiliados.rangoDe(u);

    const [campanas, cobros, cabezas, traidos, historial] = await Promise.all([
      AffiliateCode.find({ owner: u._id }).sort({ createdAt: 1 }).lean(),

      /* Lo que de verdad se le fue, movimiento por movimiento. */
      BalanceTransaction.find({ user: u._id, type: "affiliate" })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),

      AffiliateConversion.find({ owner: u._id })
        .sort({ createdAt: -1 })
        .limit(200)
        .populate("user", "username verificationLevel")
        .populate("code", "code")
        .lean(),

      User.countDocuments({ referredBy: u._id }),

      AdminLog.find({ "sobre.id": u._id, evento: { $regex: "^affiliate\\." } })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
    ]);

    const houseEdge = afiliados.reglas().houseEdgePct / 100;

    const suma = campanas.reduce(
      (a, c) => ({
        clics: a.clics + (c.clics || 0),
        jugadores: a.jugadores + (c.jugadores || 0),
        jugadoSc: sc(a.jugadoSc + (c.jugadoPorLosSuyosSc || 0)),
        ganadoSc: sc(a.ganadoSc + (c.ganadoSc || 0)),
        cobradoSc: sc(a.cobradoSc + (c.cobradoSc || 0)),
      }),
      { clics: 0, jugadores: 0, jugadoSc: 0, ganadoSc: 0, cobradoSc: 0 }
    );

    const margenSc = sc(suma.jugadoSc * houseEdge);
    const pagadoSc = sc(cobros.reduce((a, t) => a + (t.amountSc || 0), 0));

    const embudo = { nuevo: 0, deposito: 0, califica: 0, pagado: 0, anulado: 0 };
    for (const f of cabezas) if (embudo[f.estado] !== undefined) embudo[f.estado] += 1;

    return res.json({
      success: true,
      data: {
        socio: {
          _id: u._id,
          username: u.username,
          email: u.email,
          desde: u.createdAt,
          banned: !!u.banned,
          /* Si a él también lo trajo alguien. */
          vinoCon: u.affiliateCode || null,
        },

        rango,
        escalera: afiliados.rangos(),
        pidioRangoEl: u.pidioRangoEl || null,

        campanas: campanas.map((c) => ({
          _id: c._id,
          code: c.code,
          nombre: c.nombre || c.code,
          canal: c.canal || "",
          modelo: c.modelo,
          cobra: afiliados.comoCobra({ modelo: c.modelo, rango }),
          bonoPropio: c.bonoPropio === null || c.bonoPropio === undefined ? null : c.bonoPropio,
          activo: !!c.activo,
          venceEl: c.venceEl || null,
          clics: c.clics || 0,
          jugadores: c.jugadores || 0,
          jugadoPorLosSuyosSc: sc(c.jugadoPorLosSuyosSc || 0),
          ganadoSc: sc(c.ganadoSc || 0),
          cobradoSc: sc(c.cobradoSc || 0),
          porCobrarSc: sc(Math.max(0, (c.ganadoSc || 0) - (c.cobradoSc || 0))),
          creadaEl: c.createdAt,
        })),

        numeros: {
          ...suma,
          traidos,
          margenSc,
          pagadoSc,
          porCobrarSc: sc(Math.max(0, suma.ganadoSc - suma.cobradoSc)),
          netoSc: sc(margenSc - pagadoSc),
          tajadaPct: margenSc > 0 ? Math.round((pagadoSc / margenSc) * 1000) / 10 : 0,
        },

        embudo,

        cabezas: cabezas.slice(0, 50).map((f) => ({
          _id: f._id,
          estado: f.estado,
          jugador: f.user ? f.user.username : "—",
          campana: f.code ? f.code.code : "—",
          modelo: f.modelo,
          montoSc: sc(f.montoSc),
          depositadoSc: sc(f.depositadoSc),
          jugadoSc: sc(f.jugadoSc),
          nivelKyc: f.nivelKyc || 0,
          senales: f.senales || [],
          liberaEl: f.liberaEl,
          pagadoEl: f.pagadoEl,
          motivo: f.motivo || "",
        })),

        cobros: cobros.map((t) => ({
          _id: t._id,
          amountSc: sc(t.amountSc),
          cuando: t.createdAt,
          label: (t.reference && t.reference.label) || "",
        })),

        historial: historial.map((l) => ({
          _id: l._id,
          evento: l.evento,
          admin: l.adminNombre,
          antes: l.antes,
          despues: l.despues,
          motivo: l.motivo,
          cuando: l.createdAt,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "affiliates/socio");
  }
});

/**
 * OTORGARLE UN RANGO.
 *
 * Pide motivo, siempre: el rango es plata, y en seis meses nadie se
 * acuerda por qué un socio cobra el doble que otro.
 */
router.post("/affiliates/:userId/rank", async (req, res) => {
  try {
    const motivo = String(req.body.motivo || "").trim();
    if (motivo.length < 3) throw errorDe("REASON_REQUIRED");

    const u = await User.findById(req.params.userId).select("username rangoAfiliado").lean();
    if (!u) throw errorDe("NOT_FOUND");

    const antes = afiliados.rangoNumero(u.rangoAfiliado);
    const ahora = await afiliados.otorgarRango({
      userId: u._id,
      numero: req.body.numero,
    });

    await admin.anotar({
      admin: req.user,
      evento: "affiliate.rank.grant",
      sobre: { tipo: "user", id: u._id, nombre: u.username },
      antes: { numero: antes.numero, nombre: antes.nombre },
      despues: { numero: ahora.numero, nombre: ahora.nombre },
      motivo,
      req,
    });

    return res.json({ success: true, data: { rango: ahora } });
  } catch (err) {
    return responderError(res, err, "affiliates/rank");
  }
});

/**
 * TOCAR UNA CAMPAÑA DESDE EL PANEL.
 *
 * Prenderla o apagarla, ponerle fecha de vencimiento, y los dos números
 * sueltos: un bono propio para el jugador y una comisión a mano. Los dos
 * son para el trato negociado aparte; lo normal es que no estén y que
 * manden los del rango.
 */
router.post("/affiliates/campaigns/:id", async (req, res) => {
  try {
    const motivo = String(req.body.motivo || "").trim();
    if (motivo.length < 3) throw errorDe("REASON_REQUIRED");

    const campana = await AffiliateCode.findById(req.params.id).populate("owner", "username").lean();
    if (!campana) throw errorDe("CODE_NOT_FOUND");

    const cambios = {};
    if (req.body.activo !== undefined) cambios.activo = !!req.body.activo;
    if (req.body.venceEl !== undefined) {
      cambios.venceEl = req.body.venceEl ? new Date(req.body.venceEl) : null;
      if (cambios.venceEl && Number.isNaN(cambios.venceEl.getTime())) {
        throw errorDe("INVALID_AMOUNT", { campo: "venceEl" });
      }
    }
    if (req.body.bonoPropio !== undefined) {
      cambios.bonoPropio =
        req.body.bonoPropio === null || req.body.bonoPropio === ""
          ? null
          : Math.max(0, Math.min(0.2, Number(req.body.bonoPropio) || 0));
    }
    /* El modelo se puede corregir desde el panel --un socio que eligió
       mal el primer día-- pero queda anotado quién lo cambió. */
    if (req.body.modelo !== undefined && afiliados.MODELOS.includes(req.body.modelo)) {
      cambios.modelo = req.body.modelo;
    }

    if (!Object.keys(cambios).length) throw errorDe("NOT_FOUND");

    await AffiliateCode.updateOne({ _id: campana._id }, { $set: cambios });

    await admin.anotar({
      admin: req.user,
      evento: "affiliate.campaign.edit",
      sobre: { tipo: "affiliateCode", id: campana._id, nombre: campana.code },
      antes: {
        activo: campana.activo,
        modelo: campana.modelo,
        bonoPropio: campana.bonoPropio,
        venceEl: campana.venceEl,
      },
      despues: cambios,
      motivo,
      req,
    });

    return res.json({ success: true, data: { cambios } });
  } catch (err) {
    return responderError(res, err, "affiliates/campaigns/edit");
  }
});

module.exports = router;
