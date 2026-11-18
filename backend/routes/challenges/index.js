const express = require("express");

const { autorizar } = require("../../middleware/auth");
const retos = require("../../services/challenges");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

/**
 * LOS DESAFIOS AL AIRE.
 *
 * Sin cuenta se ven igual; con cuenta, además se marca cuáles ya ganó.
 * No hay nada que reclamar acá: el premio entra solo en la apertura que
 * pega el multiplicador.
 */
router.get("/", autorizar(false), async (req, res) => {
  try {
    const items = await retos.alAire(req.user ? req.user._id : null);
    return res.json({ success: true, data: { items } });
  } catch (err) {
    if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
    logger.error("[challenges] listar:", err.message);
    return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
  }
});

module.exports = router;
