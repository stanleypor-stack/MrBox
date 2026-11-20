const express = require("express");

const Race = require("../../database/models/Race");
const BalanceTransaction = require("../../database/models/BalanceTransaction");

const carreras = require("../../services/races");
const admin = require("../../services/admin");
const wallet = require("../../services/wallet");
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
 * UNA CARRERA, POR DENTRO.
 *
 * La lista dice cuáles hay. Acá se ve la que importa: quién va
 * ganando ahora mismo, cuánto cobra cada puesto, y --si ya cerró--
 * quién cobró y quién no.
 *
 * LO QUE SE PAGO SALE DEL LIBRO
 *
 * No de la lista de ganadores que guardó la carrera. La fila de
 * ganadores dice lo que TENIA que cobrar cada uno; el libro dice lo
 * que de verdad se le movió. Cuando no coinciden --un pago que falló
 * al cerrar-- hay que verlo acá, no descubrirlo cuando el jugador
 * escriba preguntando por su premio.
 */
router.get("/races/:id", async (req, res) => {
  try {
    const c = await Race.findById(req.params.id).lean();
    if (!c) throw errorDe("RACE_NOT_FOUND");

    const cuantos = Math.max((c.reparto || []).length, 10);

    /* La que está viva se calcula ahora; la cerrada ya tiene su lista. */
    const tabla = c.estado === "live"
      ? await carreras.tablaDe({ desde: c.desde, hasta: c.hasta, cuantos })
      : (c.ganadores || []);

    /* Lo que de verdad se movió por esta carrera. */
    const pagos = await BalanceTransaction.find({
      type: "race_prize",
      "reference.id": c._id,
    }).lean();

    const pagadoA = new Map(pagos.map((p) => [String(p.user), sc(p.amountSc)]));

    const puestos = tabla.map((f) => {
      const premioSc = sc(carreras.premioDe(c.reparto, c.premioTotalSc, f.puesto));
      const cobro = pagadoA.get(String(f.user));
      return {
        puesto: f.puesto,
        user: f.user,
        username: f.username,
        jugadoSc: sc(f.jugadoSc),
        premioSc,
        /* `null` mientras la carrera corre: todavía no le toca cobrar. */
        cobradoSc: c.estado === "live" ? null : (cobro === undefined ? 0 : cobro),
        sinPagar: c.estado !== "live" && premioSc > 0 && cobro === undefined,
      };
    });

    return res.json({
      success: true,
      data: {
        carrera: {
          _id: c._id,
          tipo: c.tipo,
          estado: c.estado,
          desde: c.desde,
          hasta: c.hasta,
          cerradaEl: c.cerradaEl || null,
          premioTotalSc: sc(c.premioTotalSc),
          reparto: c.reparto || [],
        },
        puestos,
        /* Los números de arriba, todos del libro o de la tabla viva. */
        numeros: {
          jugadores: puestos.length,
          jugadoSc: sc(puestos.reduce((t, p) => t + p.jugadoSc, 0)),
          repartidoSc: sc(puestos.reduce((t, p) => t + p.premioSc, 0)),
          pagadoSc: sc(pagos.reduce((t, p) => t + p.amountSc, 0)),
          sinPagar: puestos.filter((p) => p.sinPagar).length,
        },
      },
    });
  } catch (err) {
    return responderError(res, err, "races.one");
  }
});

/**
 * CERRARLA AHORA.
 *
 * Lo mismo que hace el reloj cuando vence, pero a mano: la marca
 * cerrada con la condición adentro del filtro --dos clics no la pagan
 * dos veces-- y paga lo que corresponde.
 */
router.post("/races/:id/settle", async (req, res) => {
  try {
    const motivo = String(req.body.motivo || "").trim();
    if (motivo.length < 3) throw errorDe("REASON_REQUIRED");

    const c = await Race.findById(req.params.id).lean();
    if (!c) throw errorDe("RACE_NOT_FOUND");
    if (c.estado !== "live") throw errorDe("RACE_SETTLED");

    const cerrada = await carreras.cerrar(c);
    if (!cerrada) throw errorDe("RACE_SETTLED");

    await admin.anotar({
      admin: req.user,
      evento: "race.settle",
      sobre: { tipo: "race", id: c._id, nombre: `${c.tipo} ${new Date(c.desde).toISOString().slice(0, 10)}` },
      antes: { estado: "live" },
      despues: { estado: "settled" },
      motivo,
      req,
    });

    return res.json({ success: true, data: { estado: "settled" } });
  } catch (err) {
    return responderError(res, err, "races.settle");
  }
});

/**
 * PAGARLE A UNO QUE QUEDO SIN COBRAR.
 *
 * Cuando una carrera cierra, los premios se pagan de a uno: si uno
 * falla, los demás cobran igual y el que falló queda anotado. Esto es
 * el botón para pagarlo después, sin tocar la base a mano.
 *
 * NO PUEDE PAGAR DOS VECES
 *
 * Antes de mover un peso busca en el libro si ya hay un `race_prize`
 * de esta carrera para esa persona. El libro es la verdad, no la fila
 * de ganadores.
 */
router.post("/races/:id/pay/:userId", async (req, res) => {
  try {
    const c = await Race.findById(req.params.id).lean();
    if (!c) throw errorDe("RACE_NOT_FOUND");
    if (c.estado !== "settled") throw errorDe("RACE_LIVE");

    const g = (c.ganadores || []).find((x) => String(x.user) === String(req.params.userId));
    if (!g) throw errorDe("NOT_FOUND");

    const premioSc = sc(carreras.premioDe(c.reparto, c.premioTotalSc, g.puesto));
    if (premioSc <= 0) throw errorDe("INVALID_AMOUNT", { premioSc });

    /*
      SE TOMA EL PREMIO, Y RECIEN AHI SE PAGA.

      Antes esto era buscar la fila en el libro y, si no estaba, mover
      la plata. Entre lo uno y lo otro hay una ventana: veinte clics
      simultaneos pasaban los veinte y pagaban veinte veces. Con la
      condicion `pagadoEl: null` adentro del filtro, la decide la base
      en el mismo momento en que marca.
    */
    const tomado = await Race.findOneAndUpdate(
      { _id: c._id, ganadores: { $elemMatch: { user: g.user, pagadoEl: null } } },
      { $set: { "ganadores.$.pagadoEl": new Date() } }
    ).lean();

    if (!tomado) throw errorDe("ALREADY_CLAIMED");

    try {
      await wallet.mover({
        userId: g.user,
        amountSc: premioSc,
        type: "race_prize",
        reference: { kind: "race", id: c._id, label: `${c.tipo} #${g.puesto}` },
      });
    } catch (err) {
      await Race.updateOne(
        { _id: c._id, "ganadores.user": g.user },
        { $set: { "ganadores.$.pagadoEl": null } }
      );
      throw err;
    }

    await admin.anotar({
      admin: req.user,
      evento: "race.pay",
      sobre: { tipo: "user", id: g.user, nombre: g.username },
      despues: { premioSc, puesto: g.puesto, carrera: String(c._id) },
      motivo: String(req.body.motivo || "").trim(),
      req,
    });

    return res.json({ success: true, data: { premioSc } });
  } catch (err) {
    return responderError(res, err, "races.pay");
  }
});

module.exports = router;
