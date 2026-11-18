const express = require("express");

const { autorizar } = require("../../middleware/auth");
const carreras = require("../../services/races");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[races] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/** Las tres, resumidas: es lo que dibuja el menú de la izquierda. */
router.get("/", async (req, res) => {
  try {
    return res.json({ success: true, data: await carreras.resumen() });
  } catch (err) {
    return responderError(res, err, "resumen");
  }
});

/** Las que ya cerraron. `/past?tipo=weekly` para una sola. */
router.get("/past", async (req, res) => {
  try {
    const filas = await carreras.pasadas({ tipo: req.query.tipo, cuantas: 10 });
    return res.json({ success: true, data: { items: filas } });
  } catch (err) {
    return responderError(res, err, "pasadas");
  }
});

/**
 * UNA CARRERA, CON SU TABLA.
 *
 * `autorizar(false)`: anda sin cuenta --cualquiera puede mirar quién va
 * ganando-- pero si hay sesión, se le marca su fila y se le dice en qué
 * puesto va aunque esté afuera de los cincuenta.
 *
 * Va al final: `/past` tiene que estar ANTES o `:tipo` se lo come.
 */
router.get("/:tipo", autorizar(false), async (req, res) => {
  try {
    const datos = await carreras.ver({
      tipo: req.params.tipo,
      userId: req.user ? req.user._id : null,
    });
    return res.json({ success: true, data: datos });
  } catch (err) {
    return responderError(res, err, "ver");
  }
});

module.exports = router;
