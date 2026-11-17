import Vue from "vue";
import VueI18n from "vue-i18n";

import { IDIOMAS, IDIOMA_POR_DEFECTO, idiomaInicial, recordarIdioma, existe } from "./idiomas";

import en from "./locales/en";
import de from "./locales/de";
import fr from "./locales/fr";
import es from "./locales/es";
import pt from "./locales/pt";
import it from "./locales/it";
import ru from "./locales/ru";
import ja from "./locales/ja";
import zh from "./locales/zh";

/**
 * LOS IDIOMAS, ENCHUFADOS.
 *
 * Los nueve van en el paquete principal en vez de cargarse por separado.
 * Es a propósito: los nueve juntos son unos pocos kilobytes, y cargarlos
 * aparte significa que el que entra en japonés ve el sitio en inglés
 * durante medio segundo hasta que llega su archivo. Ese parpadeo se nota
 * mucho más que los kilobytes.
 *
 * El día que los textos crezcan de verdad —cuando estén las treinta y
 * seis pantallas— esto se parte por idioma. Hoy no.
 */

Vue.use(VueI18n);

const messages = { en, de, fr, es, pt, it, ru, ja, zh };

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
 * Cambia el idioma de todo el sitio.
 *
 * Además de los textos cambia el `lang` del documento, que es lo que usan
 * el lector de pantalla para elegir la voz y el navegador para partir las
 * palabras al final del renglón.
 */
export function cambiarIdioma(code) {
  if (!existe(code)) return i18n.locale;
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
