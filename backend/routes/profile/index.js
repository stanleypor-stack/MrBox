const express = require("express");

const BalanceTransaction = require("../../database/models/BalanceTransaction");
const BoxOpen = require("../../database/models/BoxOpen");
const InventoryItem = require("../../database/models/InventoryItem");
const User = require("../../database/models/User");
const Address = require("../../database/models/Address");
const Order = require("../../database/models/Order");
const SessionEvent = require("../../database/models/SessionEvent");
const Settings = require("../../database/models/Settings");

const { autorizar } = require("../../middleware/auth");
const wallet = require("../../services/wallet");
const controles = require("../../services/controls");
const kyc = require("../../services/verification");
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
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amountSc" },
            /*
              Y lo jugado aparte, que no es lo mismo: una apertura
              gratis mueve cero y sin embargo es una jugada. Las filas
              viejas --de antes de que el campo existiera-- no lo
              tienen, y ahi vale el importe, que para una paga es
              exactamente lo mismo.
            */
            jugado: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ["$juegaSc", 0] }, 0] },
                  "$juegaSc",
                  { $abs: "$amountSc" },
                ],
              },
            },
            cuantos: { $sum: 1 },
          },
        },
      ]),
      InventoryItem.aggregate([
        { $match: { user: id, state: "held" } },
        { $group: { _id: null, cuantos: { $sum: 1 }, valor: { $sum: "$valueSc" } } },
      ]),
    ]);

    const porTipo = Object.fromEntries(sumas.map(
      (s) => [s._id, { total: sc(s.total), jugado: sc(s.jugado), cuantos: s.cuantos }]
    ));
    const de = (t) => (porTipo[t] ? porTipo[t].total : 0);
    const jugadoDe = (t) => (porTipo[t] ? porTipo[t].jugado : 0);

    /*
      Lo jugado, pero sumado desde el libro, para poder comparar.

      La lista sale del modelo: si acá faltara un tipo que el contador
      del usuario sí cuenta --los juegos, por ejemplo-- el jugador
      vería el cartel rojo de "los numeros no cuadran" sin que haya
      nada roto.
    */
    const jugadoSegunElLibro = sc(
      BalanceTransaction.TIPOS_QUE_JUEGAN.reduce((a, t) => a + jugadoDe(t), 0)
    );

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

/* ── La libreta de direcciones ──────────────────────────────── */

/** Lo que se devuelve de una dirección. Es toda suya, no hay nada oculto. */
function resumirDireccion(d) {
  return {
    _id: d._id,
    nombre: d.nombre,
    telefono: d.telefono || "",
    calle: d.calle,
    calle2: d.calle2 || "",
    ciudad: d.ciudad,
    provincia: d.provincia || "",
    codigoPostal: d.codigoPostal,
    pais: d.pais,
    predeterminada: !!d.predeterminada,
  };
}

/** Lee y recorta los campos. Lo que llega nunca se guarda como viene. */
function camposDeDireccion(cuerpo) {
  const texto = (v, largo) => String(v || "").trim().slice(0, largo);

  const campos = {
    nombre: texto(cuerpo.nombre, 80),
    telefono: texto(cuerpo.telefono, 32),
    calle: texto(cuerpo.calle, 120),
    calle2: texto(cuerpo.calle2, 120),
    ciudad: texto(cuerpo.ciudad, 80),
    provincia: texto(cuerpo.provincia, 80),
    codigoPostal: texto(cuerpo.codigoPostal, 20),
    pais: texto(cuerpo.pais, 2).toUpperCase(),
  };

  for (const obligatorio of ["nombre", "calle", "ciudad", "codigoPostal", "pais"]) {
    if (!campos[obligatorio]) throw errorDe("INVALID_AMOUNT", { campo: obligatorio });
  }
  if (campos.pais.length !== 2) throw errorDe("INVALID_AMOUNT", { campo: "pais" });

  return campos;
}

/**
 * LA FOTO DE PERFIL.
 *
 * Llega como data-URI, ya achicada por la pantalla. Se valida igual:
 * el que manda el pedido puede ser cualquiera, no solo nuestra
 * pantalla.
 *
 * NADA DE SVG
 *
 * Un SVG puede llevar javascript adentro, y esto se dibuja como foto
 * de perfil en el chat de soporte y en el panel. Tres formatos de
 * imagen de verdad y nada mas.
 */
const FOTO_OK = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const FOTO_MAXIMA = 300 * 1024;

router.put("/avatar", autorizar(true), async (req, res) => {
  try {
    const foto = String(req.body.foto || "").trim();

    /* Vacia quiere decir "sacala": vuelve a la inicial. */
    if (!foto) {
      await User.updateOne({ _id: req.user._id }, { $set: { avatarUrl: "" } });
      return res.json({ success: true, data: { avatarUrl: "" } });
    }

    if (!FOTO_OK.test(foto)) throw errorDe("BAD_FILE_TYPE", {}, 400);

    /* El largo del base64, no el de la cadena: 4 caracteres son 3 bytes. */
    const bytes = Math.floor((foto.length - foto.indexOf(",") - 1) * 0.75);
    if (bytes > FOTO_MAXIMA) throw errorDe("FILE_TOO_BIG", { maximo: FOTO_MAXIMA }, 400);

    await User.updateOne({ _id: req.user._id }, { $set: { avatarUrl: foto } });

    return res.json({ success: true, data: { avatarUrl: foto } });
  } catch (err) {
    return responderError(res, err, "avatar");
  }
});

router.get("/addresses", autorizar(true), async (req, res) => {
  try {
    const filas = await Address.find({ user: req.user._id })
      .sort({ predeterminada: -1, createdAt: -1 })
      .lean();
    return res.json({ success: true, data: { items: filas.map(resumirDireccion) } });
  } catch (err) {
    return responderError(res, err, "addresses");
  }
});

