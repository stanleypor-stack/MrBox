const Box = require("../../database/models/Box");
const Settings = require("../../database/models/Settings");

/**
 * EL VOLUMEN DE LA CINTA DE LIVE PULLS.
 *
 * QUE ES ESTO Y POR QUE EXISTE
 *
 * La cinta de la portada muestra lo que se está ganando en el sitio. Con
 * cuatro aperturas de verdad por hora, la cinta está quieta y el sitio
 * parece vacío; con la cinta quieta nadie abre una caja, y así sigue.
 *
 * Esto llena esa cinta --y solo esa cinta-- con aperturas de relleno,
 * como en el prototipo: una por segundo, y el 85% de las veces de un
 * premio barato, que es lo que de verdad sale casi siempre.
 *
 * DONDE EMPIEZA Y DONDE TERMINA
 *
 * - NO toca la base: vive en memoria y se pierde al reiniciar.
 * - NO escribe un BoxOpen, ni un movimiento, ni un inventario.
 * - NO entra en ningún número del panel: el tablero, las carreras y el
 *   retorno real salen del libro, y en el libro esto no existe.
 * - NO le da un premio a nadie: los nombres son inventados.
 *
 * Se apaga desde el panel (`pulls.relleno`). El día que haya aperturas
 * de verdad, se apaga y la cinta sigue andando sola.
 */

/* Cada cuánto se vuelve a mirar el catálogo. */
const CADA_CUANTO_MS = 5 * 60 * 1000;

/* Lo más viejo que se guarda. La portada pide 24. */
const CUANTAS_GUARDA = 80;

let cache = { cuando: 0, cajas: [] };
let hechas = [];
let ultima = 0;
let contador = 0;

/* ── Los nombres ───────────────────────────────────────────────────── */

const PARTES_A = [
  "kay", "funk", "whal", "almond", "brok", "lunar", "sabre", "nova", "pixel", "rust",
  "crim", "mango", "tiber", "orbit", "quartz", "vandal", "zephyr", "cobalt", "drift", "ember",
  "frost", "glint", "harbor", "indigo", "jolt", "karma", "lumen", "mirage", "nimbus", "onyx",
];
const PARTES_B = [
  "lope", "master", "er", "y", "halo", "wave", "tooth", "byte", "storm", "fox",
  "hawk", "rider", "smith", "walker", "king", "ghost", "panda", "viper", "cloud", "bolt",
];

/**
 * Un nombre de relleno, siempre el mismo para el mismo número.
 *
 * Que sea estable importa: si cambiara en cada pedido, el mismo pull
 * tendría dos dueños distintos en dos pantallas.
 */
function nombreDe(n) {
  /* Dos saltos distintos para que no salgan diez seguidos terminados
     igual: con un solo contador, "…king" aparecia cinco veces en una
     pantalla de veinticuatro. */
  const a = PARTES_A[(n * 7) % PARTES_A.length];
  const b = PARTES_B[(n * 3 + Math.floor(n / 5)) % PARTES_B.length];
  const cola = n % 3 === 0 ? String((n % 90) + 2) : "";
  return a + b + cola;
}

/* ── El catálogo ───────────────────────────────────────────────────── */

async function catalogo() {
  if (Date.now() - cache.cuando < CADA_CUANTO_MS && cache.cajas.length) return cache.cajas;

  const cajas = await Box.find({ live: true, creator: null })
    .select("name slug prizes")
    .lean();

  cache = {
    cuando: Date.now(),
    cajas: cajas
      .map((c) => ({
        name: c.name,
        slug: c.slug,
        premios: (c.prizes || [])
          .filter((p) => p.name && p.imageUrl)
          .map((p) => ({
            name: p.name,
            valueSc: p.valueSc,
            rarity: p.rarity || "blue",
            imageUrl: p.imageUrl,
            chance: p.chance || 0,
          })),
      }))
      .filter((c) => c.premios.length),
  };

  return cache.cajas;
}

/** Uno de la lista, sorteado por su chance; si no hay chances, parejo. */
function sortear(premios) {
  const total = premios.reduce((a, p) => a + p.chance, 0);
  if (total <= 0) return premios[Math.floor(Math.random() * premios.length)];

  let r = Math.random() * total;
  for (const p of premios) {
    r -= p.chance;
    if (r <= 0) return p;
  }
  return premios[premios.length - 1];
}

/* ── El relleno ────────────────────────────────────────────────────── */

/**
 * Pone la cinta al día.
 *
 * Genera las que faltan desde la última vez, una cada `cadaMs`. No usa
 * un `setInterval` a propósito: un timer que corre para siempre sigue
 * generando a las cuatro de la mañana sin nadie mirando, y con dos
 * procesos genera el doble.
 */
async function alDia(cfg) {
  const ahora = Date.now();
  const cadaMs = Math.max(250, 60000 / Math.max(1, cfg.porMinuto));

  if (!ultima) ultima = ahora - cadaMs * CUANTAS_GUARDA;
  if (ahora - ultima < cadaMs) return;

  const cajas = await catalogo();
  if (!cajas.length) return;

  /* Si el proceso estuvo dormido, no se generan mil de golpe. */
  const cuantas = Math.min(CUANTAS_GUARDA, Math.floor((ahora - ultima) / cadaMs));
  const nuevas = [];

  for (let i = 0; i < cuantas; i += 1) {
    const caja = cajas[Math.floor(Math.random() * cajas.length)];

    /* El 85% de las veces, uno barato: es lo que sale de verdad. */
    const baratos = caja.premios.filter((p) => p.valueSc <= cfg.topeSc);
    const lista = baratos.length && Math.random() < cfg.baratosPct ? baratos : caja.premios;
    const premio = sortear(lista);

    contador += 1;
    ultima += cadaMs;

    nuevas.push({
      _id: "v" + contador,
      username: nombreDe(contador * 13 + (contador % 5)),
      avatarUrl: "",
      boxName: caja.name,
      boxSlug: caja.slug,
      premio: {
        name: premio.name,
        valueSc: premio.valueSc,
        rarity: premio.rarity,
        imageUrl: premio.imageUrl,
      },
      createdAt: new Date(ultima),
    });
  }

  hechas = nuevas.reverse().concat(hechas).slice(0, CUANTAS_GUARDA);
}

/** Lo que el panel puede cambiar, con sus valores por defecto. */
async function config() {
  const s = await Settings.leer();
  const p = (s && s.pulls) || {};
  return {
    relleno: p.relleno !== false,
    porMinuto: p.porMinuto || 60,
    baratosPct: (p.baratosPct == null ? 85 : p.baratosPct) / 100,
    topeSc: p.topeSc || 10,
  };
}

/**
 * Las de relleno, de la más nueva a la más vieja.
 *
 * Devuelve `[]` si el dueño lo apagó, y la cinta queda con lo de verdad.
 */
async function ambiente(limite) {
  const cfg = await config();
  if (!cfg.relleno) return [];

  await alDia(cfg);
  return hechas.slice(0, limite);
}

/** Para los tests y para el panel: cuántas hay en memoria. */
function cuantas() { return hechas.length; }

module.exports = { ambiente, cuantas, nombreDe, config };
