/**
 * EL CAPTCHA DE CLOUDFLARE (TURNSTILE).
 *
 * El navegador resuelve el desafío y manda un token. Acá se le pregunta
 * a Cloudflare si ese token es de verdad.
 *
 * POR QUE SE COMPRUEBA EN EL SERVIDOR
 *
 * Porque el navegador miente. Cualquiera puede mandar un pedido a mano
 * sin pasar por la pantalla, y entonces el captcha no protegió nada. El
 * único momento en que el captcha sirve es este: acá, antes de crear la
 * cuenta.
 *
 * EL TOKEN SE USA UNA SOLA VEZ
 *
 * Cloudflare los invalida después de comprobarlos. Así que el mismo
 * token no sirve para dos registros, que es exactamente lo que haría
 * alguien automatizando.
 *
 * SI CLOUDFLARE NO CONTESTA
 *
 * Se deja pasar, y se registra el problema. Es una decisión, no un
 * descuido: entre dejar entrar algún robot durante una caída de
 * Cloudflare y que nadie en el mundo pueda registrarse, lo segundo es
 * mucho peor. El captcha es una molestia para el que abusa, no el único
 * control: el límite de pedidos y los controles antifraude siguen ahí.
 */

const { logger } = require("../utils/logger");

const URL_DE_CLOUDFLARE = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/* Cuánto se espera a Cloudflare antes de seguir sin él. */
const ESPERA_MS = 5000;

/**
 * @returns {{ ok: boolean, motivo?: string, saltado?: boolean }}
 */
async function comprobar(token, ipDelVisitante) {
  const secreto = process.env.TURNSTILE_SECRET_KEY;

  /*
    Sin clave configurada el captcha queda apagado. Es lo que hace que
    alguien pueda levantar el proyecto y registrarse sin tener cuenta de
    Cloudflare. Se avisa, para que no pase desapercibido en un servidor
    de verdad.
  */
  if (!secreto) {
    logger.warn("[turnstile] sin TURNSTILE_SECRET_KEY: el captcha esta apagado");
    return { ok: true, saltado: true };
  }

  if (!token) return { ok: false, motivo: "sin-token" };

  const cuerpo = new URLSearchParams({ secret: secreto, response: String(token) });
  if (ipDelVisitante) cuerpo.set("remoteip", String(ipDelVisitante));

  const corte = AbortSignal.timeout ? AbortSignal.timeout(ESPERA_MS) : undefined;

  try {
    const respuesta = await fetch(URL_DE_CLOUDFLARE, {
      method: "POST",
      body: cuerpo,
      signal: corte,
    });
    const datos = await respuesta.json();

    if (datos && datos.success) return { ok: true };

    return {
      ok: false,
      motivo: (datos && datos["error-codes"] && datos["error-codes"].join(",")) || "rechazado",
    };
  } catch (err) {
    logger.error(`[turnstile] no se pudo comprobar: ${err.message}`);
    return { ok: true, saltado: true };
  }
}

module.exports = { comprobar };