router.post("/addresses", autorizar(true), async (req, res) => {
  try {
    const campos = camposDeDireccion(req.body);
    const cuantas = await Address.countDocuments({ user: req.user._id });
    if (cuantas >= 10) throw errorDe("ABOVE_MAXIMUM", { maximo: 10 });

    const creada = await Address.create({ ...campos, user: req.user._id });

    /* La primera es la predeterminada sin que haya que elegirla. */
    if (cuantas === 0 || req.body.predeterminada) {
      await Address.marcarPredeterminada(req.user._id, creada._id);
    }

    return res.json({ success: true, data: resumirDireccion(await Address.findById(creada._id).lean()) });
  } catch (err) {
    return responderError(res, err, "addresses/create");
  }
});

router.put("/addresses/:id", autorizar(true), async (req, res) => {
  try {
    const campos = camposDeDireccion(req.body);
    const r = await Address.updateOne({ _id: req.params.id, user: req.user._id }, { $set: campos });
    if (!r.matchedCount) throw errorDe("ADDRESS_NOT_FOUND", {}, 404);
    if (req.body.predeterminada) await Address.marcarPredeterminada(req.user._id, req.params.id);
    return res.json({ success: true, data: resumirDireccion(await Address.findById(req.params.id).lean()) });
  } catch (err) {
    return responderError(res, err, "addresses/update");
  }
});

router.delete("/addresses/:id", autorizar(true), async (req, res) => {
  try {
    const borrada = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id }).lean();
    if (!borrada) throw errorDe("ADDRESS_NOT_FOUND", {}, 404);

    /* Si era la predeterminada, lo pasa a ser la más nueva que quede:
       quedarse sin ninguna convierte el próximo envío en un error. */
    if (borrada.predeterminada) {
      const otra = await Address.findOne({ user: req.user._id }).sort({ createdAt: -1 }).lean();
      if (otra) await Address.marcarPredeterminada(req.user._id, otra._id);
    }

    return res.json({ success: true, data: { borrada: true } });
  } catch (err) {
    return responderError(res, err, "addresses/delete");
  }
});

router.post("/addresses/:id/default", autorizar(true), async (req, res) => {
  try {
    const existe = await Address.exists({ _id: req.params.id, user: req.user._id });
    if (!existe) throw errorDe("ADDRESS_NOT_FOUND", {}, 404);
    await Address.marcarPredeterminada(req.user._id, req.params.id);
    return res.json({ success: true, data: { ok: true } });
  } catch (err) {
    return responderError(res, err, "addresses/default");
  }
});

/* ── Los pedidos de envío ────────────────────────────────── */

router.get("/orders", autorizar(true), async (req, res) => {
  try {
    const porPagina = Math.min(100, Math.max(1, Number(req.query.perPage) || 25));
    const filas = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(porPagina)
      .lean();

    return res.json({
      success: true,
      data: {
        items: filas.map((o) => ({
          _id: o._id,
          estado: o.estado,
          items: (o.items || []).map((i) => ({
            name: i.name, imageUrl: i.imageUrl, valueSc: sc(i.valueSc),
          })),
          valorSc: sc(o.valorSc),
          destino: o.destino,
          transportista: o.transportista || "",
          seguimiento: o.seguimiento || "",
          motivo: o.motivo || "",
          despachadoEl: o.despachadoEl,
          entregadoEl: o.entregadoEl,
          createdAt: o.createdAt,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "orders");
  }
});

/* ── Desde dónde se entró ───────────────────────────────── */

router.get("/activity", autorizar(true), async (req, res) => {
  try {
    const filas = await SessionEvent.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();

    return res.json({
      success: true,
      data: {
        items: filas.map((s) => ({
          _id: s._id,
          tipo: s.tipo,
          dispositivo: s.dispositivo || "",
          desde: s.desde || "",
          ok: s.ok !== false,
          createdAt: s.createdAt,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "activity");
  }
});

/* ── Los límites que se pone el jugador ─────────────────────── */

router.get("/controls", autorizar(true), async (req, res) => {
  try {
    return res.json({ success: true, data: await controles.leer(req.user._id) });
  } catch (err) {
    return responderError(res, err, "controls");
  }
});

router.put("/controls", autorizar(true), async (req, res) => {
  try {
    const r = await controles.guardar({
      userId: req.user._id,
      juegoDiarioSc: req.body.juegoDiarioSc,
      perdidaDiariaSc: req.body.perdidaDiariaSc,
    });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "controls/save");
  }
});

router.post("/controls/break", autorizar(true), async (req, res) => {
  try {
    const r = await controles.tomarseUnDescanso({ userId: req.user._id, dias: req.body.dias });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "controls/break");
  }
});

/* ── La verificación, en tres niveles ─────────────────────── */

router.get("/verification", autorizar(true), async (req, res) => {
  try {
    return res.json({ success: true, data: await kyc.estadoDe(req.user._id) });
  } catch (err) {
    return responderError(res, err, "verification");
  }
});

/**
 * MANDA UN NIVEL A REVISAR.
 *
 * Lo que entra son datos sensibles --nombre real, documento, dirección,
 * fotos--, así que esta respuesta NO los devuelve: vuelve el estado de
 * los tres niveles y nada más. Lo que el jugador acaba de escribir ya
 * lo tiene en la pantalla; devolvérselo solo agrega un lugar más de
 * donde pueden salirse.
 */
router.post("/verification/:nivel", autorizar(true), async (req, res) => {
  try {
    const r = await kyc.mandar({
      userId: req.user._id,
      nivel: req.params.nivel,
      cuerpo: req.body,
    });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "verification/submit");
  }
});

module.exports = router;
