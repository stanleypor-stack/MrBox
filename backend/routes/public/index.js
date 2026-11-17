const express = require("express");
const Settings = require("../../database/models/Settings");
const { errorDe } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

/**
 * LAS PERILLAS QUE EL SITIO PUEDE CONTAR.
 *
 * Un subconjunto a dedo de Settings, y eso es a proposito: devolver el
 * documento entero filtraria cosas que no le importan a nadie de afuera
 * --y algunas que no conviene que sepa, como el margen exacto de la
 * casa o los topes internos.
 *
 * Lo que sale de aca es lo que las pantallas MUESTRAN: cuantas
 * aperturas regala el sitio, el minimo de canje, cuantas cajas se
 * abren de una. Cosas que el jugador ve igual jugando.
 */
router.get("/settings", async (req, res) => {
  try {
    const cfg = await Settings.leer();
    return res.json({
      success: true,
      data: {
        siteName: cfg.siteName,
        maintenance: cfg.maintenance,
        aperturasDeRegalo: cfg.aperturasDeRegalo,
        aperturasDeDemo: cfg.aperturasDeDemo,
        cajasALaVez: cfg.cajasALaVez,
        canjeMinimoSc: cfg.canjeMinimoSc,
        tasaDeRecompra: cfg.tasaDeRecompra,
        bonoPorDeposito: cfg.bonoPorDeposito,
        envioQuePideNivel3Sc: cfg.envioQuePideNivel3Sc,
        soporte: cfg.soporte,
      },
    });
  } catch (err) {
    logger.error("[public] settings:", err.message);
    return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
  }
});

module.exports = router;
