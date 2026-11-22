/**
 * PLINKO.
 *
 * Se suelta una bola arriba y rebota fila por fila. En cada rebote va
 * para un lado o para el otro con la misma chance, y donde cae decide
 * el multiplicador: los bordes pagan mucho, el centro poco.
 *
 * De 8 a 16 filas y tres riesgos. Mas filas y mas riesgo = bordes mas
 * jugosos y centro mas pobre.
 *
 * LA TABLA ES LA DE BETSWEEPS, COPIADA POR PROGRAMA
 *
 * Son 27 listas de numeros: 3 riesgos por 9 cantidades de filas.
 * Copiarlas a mano es pedirle a alguien que no se equivoque 300
 * veces, asi que este archivo se GENERO leyendo la tabla de
 * BetSweeps. Los numeros de abajo estan calculados para un margen del
 * 1%, que es como estan alla: `tabla()` los reescala al margen que
 * tengan puestas las perillas.
 *
 * Con el margen en 6 el retorno da 94% en las 27 combinaciones, y hay
 * una prueba que las recorre todas.
 *
 * POR QUE EL CAMINO Y NO SOLO LA CASILLA
 *
 * El sorteo da un lado por fila --16 numeros como mucho-- y la
 * casilla sale de contar cuantas veces fue a la derecha. Se devuelve
 * el camino entero porque es lo que dibuja la pantalla y lo que el
 * jugador puede rehacer: con la casilla sola no se puede verificar
 * nada.
 */

const cfgJuegos = require("./config");
const fair = require("./fair");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

const RIESGOS = ["low", "medium", "high"];
const FILAS_MINIMO = 8;
const FILAS_MAXIMO = 16;

/*
  EL MARGEN CON EL QUE ESTA ESCRITA LA TABLA DE ABAJO.

  No es el que se cobra: es el que ya trae horneado. Para pasar al
  margen de verdad se multiplica por (1 - margen) / (1 - este).
*/
const MARGEN_DE_LA_TABLA = 1;

const PAGOS = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    9: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
    10: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
    11: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    13: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
    14: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    15: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    9: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    10: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    11: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    13: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    14: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
    15: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    9: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
    10: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    13: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
    14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

/** La tabla de un riesgo y una cantidad de filas, con el margen puesto. */
function tabla(riesgo, filas, cfg) {
  const base = (PAGOS[riesgo] || {})[filas];
  if (!base) throw errorDe("INVALID_AMOUNT", { campo: "plinko" });

  const escala = cfgJuegos.factor("plinko", cfg) / (1 - MARGEN_DE_LA_TABLA / 100);
  return base.map((x) => Math.round(x * escala * 100000) / 100000);
}

/** Revisa lo que llego por la red. */
function revisar({ riesgo, filas }) {
  const r = String(riesgo || "").toLowerCase();
  if (!RIESGOS.includes(r)) throw errorDe("INVALID_AMOUNT", { campo: "riesgo" });

  const f = Math.floor(Number(filas));
  if (!Number.isFinite(f) || f < FILAS_MINIMO || f > FILAS_MAXIMO) {
    throw errorDe("INVALID_AMOUNT", { campo: "filas", minimo: FILAS_MINIMO, maximo: FILAS_MAXIMO });
  }

  return { riesgo: r, filas: f };
}

/**
 * SUELTA UNA BOLA.
 *
 * Un numero por fila. Menos de 0,5 es izquierda y el resto derecha;
 * la casilla es cuantas veces fue a la derecha, que es lo mismo que
 * la posicion final contando desde el borde izquierdo.
 */
function jugar({ apuestaSc, riesgo, filas, semillas, cfg }) {
  const limpio = revisar({ riesgo, filas });

  const { numeros, hmacs } = fair.numeros(limpio.filas, semillas);

  const camino = numeros.map((n) => (n < 0.5 ? 0 : 1));
  const casilla = camino.reduce((a, b) => a + b, 0);

  const mult = tabla(limpio.riesgo, limpio.filas, cfg)[casilla] || 0;

  return {
    camino,
    casilla,
    gano: mult > 1,
    multiplicador: mult,
    pagoSc: mult > 0 ? sc(apuestaSc * mult) : 0,
    hmacs,
    jugada: limpio,
    resultado: { camino, casilla, multiplicador: mult },
  };
}

module.exports = {
  RIESGOS,
  FILAS_MINIMO,
  FILAS_MAXIMO,
  MARGEN_DE_LA_TABLA,
  PAGOS,
  tabla,
  revisar,
  jugar,
};
