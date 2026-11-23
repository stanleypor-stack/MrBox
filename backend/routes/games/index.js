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
const rondas = require("../../services/games/rondas");
const controles = require("../../services/controls");
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

/**
 * LA TABLA DE PLINKO, PARA DIBUJARLA.
 *
 * Son 27 listas de numeros y la pantalla necesita la del riesgo y
 * las filas que el jugador elija, antes de tirar. Viene del servidor
 * y no escrita en el navegador porque es la MISMA que paga: si el
 * margen cambia desde el panel, los numeritos del tablero cambian
 * con el.
 */
router.get("/plinko/pagos", autorizar(false), async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const pagos = {};
    for (const riesgo of plinko.RIESGOS) {
      pagos[riesgo] = {};
      for (let f = plinko.FILAS_MINIMO; f <= plinko.FILAS_MAXIMO; f += 1) {
        pagos[riesgo][f] = plinko.tabla(riesgo, f, cfg);
      }
    }
    return res.json({ success: true, data: { pagos } });
  } catch (err) {
    return responderError(res, err, "games/plinko/pagos");
  }
});

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

/* ── Slide y Crash: rondas compartidas ────────────────── */

/**
 * LO QUE VE LA PANTALLA DE UNA RONDA.
 *
 * Mientras se apuesta y mientras gira, el resultado NO sale de aca:
 * lo unico que viaja es el hash de la semilla, que es la promesa de
 * que el resultado ya estaba decidido. Recien cuando la ronda
 * termina se revela, y entonces cualquiera puede rehacerlo.
 */
async function tandaALaVista(juego, userId) {
  const tanda = await rondas.tandaActual(juego);
  const estado = rondas.estadoDe(tanda);
  const ahora = Date.now();

  const base = {
    numero: tanda.numero,
    estado,
    semillaHash: tanda.semillaHash,
    historial: await rondas.historial(juego, 20),
  };

  const arranco = new Date(tanda.abiertaHasta).getTime();
  const vuela = tanda.vuelaHasta ? new Date(tanda.vuelaHasta).getTime() : arranco;
  const termina = new Date(tanda.giraHasta).getTime();

  /*
    LO QUE SE CUENTA EN CADA MOMENTO, Y LO QUE NO.

    Mientras se apuesta: cuanto falta para que arranque, y nada mas.

    Mientras gira: cuanto hace que arranco, para que la animacion
    sepa donde esta parada el que entra a mitad de la vuelta.

      - Slide manda tambien EN QUE CASILLA frena. Tiene que mandarlo:
        la cinta va hasta ahi. Y no le hace mal a nadie, porque a esa
        altura ya no se puede apostar ni cobrar: no queda ninguna
        decision por tomar.

      - Crash NO manda el punto de reventon ni cuanto falta para el
        final. Ahi SI queda una decision --cuando cobrar-- y saber
        donde revienta la convierte en ninguna: se cobra un
        milisegundo antes y el juego deja de tener margen. Por eso
        tampoco va `faltaMs`: el final del vuelo ES el punto de
        reventon, puesto en segundos, y una resta lo despeja.

    Cuando ya salio: el resultado y cuanto queda para la proxima.
  */
  if (estado === "apostando") {
    base.faltaMs = Math.max(0, arranco - ahora);
  } else if (estado === "girando") {
    base.transcurridoMs = Math.max(0, ahora - arranco);
    if (juego === "slide") {
      base.resultado = tanda.resultado;
      base.faltaMs = Math.max(0, vuela - ahora);
    }
  } else {
    base.resultado = tanda.resultado;
    base.faltaMs = Math.max(0, termina - ahora);
  }

  /* El cartel de "LAST 100", que solo tiene Slide. */
  if (juego === "slide") base.estadisticas = await rondas.estadisticas(juego, 100);

  /* Las apuestas de la ronda: los dos juegos las muestran. Las mas
     nuevas primero, que es como las dibuja el diseno. */
  const apuestas = await GameRound.find({ juego, "jugada.tanda": String(tanda._id) })
    .select("user apuestaSc jugada multiplicador pagoSc abierta createdAt")
    .populate("user", "username")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  base.apuestas = apuestas.map((a) => ({
    jugador: a.user && a.user.username ? a.user.username : "",
    apuestaSc: a.apuestaSc,
    color: a.jugada.color,
    autoCobrarEn: a.jugada.autoCobrarEn || null,
    multiplicador: a.multiplicador,
    pagoSc: a.pagoSc,
    abierta: a.abierta,
  }));

  if (userId) {
    const mia = apuestas.find((a) => String(a.user && a.user._id) === String(userId));
    base.miApuesta = mia
      ? {
        apuestaSc: mia.apuestaSc,
        color: mia.jugada.color,
        autoCobrarEn: mia.jugada.autoCobrarEn || null,
        abierta: mia.abierta,
        multiplicador: mia.multiplicador,
        pagoSc: mia.pagoSc,
      }
      : null;
  }

  return { tanda, datos: base };
}

