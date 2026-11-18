const express = require("express");

const Promotion = require("../../database/models/Promotion");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[promotions] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/**
 * Un texto en el idioma que pidieron, o en inglés.
 *
 * Un Map de Mongoose no es un objeto común: hay que sacarlo con `get`.
 * Y si falta el idioma se cae al inglés en vez de a un hueco: una promo
 * a medio traducir se lee; una vacía, no.
 */
function enIdioma(mapa, idioma) {
  if (!mapa) return "";
  const leer = (k) => (typeof mapa.get === "function" ? mapa.get(k) : mapa[k]);
  return leer(idioma) || leer("en") || "";
}

/** Las que están al aire ahora, en el idioma del que pregunta. */
router.get("/", async (req, res) => {
  try {
    const idioma = String(req.query.lang || "en").slice(0, 5);
    const ahora = new Date();

    const filas = await Promotion.find({
      activa: true,
      $and: [
        { $or: [{ desde: null }, { desde: { $lte: ahora } }] },
        { $or: [{ hasta: null }, { hasta: { $gt: ahora } }] },
      ],
    }).sort({ orden: 1, createdAt: -1 });

    return res.json({
      success: true,
      data: {
        items: filas.map((p) => ({
          _id: p._id,
          clave: p.clave,
          titulo: enIdioma(p.titulo, idioma),
          texto: enIdioma(p.texto, idioma),
          boton: enIdioma(p.boton, idioma),
          arte: {
            kicker: enIdioma(p.arte && p.arte.kicker, idioma),
            linea1: enIdioma(p.arte && p.arte.linea1, idioma),
            linea2: enIdioma(p.arte && p.arte.linea2, idioma),
            fondo: (p.arte && p.arte.fondo) || "#14306a",
            acento: (p.arte && p.arte.acento) || "#ffc83d",
            pos1: (p.arte && p.arte.pos1) || "",
            pos2: (p.arte && p.arte.pos2) || "",
          },
          destino: p.destino || "/boxes",
          hasta: p.hasta,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "listar");
  }
});

module.exports = router;
