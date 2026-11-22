/**
 * EL SORTEO VERIFICABLE DE LOS JUEGOS.
 *
 * Usa EXACTAMENTE las mismas semillas que las cajas --la del servidor,
 * la del jugador y el nonce de `UserSeed`-- así que todo lo que ya
 * existe sigue valiendo: el hash que se muestra antes de jugar, la
 * rotación de semillas y la pantalla de verificación del perfil.
 *
 * QUE AGREGA SOBRE `services/boxes/fair.js`
 *
 * Una caja necesita UN número por apertura. Un juego necesita varios:
 * Keno saca 10 bolillas, Plinko rebota 16 veces, Mines baraja 25
 * casillas. Así que hace falta una forma de sacar N números del mismo
 * tiro sin que se repitan ni se puedan adivinar.
 *
 *     hmac_i = HMAC_SHA256(semillaServidor, `${semillaCliente}:${nonce}:${i}`)
 *
 * El `i` es el único agregado: un contador que arranca en 0 dentro de
 * la ronda. Cada HMAC da un número y listo.
 *
 * POR QUE UN HMAC POR NUMERO Y NO UNO PARTIDO EN PEDAZOS
 *
 * Se podría sacar cuatro números de cada HMAC y gastar la cuarta parte
 * de los hashes. No se hace: el jugador tiene que poder rehacer la
 * cuenta con una calculadora de HMAC y la lista de los `i`, sin saber
 * cómo partimos los bytes. Un Keno son 10 hashes; el costo es
 * invisible al lado de una consulta a la base.
 *
 * DE DONDE SALE
 *
 * La mecánica es la de BetSweeps, que ya corre en producción. Cambia
 * la primitiva: allá cada juego arma su hash a mano --`sha256` de
 * `${semillaServidor}-${nonce}-${semillaCliente}`-- y acá se usa el
 * HMAC que MR BOX ya tiene probado y que su pantalla de verificación
 * sabe rehacer. Lo que NO cambia es la matemática de cada juego ni el
 * margen de la casa, que es lo que decide cuánto se paga.
 */

const crypto = require("crypto");

/*
  13 dígitos hexadecimales son 52 bits, que es exactamente la mantisa
  de un double: la división es exacta y no mete sesgo en el redondeo.
  El mismo número que usan las cajas.
*/
const DIGITOS_HEX = 13;
const MAXIMO = Math.pow(2, 4 * DIGITOS_HEX);

/** El HMAC de un paso de la ronda. */
function hmacDe(semillaServidor, semillaCliente, nonce, i) {
  return crypto
    .createHmac("sha256", String(semillaServidor))
    .update(`${semillaCliente}:${nonce}:${i}`)
    .digest("hex");
}

/** Un número en [0, 1) a partir de un HMAC. */
function numeroDe(hmac) {
  return parseInt(hmac.slice(0, DIGITOS_HEX), 16) / MAXIMO;
}

/**
 * N números en [0, 1), y los HMAC que los produjeron.
 *
 * Los HMAC viajan con el resultado para que el jugador pueda
 * comprobarlos uno por uno sin tener que recalcularlos a ciegas.
 *
 * @returns {{ numeros: number[], hmacs: string[] }}
 */
function numeros(cuantos, { semillaServidor, semillaCliente, nonce }) {
  const n = Math.max(0, Math.floor(Number(cuantos) || 0));
  const hmacs = [];
  const salida = [];

  for (let i = 0; i < n; i += 1) {
    const h = hmacDe(semillaServidor, semillaCliente, nonce, i);
    hmacs.push(h);
    salida.push(numeroDe(h));
  }

  return { numeros: salida, hmacs };
}

/**
 * UN ENTERO ENTRE 0 Y `tope`-1, SIN SESGO DE REDONDEO.
 *
 * `Math.floor(numero * tope)` alcanza acá: el número tiene 52 bits de
 * precisión y los topes de estos juegos son chicos (100, 25, 40), así
 * que el sesgo está muy por debajo de lo que cualquiera podría medir
 * en la vida de un casino. Se deja escrito igual para que nadie lo
 * cambie por una operación de módulo, que SI sesga.
 */
function entero(numero, tope) {
  return Math.min(tope - 1, Math.floor(numero * tope));
}

/**
 * BARAJA DE FISHER-YATES, CON LOS NUMEROS DEL SORTEO.
 *
 * Es la que usa BetSweeps y es la correcta: recorre de atrás hacia
 * adelante y cambia cada posición por una al azar de las que quedan.
 * Barajar "ordenando por un número al azar" --el truco de una línea--
 * no da todas las permutaciones con la misma probabilidad.
 *
 * Consume un número por posición, salvo la primera, que no hace falta.
 *
 * @param {number} cuantas  el tamaño del mazo
 * @returns {number[]}      las posiciones 0..cuantas-1, mezcladas
 */
function barajar(cuantas, semillas) {
  const { numeros: nums, hmacs } = numeros(Math.max(0, cuantas - 1), semillas);
  const mazo = Array.from({ length: cuantas }, (_, i) => i);

  let k = 0;
  for (let i = cuantas - 1; i > 0; i -= 1) {
    const j = entero(nums[k], i + 1);
    const tmp = mazo[j];
    mazo[j] = mazo[i];
    mazo[i] = tmp;
    k += 1;
  }

  return { mazo, hmacs };
}

/**
 * Rehace una ronda con datos públicos.
 *
 * Lo usa la pantalla de verificación una vez revelada la semilla del
 * servidor: con la semilla, la del jugador y el nonce salen los mismos
 * números y, por lo tanto, el mismo resultado.
 */
function verificar({ semillaServidor, semillaCliente, nonce, cuantos }) {
  return numeros(cuantos, { semillaServidor, semillaCliente, nonce });
}

module.exports = {
  DIGITOS_HEX,
  hmacDe,
  numeroDe,
  numeros,
  entero,
  barajar,
  verificar,
};
