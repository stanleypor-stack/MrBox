/**
 * LAS RONDAS COMPARTIDAS DE SLIDE Y CRASH.
 *
 * Todos los jugadores apuestan a la misma rueda y al mismo gráfico.
 * Es lo que dibuja el diseño --cuenta regresiva, historial de las
 * últimas, y en Crash las apuestas de los demás-- y es como funciona
 * en BetSweeps.
 *
 * SIN NINGUN RELOJ CORRIENDO
 *
 * La ronda no la mueve un temporizador: su estado es una cuenta de
 * fechas. Cuando alguien mira, se calcula en qué momento está; si ya
 * pasó su hora, se cierra, se pagan las apuestas y se crea la
 * siguiente, todo en ese mismo pedido.
 *
 * Un reloj de fondo que se cae una noche deja el juego trabado hasta
 * que alguien lo nota. Esto no se puede caer, porque no está
 * corriendo. Y si nadie mira, no pasa nada: tampoco hace falta.
 *
 * EL RESULTADO EXISTE ANTES QUE LAS APUESTAS
 *
 * Se sortea al CREAR la ronda y queda tapado. Así nadie --tampoco la
 * casa-- puede ver quién apostó a qué antes de decidir qué sale. El
 * hash de la semilla se publica apenas abre; la semilla en claro se
 * revela al terminar, y con las dos cualquiera rehace el resultado.
 */

const crypto = require("crypto");

const GameTanda = require("../../database/models/GameTanda");
const GameRound = require("../../database/models/GameRound");
const Settings = require("../../database/models/Settings");

const wallet = require("./../wallet");
const juegos = require("./index");
const cfgJuegos = require("./config");
const slide = require("./slide");
const crash = require("./crash");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

/*
  LOS TIEMPOS, LOS DEL DISEÑO.

  Slide: 13 segundos para apostar, que es lo que cuenta su reloj, y
  8,1 de giro: 5,6 que tarda la cinta en frenar más 2,5 para ver
  dónde paró antes de que se abra la que sigue.

  Crash: 6 para apostar. Lo que dura el vuelo depende de dónde
  reviente --la curva es e^(0,00006 t), así que llegar a 10x lleva
  38 segundos-- y a eso se le suman 3 para ver el número colorado.
*/
const TIEMPOS = {
  slide: { apostar: 13000, girar: 8100 },
  crash: { apostar: 6000, girar: 3000 },
};

/** El hash que se publica antes de que nadie apueste. */
function hashDe(semilla) {
  return crypto.createHash("sha256").update(String(semilla)).digest("hex");
}

/** El sorteo de una ronda, a partir de su semilla y su número. */
function sortear(juego, semilla, numero, cfg) {
  const hmac = crypto
    .createHmac("sha256", String(semilla))
    .update(`tanda:${juego}:${numero}`)
    .digest("hex");

  if (juego === "slide") {
    const n = parseInt(hmac.slice(0, 13), 16) / Math.pow(2, 52);
    const casilla = Math.min(slide.CASILLAS - 1, Math.floor(n * slide.CASILLAS));
    return { casilla, color: slide.colorDe(casilla), hmac };
  }

  /* Crash: la misma fórmula de BetSweeps, sobre el hmac de la ronda. */
  return { punto: crash.puntoDe(hmac, cfg), hmac };
}

/**
 * CUANTO DURA EL VUELO, Y CUANTO SE MUESTRA EL RESULTADO.
 *
 * Son dos tiempos y no uno porque en Crash el primero es secreto: lo
 * que dura el vuelo ES el punto de reventon, puesto en segundos. El
 * segundo --los tres segundos del numero colorado-- es igual siempre y
 * se puede contar a la vista de todos.
 *
 * En Slide los dos son fijos: la cinta tarda 5,6 y el resultado se
 * queda 2,5.
 */
function cuantoDura(juego, resultado) {
  if (juego === "slide") return { vuelo: 5600, muestra: 2500 };
  return {
    vuelo: Math.round(crash.cuandoLlegaA(resultado.punto)),
    muestra: TIEMPOS.crash.girar,
  };
}

/** Crea la ronda que sigue. */
async function crearTanda(juego, numero, cfg) {
  const semilla = crypto.randomBytes(32).toString("hex");
  const resultado = sortear(juego, semilla, numero, cfg);

  const ahora = Date.now();
  const abiertaHasta = new Date(ahora + TIEMPOS[juego].apostar);
  const dura = cuantoDura(juego, resultado);
  const vuelaHasta = new Date(abiertaHasta.getTime() + dura.vuelo);
  const giraHasta = new Date(vuelaHasta.getTime() + dura.muestra);

  try {
    return await GameTanda.create({
      juego,
      numero,
      semilla,
      semillaHash: hashDe(semilla),
      resultado,
      abiertaHasta,
      vuelaHasta,
      giraHasta,
    });
  } catch (err) {
    /*
      11000 es "ese numero ya existe": otro pedido creó la misma ronda
      en el mismo milisegundo. No es un error, es la carrera que el
      índice único está para ganar. Se usa la que quedó.
    */
    if (err && err.code === 11000) {
      return GameTanda.findOne({ juego, numero }).select("+semilla +resultado");
    }
    throw err;
  }
}

/**
 * PAGA LAS APUESTAS DE UNA RONDA QUE TERMINO.
 *
 * `pagada: false` va en el filtro del update, así que el primero que
 * llega se lleva la bandera y los demás no pagan nada. Dos jugadores
 * mirando la pantalla en el mismo instante no pueden pagar dos veces.
 */
