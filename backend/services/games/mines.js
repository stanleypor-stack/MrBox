/**
 * MINES.
 *
 * Un tablero con minas escondidas. El jugador destapa casillas; cada
 * una que sale limpia sube el multiplicador, y la primera mina
 * termina la ronda sin nada. Puede cobrar cuando quiera.
 *
 * EL MULTIPLICADOR SALE DE LA COMBINATORIA, NO DE UNA TABLA
 *
 * La chance de destapar `d` casillas limpias seguidas en un tablero
 * de `T` con `M` minas es:
 *
 *     C(T - M, d) / C(T, d)
 *
 * El pago justo es su inverso, y el de la casa es ese por (1 -
 * margen). Es la cuenta de BetSweeps, escrita igual:
 *
 *     mult = (1 - margen) * C(T, d) / C(T - M, d)
 *
 * Nunca baja de 1: con pocas minas y pocas destapadas el pago justo
 * es apenas mayor que 1 y el margen lo dejaría abajo, o sea cobrarle
 * al jugador por acertar.
 *
 * LAS MINAS SE PONEN AL EMPEZAR, NO AL TOCAR
 *
 * El tablero entero se baraja cuando arranca la ronda y se guarda
 * tapado. Decidir en cada click si la casilla tiene mina --mirando
 * cuánto va ganando-- es exactamente lo que un sorteo verificable
 * tiene que hacer imposible: con el tablero fijo desde el primer
 * momento, el jugador puede rehacerlo después y ver que nadie lo
 * movió.
 */

const cfgJuegos = require("./config");
const fair = require("./fair");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

/** Los cuatro tableros, como en BetSweeps. */
const TABLEROS = [25, 36, 49, 64];

/** Combinaciones de `n` tomadas de a `k`, sin factoriales gigantes. */
function combinaciones(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i += 1) r = (r * (n - i)) / (i + 1);
  return r;
}

/**
 * Lo que paga haber destapado `destapadas` limpias.
 *
 * Con cero destapadas no hay nada que cobrar: la ronda recién empieza.
 */
function multiplicador({ tablero, minas, destapadas }, cfg) {
  if (destapadas <= 0) return 0;

  const justo = combinaciones(tablero, destapadas) / combinaciones(tablero - minas, destapadas);
  const m = cfgJuegos.factor("mines", cfg) * justo;

  return Math.max(1, Math.round(m * 10000) / 10000);
}

/** Revisa con qué tablero y cuántas minas se quiere jugar. */
function revisar({ tablero, minas }) {
  const t = Math.floor(Number(tablero));
  if (!TABLEROS.includes(t)) throw errorDe("INVALID_AMOUNT", { campo: "tablero" });

  const m = Math.floor(Number(minas));
  /*
    Entre 1 y las que dejen al menos una casilla limpia. Un tablero
    todo minado no es un juego: es una apuesta perdida con una
    animación.
  */
  if (!Number.isFinite(m) || m < 1 || m > t - 1) {
    throw errorDe("INVALID_AMOUNT", { campo: "minas", minimo: 1, maximo: t - 1 });
  }

  return { tablero: t, minas: m };
}

/**
 * ARMA EL TABLERO.
 *
 * Baraja las posiciones y las primeras `minas` son las minadas. Se
 * devuelven ORDENADAS para que la lista no delate en qué orden
 * salieron del sorteo.
 */
function armar({ tablero, minas, semillas }) {
  const { mazo, hmacs } = fair.barajar(tablero, semillas);
  return { minadas: mazo.slice(0, minas).sort((a, b) => a - b), hmacs };
}

/**
 * DESTAPA UNA CASILLA.
 *
 * No toca nada: recibe el estado de la ronda y dice qué pasa. Quién
 * lo guarda y quién paga es `services/games/index.js`.
 */
function destapar({ ronda, casilla, cfg }) {
  const c = Math.floor(Number(casilla));
  if (!Number.isFinite(c) || c < 0 || c >= ronda.tablero) {
    throw errorDe("INVALID_AMOUNT", { campo: "casilla" });
  }
  if (ronda.destapadas.includes(c)) {
    throw errorDe("INVALID_AMOUNT", { campo: "casilla", yaEstaba: true });
  }

  const exploto = ronda.minadas.includes(c);
  const destapadas = exploto ? ronda.destapadas : [...ronda.destapadas, c];

  const mult = exploto
    ? 0
    : multiplicador({ tablero: ronda.tablero, minas: ronda.minas, destapadas: destapadas.length }, cfg);

  /* Destapó todo lo que se podía: la ronda se cierra sola y paga. */
  const limpias = ronda.tablero - ronda.minas;
  const termino = exploto || destapadas.length >= limpias;

  return { casilla: c, exploto, destapadas, multiplicador: mult, termino };
}

/** Lo que pagaría cobrar ahora. */
function pagoDe({ apuestaSc, tablero, minas, destapadas }, cfg) {
  const m = multiplicador({ tablero, minas, destapadas: destapadas.length }, cfg);
  return { multiplicador: m, pagoSc: m > 0 ? sc(apuestaSc * m) : 0 };
}

module.exports = {
  TABLEROS,
  combinaciones,
  multiplicador,
  revisar,
  armar,
  destapar,
  pagoDe,
};
