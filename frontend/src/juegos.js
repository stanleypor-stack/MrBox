/**
 * LOS OCHO JUEGOS, PARA LA PANTALLA.
 *
 * El nombre, el icono y el orden, que son del diseño. El retorno NO
 * está acá: lo trae el servidor en `GET /games`, porque es el número
 * con el que paga y no puede haber dos versiones.
 *
 * El mismo listado lo usan la pantalla de juegos y la barra lateral,
 * así que el orden y los nombres no se pueden ir separando.
 */
export const JUEGOS = [
  { id: "dice", nombre: "Dice", icono: "/img/juegos/ic-dice.svg" },
  { id: "crash", nombre: "Crash", icono: "/img/juegos/ic-crash.svg" },
  { id: "slide", nombre: "Slide", icono: "/img/juegos/ic-slide.svg" },
  { id: "keno", nombre: "Keno", icono: "/img/juegos/ic-keno.svg" },
  { id: "reme", nombre: "Reme", icono: "/img/juegos/ic-reme.svg" },
  { id: "mines", nombre: "Mines", icono: "/img/juegos/ic-mines.svg" },
  { id: "towers", nombre: "Dragon's Tower", icono: "/img/juegos/ic-towers.svg" },
  { id: "plinko", nombre: "Plinko", icono: "/img/juegos/ic-plinko.svg" },
];

/** Los que ya se pueden jugar. Los demás muestran "pronto". */
export const LISTOS = ["dice"];

export default JUEGOS;
