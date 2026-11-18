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

/** Mandar plata afuera. Solo con la clave de pagos. */
async function pagar({ montoSc, ticker, red, direccion, referencia }) {
  const datos = await pedir(
    "/payout",
    {
      address: direccion,
      currency: ticker,
      network: red,
      amount: montoSc,
      description: `MR BOX redemption ${referencia}`,
    },
    claveDePagos(),
    "payout_api_key"
  );

  return { id: datos.track_id || datos.trackId || "" };
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
  configurada,
  listaParaPagar,
  direccionDeDeposito,
  pagar,
  avisoEsDeOxaPay,
  BASE,
};