async function pagarTanda(tanda, cfg) {
  const tomada = await GameTanda.findOneAndUpdate(
    { _id: tanda._id, pagada: false },
    { $set: { pagada: true, resultadoVisible: tanda.resultado } },
    { returnDocument: "after" },
  ).lean();

  if (!tomada) return;

  const apuestas = await GameRound.find({
    juego: tanda.juego,
    "jugada.tanda": String(tanda._id),
    abierta: true,
  }).lean();

  for (const a of apuestas) {
    try {
      let mult = 0;

      if (tanda.juego === "slide") {
        const pagos = slide.pagos(cfg);
        mult = a.jugada.color === tanda.resultado.color ? pagos[tanda.resultado.color] : 0;
      } else {
        /*
          Crash: solo cobra el que puso cobro automático por debajo
          del punto. El que cobró a mano ya cerró su propia fila
          antes, así que acá no aparece.
        */
        const auto = Number(a.jugada.autoCobrarEn) || 0;
        mult = auto > 1 && auto <= tanda.resultado.punto ? auto : 0;
      }

      const bruto = mult > 0 ? sc(a.apuestaSc * mult) : 0;
      const acotado = cfgJuegos.acotarPago(a.apuestaSc, bruto, cfg);

      await GameRound.updateOne(
        { _id: a._id, abierta: true },
        {
          $set: {
            abierta: false,
            cerradaEl: new Date(),
            multiplicador: acotado.recortado ? acotado.multiplicador : mult,
            pagoSc: acotado.pagoSc,
            resultado: tanda.resultado,
          },
        },
      );

      if (acotado.pagoSc > 0) {
        await wallet.mover({
          userId: a.user,
          amountSc: acotado.pagoSc,
          type: "game_win",
          reference: { kind: "game", id: a._id, label: tanda.juego },
        });
      }

      /* Y la comision del socio, igual que en los otros seis. */
      await juegos.comisionDelSocio({
        userId: a.user,
        juego: tanda.juego,
        apuestaSc: a.apuestaSc,
        pagoSc: acotado.pagoSc,
      });
    } catch (err) {
      /* Una apuesta que falla no puede dejar sin pagar a las demás. */
      logger.error(`[games] pagando ${tanda.juego}: ${err.message}`);
    }
  }
}

/**
 * LA RONDA DE AHORA, YA PUESTA AL DIA.
 *
 * Si la que había ya terminó, se paga y se crea la siguiente. Es el
 * único lugar por el que se mueven las rondas.
 */
async function tandaActual(juego) {
  const cfg = await Settings.leer();

  let tanda = await GameTanda.findOne({ juego })
    .sort({ numero: -1 })
    .select("+semilla +resultado");

  if (!tanda) return crearTanda(juego, 1, cfg);

  /* Mientras no haya terminado de girar, es la de ahora. */
  if (Date.now() < new Date(tanda.giraHasta).getTime()) return tanda;

  /* Termino: se paga y se abre la que sigue. */
  await pagarTanda(tanda, cfg);
  return crearTanda(juego, tanda.numero + 1, cfg);
}

/**
 * EN QUE MOMENTO ESTA UNA RONDA.
 *
 *   apostando  se puede apostar
 *   girando    la cinta gira / el avion vuela; en Crash se puede cobrar
 *   mostrando  ya salio, se ve el resultado, no se puede nada
 *   terminada  paso su hora: el proximo que mire la paga y abre otra
 */
function estadoDe(tanda) {
  const ahora = Date.now();
  if (ahora < new Date(tanda.abiertaHasta).getTime()) return "apostando";
  /* `vuelaHasta` puede faltar en una ronda vieja: se toma el final. */
  const vuela = tanda.vuelaHasta ? new Date(tanda.vuelaHasta).getTime() : null;
  if (vuela && ahora < vuela) return "girando";
  if (ahora < new Date(tanda.giraHasta).getTime()) return vuela ? "mostrando" : "girando";
  return "terminada";
}

/** Las últimas que ya se jugaron, para el historial de la pantalla. */
async function historial(juego, cuantas = 20) {
  return GameTanda.find({ juego, pagada: true, resultadoVisible: { $ne: null } })
    .sort({ numero: -1 })
    .limit(cuantas)
    .select("numero resultadoVisible semillaHash createdAt")
    .lean();
}

/**
 * CUANTAS VECES SALIO CADA COLOR EN LAS ULTIMAS CIEN.
 *
 * Es el "LAST 100" del diseño. Se cuenta acá y no en la pantalla
 * porque la pantalla solo tiene a la vista las últimas pocas: contar
 * sobre lo que le llegó daría un número distinto al del cartel.
 */
async function estadisticas(juego, cuantas = 100) {
  const ultimas = await GameTanda.find({
    juego, pagada: true, resultadoVisible: { $ne: null },
  })
    .sort({ numero: -1 })
    .limit(cuantas)
    .select("resultadoVisible")
    .lean();

  const cuenta = { red: 0, purple: 0, yellow: 0 };
  for (const t of ultimas) {
    const c = (t.resultadoVisible || {}).color;
    if (cuenta[c] !== undefined) cuenta[c] += 1;
  }
  return cuenta;
}

module.exports = {
  TIEMPOS,
  estadisticas,
  hashDe,
  sortear,
  crearTanda,
  pagarTanda,
  tandaActual,
  estadoDe,
  historial,
};
