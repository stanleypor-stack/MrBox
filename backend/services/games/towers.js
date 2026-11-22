/**
 * DRAGON'S TOWER.
 *
 * Diez pisos. En cada uno hay varias baldosas y una o más esconden un
 * dragón. El jugador elige una por piso: si acierta sube y el
 * multiplicador crece; si pisa el dragón, se terminó. Puede cobrar en
 * cualquier piso.
 *
 * CINCO DIFICULTADES, LAS DE BETSWEEPS
 *
 *   easy         4 baldosas, 1 dragón
 *   med          3 baldosas, 1 dragón
 *   hard         2 baldosas, 1 dragón
 *   insane       3 baldosas, 2 dragones
 *   ultraInsane  4 baldosas, 3 dragones
 *
 * EL MULTIPLICADOR
 *
 *     mult = (1 - margen) * (baldosas / (baldosas - dragones)) ^ piso
 *
 * Cada piso multiplica por lo mismo, porque cada piso es la misma
 * apuesta: el inverso de la chance de acertar. El margen se cobra una
 * sola vez, al principio, y no piso por piso: por eso está afuera de
 * la potencia. Es la cuenta de BetSweeps, igual.
 *
 * LA TORRE SE ARMA AL EMPEZAR
 *
 * Los diez pisos se sortean cuando arranca la ronda y quedan
 * guardados tapados, por lo mismo que en Mines: decidir el dragón en
 * el momento del click, sabiendo cuánto va ganando, es lo que el
 * sorteo verificable tiene que hacer imposible.
 */

const cfgJuegos = require("./config");
const fair = require("./fair");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

const PISOS = 10;

const DIFICULTADES = {
  easy: { baldosas: 4, dragones: 1 },
  med: { baldosas: 3, dragones: 1 },
  hard: { baldosas: 2, dragones: 1 },
  insane: { baldosas: 3, dragones: 2 },
  ultraInsane: { baldosas: 4, dragones: 3 },
};

/** Lo que paga haber subido `piso` pisos. */
function multiplicador({ riesgo, piso }, cfg) {
  if (piso <= 0) return 0;

  const d = DIFICULTADES[riesgo];
  if (!d) throw errorDe("INVALID_AMOUNT", { campo: "riesgo" });

  const porPiso = d.baldosas / (d.baldosas - d.dragones);
  const m = cfgJuegos.factor("towers", cfg) * Math.pow(porPiso, piso);

  return Math.max(1, Math.round(m * 10000) / 10000);
}

function revisar({ riesgo }) {
  const r = String(riesgo || "");
  if (!DIFICULTADES[r]) throw errorDe("INVALID_AMOUNT", { campo: "riesgo" });
  return { riesgo: r };
}

/**
 * ARMA LA TORRE.
 *
 * Un sorteo por piso: se barajan las baldosas de ese piso y las
 * primeras `dragones` son las malas. Se guardan ordenadas.
 */
function armar({ riesgo, semillas }) {
  const d = DIFICULTADES[riesgo];
  const todos = [];
  const hmacs = [];

  for (let piso = 0; piso < PISOS; piso += 1) {
    /*
      Cada piso usa su propio tramo del sorteo. El nonce es el mismo
      --es una sola ronda-- y lo que cambia es el contador de adentro,
      que `fair` mueve solo: por eso se le pide el mazo de una vez y
      se reparte, en vez de pedir diez mazos iguales.
    */
    const { mazo, hmacs: h } = fair.barajar(d.baldosas, {
      ...semillas,
      /* El piso entra en la semilla del cliente para que cada uno sea
         distinto y siga siendo rehacible desde afuera. */
      semillaCliente: `${semillas.semillaCliente}:piso${piso}`,
    });
    todos.push(mazo.slice(0, d.dragones).sort((a, b) => a - b));
    hmacs.push(...h);
  }

  return { dragones: todos, hmacs };
}

/**
 * PISA UNA BALDOSA.
 *
 * No toca nada: dice qué pasa. Guardar y pagar es del servicio común.
 */
function pisar({ ronda, baldosa, cfg }) {
  const d = DIFICULTADES[ronda.riesgo];
  const piso = ronda.subidos;

  if (piso >= PISOS) throw errorDe("INVALID_AMOUNT", { campo: "piso" });

  const b = Math.floor(Number(baldosa));
  if (!Number.isFinite(b) || b < 0 || b >= d.baldosas) {
    throw errorDe("INVALID_AMOUNT", { campo: "baldosa" });
  }

  const quemo = ronda.dragones[piso].includes(b);
  const subidos = quemo ? ronda.subidos : ronda.subidos + 1;

  const mult = quemo ? 0 : multiplicador({ riesgo: ronda.riesgo, piso: subidos }, cfg);
  const termino = quemo || subidos >= PISOS;

  return { baldosa: b, quemo, subidos, multiplicador: mult, termino };
}

/** Lo que pagaría cobrar ahora. */
function pagoDe({ apuestaSc, riesgo, subidos }, cfg) {
  const m = multiplicador({ riesgo, piso: subidos }, cfg);
  return { multiplicador: m, pagoSc: m > 0 ? sc(apuestaSc * m) : 0 };
}

module.exports = {
  PISOS,
  DIFICULTADES,
  multiplicador,
  revisar,
  armar,
  pisar,
  pagoDe,
};
