/**
 * LA PLATA, EN UN SOLO LUGAR.
 *
 * MR BOX tiene UNA moneda: el Sweeps Coin (SC), que vale un dólar. No hay
 * Gold Coins, no hay cotización entre monedas, no hay conversiones: un
 * número en este archivo es SC y nada más.
 *
 * POR QUE TODO PASA POR ACA
 *
 * Un saldo guardado como número común acumula error. `0.1 + 0.2` da
 * `0.30000000000000004`, y después de unas miles de aperturas de caja esa
 * basura se nota en el saldo de alguien. La regla es:
 *
 *     toda cuenta que termine en un saldo, un precio o un premio pasa
 *     por `sc()` antes de guardarse.
 *
 * `sc()` redondea a centavos usando la escala de enteros, que es exacta
 * hasta montos muchísimo más grandes que cualquiera que vaya a existir acá
 * (el tope de premio del sitio es SC 300.000).
 *
 * No se usa una librería de decimales a propósito: una sola función que
 * todo el mundo entiende y que se puede leer de arriba abajo vale más que
 * una dependencia que hay que aprender.
 */

/** Centavos por Sweeps Coin. */
const CENTAVOS = 100;

/**
 * Un monto en SC, redondeado a centavos.
 *
 * Lo que no es un número da 0, a propósito: un `undefined` que se cuela en
 * una cuenta tiene que valer cero y no ensuciar todo con `NaN`, que se
 * propaga en silencio hasta el saldo.
 */
function sc(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * CENTAVOS) / CENTAVOS;
}

/** La suma de varios montos, redondeada una sola vez al final. */
function suma(...montos) {
  const lista = montos.length === 1 && Array.isArray(montos[0]) ? montos[0] : montos;
  return sc(lista.reduce((acc, m) => acc + (Number(m) || 0), 0));
}

/**
 * Lo que vale un monto para mostrarlo: siempre con dos decimales.
 *
 * Se usa `en-US` fijo y no el idioma del visitante: en alemán el separador
 * de miles es el punto, y "SC 1.000" leído como mil con coma decimal es un
 * malentendido caro.
 */
function mostrar(valor) {
  return sc(valor).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Si un monto sirve como plata: número, finito y no negativo. */
function esMontoValido(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0;
}

module.exports = { sc, suma, mostrar, esMontoValido, CENTAVOS };
