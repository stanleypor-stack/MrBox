const crypto = require("crypto");
const { logger } = require("../../utils/logger");

/**
 * OXAPAY.
 *
 * La pasarela de cripto que eligió Dani. Acá está TODO lo que la toca,
 * en un solo archivo: si mañana se cambia de proveedor, se cambia esto
 * y nada más.
 *
 * DOS CLAVES DISTINTAS, A PROPOSITO DE ELLOS
 *
 *  - la de comercio cobra (depósitos);
 *  - la de pagos manda plata afuera (canjes).
 *
 * Están separadas porque la segunda es mucho más peligrosa: con la de
 * comercio filtrada alguien ve pagos, con la de pagos filtrada alguien
 * se lleva el saldo. Por eso el sitio puede andar con la primera sola,
 * y los canjes esperan.
 *
 * NUNCA SE INVENTA UNA DIRECCION
 *
 * Si no hay clave, esto devuelve "no configurada" y la pantalla lo
 * dice. Una dirección de ejemplo en una pantalla de depósito es plata
 * de alguien mandada a la nada.
 */

const BASE = "https://api.oxapay.com/v1";

/* Para que una llamada colgada no cuelgue el pedido del jugador. */
const ESPERA_MS = 12000;

function claveDeComercio() { return process.env.OXAPAY_MERCHANT_KEY || ""; }
function claveDePagos() { return process.env.OXAPAY_PAYOUT_KEY || ""; }

function configurada() { return !!claveDeComercio(); }
function listaParaPagar() { return !!claveDePagos(); }

async function traer(ruta, clave, cabecera) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);

  try {
    const r = await fetch(BASE + ruta, {
      method: "GET",
      headers: clave ? { [cabecera]: clave } : {},
      signal: control.signal,
    });

    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`oxapay ${ruta}: ${r.status}`);
    return datos.data || datos;
  } finally {
    clearTimeout(reloj);
  }
}

async function pedir(ruta, cuerpo, clave, cabecera) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);

  try {
    const r = await fetch(BASE + ruta, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [cabecera]: clave,
      },
      body: JSON.stringify(cuerpo),
      signal: control.signal,
    });

    const datos = await r.json().catch(() => ({}));

    /*
      OJO CON `error`.

      OxaPay manda SIEMPRE el campo `error`, y cuando salio todo bien
      manda `{}`. Un objeto vacio en JavaScript es verdadero, asi que
      `if (datos.error)` daba error justo cuando habia funcionado. Lo
      que hay que mirar es si tiene algo adentro.
    */
    const fallo = datos && datos.error && Object.keys(datos.error).length > 0;

    if (!r.ok || fallo) {
      const motivo = (fallo && (datos.error.message || datos.error.type))
        || (datos && datos.message)
        || r.status;
      throw new Error(`oxapay ${ruta}: ${motivo}`);
    }

    return datos.data || datos;
  } finally {
    clearTimeout(reloj);
  }
}

/*
  LA COTIZACION, QUE ES LO QUE FALTABA.

  SC vale un dolar. Las monedas de la lista, no: una es BTC. OxaPay
  espera el `amount` del payout EN UNIDADES DE LA MONEDA, asi que entre
  el canje y el pago tiene que haber una division, y esa division sale
  de `GET /common/prices`.

  Se guarda un minuto. Pedirla en cada canje seria una llamada de red
  entre el click del admin y la plata saliendo, y el precio del bitcoin
  no se mueve lo suficiente en sesenta segundos como para que importe.

  Si NO se puede cotizar, esto tira. El que llama tiene que dejar el
  canje sin pagar: mandar plata afuera con un numero inventado es peor
  que hacer esperar a alguien.
*/
const PRECIOS_DURAN_MS = 60 * 1000;
let preciosGuardados = null;
let preciosDeCuando = 0;

async function precios() {
  const ahora = Date.now();
  if (preciosGuardados && ahora - preciosDeCuando < PRECIOS_DURAN_MS) {
    return preciosGuardados;
  }

  const datos = await traer("/common/prices", claveDeComercio(), "merchant_api_key");
  if (!datos || typeof datos !== "object") throw new Error("oxapay: precios ilegibles");

  preciosGuardados = datos;
  preciosDeCuando = ahora;
  return datos;
}

