/**
 * LOS DESAFIOS DEL DIA.
 *
 * Se revisan después de cada apertura. El jugador no reclama nada: si
 * pegó el multiplicador y quedaban cupos, el premio entra en esa misma
 * apertura.
 *
 * TODO VA EN SU PROPIO TRY, ARRIBA
 *
 * Esto corre dentro de `boxes.abrir()`, después de cobrar y entregar.
 * Que falle un desafío no puede tumbar la apertura de alguien que ya
 * pagó y ya tiene su objeto.
 */

const Challenge = require("../../database/models/Challenge");
const { ChallengeWin } = require("../../database/models/Challenge");

const wallet = require("../wallet");
const { sc } = require("../../utils/money");
const { logger } = require("../../utils/logger");

/**
 * Revisa los desafíos de una caja después de una apertura.
 *
 * @param {object} o
 * @param {object} o.user
 * @param {object} o.caja
 * @param {number} o.precioSc  lo que costó la apertura
 * @param {number} o.premioSc  lo que salió
 * @param {string} [o.boxOpenId]
 * @returns {Promise<Array>} los que ganó, para contárselo
 */
async function revisar({ user, caja, precioSc, premioSc, boxOpenId }) {
  /*
    Con una apertura gratis el precio es cero y el multiplicador sería
    infinito. Se usa el precio de lista: el desafío es sobre la caja, no
    sobre lo que pagó.
  */
  const base = sc(precioSc) > 0 ? sc(precioSc) : sc(caja.priceSc);
  if (base <= 0) return [];

  const logrado = sc(premioSc) / base;
  const ahora = new Date();

  const vivos = await Challenge.find({
    box: caja._id,
    activo: true,
    desde: { $lte: ahora },
    hasta: { $gt: ahora },
    multiplicador: { $lte: logrado },
  }).lean();

  if (!vivos.length) return [];

  const ganados = [];

  for (const d of vivos) {
    try {
      /*
        PRIMERO EL CUPO, DESPUES LA PLATA.

        `cuposUsados: { $lt: d.cupos }` va adentro del FILTRO: si otro
        jugador se llevó el último en este mismo instante, este update
        no toca nada y acá no se paga. Leer y después escribir es como
        se regalan treinta premios de diez cupos.
      */
      const tomado = await Challenge.findOneAndUpdate(
        { _id: d._id, activo: true, cuposUsados: { $lt: d.cupos } },
        { $inc: { cuposUsados: 1 } },
        { new: true }
      ).lean();

      if (!tomado) continue; // se agotaron

      /*
        Y la fila del ganador con su índice único: el mismo desafío no
        se gana dos veces. Si choca, se devuelve el cupo.
      */
      try {
        await ChallengeWin.create({
          challenge: d._id,
          user: user._id,
          boxOpen: boxOpenId || null,
          premioSc: sc(d.premioSc),
          multiplicadorLogrado: Math.round(logrado * 100) / 100,
        });
      } catch (err) {
        await Challenge.updateOne({ _id: d._id }, { $inc: { cuposUsados: -1 } });
        if (err && err.code === 11000) continue; // ya lo habia ganado
        throw err;
      }

      await wallet.mover({
        userId: user._id,
        amountSc: sc(d.premioSc),
        type: "challenge",
        reference: { kind: "challenge", id: d._id, label: `${d.multiplicador}x ${d.boxName}` },
      });

      ganados.push({
        _id: d._id,
        multiplicador: d.multiplicador,
        premioSc: sc(d.premioSc),
        cuposLibres: Math.max(0, d.cupos - tomado.cuposUsados),
      });
    } catch (err) {
      logger.error(`[challenges] ${d._id}: ${err.message}`);
    }
  }

  return ganados;
}

/** Los que están al aire, para la pantalla. */
async function alAire(userId) {
  const ahora = new Date();

  const vivos = await Challenge.find({
    activo: true,
    desde: { $lte: ahora },
    hasta: { $gt: ahora },
  })
    .sort({ premioSc: -1 })
    .populate("box", "slug name imageUrl priceSc category")
    .lean();

  const ganados = userId
    ? await ChallengeWin.find({ user: userId, challenge: { $in: vivos.map((v) => v._id) } }).lean()
    : [];
  const mios = new Set(ganados.map((g) => String(g.challenge)));

  return vivos.map((d) => ({
    _id: d._id,
    multiplicador: d.multiplicador,
    premioSc: sc(d.premioSc),
    cupos: d.cupos,
    cuposLibres: Math.max(0, d.cupos - d.cuposUsados),
    hasta: d.hasta,
    yaLoGane: mios.has(String(d._id)),
    caja: d.box
      ? {
        slug: d.box.slug,
        name: d.box.name,
        imageUrl: d.box.imageUrl,
        priceSc: sc(d.box.priceSc),
        category: d.box.category,
      }
      : { slug: d.boxSlug, name: d.boxName, imageUrl: "", priceSc: 0, category: "" },
    /* Lo que hay que sacar, en SC: es lo que el jugador quiere saber. */
    hayQueSacarSc: d.box ? sc(d.box.priceSc * d.multiplicador) : 0,
  }));
}

module.exports = { revisar, alAire };
