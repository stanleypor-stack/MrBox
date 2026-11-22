/**
 * CRASH.
 *
 * El multiplicador arranca en 1.00x y sube hasta que revienta. El
 * jugador cobra antes o se queda sin nada.
 *
 * EL PUNTO DE REVENTON
 *
 * Es la cuenta de BetSweeps, igual:
 *
 *     si el hash es divisible por `mod`  ->  revienta en 1.00x
 *     si no  ->  floor((100 * 2^52 - h) / (2^52 - h)) / 100
 *
 * donde `h` son los primeros 52 bits del hash. Esa fórmula da una
 * distribución en la que la chance de llegar a `x` es 1/x: llegar a
 * 2x pasa la mitad de las veces, a 10x una de cada diez.
 *
 * EL MARGEN ESTA CUANTIZADO, Y HAY QUE DECIRLO
 *
 * El margen es "una de cada `mod` rondas revienta al toque", con
 * `mod = round(100 / margen)`. Como `mod` es entero, solo los
 * divisores de 100 dan el margen pedido al dedo: 4% da mod 25, que es
 * 4% exacto; 3% da mod 33, que es 3,03%. `margenEfectivo()` en
 * `config.js` dice el de verdad, y es ese el que publica la pantalla.
 *
 * COMO CRECE
 *
 *     multiplicador = e ^ (0,00006 * milisegundos)
 *
 * o sea que 2x llega a los 11,5 segundos y 10x a los 38. La misma
 * curva que BetSweeps.
 *
 * QUIEN DECIDE CUANDO COBRASTE
 *
 * El servidor, con SU reloj. El navegador dibuja la curva, pero
 * cuando llega el pedido de cobrar, el multiplicador se calcula con
 * el tiempo que paso en el servidor desde que arranco la ronda. Si
 * eso ya pasó el punto de reventón, no se paga: no alcanza con que el
 * cliente diga que llego a tiempo.
 */

const crypto = require("crypto");
const cfgJuegos = require("./config");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

/** Cuánto crece por milisegundo. La constante de BetSweeps. */
const VELOCIDAD = 0.00006;

/** El multiplicador a los `ms` milisegundos de arrancar. */
function multiplicadorEn(ms) {
  const x = Math.pow(Math.E, VELOCIDAD * Math.max(0, ms));
  /* Hacia abajo: pagar el redondeo hacia arriba es regalar plata en
     el borde, y en el borde es donde cobra todo el mundo. */
  return Math.floor(x * 100) / 100;
}

/** Cuántos milisegundos hacen falta para llegar a `x`. */
function cuandoLlegaA(x) {
  return Math.log(Math.max(1, x)) / VELOCIDAD;
}

/**
 * ¿EL HASH ES DIVISIBLE POR `mod`?
 *
 * De a cuatro dígitos hexadecimales, arrastrando el resto. Es la
 * forma de dividir un número de 64 dígitos sin que se rompa la
 * precisión de un double.
 */
function divisible(hash, mod) {
  let val = 0;
  const o = hash.length % 4;
  for (let i = o > 0 ? o - 4 : 0; i < hash.length; i += 4) {
    val = ((val << 16) + parseInt(hash.substring(i, i + 4), 16)) % mod;
  }
  return val === 0;
}

/** El punto de reventón de una ronda, a partir de su hash. */
function puntoDe(hash, cfg) {
  const mod = cfgJuegos.crashMod(cfg);
  if (divisible(hash, mod)) return 1;

  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);
  return Math.floor((100 * e - h) / (e - h)) / 100;
}

/**
 * ARRANCA UNA RONDA.
 *
 * El punto de reventón se sortea ACA y se guarda tapado. El
 * navegador no lo ve hasta que la ronda termina: si lo supiera,
 * cobraría siempre un centésimo antes.
 */
function arrancar({ semillas, cfg }) {
  const hmac = crypto
    .createHmac("sha256", String(semillas.semillaServidor))
    .update(`${semillas.semillaCliente}:${semillas.nonce}:0`)
    .digest("hex");

  return { punto: puntoDe(hmac, cfg), hmacs: [hmac] };
}

/**
 * COBRA UNA RONDA ABIERTA.
 *
 * @param {number} o.punto      el de reventón, guardado tapado
 * @param {number} o.msDesde    cuánto hace que arrancó, según el servidor
 * @param {number} [o.pedido]   el multiplicador en el que quiso cobrar
 */
function cobrar({ apuestaSc, punto, msDesde, pedido }) {
  const enElReloj = multiplicadorEn(msDesde);

  /*
    EL QUE MANDA ES EL MAS CHICO DE LOS TRES.

    El del reloj del servidor, el que pidió el jugador y el punto de
    reventón. Tomar el que pidió sin mirar el reloj deja cobrar 100x
    en el primer segundo; tomar el del reloj sin mirar lo que pidió le
    cobra de más al que apretó antes.
  */
  const tope = Number.isFinite(Number(pedido)) && Number(pedido) > 1
    ? Math.min(enElReloj, Number(pedido))
    : enElReloj;

  if (tope > punto) {
    /* Ya había reventado: no hay nada que cobrar. */
    return { reventado: true, multiplicador: 0, pagoSc: 0, en: punto };
  }

  const m = Math.max(1, tope);
  return { reventado: false, multiplicador: m, pagoSc: sc(apuestaSc * m), en: m };
}

module.exports = {
  VELOCIDAD,
  multiplicadorEn,
  cuandoLlegaA,
  divisible,
  puntoDe,
  arrancar,
  cobrar,
};
