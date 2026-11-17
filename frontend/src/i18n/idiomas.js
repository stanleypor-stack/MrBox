/**
 * LOS NUEVE IDIOMAS DE MR BOX.
 *
 * Los del diseño, en el orden del diseño. El orden no es alfabético y
 * está bien: inglés primero porque es el idioma del sitio, y después los
 * mercados por tamaño.
 *
 * LA BANDERA NO ES UN EMOJI
 *
 * Los emoji de bandera no se dibujan en Windows —salen como dos letras
 * sueltas, "ES", "DE"— que es justamente donde está la mitad de los
 * jugadores. Así que cada bandera es un SVG, los mismos que trae el
 * diseño, metidos en el CSS como `data:` para que no haya una consulta
 * de red por bandera.
 *
 * EL IDIOMA NO SE ADIVINA A LA FUERZA
 *
 * Se arranca con lo que dice el navegador, pero en cuanto el jugador
 * elige, manda su elección y se recuerda. Un sitio que te vuelve a poner
 * en alemán cada vez que entrás porque tu sistema está en alemán es un
 * sitio que no te escucha.
 */

export const IDIOMAS = [
  { code: "en", nombre: "English",    bandera: "en" },
  { code: "de", nombre: "Deutsch",    bandera: "de" },
  { code: "fr", nombre: "Français",   bandera: "fr" },
  { code: "es", nombre: "Español",    bandera: "es" },
  { code: "pt", nombre: "Português",  bandera: "pt" },
  { code: "it", nombre: "Italiano",   bandera: "it" },
  { code: "ru", nombre: "Русский",    bandera: "ru" },
  { code: "ja", nombre: "日本語",      bandera: "ja" },
  { code: "zh", nombre: "中文",        bandera: "zh" },
];

export const IDIOMA_POR_DEFECTO = "en";

/** Los códigos que existen, para no andar recorriendo la lista. */
export const CODIGOS = IDIOMAS.map((i) => i.code);

/** Si un código es uno de los nuestros. */
export function existe(code) {
  return CODIGOS.includes(String(code || "").toLowerCase());
}

/**
 * Con qué idioma arrancar.
 *
 * Primero lo que el jugador eligió alguna vez. Si nunca eligió, lo que
 * dice el navegador, quedándose con la parte de adelante: "es-AR" y
 * "es-ES" son los dos español para nosotros. Si no reconocemos nada,
 * inglés.
 */
export function idiomaInicial() {
  try {
    const guardado = window.localStorage.getItem("mrbox:idioma");
    if (existe(guardado)) return guardado.toLowerCase();
  } catch {
    /* Navegación privada o almacenamiento bloqueado: no es un problema,
       se sigue con el del navegador. */
  }

  const delNavegador = (window.navigator.languages || [window.navigator.language || ""])
    .map((l) => String(l).split("-")[0].toLowerCase())
    .find(existe);

  return delNavegador || IDIOMA_POR_DEFECTO;
}

/** Recuerda la elección. Que falle no puede romper el cambio de idioma. */
export function recordarIdioma(code) {
  try {
    window.localStorage.setItem("mrbox:idioma", code);
  } catch {
    /* Ver arriba. */
  }
}
