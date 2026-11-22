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
        apuestaMinimaSc: Number(j.apuestaMinimaSc) || 0.1,
        apuestaMaximaSc: Number(j.apuestaMaximaSc) || 0,
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

module.exports = router;
