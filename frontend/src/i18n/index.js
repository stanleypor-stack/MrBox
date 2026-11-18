import Vue from "vue";
import VueI18n from "vue-i18n";

import { IDIOMAS, IDIOMA_POR_DEFECTO, idiomaInicial, recordarIdioma, existe } from "./idiomas";

import en from "./locales/en";

/**
 * LOS IDIOMAS, UNO POR VEZ.
 *
 * En el paquete principal va el inglés y nada más. Los otros ocho se
 * bajan cuando hacen falta.
 *
 * POR QUE CAMBIO
 *
 * Antes iban los nueve juntos, y con razón: eran unos kilobytes y
 * cargarlos aparte hacía parpadear el sitio. Hoy son mil trescientos
 * textos por idioma --medio megabyte de los nueve-- y eso ya es más de
 * la mitad del javascript que baja alguien que entra por primera vez,
 * para leer ocho idiomas que no habla.
 *
 * Y EL PARPADEO NO VUELVE
 *
 * Porque el idioma se sabe ANTES de dibujar --está en el navegador o
 * guardado de la vez pasada-- y `main.js` espera ese archivo antes de
 * montar la aplicación. Nadie ve medio segundo de inglés.
 */

Vue.use(VueI18n);

const messages = { en };

/* Los que ya se bajaron, para no volver a pedirlos. */
const bajados = new Set(["en"]);

const i18n = new VueI18n({
  locale: idiomaInicial(),
  fallbackLocale: IDIOMA_POR_DEFECTO,
  messages,

  /*
    Que un texto que falta no grite en la consola de producción. Si falta,
    cae al inglés, que es lo que queremos; el aviso solo sirve mientras se
    desarrolla.
  */
  silentFallbackWarn: process.env.NODE_ENV === "production",
  silentTranslationWarn: process.env.NODE_ENV === "production",
});

/**
 * Baja los textos de un idioma, si no estaban.
 *
 * El nombre del archivo sale de la lista de idiomas y nunca de algo que
 * escriba alguien: `import` con una variable suelta deja que cualquier
 * texto de la dirección pida un archivo del paquete.
 */
export async function cargarIdioma(code) {
  if (bajados.has(code) || !existe(code)) return;

  const m = await import(/* webpackChunkName: "idioma-[request]" */ `./locales/${code}.js`);
  i18n.setLocaleMessage(code, m.default);
  bajados.add(code);
}

/**
 * Cambia el idioma de todo el sitio.
 *
 * Además de los textos cambia el `lang` del documento, que es lo que usan
 * el lector de pantalla para elegir la voz y el navegador para partir las
 * palabras al final del renglón.
 */
export async function cambiarIdioma(code) {
  if (!existe(code)) return i18n.locale;
  await cargarIdioma(code);
  i18n.locale = code;
  recordarIdioma(code);
  if (typeof document !== "undefined") document.documentElement.setAttribute("lang", code);
  return code;
}

/* Al arrancar, dejar el documento diciendo la verdad sobre su idioma. */
if (typeof document !== "undefined") {
  document.documentElement.setAttribute("lang", i18n.locale);
}

/**
 * El texto de un error del servidor.
 *
 * El servidor manda un CODIGO y los datos aparte (ver
 * backend/utils/errors.js). Acá se arma la frase en el idioma de quien
 * mira. Si llega un código que todavía no tiene traducción, se usa el
 * texto en inglés que vino en la respuesta: feo, pero mucho mejor que un
 * cartel vacío.
 */
export function textoDeError(respuesta) {
  const code = respuesta && respuesta.code;
  const datos = (respuesta && respuesta.data) || {};
  const clave = "error." + code;

  if (code && i18n.te(clave)) return i18n.t(clave, datos);
  return (respuesta && respuesta.message) || i18n.t("error.SOMETHING_WENT_WRONG");
}

export { IDIOMAS, IDIOMA_POR_DEFECTO };
export default i18n;
