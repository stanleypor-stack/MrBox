/**
 * SLIDE.
 *
 * Una rueda de 15 casillas y tres colores. El jugador elige uno y el
 * indicador decide.
 *
 *   amarillo   paga 14x   1 de 15
 *   rojo       paga  2x   7 de 15
 *   violeta    paga  2x   7 de 15
 *
 * Los tres pagan lo mismo en el largo plazo: 14/15, o sea 93,333% de
 * retorno y 6,667 de margen. El amarillo no es "mejor": es la misma
 * cuenta repartida distinto, mucho menos seguido y mucho más grande.
 *
 * EL MARGEN SALE DE LAS REGLAS, NO DE UN PARAMETRO
 *
 * Igual que en Reme: 14/15 es lo que dan la rueda y la tabla de
 * pagos. Por eso, cuando el margen se mueve desde las perillas, lo
 * que se escala son los pagos y no la rueda. Con el de fábrica la
 * escala es exactamente 1 y quedan 14x y 2x clavados.
 *
 * LA RUEDA ES COMPARTIDA
 *
 * Una sola para todos, que gira cada trece segundos. El sorteo, los
 * tiempos y el pago de cada ronda están en `rondas.js`; acá viven la
 * rueda y la tabla, que es lo que no depende de la ronda.
 */

const cfgJuegos = require("./config");
const { errorDe } = require("../../utils/errors");

/*
  EL ORDEN DE LA RUEDA, EL DEL DISEÑO.

  No es "el 0 es amarillo y después alterna": el amarillo está en el
  medio, en la casilla 7, y a los costados se van alternando rojo y
  violeta. La cuenta es la misma --1, 7 y 7-- pero el lugar importa,
  porque la cinta que gira en la pantalla se dibuja con este orden y
  frena en la casilla que dice el servidor. Si acá dijera otra cosa,
  la rueda pararía en un color y el resultado diría otro.
*/
const RUEDA = [
  "red", "purple", "red", "purple", "red", "purple", "red",
  "yellow",
  "purple", "red", "purple", "red", "purple", "red", "purple",
];

const CASILLAS = RUEDA.length;
const COLORES = ["yellow", "red", "purple"];

/** Los pagos, ya con el margen de las perillas. */
function pagos(cfg) {
  const escala = cfgJuegos.escala("slide", cfg);
  const redondo = (x) => Math.round(x * escala * 10000) / 10000;
  return { yellow: redondo(14), red: redondo(2), purple: redondo(2) };
}

/** De qué color es una casilla. */
function colorDe(casilla) {
  return RUEDA[casilla] || "red";
}

function revisar(color) {
  const c = String(color || "").toLowerCase();
  if (!COLORES.includes(c)) throw errorDe("INVALID_AMOUNT", { campo: "color" });
  return c;
}

module.exports = { RUEDA, CASILLAS, COLORES, pagos, colorDe, revisar };
