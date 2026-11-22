/**
 * KENO.
 *
 * Un tablero de 40 números. El jugador elige de 1 a 10 y la casa saca
 * 10 al azar. Cuantos más coincidan, más paga.
 *
 * LA TABLA ES LA DE BETSWEEPS, NUMERO POR NUMERO
 *
 * Son los pagos JUSTOS, antes del margen: abajo se multiplican todos
 * por (100 - margen) / 100. Con el margen en 6 eso da el 94% que dice
 * la pantalla.
 *
 * La tabla está escrita y no calculada a propósito. Los pagos de Keno
 * no salen de una fórmula limpia --están redondeados a mano para que
 * los números queden lindos-- así que copiarlos es lo correcto;
 * recalcularlos daría otros, y otros pagos es otro juego.
 *
 * El índice es la cantidad de aciertos: `PAGOS[3][2]` es "elegí 3,
 * acerté 2". Los ceros del principio son los casos que no pagan, y
 * están escritos para que la posición coincida con los aciertos sin
 * tener que restar nada.
 */

const cfgJuegos = require("./config");
const fair = require("./fair");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

/** Cuántas casillas tiene el tablero. */
const CASILLAS = 40;

/** Cuántas saca la casa. */
const BOLILLAS = 10;

/** Cuántas puede elegir el jugador. */
const MINIMO_ELEGIDAS = 1;
const MAXIMO_ELEGIDAS = 10;

const PAGOS_JUSTOS = {
  1: [0.405, 2.784],
  2: [0, 1.825, 5.172],
  3: [0, 0, 2.835, 50.63],
  4: [0, 0, 1.74, 10.23, 102.35],
  5: [0, 0, 1.41, 4.05, 14.18, 395.12],
  6: [0, 0, 0, 3.04, 9.13, 182.71, 720.7],
  7: [0, 0, 0, 2.02, 7.08, 30.34, 404.64, 809.29],
  8: [0, 0, 0, 2.02, 4.04, 11.13, 67.81, 404.85, 910.92],
  9: [0, 0, 0, 2.02, 2.52, 5.05, 15.17, 101.19, 505.98, 1011.96],
  10: [0, 0, 0, 1.61, 2.02, 4.04, 7.07, 26.28, 101.08, 505.42, 1010.84],
};

/** La tabla de un jugador que eligió `cuantas`, ya con el margen. */
function tabla(cuantas, cfg) {
  const justos = PAGOS_JUSTOS[cuantas];
  if (!justos) throw errorDe("INVALID_AMOUNT", { campo: "elegidas" });
  const f = cfgJuegos.factor("keno", cfg);
  return justos.map((x) => Math.round(x * f * 10000) / 10000);
}

/** Lo que paga acertar `aciertos` habiendo elegido `cuantas`. */
function multiplicador(cuantas, aciertos, cfg) {
  return tabla(cuantas, cfg)[aciertos] || 0;
}

/**
 * REVISA LAS ELEGIDAS.
 *
 * Todo lo que llega por la red: que sean números del tablero, que no
 * se repitan --elegir el 7 diez veces daría diez aciertos con una
 * sola bolilla-- y que la cantidad esté en rango.
 */
function revisar(elegidas) {
  if (!Array.isArray(elegidas)) throw errorDe("INVALID_AMOUNT", { campo: "elegidas" });

  const limpias = [...new Set(
    elegidas.map((n) => Math.floor(Number(n))).filter((n) => Number.isFinite(n) && n >= 1 && n <= CASILLAS)
  )];

  if (limpias.length !== elegidas.length) {
    throw errorDe("INVALID_AMOUNT", { campo: "elegidas" });
  }
  if (limpias.length < MINIMO_ELEGIDAS || limpias.length > MAXIMO_ELEGIDAS) {
    throw errorDe("INVALID_AMOUNT", {
      campo: "elegidas", minimo: MINIMO_ELEGIDAS, maximo: MAXIMO_ELEGIDAS,
    });
  }

  return limpias.sort((a, b) => a - b);
}

/**
 * JUEGA UNA RONDA.
 *
 * Se baraja el tablero entero y se toman las diez primeras. Barajar y
 * cortar es lo que garantiza que no salga dos veces la misma bolilla;
 * sacar diez números sueltos al azar sí podría repetir.
 */
function jugar({ apuestaSc, elegidas, semillas, cfg }) {
  const mias = revisar(elegidas);

  const { mazo, hmacs } = fair.barajar(CASILLAS, semillas);
  const salieron = mazo.slice(0, BOLILLAS).map((n) => n + 1);

  const aciertos = mias.filter((n) => salieron.includes(n)).length;
  const mult = multiplicador(mias.length, aciertos, cfg);

  return {
    salieron,
    elegidas: mias,
    aciertos,
    gano: mult > 0,
    multiplicador: mult,
    pagoSc: mult > 0 ? sc(apuestaSc * mult) : 0,
    hmacs,
    jugada: { elegidas: mias },
    resultado: { salieron, aciertos, gano: mult > 0 },
  };
}

module.exports = {
  CASILLAS,
  BOLILLAS,
  MINIMO_ELEGIDAS,
  MAXIMO_ELEGIDAS,
  PAGOS_JUSTOS,
  tabla,
  multiplicador,
  revisar,
  jugar,
};
