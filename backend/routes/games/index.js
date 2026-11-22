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
const mines = require("../../services/games/mines");
const towers = require("../../services/games/towers");
const crash = require("../../services/games/crash");
const wallet = require("../../services/wallet");

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
        maximoPremioSc: cfgJuegos.limites(cfg).premioSc,
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

/* ── Mines ────────────────────────────────────────────────────────── */

/**
 * LO QUE EL JUGADOR PUEDE VER DE UNA RONDA ABIERTA.
 *
 * Nunca las minas. La ronda guarda dónde están desde el primer
 * momento --tiene que estar sorteado antes del primer click-- y esta
 * función es la puerta por la que sale lo que se muestra. Mientras la
 * ronda esté abierta, solo salen las casillas que el jugador YA
 * destapó.
 */
function minesALaVista(ronda, cfg, { terminada = false, minadas = null } = {}) {
  const destapadas = (ronda.resultado || {}).destapadas || [];
  const { tablero, minas } = ronda.jugada;

  return {
    rondaId: ronda._id,
    tablero,
    minas,
    destapadas,
    ...mines.pagoDe({ apuestaSc: ronda.apuestaSc, tablero, minas, destapadas }, cfg),
    /* Las minas solo cuando ya no se puede jugar. */
    ...(terminada ? { minadas: minadas || (ronda.oculto || {}).minadas || [] } : {}),
  };
}

router.post("/mines/open", autorizar(true), limite, async (req, res) => {
  try {
    const r = await juegos.abrirRonda({
      user: req.user,
      juego: "mines",
      apuestaSc: req.body.apuestaSc,
      revisar: () => mines.revisar({ tablero: req.body.tablero, minas: req.body.minas }),
      repartir: ({ semillas, jugada }) => {
        const { minadas, hmacs } = mines.armar({ ...jugada, semillas });
        return {
          hmacs,
          /* Lo tapado va a `oculto`, que el modelo no devuelve. */
          oculto: { minadas },
          publico: { destapadas: [], ...jugada },
        };
      },
    });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "games/mines/open");
  }
});

router.post("/mines/tile", autorizar(true), limite, async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const ronda = await juegos.rondaAbierta(req.user._id, "mines");

    const paso = mines.destapar({
      ronda: {
        tablero: ronda.jugada.tablero,
        minas: ronda.jugada.minas,
        minadas: (ronda.oculto || {}).minadas || [],
        destapadas: (ronda.resultado || {}).destapadas || [],
      },
      casilla: req.body.casilla,
      cfg,
    });

    const resultado = { ...ronda.resultado, destapadas: paso.destapadas, exploto: paso.exploto };

    if (!paso.termino) {
      await juegos.guardarAvance({ ronda, resultado });
      return res.json({
        success: true,
        data: { ...minesALaVista({ ...ronda, resultado }, cfg), casilla: paso.casilla, exploto: false },
      });
    }

    const pago = paso.exploto
      ? { multiplicador: 0, pagoSc: 0 }
      : mines.pagoDe({
          apuestaSc: ronda.apuestaSc,
          tablero: ronda.jugada.tablero,
          minas: ronda.jugada.minas,
          destapadas: paso.destapadas,
        }, cfg);

    await juegos.cerrarRonda({ userId: req.user._id, ronda, ...pago, resultado });

    return res.json({
      success: true,
      data: {
        ...minesALaVista({ ...ronda, resultado }, cfg, { terminada: true }),
        casilla: paso.casilla,
        exploto: paso.exploto,
        termino: true,
        ...pago,
        ...(await wallet.saldoDe(req.user._id)),
      },
    });
  } catch (err) {
    return responderError(res, err, "games/mines/tile");
  }
});

router.post("/mines/cashout", autorizar(true), limite, async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const ronda = await juegos.rondaAbierta(req.user._id, "mines");
    const destapadas = (ronda.resultado || {}).destapadas || [];

    /* Sin ninguna destapada no hay nada que cobrar: seria recuperar
       la apuesta sin haber jugado. */
    if (!destapadas.length) throw errorDe("NOTHING_TO_CLAIM", { juego: "mines" });

    const pago = mines.pagoDe({
      apuestaSc: ronda.apuestaSc,
      tablero: ronda.jugada.tablero,
      minas: ronda.jugada.minas,
      destapadas,
    }, cfg);

    await juegos.cerrarRonda({ userId: req.user._id, ronda, ...pago, resultado: ronda.resultado });

    return res.json({
      success: true,
      data: {
        ...minesALaVista(ronda, cfg, { terminada: true }),
        termino: true,
        ...pago,
        ...(await wallet.saldoDe(req.user._id)),
      },
    });
  } catch (err) {
    return responderError(res, err, "games/mines/cashout");
  }
});

/* ── Dragon's Tower ───────────────────────────────────────────────── */

function towersALaVista(ronda, cfg, { terminada = false } = {}) {
  const subidos = (ronda.resultado || {}).subidos || 0;
  const { riesgo } = ronda.jugada;

  return {
    rondaId: ronda._id,
    riesgo,
    subidos,
    elegidas: (ronda.resultado || {}).elegidas || [],
    ...towers.pagoDe({ apuestaSc: ronda.apuestaSc, riesgo, subidos }, cfg),
    /* La torre entera recién cuando se terminó. */
    ...(terminada ? { dragones: (ronda.oculto || {}).dragones || [] } : {}),
  };
}

