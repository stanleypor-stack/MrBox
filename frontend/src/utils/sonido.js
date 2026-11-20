/**
 * LOS SONIDOS, LOS DEL PROTOTIPO.
 *
 * Tres: el tic de la cinta mientras pasa cada objeto, el acorde de
 * premio y el bajón de cuando no salió. Son los mismos números que el
 * prototipo --frecuencia, duración, forma de onda y volumen-- porque
 * un tic de 1.400 Hz y uno de 900 Hz son dos juegos distintos.
 *
 * SINTETIZADOS, NO BAJADOS
 *
 * No hay archivos de audio: son unos bytes de código contra unos
 * cientos de kilobytes. En un teléfono con mala señal, el sonido de
 * abrir una caja no puede estar esperando una descarga.
 *
 * EL NAVEGADOR NO DEJA SONAR SOLO
 *
 * El contexto de audio arranca "suspendido" hasta que la persona toca
 * algo. Por eso `despertar()` se llama desde el click de abrir: ahí sí
 * deja, y de ahí en más el resto suena.
 */

let ac = null;
let mudo = false;

/** El contexto, creado la primera vez que de verdad hace falta. */
function contexto() {
  if (!ac) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    } catch {
      return null;
    }
  }

  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}

/** Se llama desde un click: es lo que destraba el audio del navegador. */
export function despertar() { contexto(); }

export function silenciar(valor) { mudo = !!valor; }
export function estaMudo() { return mudo; }

/**
 * Una nota.
 *
 * @param {number} f      frecuencia en Hz
 * @param {number} d      cuánto dura, en segundos
 * @param {string} tipo   square, triangle, sine, sawtooth
 * @param {number} vol    0 a 1
 * @param {number} demora segundos a esperar antes de sonar
 */
export function nota(f, d, tipo = "square", vol = 0.04, demora = 0) {
  const c = contexto();
  if (!c || mudo) return;

  const t = c.currentTime + demora;
  const o = c.createOscillator();
  const g = c.createGain();

  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(vol, t);
  /* La caída exponencial es lo que lo hace sonar a juego y no a
     zumbido: un corte seco hace "clac". */
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);

  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + d + 0.02);
}

/**
 * EL TIC DE LA CINTA.
 *
 * Mira de verdad dónde está la tira --lee su `transform` en cada
 * cuadro-- y suena cada vez que pasa un objeto. Por eso los tics se
 * van separando solos cuando la cinta frena: no están programados a
 * intervalos, siguen el movimiento.
 *
 * @param {Element} tira    el elemento que se mueve
 * @param {number}  ms      cuánto dura la tirada
 * @param {number}  paso    cada cuántos píxeles hay un objeto
 */
export function ticsDeLaCinta(tira, ms, paso = 132, eje = "x") {
  if (!tira || mudo) return;

  const desde = Date.now();
  let ultimo = null;

  /* La matriz es `matrix(a, b, c, d, tx, ty)`: el 5to valor es el
     corrimiento en X y el 6to en Y. Con varias cajas la cinta se mueve
     en Y, asi que hay que leer el otro. */
  const cual = eje === "y" ? 5 : 4;

  const cuadro = () => {
    const m = getComputedStyle(tira).transform;
    let x = 0;
    if (m && m !== "none") {
      const v = m.match(/matrix\(([^)]+)\)/);
      if (v) x = parseFloat(v[1].split(",")[cual]);
    }

    const i = Math.floor(-x / paso);
    if (ultimo !== null && i !== ultimo) nota(1400, 0.035, "triangle", 0.05);
    ultimo = i;

    if (Date.now() - desde < ms) window.requestAnimationFrame(cuadro);
  };

  window.requestAnimationFrame(cuadro);
}

/**
 * EL ACORDE DE PREMIO.
 *
 * Cuatro notas que suben. Si lo que salió es de las dos rarezas de
 * arriba, agrega dos más: el oído entiende que fue grande antes de
 * leer el nombre.
 */
export function sonarPremio(rareza) {
  const grande = rareza === "gold" || rareza === "red";
  [523, 659, 784, grande ? 1047 : 988].forEach((f, i) => {
    nota(f, 0.22, "sine", 0.07, i * 0.09);
  });

  if (grande) [1319, 1568].forEach((f, i) => nota(f, 0.3, "triangle", 0.05, 0.4 + i * 0.1));
}

/** Dos notas que bajan: no salió. */
export function sonarFallo() {
  [330, 262].forEach((f, i) => nota(f, 0.22, "sawtooth", 0.035, i * 0.14));
}

/** El tic de la rueda de Deals, que gira en grados y no en píxeles. */
export function ticsDeLaRueda(ms, desdeGrados, hastaGrados) {
  if (mudo) return;

  const t0 = Date.now();
  let ultimo = Math.floor(desdeGrados / 15);

  const cuadro = () => {
    const p = Math.min(1, (Date.now() - t0) / ms);
    /* La misma curva que la animación: si no, los tics se adelantan. */
    const e = 1 - (1 - p) ** 3.2;
    const a = desdeGrados + (hastaGrados - desdeGrados) * e;
    const n = Math.floor(a / 15);

    if (n !== ultimo) { ultimo = n; nota(1300, 0.025, "triangle", 0.035); }
    if (p < 1) window.requestAnimationFrame(cuadro);
  };

  window.requestAnimationFrame(cuadro);
}
