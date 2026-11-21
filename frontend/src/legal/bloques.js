/**
 * LOS LADRILLOS DE UN TEXTO LEGAL.
 *
 * Cada pagina legal es una lista de bloques y cada bloque dice que
 * es. La pantalla los dibuja; nadie escribe HTML.
 *
 * Por que no HTML: un contrato es texto corrido con titulos y listas,
 * no necesita etiquetas, y abrirle la puerta al HTML en la unica
 * pagina que todo el mundo lee no vale lo que cuesta.
 *
 * Lo escrito «[[asi]]» es una decision que todavia no esta tomada.
 * `scripts/exportarLegales.js` las junta todas y las lista.
 */

/** Un titulo de seccion: "1. Lo que sea". */
export const h = (texto) => ({ t: "h2", texto });

/** Un subtitulo: "A. Lo que sea". */
export const s = (texto) => ({ t: "h3", texto });

/** Un parrafo. */
export const p = (texto) => ({ t: "p", texto });

/** Una lista de puntos. */
export const li = (items) => ({ t: "ul", items });

/** Lo que hay que entender aunque no se lea el resto. */
export const nota = (texto) => ({ t: "nota", texto });

/** Una tabla chica: filas de [que, cuanto]. */
export const tabla = (filas) => ({ t: "tabla", filas });