/**
 * Cuántos dólares vale UNA unidad de la moneda.
 *
 * @throws si la pasarela no la cotiza. No se adivina.
 */
async function precioDe(ticker) {
  const tabla = await precios();
  const clave = String(ticker || "").toUpperCase();
  const valor = Number(tabla[clave]);

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(`oxapay: no hay cotizacion para ${clave}`);
  }
  return valor;
}

/**
 * De dólares (SC) a unidades de la moneda.
 *
 * Se redondea a 8 decimales, que es lo que acepta cualquier cadena de
 * las que usamos, y hacia ABAJO: pagar un satoshi de menos no rompe
 * nada, pagar uno de más por redondeo es plata de la casa cada vez.
 */
async function aMoneda(montoSc, ticker) {
  const precio = await precioDe(ticker);
  const crudo = Number(montoSc) / precio;
  const cuanto = Math.floor(crudo * 1e8) / 1e8;

  return { cuanto, precio };
}

/**
 * Una dirección para recibir un depósito.
 *
 * `userId` viaja como orden: es lo que devuelve el aviso de pago y lo
 * que permite saber a quién acreditarle.
 */
async function direccionDeDeposito({ userId, ticker, red }) {
  const datos = await pedir(
    "/payment/static-address",
    {
      currency: ticker,
      network: red,
      order_id: String(userId),
      callback_url: process.env.OXAPAY_CALLBACK_URL || undefined,
    },
    claveDeComercio(),
    "merchant_api_key"
  );

  /* `memo` importa en las cadenas que lo piden: sin el, el deposito
     llega a la direccion pero no se sabe de quien es. */
  return {
    address: datos.address,
    memo: datos.memo || "",
    trackId: datos.track_id || "",
    expiresAt: datos.expired_at || null,
  };
}

/**
 * Mandar plata afuera. Solo con la clave de pagos.
 *
 * `montoSc` son dólares; `amount` tiene que ir en unidades de la
 * moneda. La conversión va acá y la cotización usada vuelve, para que
 * el canje la guarde y mañana se pueda revisar qué se pagó y a cuánto.
 */
async function pagar({ montoSc, ticker, red, direccion, referencia }) {
  const { cuanto, precio } = await aMoneda(montoSc, ticker);

  if (!(cuanto > 0)) {
    throw new Error(`oxapay: SC ${montoSc} en ${ticker} da cero al convertir`);
  }

  const datos = await pedir(
    "/payout",
    {
      address: direccion,
      currency: ticker,
      network: red,
      amount: cuanto,
      description: `MR BOX redemption ${referencia}`,
    },
    claveDePagos(),
    "payout_api_key"
  );

  return { id: datos.track_id || datos.trackId || "", montoMoneda: cuanto, cotizacion: precio };
}

/**
 * ¿El aviso de pago es de verdad?
 *
 * OxaPay firma el cuerpo con HMAC-SHA512 y la clave. Sin esta
 * comprobación, cualquiera que sepa la dirección del aviso puede
 * acreditarse SC mandando un JSON.
 *
 * `timingSafeEqual` y no `===` porque comparar firmas con `===` filtra,
 * byte a byte, cuánto acertó el que prueba.
 */
function avisoEsDeOxaPay(cuerpoCrudo, firma) {
  const clave = process.env.OXAPAY_CALLBACK_SECRET || claveDeComercio();
  if (!clave || !firma) return false;

  const mia = crypto.createHmac("sha512", clave).update(cuerpoCrudo).digest("hex");
  const a = Buffer.from(mia);
  const b = Buffer.from(String(firma));

  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    logger.error("[oxapay] firma:", err.message);
    return false;
  }
}

module.exports = {
  precioDe,
  aMoneda,
  configurada,
  listaParaPagar,
  direccionDeDeposito,
  pagar,
  avisoEsDeOxaPay,
  BASE,
};
