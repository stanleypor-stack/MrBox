const express = require("express");

const { autorizar } = require("../../middleware/auth");
const vip = require("../../services/vip");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[vip] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/**
 * LA TABLA DE LOS NUEVE RANGOS.
 *
 * Sin cuenta: es la pantalla que convence a alguien de abrirse una.
 * Si hay sesión, además dice en cuál está.
 */
router.get("/", autorizar(false), async (req, res) => {
  try {
    return res.json({
      success: true,
      data: {
        rangos: vip.tabla(),
        beneficios: vip.BENEFICIOS,
        miRango: req.user ? vip.rangoDe(vip.jugadoParaVip(req.user), req.user.rangoManual) : null,
        /* Lo que muestra la barra: lo jugado mas el piso del rango que
           se le haya puesto a mano. */
        jugadoVipSc: req.user ? vip.jugadoParaVip(req.user) : 0,
      },
    });
  } catch (err) {
    return responderError(res, err, "tabla");
  }
});

/* ── El rakeback ──────────────────────────────────────────────────── */

router.get("/rakeback", autorizar(true), async (req, res) => {
  try {
    return res.json({ success: true, data: await vip.rakebackDe(req.user._id) });
  } catch (err) {
    return responderError(res, err, "rakeback");
  }
});

router.post("/rakeback/:periodo", autorizar(true), async (req, res) => {
  try {
    const r = await vip.cobrarRakeback({ userId: req.user._id, periodo: req.params.periodo });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "rakeback/claim");
  }
});

/* ── Los beneficios del club ──────────────────────────────────────── */

/**
 * EN QUE ESTADO ESTA CADA UNO.
 *
 * Los siete, con el rango que hace falta y --para los tres que dan una
 * caja-- si se puede cobrar ahora.
 */
router.get("/beneficios", autorizar(true), async (req, res) => {
  try {
    return res.json({ success: true, data: await vip.beneficiosDe(req.user._id) });
  } catch (err) {
    return responderError(res, err, "vip/beneficios");
  }
});

/**
 * COBRAR UNO.
 *
 * Se piden, no se entregan solos. Es lo mismo que hace el rakeback y
 * evita tener un reloj corriendo cada semana y cada mes: un reloj que
 * se cae una noche deja a todos sin su caja y nadie se entera hasta
 * que alguien reclama.
 */
router.post("/beneficios/:clave", autorizar(true), async (req, res) => {
  try {
    const r = await vip.cobrarBeneficio({ userId: req.user._id, clave: req.params.clave });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "vip/beneficios/claim");
  }
});

module.exports = router;
