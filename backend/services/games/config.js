/**
 * EL MARGEN DE LA CASA DE CADA JUEGO.
 *
 * Una sola fuente. Los números son los que corren hoy en BetSweeps, y
 * son los que dice la pantalla de cada juego: cambiar uno acá cambia
 * lo que se paga, así que no hay forma de que la etiqueta mienta.
 *
 * DOS FAMILIAS, DOS MECANICAS
 *
 * MULTIPLICATIVO --dice, mines, towers, keno, plinko--. El pago es la
 * probabilidad justa por (1 - margen). Subir o bajar el margen
 * reescala todos los multiplicadores de forma pareja, y cualquier
 * valor da exactamente ese margen.
 *
 * ESTRUCTURAL --slide, reme, crash--. Ahí el margen no es un
 * parámetro: está horneado en las reglas (la tabla de pagos y la
 * geometría del juego). Para poder moverlo igual, el pago se escala
 * por `(1 - margen) / rtpDeFabrica`. Con el margen de fábrica el
 * factor es exactamente 1 y los multiplicadores quedan idénticos.
 *
 * CRASH ESTA CUANTIZADO
 *
 * Su regla es "una de cada N rondas revienta en 1.00x" con
 * `N = round(100 / margen)`. Como N es entero, solo los divisores de
 * 100 dan el margen pedido al dedo: 4% -> 25 exacto; 3% -> 33, que es
 * 3,03%. `margenEfectivo()` dice el de verdad para que nadie se
 * sorprenda.
 */

/* ── Los de fábrica, los mismos que BetSweeps ──────────────────────── */

const DE_FABRICA = {
  dice: 6,
  mines: 6,
  towers: 6,
  keno: 6,
  plinko: 6,

  /*
    Slide: tres colores con su chance y su pago. Lo que sale de esa
    tabla es 93,333% de retorno, o sea 6,667 de margen.
  */
  slide: 100 * (1 - 14 / 15),

  /*
    Reme: dos ruedas y la regla del 0. Lo que sale de las reglas es
    97,297% de retorno, o sea 2,703 de margen.
  */
  reme: 100 * (1 - 36 / 37),

  crash: 4,
};

/* El retorno que da cada juego estructural con sus reglas de fábrica. */
const RTP_DE_FABRICA = {
  slide: 14 / 15,
  reme: 36 / 37,
};

const JUEGOS = Object.keys(DE_FABRICA);

/*
  LOS LIMITES DE APUESTA DE FABRICA.

  El documento de perillas de un sitio que ya estaba andando es mas
  viejo que este campo, asi que llega sin `juegos`. Con un `|| 0` eso
  quedaba en "sin tope", que no es lo que dice el esquema ni lo que
  nadie eligio: es un campo que todavia no existe. Los valores viven
  aca y los usan el servicio y la ruta, que son los dos lugares que
  los necesitan.
*/
const LIMITES_DE_FABRICA = { minimaSc: 0.1, maximaSc: 500, premioSc: 10000 };

/** El minimo y el maximo que valen hoy. */
function limites(cfg = {}) {
  const j = (cfg && cfg.juegos) || {};
  const min = Number(j.apuestaMinimaSc);
  const max = Number(j.apuestaMaximaSc);
  const premio = Number(j.maximoPremioSc);
  return {
    minimaSc: Number.isFinite(min) && min > 0 ? min : LIMITES_DE_FABRICA.minimaSc,
    /* Cero SI es una eleccion valida aca: quiere decir sin tope. */
    maximaSc: Number.isFinite(max) && max >= 0 ? max : LIMITES_DE_FABRICA.maximaSc,
    premioSc: Number.isFinite(premio) && premio >= 0 ? premio : LIMITES_DE_FABRICA.premioSc,
  };
}

/**
 * ACOTA UN PAGO AL MAXIMO DE LA CASA.
 *
 * Devuelve el multiplicador y el pago ya recortados. Se aplica en UN
 * solo lugar --`services/games/index.js`-- para que ningun juego
 * pueda saltearselo por olvido.
 *
 * El multiplicador que se devuelve es el que de verdad se pago, no el
 * que salio: si se guardara el otro, el libro diria una cosa y la
 * plata otra.
 */
function acotarPago(apuestaSc, pagoSc, cfg) {
  const tope = limites(cfg).premioSc;
  if (!(tope > 0) || !(pagoSc > tope)) return { pagoSc, recortado: false };

  return {
    pagoSc: tope,
    multiplicador: apuestaSc > 0 ? Math.round((tope / apuestaSc) * 10000) / 10000 : 0,
    recortado: true,
  };
}

/**
 * El margen de un juego, en porcentaje.
 *
 * `cfg` son las perillas del sitio. Vacío quiere decir "el de
 * fábrica": una perilla sin tocar no tiene por qué cambiar nada.
 */
function margen(juego, cfg = {}) {
  const puesto = (((cfg && cfg.juegos) || {}).margenes || {})[juego];

  /*
    VACIO NO ES CERO.

    El campo nace en `null` --"nadie lo toco"-- y `Number(null)` es 0,
    que es un margen válido y además el peor posible: la casa paga el
    100% y pierde en cada ronda. Con los valores de fábrica puestos
    en la base como `null`, TODOS los juegos habrían arrancado sin
    margen. Lo agarró la prueba del 94%, que daba 2.00x donde tenía
    que dar 1.88x.

    Así que primero se descarta lo que no es un número escrito a
    propósito, y recién después se convierte.
  */
  if (puesto === null || puesto === undefined || puesto === "") return DE_FABRICA[juego];

  const n = Number(puesto);

  /*
    Entre 0 y 50. Un margen negativo sería pagarle al jugador por
    jugar, y uno de 90 es un juego que nadie vuelve a tocar: las dos
    cosas son errores de tipeo, no decisiones.
  */
  if (Number.isFinite(n) && n >= 0 && n <= 50) return n;
  return DE_FABRICA[juego];
}

/** Lo que se multiplica el pago justo. */
function factor(juego, cfg) {
  return 1 - margen(juego, cfg) / 100;
}

/**
 * La escala de los juegos estructurales.
 *
 * Con el margen de fábrica da exactamente 1 y los multiplicadores
 * quedan como están dibujados.
 */
function escala(juego, cfg) {
  const base = RTP_DE_FABRICA[juego];
  if (!base) return 1;
  return factor(juego, cfg) / base;
}

/** Una de cada cuántas rondas de Crash revienta al toque. */
function crashMod(cfg) {
  return Math.max(2, Math.round(100 / Math.max(margen("crash", cfg), 0.01)));
}

/** El margen que de verdad queda en Crash, ya cuantizado. */
function margenEfectivo(juego, cfg) {
  if (juego !== "crash") return margen(juego, cfg);
  return 100 / crashMod(cfg);
}

module.exports = {
  JUEGOS,
  LIMITES_DE_FABRICA,
  limites,
  acotarPago,
  DE_FABRICA,
  RTP_DE_FABRICA,
  margen,
  factor,
  escala,
  crashMod,
  margenEfectivo,
};
