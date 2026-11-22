/**
 * DICE.
 *
 * Sale un número de 0 a 99 y el jugador apuesta a dónde va a caer.
 * Cuatro formas de apostar, las mismas que BetSweeps:
 *
 *   over      sale MAS que el objetivo        chance = 99 - objetivo
 *   under     sale MENOS que el objetivo      chance = objetivo
 *   between   sale entre los dos, sin tocar   chance = hasta - desde - 1
 *   outside   sale afuera de los dos          chance = 99 - (hasta - desde)
 *
 * EL PAGO
 *
 *     multiplicador = (100 - margen) / chance
 *
 * Con el margen en 6 eso da 94% de retorno, que es lo que dice la
 * pantalla. La cuenta está acá y en ningún otro lado: el multiplicador
 * que ve el jugador y el que se paga salen de la misma función, así
 * que no pueden separarse.
 *
 * POR QUE LAS CHANCES SON SOBRE 100 PERO SE RESTA 1
 *
 * `over 50` gana con 51..99, que son 49 números de 100: la chance es
 * 49%, no 50%. Ese número de menos es parte de la regla del juego
 * --como el cero de una ruleta-- y ya está contado en el margen de
 * BetSweeps, así que se porta igual.
 */

const cfgJuegos = require("./config");
const fair = require("./fair");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

const MODOS = ["over", "under", "between", "outside"];

/* El objetivo se mueve entre estos dos. Afuera no hay juego posible:
   `under 0` no gana nunca y `over 99` tampoco. */
const MINIMO = 1;
const MAXIMO = 98;

/** Cuántos de los 100 números hacen ganar. */
function cuantosGanan(modo, desde, hasta) {
  switch (modo) {
    case "over": return 99 - desde;
    case "under": return desde;
    case "between": return hasta - desde - 1;
    case "outside": return 99 - (hasta - desde);
    default: throw errorDe("INVALID_AMOUNT", { campo: "modo" });
  }
}

/** Si el número que salió paga. */
function gano(numero, modo, desde, hasta) {
  switch (modo) {
    case "over": return numero > desde;
    case "under": return numero < desde;
    case "between": return numero > desde && numero < hasta;
    case "outside": return numero < desde || numero > hasta;
    default: throw errorDe("INVALID_AMOUNT", { campo: "modo" });
  }
}

/** El multiplicador de una apuesta, ya con el margen adentro. */
function multiplicador(modo, desde, hasta, cfg) {
  const chance = cuantosGanan(modo, desde, hasta);
  if (chance <= 0) throw errorDe("INVALID_AMOUNT", { campo: "objetivo" });
  return (100 - cfgJuegos.margen("dice", cfg)) / chance;
}

/**
 * REVISA LA APUESTA ANTES DE COBRAR NADA.
 *
 * Devuelve los valores ya limpios. Todo lo que entra por la red se
 * mira acá: el cliente puede mandar cualquier cosa, incluido un
 * `between` dado vuelta que haría una chance negativa y un
 * multiplicador que pagaría de más.
 */
function revisar({ modo, desde, hasta }) {
  if (!MODOS.includes(modo)) throw errorDe("INVALID_AMOUNT", { campo: "modo" });

  const d = Math.floor(Number(desde));
  if (!Number.isFinite(d) || d < MINIMO || d > MAXIMO) {
    throw errorDe("INVALID_AMOUNT", { campo: "desde", minimo: MINIMO, maximo: MAXIMO });
  }

  let h = null;
  if (modo === "between" || modo === "outside") {
    h = Math.floor(Number(hasta));
    if (!Number.isFinite(h) || h <= d || h > 99) {
      throw errorDe("INVALID_AMOUNT", { campo: "hasta" });
    }
    /* `between 50 51` no deja ningún número adentro: no es una
       apuesta, es una forma de pedir un multiplicador infinito. */
    if (cuantosGanan(modo, d, h) <= 0) {
      throw errorDe("INVALID_AMOUNT", { campo: "hasta" });
    }
  }

  return { modo, desde: d, hasta: h };
}

/**
 * JUEGA UNA RONDA.
 *
 * No toca la base ni el saldo: recibe las semillas y devuelve qué
 * pasó. De mover la plata se encarga `services/games/index.js`, que es
 * el mismo para los ocho juegos.
 *
 * @returns {{ numero, gano, multiplicador, pagoSc, hmacs, chance }}
 */
function jugar({ apuestaSc, modo, desde, hasta, semillas, cfg }) {
  const limpio = revisar({ modo, desde, hasta });

  const { numeros, hmacs } = fair.numeros(1, semillas);
  const numero = fair.entero(numeros[0], 100);

  const mult = multiplicador(limpio.modo, limpio.desde, limpio.hasta, cfg);
  const acerto = gano(numero, limpio.modo, limpio.desde, limpio.hasta);

  return {
    numero,
    gano: acerto,
    multiplicador: Math.round(mult * 10000) / 10000,
    pagoSc: acerto ? sc(apuestaSc * mult) : 0,
    chance: cuantosGanan(limpio.modo, limpio.desde, limpio.hasta),
    hmacs,
    jugada: limpio,
  };
}

module.exports = {
  MODOS,
  MINIMO,
  MAXIMO,
  cuantosGanan,
  gano,
  multiplicador,
  revisar,
  jugar,
};
