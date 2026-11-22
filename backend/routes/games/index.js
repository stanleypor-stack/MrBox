const express = require("express");
const rateLimit = require("express-rate-limit");

const { autorizar } = require("../../middleware/auth");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const Settings = require("../../database/models/Settings");
const GameRound = require("../../database/models/GameRound");

const juegos = require("../../services/games");
const cfgJuegos = require("../../services/games/config");
const dice = require("../../services/games/dice");
const reme = require("../../services/games/reme");
const keno = require("../../services/games/keno");
const slide = require("../../services/games/slide");
const plinko = require("../../services/games/plinko");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[games] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/**
 * EL FRENO.
 *
 * Un juego se juega rápido y a propósito: el tope tiene que dejar
 * jugar cómodo y cortar un script. 300 por minuto son cinco por
 * segundo, que ningún dedo alcanza y ningún bot aprovecha.
 */
const limite = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.GAME_RATE_LIMIT) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json(errorDe("RATE_LIMITED", {}, 429).aRespuesta()),
});

/* ── Lo que la pantalla necesita saber antes de jugar ─────────────── */

/**
 * LOS OCHO, CON SU MARGEN Y SUS LIMITES.
 *
 * Se puede mirar sin cuenta: la pantalla de juegos es una pantalla de
 * venta igual que la de cajas, y lo que publica --el retorno de cada
 * juego-- es justamente lo que tiene que poder leerse sin registrarse.
 */
router.get("/", autorizar(false), async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const j = cfg.juegos || {};

    return res.json({
      success: true,
      data: {
        apagados: !!j.apagados,
        /* Los mismos nombres que usa la pantalla; los limites salen
           de un solo lugar, que es el que tambien los hace cumplir. */
        apuestaMinimaSc: cfgJuegos.limites(cfg).minimaSc,
        apuestaMaximaSc: cfgJuegos.limites(cfg).maximaSc,
        juegos: cfgJuegos.JUEGOS.map((id) => ({
          id,
          /* El retorno, que es lo que dice la tarjeta. Sale del mismo
             número que paga, así que no puede mentir. */
          rtp: Math.round((100 - cfgJuegos.margenEfectivo(id, cfg)) * 100) / 100,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "games");
  }
});

/**
 * LAS ULTIMAS RONDAS DEL JUGADOR.
 *
 * Sin `oculto`, que el modelo ya deja afuera por defecto: una ronda de
 * Mines todavía abierta tiene las minas guardadas, y eso no sale de
 * acá ni por error.
 */
router.get("/historial", autorizar(true), async (req, res) => {
  try {
    const cuantas = Math.min(50, Math.max(1, Number(req.query.limite) || 20));
    const filas = await GameRound.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(cuantas)
      .select("juego apuestaSc jugada resultado multiplicador pagoSc nonce semillaServidorHash semillaCliente hmacs abierta createdAt")
      .lean();

    return res.json({ success: true, data: { rondas: filas } });
  } catch (err) {
    return responderError(res, err, "games/historial");
  }
});

/* ── Dice ─────────────────────────────────────────────────────────── */

/**
 * UNA TIRADA.
 *
 * El cuerpo trae la apuesta y la jugada. Nada de lo que manda el
 * cliente decide cuánto se paga: el multiplicador lo calcula el
 * servidor con el margen de las perillas, y el número sale de las
 * semillas. Lo único que el jugador elige es a qué le apuesta.
 */
router.post("/dice/play", autorizar(true), limite, async (req, res) => {
  try {
    const r = await juegos.jugarUnaRonda({
      user: req.user,
      juego: "dice",
      apuestaSc: req.body.apuestaSc,
      /* Se mira la jugada antes de que se mueva un peso. */
      revisar: () => dice.revisar({
        modo: req.body.modo,
        desde: req.body.desde,
        hasta: req.body.hasta,
      }),

      sortear: ({ apuestaSc, semillas, cfg, jugada }) => {
        const salida = dice.jugar({
          apuestaSc,
          modo: jugada.modo,
          desde: jugada.desde,
          hasta: jugada.hasta,
          semillas,
          cfg,
        });

        return {
          ...salida,
          resultado: { numero: salida.numero, gano: salida.gano, chance: salida.chance },
        };
      },
    });

    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "games/dice");
  }
});

/* ── Los otros que empiezan y terminan de una ─────────────────────── */

/**
 * UNA PUERTA POR JUEGO, PERO UNA SOLA COCINA.
 *
 * Reme, Keno, Slide y Plinko son todos lo mismo visto desde el
 * servidor: se apuesta, sale un resultado y se acabó. Lo único propio
 * de cada uno es qué mira de lo que vino en el pedido y qué
 * matemática aplica, así que eso es lo único que se escribe acá
 * abajo. Cobrar, el nonce, la ronda y el pago los hace
 * `services/games`, igual que Dice.
 */
const DE_UNA = {
  reme: {
    servicio: reme,
    revisar: () => ({}),
    sortear: ({ apuestaSc, semillas, cfg }) => reme.jugar({ apuestaSc, semillas, cfg }),
  },

  keno: {
    servicio: keno,
    revisar: (req) => ({ elegidas: keno.revisar(req.body.elegidas) }),
    sortear: ({ apuestaSc, semillas, cfg, jugada }) =>
      keno.jugar({ apuestaSc, elegidas: jugada.elegidas, semillas, cfg }),
  },

  slide: {
    servicio: slide,
    revisar: (req) => ({ color: slide.revisar(req.body.color) }),
    sortear: ({ apuestaSc, semillas, cfg, jugada }) =>
      slide.jugar({ apuestaSc, color: jugada.color, semillas, cfg }),
  },

  plinko: {
    servicio: plinko,
    revisar: (req) => plinko.revisar({ riesgo: req.body.riesgo, filas: req.body.filas }),
    sortear: ({ apuestaSc, semillas, cfg, jugada }) =>
      plinko.jugar({ apuestaSc, riesgo: jugada.riesgo, filas: jugada.filas, semillas, cfg }),
  },
};

for (const [id, def] of Object.entries(DE_UNA)) {
  router.post(`/${id}/play`, autorizar(true), limite, async (req, res) => {
    try {
      const r = await juegos.jugarUnaRonda({
        user: req.user,
        juego: id,
        apuestaSc: req.body.apuestaSc,
        revisar: () => def.revisar(req),
        sortear: def.sortear,
      });
      return res.json({ success: true, data: r });
    } catch (err) {
      return responderError(res, err, `games/${id}`);
    }
  });
}

module.exports = router;
