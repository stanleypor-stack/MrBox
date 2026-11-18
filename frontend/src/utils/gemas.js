/**
 * LOS COLORES DE LAS NUEVE GEMAS.
 *
 * Una por rango, en orden, con las cuatro caras del dibujo: la clara,
 * la media, la oscura y el contorno. Vive acá y no adentro de una
 * pantalla porque la gema sale en el Club VIP, en la ficha del jugador
 * y en la pantalla de rangos del panel: tres lugares que tienen que
 * mostrar la MISMA piedra para el mismo rango.
 */
export const GEMAS = [
  ["#ffd2a6", "#e0954f", "#a65f28", "#5e3414"],
  ["#ffffff", "#d3dae6", "#97a4ba", "#4f5b70"],
  ["#fff3a6", "#ffd04a", "#dc9c1c", "#7a4c06"],
  ["#b9dbff", "#5b98ff", "#2058d0", "#0e2b70"],
  ["#b4ffe0", "#3ddca0", "#11a171", "#06513a"],
  ["#ffc0cc", "#ff5574", "#cc2747", "#6a0a1d"],
  ["#ffffff", "#c6f3ff", "#6acdf4", "#1f6f9c"],
  ["#a9b1c2", "#646d82", "#30353f", "#0d0f14"],
  ["#ffe6fb", "#d2bdff", "#9270ff", "#4a2fb0"],
];

/** La gema del rango número `n` (1 a 9). La última si se pasa. */
export function gemaDe(n) {
  const i = Math.max(0, Math.min(GEMAS.length - 1, (Number(n) || 1) - 1));
  return GEMAS[i];
}
