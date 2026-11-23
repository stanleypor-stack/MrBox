/**
 * LOS SONIDOS DE LOS JUEGOS.
 *
 * Son los mismos archivos que usa BetSweeps, que es de donde sale la
 * lógica de los ocho juegos. El prototipo dejó el gancho puesto
 * --`gxSnd('win')`-- pero nunca le colgó ningún archivo, así que los
 * juegos salieron mudos.
 *
 * VIVEN EN `public`, NO EN EL PAQUETE
 *
 * Así no entran al bundle: el navegador los pide la primera vez que
 * suenan y después los tiene en su caché. Un jugador que nunca abre
 * un juego no se baja un solo byte de audio.
 *
 * EL NAVEGADOR PUEDE DECIR QUE NO
 *
 * Hasta que la persona no toca la pantalla, el navegador bloquea el
 * audio --y en el teléfono es más estricto todavía--. Por eso cada
 * reproducción va en su try y su `.catch()`: que no suene es un
 * detalle, que reviente la jugada por no poder sonar sería un error.
 *
 * SE PUEDE APAGAR, Y SE ACUERDA
 *
 * El botón del pie de los juegos lo prende y lo apaga, y queda
 * guardado en el navegador: el que lo apagó una vez no tiene que
 * apagarlo en cada partida.
 */

const ARCHIVOS = {
  tick: "tick.mp3",
  win: "win.mp3",
  lose: "lose.mp3",
  cash: "cash.mp3",
  roll: "roll.mp3",
  pop: "pop.mp3",
  boom: "explosion.mp3",
  gema: "minesReveal.mp3",
  plinko: "plinko1.mp3",
  rueda: "remeRoll.wav",
};

const LLAVE = "mrbox:sonido";
const VOLUMEN = 0.35;

/* Un Audio por sonido, cargado la primera vez que hace falta. */
const cargados = {};

function leerPreferencia() {
  try {
    return window.localStorage.getItem(LLAVE) !== "0";
  } catch {
    /* Navegación privada con el almacenamiento trabado. */
    return true;
  }
}

let encendido = leerPreferencia();

export function sonidoEncendido() {
  return encendido;
}

export function prenderSonido(valor) {
  encendido = !!valor;
  try {
    window.localStorage.setItem(LLAVE, encendido ? "1" : "0");
  } catch { /* sin almacenamiento: vale para esta sesión y listo */ }
  return encendido;
}

/**
 * SUENA UNA VEZ.
 *
 * Se clona el audio en vez de rebobinar el mismo: en Plinko caen
 * varias bolitas juntas y con uno solo la segunda corta a la primera.
 */
export function sonar(nombre) {
  if (!encendido) return;

  const archivo = ARCHIVOS[nombre];
  if (!archivo) return;

  try {
    if (!cargados[nombre]) {
      cargados[nombre] = new Audio(`/sonidos/${archivo}`);
      cargados[nombre].preload = "auto";
    }
    const a = cargados[nombre].cloneNode();
    a.volume = VOLUMEN;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch { /* el navegador no quiso: no es asunto del juego */ }
}

export default { sonar, sonidoEncendido, prenderSonido };
