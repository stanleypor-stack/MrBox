const express = require("express");

const { autorizar } = require("../../middleware/auth");
const avisos = require("../../services/notificaciones");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

/**
 * LA CAMPANITA.
 *
 * Dos cosas: qué hay, y marcarlo leído. Los avisos no se crean desde
 * acá --los deja el sitio cuando pasa algo-- así que no hay POST para
 * crear uno: un aviso que se puede pedir no es un aviso.
 */

/** Lo que tiene, y cuántos sin leer para la bolita. */
router.get("/", autorizar(true), async (req, res) => {
  try {
    const [items, sinLeer] = await Promise.all([
      avisos.listar(req.user._id),
      avisos.sinLeer(req.user._id),
    ]);
    return res.json({ success: true, data: { items, sinLeer } });
  } catch (err) {
    if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
    logger.error("[avisos] listar:", err.message);
    return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
  }
});

/**
 * Solo la cuenta, para la bolita.
 *
 * La pide el encabezado cada tanto. Es una cuenta contra un índice:
 * traer los treinta avisos enteros cada minuto para mostrar un número
 * sería mandar cien veces más de lo que se usa.
 */
router.get("/count", autorizar(true), async (req, res) => {
  try {
    return res.json({ success: true, data: { sinLeer: await avisos.sinLeer(req.user._id) } });
  } catch (err) {
    logger.error("[avisos] contar:", err.message);
    return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
  }
});

/** Marcar leído. Sin `ids`, todos. */
router.post("/read", autorizar(true), async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : null;
    const cuantos = await avisos.marcar(req.user._id, ids);
    return res.json({ success: true, data: { marcados: cuantos, sinLeer: await avisos.sinLeer(req.user._id) } });
  } catch (err) {
    if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
    logger.error("[avisos] marcar:", err.message);
    return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
  }
});

module.exports = router;
