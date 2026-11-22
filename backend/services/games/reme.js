/**
 * REME.
 *
 * Dos ruedas de 0 a 36, una del jugador y una de la casa. Cada número
 * se reduce a LA SUMA DE SUS DIGITOS, y de eso se mira el último:
 * un 17 es 1 + 7 = 8; un 29 es 11, y de 11 vale el 1.
 *
 *   la casa saca 0     pierde el jugador
 *   el jugador saca 0  paga 3x
 *   la casa empata o gana   pierde el jugador
 *   el jugador gana    paga 2x
 *
 * El empate pierde. Es la regla que le da el margen a la casa, y es
 * la misma de BetSweeps.
 *
 * DE DONDE SALE EL 97,3%
 *
 * De contar los 37x37 casos: 1332 de 1369 en plata devuelta, o sea
 * 97,2973% de retorno y 2,7027 de margen. No es un número elegido: es
 * el que sale de las reglas. Por eso, cuando el margen se mueve desde
 * las perillas, lo que se escala son los pagos --el 2x y el 3x-- y no
 * las reglas: `escala()` vale exactamente 1 con el margen de fábrica,
 * así que de fábrica los multiplicadores quedan en 2 y 3 clavados.
 *
 * La prueba recorre los 1369 casos y falla si el retorno se corre.
 */

const cfgJuegos = require("./config");
const fair = require("./fair");
const { sc } = require("../../utils/money");

/* La rueda tiene 37 casillas, como una ruleta europea. */
const CASILLAS = 37;

/** La suma de los dígitos, y de eso el último. */
function reducir(numero) {
  if (numero < 0 || numero > 36) throw new Error("ese número no sale de la rueda");

  let suma = 0;
  let n = numero;
  while (n > 0) {
    suma += n % 10;
    n = Math.floor(n / 10);
  }
  return suma % 10;
}

/** Los dos multiplicadores, ya con el margen de las perillas adentro. */
function multiplicadores(cfg) {
  const escala = cfgJuegos.escala("reme", cfg);
  /* Cuatro decimales: más que eso es ruido de coma flotante. */
  const redondo = (x) => Math.round(x * escala * 10000) / 10000;
  return { cero: redondo(3), gana: redondo(2) };
}

/**
 * El multiplicador de una mano.
 *
 * @param {number} jugador  lo que sacó, de 0 a 36
 * @param {number} casa     lo que sacó la casa
 */
function multiplicador(jugador, casa, cfg) {
  const j = reducir(jugador);
  const c = reducir(casa);
  const m = multiplicadores(cfg);

  /* El cero de la casa manda sobre todo lo demás, incluso sobre el
     cero del jugador: es el orden que tiene BetSweeps. */
  if (c === 0) return 0;
  if (j === 0) return m.cero;
  if (c >= j) return 0;
  return m.gana;
}

/**
 * JUEGA UNA MANO.
 *
 * El primer número es el del jugador y el segundo el de la casa, en
 * ese orden: el orden importa porque es el que se puede volver a
 * sacar de las semillas para verificar.
 */
function jugar({ apuestaSc, semillas, cfg }) {
  const { numeros, hmacs } = fair.numeros(2, semillas);

  const jugador = fair.entero(numeros[0], CASILLAS);
  const casa = fair.entero(numeros[1], CASILLAS);
  const mult = multiplicador(jugador, casa, cfg);

  return {
    jugador,
    casa,
    jugadorReducido: reducir(jugador),
    casaReducido: reducir(casa),
    gano: mult > 0,
    multiplicador: mult,
    pagoSc: mult > 0 ? sc(apuestaSc * mult) : 0,
    hmacs,
    jugada: {},
    resultado: {
      jugador,
      casa,
      jugadorReducido: reducir(jugador),
      casaReducido: reducir(casa),
      gano: mult > 0,
    },
  };
}

module.exports = {
  CASILLAS,
  reducir,
  multiplicadores,
  multiplicador,
  jugar,
};
