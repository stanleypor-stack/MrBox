/**
 * LAS FOTOS QUE SON UN RECORTE DE UNA LAMINA.
 *
 * El backend manda `sprite:<lamina>:<posicion>` en vez de una dirección
 * de imagen, porque los 1.712 objetos y las 163 cajas viven en tres
 * archivos y no en 1.875 (ver styles/_sprites.scss).
 *
 * Esto lo convierte en la clase y el estilo que hay que ponerle al
 * elemento. Si llega una dirección normal --una foto subida a mano desde
 * el panel-- devuelve `null`, y la pantalla dibuja un `<img>` común.
 */

export function esSprite(imageUrl) {
  return typeof imageUrl === "string" && imageUrl.startsWith("sprite:");
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

  return { clase: "mb-" + lamina, estilo: { backgroundPosition: posicion } };
}
