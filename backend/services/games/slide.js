/**
 * SLIDE.
 *
 * Una rueda de 15 casillas y tres colores. El jugador elige uno y el
 * indicador decide.
 *
 *   0                     amarillo   paga 14x   1 de 15
 *   pares (2,4,...,14)    rojo       paga  2x   7 de 15
 *   impares (1,3,...,13)  violeta    paga  2x   7 de 15
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
 * UNA RUEDA POR JUGADA, NO UNA COMPARTIDA
 *
 * En BetSweeps, Slide es una ronda común: todos apuestan a la misma
 * rueda y se gira cada tantos segundos. Acá el diseño lo dibuja como
 * los otros siete --con Manual, Auto y su botón de jugar-- así que
 * cada jugada es la suya. La matemática es la misma; lo que cambia es
 * de quién es la rueda.
 */

const cfgJuegos = require("./config");
const fair = require("./fair");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

const CASILLAS = 15;
const COLORES = ["yellow", "red", "purple"];

/** Los pagos, ya con el margen de las perillas. */
function pagos(cfg) {
  const escala = cfgJuegos.escala("slide", cfg);
  const redondo = (x) => Math.round(x * escala * 10000) / 10000;
  return { yellow: redondo(14), red: redondo(2), purple: redondo(2) };
}

/** De qué color es una casilla. */
function colorDe(casilla) {
  if (casilla === 0) return "yellow";
  return casilla % 2 === 0 ? "red" : "purple";
}

function revisar(color) {
  const c = String(color || "").toLowerCase();
  if (!COLORES.includes(c)) throw errorDe("INVALID_AMOUNT", { campo: "color" });
  return c;
}

function jugar({ apuestaSc, color, semillas, cfg }) {
  const elegido = revisar(color);

  const { numeros, hmacs } = fair.numeros(1, semillas);
  const casilla = fair.entero(numeros[0], CASILLAS);
  const salio = colorDe(casilla);

  const mult = salio === elegido ? pagos(cfg)[salio] : 0;

  return {
    casilla,
    color: salio,
    gano: mult > 0,
    multiplicador: mult,
    pagoSc: mult > 0 ? sc(apuestaSc * mult) : 0,
    hmacs,
    jugada: { color: elegido },
    resultado: { casilla, color: salio, gano: mult > 0 },
  };
}

module.exports = { CASILLAS, COLORES, pagos, colorDe, revisar, jugar };