router.post("/towers/open", autorizar(true), limite, async (req, res) => {
  try {
    const r = await juegos.abrirRonda({
      user: req.user,
      juego: "towers",
      apuestaSc: req.body.apuestaSc,
      revisar: () => towers.revisar({ riesgo: req.body.riesgo }),
      repartir: ({ semillas, jugada }) => {
        const { dragones, hmacs } = towers.armar({ riesgo: jugada.riesgo, semillas });
        return {
          hmacs,
          oculto: { dragones },
          publico: { subidos: 0, elegidas: [], riesgo: jugada.riesgo },
        };
      },
    });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "games/towers/open");
  }
});

router.post("/towers/tile", autorizar(true), limite, async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const ronda = await juegos.rondaAbierta(req.user._id, "towers");

    const paso = towers.pisar({
      ronda: {
        riesgo: ronda.jugada.riesgo,
        subidos: (ronda.resultado || {}).subidos || 0,
        dragones: (ronda.oculto || {}).dragones || [],
      },
      baldosa: req.body.baldosa,
      cfg,
    });

    const resultado = {
      ...ronda.resultado,
      subidos: paso.subidos,
      elegidas: [...((ronda.resultado || {}).elegidas || []), paso.baldosa],
      quemo: paso.quemo,
    };

    if (!paso.termino) {
      await juegos.guardarAvance({ ronda, resultado });
      return res.json({
        success: true,
        data: { ...towersALaVista({ ...ronda, resultado }, cfg), baldosa: paso.baldosa, quemo: false },
      });
    }

    const pago = paso.quemo
      ? { multiplicador: 0, pagoSc: 0 }
      : towers.pagoDe({ apuestaSc: ronda.apuestaSc, riesgo: ronda.jugada.riesgo, subidos: paso.subidos }, cfg);

    await juegos.cerrarRonda({ userId: req.user._id, ronda, ...pago, resultado });

    return res.json({
      success: true,
      data: {
        ...towersALaVista({ ...ronda, resultado }, cfg, { terminada: true }),
        baldosa: paso.baldosa,
        quemo: paso.quemo,
        termino: true,
        ...pago,
        ...(await wallet.saldoDe(req.user._id)),
      },
    });
  } catch (err) {
    return responderError(res, err, "games/towers/tile");
  }
});

router.post("/towers/cashout", autorizar(true), limite, async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const ronda = await juegos.rondaAbierta(req.user._id, "towers");
    const subidos = (ronda.resultado || {}).subidos || 0;

    if (subidos <= 0) throw errorDe("NOTHING_TO_CLAIM", { juego: "towers" });

    const pago = towers.pagoDe({ apuestaSc: ronda.apuestaSc, riesgo: ronda.jugada.riesgo, subidos }, cfg);
    await juegos.cerrarRonda({ userId: req.user._id, ronda, ...pago, resultado: ronda.resultado });

    return res.json({
      success: true,
      data: {
        ...towersALaVista(ronda, cfg, { terminada: true }),
        termino: true,
        ...pago,
        ...(await wallet.saldoDe(req.user._id)),
      },
    });
  } catch (err) {
    return responderError(res, err, "games/towers/cashout");
  }
});

/* ── Crash ────────────────────────────────────────────────────────── */

router.post("/crash/open", autorizar(true), limite, async (req, res) => {
  try {
    const r = await juegos.abrirRonda({
      user: req.user,
      juego: "crash",
      apuestaSc: req.body.apuestaSc,
      revisar: () => {
        /* El cobro automático es opcional; si viene, tiene que ser un
           multiplicador por encima de 1. */
        const auto = Number(req.body.autoCobrarEn);
        if (req.body.autoCobrarEn !== undefined && (!Number.isFinite(auto) || auto <= 1)) {
          throw errorDe("INVALID_AMOUNT", { campo: "autoCobrarEn" });
        }
        return { autoCobrarEn: Number.isFinite(auto) && auto > 1 ? auto : null };
      },
      repartir: ({ semillas, cfg }) => {
        const { punto, hmacs } = crash.arrancar({ semillas, cfg });
        return {
          hmacs,
          /* El punto de reventón es LO tapado. Si saliera de acá, el
             navegador cobraría siempre un centésimo antes. */
          oculto: { punto },
          publico: { arrancoEn: Date.now() },
        };
      },
    });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "games/crash/open");
  }
});

/**
 * COBRAR.
 *
 * El multiplicador lo decide el reloj DEL SERVIDOR: cuánto pasó desde
 * que se creó la ronda. Lo que manda el cliente (`en`) solo puede
 * bajarlo, nunca subirlo, así que un navegador tocado no puede cobrar
 * más de lo que le tocaba.
 */
router.post("/crash/cashout", autorizar(true), limite, async (req, res) => {
  try {
    const ronda = await juegos.rondaAbierta(req.user._id, "crash");

    const msDesde = Date.now() - new Date(ronda.createdAt).getTime();
    const r = crash.cobrar({
      apuestaSc: ronda.apuestaSc,
      punto: (ronda.oculto || {}).punto || 1,
      msDesde,
      pedido: req.body.en,
    });

    await juegos.cerrarRonda({
      userId: req.user._id,
      ronda,
      multiplicador: r.multiplicador,
      pagoSc: r.pagoSc,
      resultado: { punto: (ronda.oculto || {}).punto, reventado: r.reventado, en: r.en },
    });

    return res.json({
      success: true,
      data: {
        rondaId: ronda._id,
        punto: (ronda.oculto || {}).punto,
        reventado: r.reventado,
        multiplicador: r.multiplicador,
        pagoSc: r.pagoSc,
        ...(await wallet.saldoDe(req.user._id)),
      },
    });
  } catch (err) {
    return responderError(res, err, "games/crash/cashout");
  }
});

module.exports = router;
