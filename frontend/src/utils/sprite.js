/**
 * LAS FOTOS DE LOS OBJETOS Y DE LAS CAJAS.
 *
 * El backend manda `sprite:<lamina>:<posicion>` en vez de una dirección
 * de imagen. La posición es la del casillero dentro de la grilla que
 * entregó el diseño.
 *
 * LOS OBJETOS YA NO SALEN DE UNA LAMINA
 *
 * Salían: 1.712 objetos en un archivo de 4 MB con casilleros de 96 px.
 * Dos problemas. Uno, ese archivo lo bajaba entero cualquier pantalla
 * que mostrara un solo objeto. Dos, 96 px estirados a los 140 px de la
 * página de una caja --y por 3 en la pantalla de un celular-- se ven
 * borrosos.
 *
 * Ahora cada objeto es un archivo de 192 px (scripts/cortarObjetos.py),
 * y la posición del casillero dice cuál. La página de una caja baja los
 * treinta y pico que muestra, no los mil setecientos.
 *
 * Las cajas, las carreras y el feed siguen en láminas: son pocas, las
 * láminas pesan poco y se dibujan chicas (ver styles/_sprites.scss).
 *
 * Si llega una dirección normal --una foto subida a mano desde el
 * panel-- devuelve `null`, y la pantalla dibuja un `<img>` común.
 */

/* La grilla de los objetos, la misma que usó el script al cortarlos. */
const COLUMNAS = 42;
const FILAS = 41;

export function esSprite(imageUrl) {
  return typeof imageUrl === "string" && imageUrl.startsWith("sprite:");
}

/** De "60.9756% 0.0000%" al archivo de ese objeto. */
function archivoDeObjeto(posicion) {
  const partes = posicion.split(/\s+/);
  if (partes.length < 2) return "";

  const x = parseFloat(partes[0]);
  const y = parseFloat(partes[1]);
  if (!isFinite(x) || !isFinite(y)) return "";

  const columna = Math.round((x * (COLUMNAS - 1)) / 100);
  const fila = Math.round((y * (FILAS - 1)) / 100);

  return `/img/prod/${columna}-${fila}.webp`;
}

/**
 * @returns {{ clase: string, estilo: object } | null}
 */
export function sprite(imageUrl) {
  if (!esSprite(imageUrl)) return null;

  const partes = imageUrl.split(":");
  const lamina = partes[1];
  /* La posición trae un espacio en el medio ("50% 25%") y nunca dos
     puntos, pero se vuelve a unir por las dudas. */
  const posicion = partes.slice(2).join(":");
  if (!lamina || !posicion) return null;

  if (lamina === "prod") {
    const archivo = archivoDeObjeto(posicion);
    if (!archivo) return null;
    return { clase: "mb-prod", estilo: { backgroundImage: `url("${archivo}")` } };
  }

  return { clase: "mb-" + lamina, estilo: { backgroundPosition: posicion } };
}
