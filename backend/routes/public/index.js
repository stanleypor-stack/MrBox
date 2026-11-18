const express = require("express");
const Settings = require("../../database/models/Settings");
const Banner = require("../../database/models/Banner");
const Challenge = require("../../database/models/Challenge");
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
        /*
          De soporte sale el horario y nada mas.

          Antes salia `cfg.soporte` entero, que desde que existen las
          respuestas guardadas incluye el texto con el que contesta el
          equipo. Eso es de adentro: no hace mal, pero no tiene por que
          estar en una respuesta publica.
        */
        soporte: {
          horarioMostrado: (cfg.soporte && cfg.soporte.horarioMostrado) || "24/7",
          respuestaAutomatica: !(cfg.soporte && cfg.soporte.respuestaAutomatica === false),
        },
      },
    });
  } catch (err) {
    logger.error("[public] settings:", err.message);
    return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
  }
});

/**
 * LOS BANNERS DE LA PORTADA.
 *
 * Vienen de la base para que cambiarlos sea cambiar una fila y no
 * desplegar el sitio. El texto son CLAVES de idioma: el que mira los
 * lee en el suyo (ver database/models/Banner).
 */
router.get("/banners", async (req, res) => {
  try {
    const items = await Banner.find({ visible: true })
      .sort({ orden: 1 })
      .select("clave foto titulo sub cta destino")
      .lean();

    return res.json({ success: true, data: { items } });
  } catch (err) {
    logger.error("[public] banners:", err.message);
    return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
  }
});

/**
 * LOS NUMERITOS DE LA BARRA LATERAL.
 *
 * Hoy, cuantos desafios hay al aire: es la chapita del prototipo al
 * lado de "Challenges". Va en su propia ruta --chica y sin sesion--
 * porque la barra esta en TODAS las pantallas: meterlo en algo mas
 * grande seria pagar ese pedido en cada vista.
 */
router.get("/counts", async (req, res) => {
  try {
    const desafios = await Challenge.countDocuments({
      activo: true,
      hasta: { $gt: new Date() },
      $expr: { $lt: ["$cuposUsados", "$cupos"] },
    });

    return res.json({ success: true, data: { desafios } });
  } catch (err) {
    logger.error("[public] counts:", err.message);
    return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
  }
});

module.exports = router;
