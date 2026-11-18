const express = require("express");
const rateLimit = require("express-rate-limit");

const { autorizar } = require("../../middleware/auth");
const soporte = require("../../services/support");
const Settings = require("../../database/models/Settings");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[support] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/**
 * EL CHAT DE SOPORTE, DEL LADO DEL JUGADOR.
 *
 * El globito de abajo a la derecha. Todo pide sesión menos las perillas
 * (el horario que se muestra), porque una conversación sin cuenta no se
 * le puede contestar a nadie.
 *
 * EL LIMITE DE ESCRITURA
 *
 * Veinte mensajes por minuto es más de lo que escribe una persona y
 * mucho menos de lo que escribe un script. Sin esto, el primer aburrido
 * deja la bandeja con cuarenta mil mensajes y el equipo no puede
 * trabajar.
 */

const limiteDeEscritura = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED" } },
});

/** Las perillas que la pantalla necesita antes de que alguien entre. */
router.get("/config", async (req, res) => {
  try {
    const cfg = await Settings.leer();
    return res.json({
      success: true,
      data: {
        horario: (cfg.soporte && cfg.soporte.horarioMostrado) || "24/7",
        respuestaAutomatica: !(cfg.soporte && cfg.soporte.respuestaAutomatica === false),
      },
    });
  } catch (err) {
    return responderError(res, err, "support.config");
  }
});

router.use(autorizar(true));

/** Mis conversaciones, la más fresca arriba. */
router.get("/threads", async (req, res) => {
  try {
    const items = await soporte.mias(req.user._id);
    return res.json({ success: true, data: { items, sinLeer: await soporte.sinLeer(req.user._id) } });
  } catch (err) {
    return responderError(res, err, "support.threads");
  }
});

/** Una conversación entera. Abrirla la marca leída. */
router.get("/threads/:id", async (req, res) => {
  try {
    return res.json({ success: true, data: await soporte.ver(req.user._id, req.params.id) });
  } catch (err) {
    return responderError(res, err, "support.thread");
  }
});

/**
 * Escribir.
 *
 * Sin `hilo`, sigue la conversación abierta o abre una. Con `hilo`,
 * escribe en esa. La pantalla no tiene que saber cuál de las dos cosas
 * pasa: manda el texto y recibe la conversación al día.
 */
router.post("/threads", limiteDeEscritura, async (req, res) => {
  try {
    const hilo = await soporte.escribir({
      userId: req.user._id,
      nombre: req.user.username,
      texto: req.body.texto,
      hiloId: req.body.hilo || null,
      nueva: !!req.body.nueva,
    });
    return res.json({ success: true, data: hilo });
  } catch (err) {
    return responderError(res, err, "support.write");
  }
});

/** Cerrarla desde el sitio: "ya está, gracias". */
router.post("/threads/:id/close", async (req, res) => {
  try {
    return res.json({ success: true, data: await soporte.cerrarDelJugador(req.user._id, req.params.id) });
  } catch (err) {
    return responderError(res, err, "support.close");
  }
});

module.exports = router;
