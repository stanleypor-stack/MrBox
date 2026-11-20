const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const { logger } = require("../utils/logger");

/**
 * ENTRAR CON GOOGLE: COMPROBAR QUE EL TOKEN ES DE GOOGLE.
 *
 * El botón de Google del navegador devuelve un ID token: un JWT que
 * Google firmó y que dice quién es la persona. Esto comprueba que lo
 * firmó Google de verdad y que es para NUESTRA aplicación.
 *
 * POR QUE NO ALCANZA CON LEERLO
 *
 * Un JWT se lee sin ninguna clave: cualquiera puede escribir uno que
 * diga `email: dani@mrbox.gg` y mandarlo. Lo único que lo hace valer
 * es la firma, y para comprobarla hace falta la clave pública de
 * Google. Por eso acá se verifica siempre, nunca se decodifica y
 * listo.
 *
 * SIN LIBRERIA NUEVA
 *
 * `google-auth-library` hace esto mismo, pero son tres cosas: bajar
 * las claves públicas, armar la clave y verificar la firma. Node trae
 * las tres (`fetch`, `crypto.createPublicKey` con formato JWK, y
 * `jsonwebtoken`, que ya usamos para nuestras sesiones). Una
 * dependencia menos en algo que toca la autenticación.
 *
 * LAS TRES COSAS QUE SE COMPRUEBAN
 *
 *   quién lo firmó   `iss` tiene que ser Google
 *   para quién es    `aud` tiene que ser NUESTRO Client ID. Sin esto,
 *                    un token que Google emitió para otra aplicación
 *                    entraría acá: se lo pide al usuario en su propio
 *                    sitio y lo reenvía al nuestro.
 *   cuándo vence     `exp`, que lo mira `jwt.verify`
 */

const EMISORES = ["https://accounts.google.com", "accounts.google.com"];
const CLAVES = "https://www.googleapis.com/oauth2/v3/certs";

/*
  Las claves públicas de Google, guardadas.

  Las rota cada tanto, así que no se pueden guardar para siempre; y
  bajarlas en cada entrada sería un viaje a Google por cada login. Se
  guardan una hora, que es lo que recomienda la cabecera de su
  respuesta.
*/
const UNA_HORA = 60 * 60 * 1000;
let guardadas = { hasta: 0, porId: new Map() };

async function clavesDeGoogle(forzar = false) {
  if (!forzar && Date.now() < guardadas.hasta && guardadas.porId.size) {
    return guardadas.porId;
  }

  const r = await fetch(CLAVES);
  if (!r.ok) throw new Error(`google: las claves contestaron ${r.status}`);

  const { keys } = await r.json();
  const porId = new Map();

  for (const jwk of keys || []) {
    try {
      porId.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
    } catch (err) {
      logger.warn(`[google] una clave no se pudo armar: ${err.message}`);
    }
  }

  if (!porId.size) throw new Error("google: no vino ninguna clave usable");

  guardadas = { hasta: Date.now() + UNA_HORA, porId };
  return porId;
}

/** Si está configurado el "Entrar con Google". */
function configurado() {
  return !!process.env.GOOGLE_CLIENT_ID;
}

/**
 * Comprueba un ID token y devuelve a quién pertenece.
 *
 * @param {string} token el `credential` que devuelve el botón de Google
 * @returns {Promise<{ sub, email, emailVerificado, nombre, foto }>}
 * @throws si la firma no cierra, si no es para nosotros, o si venció
 */
async function quienEs(token) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("google: falta GOOGLE_CLIENT_ID");
  if (!token || typeof token !== "string") throw new Error("google: sin token");

  const cabecera = jwt.decode(token, { complete: true });
  if (!cabecera || !cabecera.header || !cabecera.header.kid) {
    throw new Error("google: el token no trae kid");
  }

  let porId = await clavesDeGoogle();
  let clave = porId.get(cabecera.header.kid);

  /* Si no está, puede ser que Google las haya rotado recién: se
     vuelven a bajar una vez antes de darlo por malo. */
  if (!clave) {
    porId = await clavesDeGoogle(true);
    clave = porId.get(cabecera.header.kid);
  }
  if (!clave) throw new Error("google: no tengo la clave con la que se firmo");

  const datos = jwt.verify(token, clave, {
    algorithms: ["RS256"],
    audience: clientId,
    issuer: EMISORES,
  });

  if (!datos.sub) throw new Error("google: el token no dice de quien es");

  return {
    /* El identificador de la cuenta de Google. NO cambia aunque la
       persona cambie de mail, y por eso es el que se guarda. */
    sub: String(datos.sub),
    email: String(datos.email || "").trim().toLowerCase(),
    /* Google avisa si el mail está verificado. Si no lo está, no se
       puede usar para encontrar una cuenta nuestra: alguien podría
       crear una cuenta de Google con el mail de otro. */
    emailVerificado: datos.email_verified === true || datos.email_verified === "true",
    nombre: String(datos.name || datos.given_name || "").trim(),
    foto: String(datos.picture || "").trim(),
  };
}

module.exports = { quienEs, configurado };
