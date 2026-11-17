/**
 * EL SORTEO VERIFICABLE.
 *
 * Portado del de BetSweeps, que ya corre en producción. Cambia una sola
 * cosa: allá cada premio trae `probability` y acá trae `chance`.
 *
 * COMO FUNCIONA
 *
 * Cada jugador tiene tres datos: una semilla del servidor (que guardamos
 * tapada), una semilla suya (que puede cambiar cuando quiera) y un
 * contador que sube con cada apertura. De eso sale el resultado:
 *
 *     hmac = HMAC_SHA256(clave = semillaServidor, mensaje = `${semillaCliente}:${nonce}`)
 *
 * Del HMAC se toman los primeros 13 dígitos hexadecimales (52 bits) y se
 * normalizan a [0, 1). 52 bits es exactamente la mantisa de un double, así
 * que la división es exacta y no pierde uniformidad: todos los resultados
 * son igual de probables, sin sesgo escondido en el redondeo.
 *
 * POR QUE ESTO ES VERIFICABLE
 *
 * Al jugador le mostramos el hash de la semilla del servidor ANTES de que
 * abra. No podemos cambiarla después sin que el hash deje de coincidir.
 * Cuando rota su semilla, le revelamos la vieja y puede rehacer cada
 * sorteo con `verificarApertura()` y comprobar que le tocó lo que le
 * tocó. Nosotros no podemos elegir el premio, y él no tiene que creernos.
 */

const crypto = require("crypto");

const DIGITOS_HEX = 13;
const MAXIMO = Math.pow(2, 4 * DIGITOS_HEX); // 2^52

function calcularHmac(semillaServidor, semillaCliente, nonce) {
  return crypto
    .createHmac("sha256", String(semillaServidor))
    .update(`${semillaCliente}:${nonce}`)
    .digest("hex");
}

/** Convierte el HMAC en un número en [0, 1). */
function hmacANumero(hmac) {
  return parseInt(hmac.slice(0, DIGITOS_HEX), 16) / MAXIMO;
}

/**
 * Busca qué premio le toca a un número entre 0 y 1.
 *
 * Los premios se recorren EN EL ORDEN EN QUE ESTAN GUARDADOS, sin
 * ordenarlos: cualquiera que lea la caja tiene que poder rehacer la cuenta
 * igual que nosotros, y para eso el orden tiene que ser el mismo.
 *
 * Si por error de redondeo las chances no llegan a 1 y el número cae en
 * ese hueco, devuelve el último premio en vez de romper. `revisarCaja` ya
 * impide guardar una caja así, pero una caja vieja o tocada a mano en la
 * base no puede tumbar una apertura.
 */
function elegirPremio(premios, numero) {
  if (!Array.isArray(premios) || premios.length === 0) {
    throw new Error("La caja no tiene premios.");
  }

  let acumulado = 0;
  for (let i = 0; i < premios.length; i += 1) {
    acumulado += Number(premios[i].chance) || 0;
    if (numero < acumulado) return { premio: premios[i], indice: i };
  }

  return { premio: premios[premios.length - 1], indice: premios.length - 1 };
}

/**
 * Resuelve una apertura entera.
 * @returns {{ hmac, numero, premio, indice }}
 */
function sortear({ semillaServidor, semillaCliente, nonce, premios }) {
  const hmac = calcularHmac(semillaServidor, semillaCliente, nonce);
  const numero = hmacANumero(hmac);
  const { premio, indice } = elegirPremio(premios, numero);
  return { hmac, numero, premio, indice };
}

/**
 * Rehace un sorteo con datos públicos.
 *
 * Es lo que usa la pantalla de verificación una vez revelada la semilla
 * del servidor. `coincide` es la respuesta a la única pregunta que le
 * importa al jugador: ¿me tocó lo que dicen que me tocó?
 */
function verificarApertura({ semillaServidor, semillaCliente, nonce, premios, premioEsperado }) {
  const { hmac, numero, premio } = sortear({ semillaServidor, semillaCliente, nonce, premios });
  return {
    hmac,
    numero,
    premio,
    coincide: premioEsperado === undefined || premio.name === premioEsperado,
  };
}

/** El hash que se le muestra al jugador antes de abrir. */
function hashDeSemilla(semillaServidor) {
  return crypto.createHash("sha256").update(String(semillaServidor)).digest("hex");
}

/** Una semilla nueva del servidor. */
function semillaNueva() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = {
  calcularHmac,
  hmacANumero,
  elegirPremio,
  sortear,
  verificarApertura,
  hashDeSemilla,
  semillaNueva,
};