/**
 * APUESTA A LA RONDA DE AHORA.
 *
 * Solo mientras esta abierta.
 *
 * UNA POR JUGADOR Y POR RONDA, EN LOS DOS
 *
 * Es la regla de BetSweeps, con esas palabras: "you can only bet one
 * time per round" en Crash y "you can only bet once per game" en
 * Slide. La segunda tiene que rebotar y no cobrar nada.
 *
 * El prototipo deja apretar los tres colores de la misma vuelta
 * porque es un prototipo y su plata es de mentira. La regla de la
 * casa es la de BetSweeps.
 */
async function apostarEnTanda({ req, juego, revisar }) {
  const cfg = await Settings.leer();
  if ((cfg.juegos || {}).apagados) throw errorDe("GAMES_OFF", {}, 403);

  const { tanda } = await tandaALaVista(juego, req.user._id);
  if (rondas.estadoDe(tanda) !== "apostando") {
    throw errorDe("ROUND_CLOSED", { juego }, 409);
  }

  const monto = await juegos.revisarApuesta(req.body.apuestaSc, cfg);
  const jugada = revisar();

  await juegos.revisarTopePorBono(req.user._id, monto, cfg);
  await controles.revisarAntesDeJugar({ userId: req.user._id, montoSc: monto });

  /*
    SE MIRA ANTES DE COBRAR.

    El indice unico alcanza para que no queden dos abiertas, pero si
    se cobra primero y el indice rebota despues, la apuesta quedo
    descontada por una ronda que no existe.
  */
  const yaTiene = await GameRound.findOne({
    user: req.user._id, juego, abierta: true,
  }).lean();
  if (yaTiene) throw errorDe("ROUND_OPEN", { juego }, 409);

  await wallet.mover({
    userId: req.user._id,
    amountSc: -monto,
    type: "game_bet",
    juegaSc: monto,
    reference: { kind: "game", label: juego },
  });

  try {
    await GameRound.create({
      user: req.user._id,
      juego,
      apuestaSc: monto,
      jugada: { ...jugada, tanda: String(tanda._id) },
      semillaServidorHash: tanda.semillaHash,
      nonce: tanda.numero,
      abierta: true,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      await wallet.mover({
        userId: req.user._id, amountSc: monto, type: "game_win",
        reason: "devolucion: ya habia apostado en esa ronda",
        reference: { kind: "game", label: juego },
      }).catch(() => {});
      throw errorDe("ROUND_OPEN", { juego }, 409);
    }
    throw err;
  }

  const { datos } = await tandaALaVista(juego, req.user._id);
  return { ...datos, ...(await wallet.saldoDe(req.user._id)) };
}

for (const juego of ["slide", "crash"]) {
  router.get(`/${juego}/estado`, autorizar(false), async (req, res) => {
    try {
      const { datos } = await tandaALaVista(juego, req.user ? req.user._id : null);
      return res.json({ success: true, data: datos });
    } catch (err) {
      return responderError(res, err, `games/${juego}/estado`);
    }
  });

  router.post(`/${juego}/bet`, autorizar(true), limite, async (req, res) => {
    try {
      const datos = await apostarEnTanda({
        req,
        juego,
        revisar: () => (juego === "slide"
          ? { color: slide.revisar(req.body.color) }
          : (() => {
            const auto = Number(req.body.autoCobrarEn);
            if (req.body.autoCobrarEn !== undefined && (!Number.isFinite(auto) || auto <= 1)) {
              throw errorDe("INVALID_AMOUNT", { campo: "autoCobrarEn" });
            }
            return { autoCobrarEn: Number.isFinite(auto) && auto > 1 ? auto : null };
          })()),
      });
      return res.json({ success: true, data: datos });
    } catch (err) {
      return responderError(res, err, `games/${juego}/bet`);
    }
  });
}

/**
 * COBRAR EN CRASH, A MANO Y EN VIVO.
 *
 * El multiplicador lo decide el reloj DEL SERVIDOR: cuanto paso desde
 * que la ronda empezo a girar. Si eso ya paso el punto de reventon,
 * no se paga. Lo que diga el navegador no entra en la cuenta.
 */
router.post("/crash/cashout", autorizar(true), limite, async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const tanda = await rondas.tandaActual("crash");

    if (rondas.estadoDe(tanda) !== "girando") {
      throw errorDe("ROUND_CLOSED", { juego: "crash" }, 409);
    }

    const mia = await GameRound.findOne({
      user: req.user._id, juego: "crash", "jugada.tanda": String(tanda._id), abierta: true,
    }).lean();
    if (!mia) throw errorDe("NO_ROUND", { juego: "crash" }, 404);

    const msDesde = Date.now() - new Date(tanda.abiertaHasta).getTime();
    const r = crash.cobrar({
      apuestaSc: mia.apuestaSc,
      punto: tanda.resultado.punto,
      msDesde,
      pedido: req.body.en,
    });

    const acotado = cfgJuegos.acotarPago(mia.apuestaSc, r.pagoSc, cfg);

    /* `abierta: true` en el filtro: dos clicks pagan una sola vez. */
    const cerrada = await GameRound.findOneAndUpdate(
      { _id: mia._id, abierta: true },
      {
        $set: {
          abierta: false,
          cerradaEl: new Date(),
          multiplicador: acotado.recortado ? acotado.multiplicador : r.multiplicador,
          pagoSc: acotado.pagoSc,
          resultado: { en: r.en, reventado: r.reventado },
        },
      },
      { returnDocument: "after" },
    ).lean();

    if (!cerrada) throw errorDe("NO_ROUND", { juego: "crash" }, 409);

    if (acotado.pagoSc > 0) {
      await wallet.mover({
        userId: req.user._id,
        amountSc: acotado.pagoSc,
        type: "game_win",
        reference: { kind: "game", id: mia._id, label: "crash" },
      });
    }

    /*
      LA COMISION DEL SOCIO.

      Este cobro cierra la fila a mano, sin pasar por `cerrarRonda`,
      asi que la comision hay que anotarla aca: si no, el unico juego
      que no le paga al socio seria justamente el que se cobra a mano.
    */
    await juegos.comisionDelSocio({
      userId: req.user._id,
      juego: "crash",
      apuestaSc: mia.apuestaSc,
      pagoSc: acotado.pagoSc,
    });

    return res.json({
      success: true,
      data: {
        reventado: r.reventado,
        multiplicador: cerrada.multiplicador,
        pagoSc: cerrada.pagoSc,
        ...(await wallet.saldoDe(req.user._id)),
      },
    });
  } catch (err) {
    return responderError(res, err, "games/crash/cashout");
  }
});

module.exports = router;
