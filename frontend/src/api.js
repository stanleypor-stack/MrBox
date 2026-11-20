import axios from "axios";
import { textoDeError } from "@/i18n";

/**
 * LA PUERTA AL SERVIDOR.
 *
 * Todo pedido sale de acá. Dos cosas que hace por todos:
 *
 *   1. PONE EL TOKEN. Si no estuviera centralizado, cada pantalla
 *      tendría que acordarse, y la que se olvide falla sola y tarde.
 *
 *   2. TRADUCE EL ERROR. El servidor manda un código, no una frase (ver
 *      backend/utils/errors.js). Acá se convierte en texto del idioma de
 *      quien mira, UNA vez, así ninguna pantalla arma mensajes a mano.
 */

const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
});

const LLAVE = "mrbox:token";

export function guardarToken(token) {
  try {
    if (token) window.localStorage.setItem(LLAVE, token);
    else window.localStorage.removeItem(LLAVE);
  } catch {
    /* Navegación privada: la sesión dura lo que dure la pestaña, que es
       molesto pero no roto. */
  }
}

export function leerToken() {
  try {
    return window.localStorage.getItem(LLAVE) || null;
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = leerToken();
  if (token) config.headers["x-auth-token"] = token;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const respuesta = error.response && error.response.data;

    /*
      La sesión se venció o la cuenta se cerró: se limpia el token acá y
      no en cada pantalla. Si no, el sitio sigue mandando un token muerto
      en cada pedido y todo falla raro en vez de pedir que entre de nuevo.
    */
    const code = respuesta && respuesta.code;
    if (code === "SESSION_EXPIRED" || code === "ACCOUNT_BANNED") guardarToken(null);

    /* El texto ya traducido, para que la pantalla solo tenga que
       mostrarlo. El código viaja igual por si alguien quiere reaccionar
       distinto según cuál sea. */
    error.textoParaElJugador = respuesta
      ? textoDeError(respuesta)
      : textoDeError({ code: "SOMETHING_WENT_WRONG" });
    error.code = code || "SOMETHING_WENT_WRONG";
    /* Y lo que el servidor haya mandado con el error: a veces trae el
       dato que la pantalla necesita para corregirse sola, como cuantas
       pruebas gratis quedan de verdad. */
    error.datos = (respuesta && respuesta.data) || null;

    return Promise.reject(error);
  }
);

export default api;
