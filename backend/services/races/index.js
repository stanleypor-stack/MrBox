/**
 * LAS CARRERAS.
 *
 * Tres a la vez: diaria, semanal y mensual. Todo lo que el jugador
 * juega cuenta para las tres al mismo tiempo, y al cerrarse cada una
 * reparte su pozo entre los primeros.
 *
 * LA TABLA SALE DEL LIBRO
 *
 * No hay un contador "lo jugado en esta carrera" por jugador. Se suma
 * de las transacciones de la ventana cada vez que alguien mira.
 *
 * Un contador sería más rápido, sí. También sería un número que hay
 * que reiniciar a mano cada día, cada lunes y cada primero, y que se
 * desincroniza en silencio: el día que falle, la carrera reparte mal y
 * nadie se entera hasta que un jugador reclame el premio que no cobró.
 * El libro no se desincroniza porque es el libro.
 *
 * SE CIERRAN SOLAS, AL MIRARLAS
 *
 * Cuando alguien pide una carrera cuya hora ya pasó, se cierra ahí
 * mismo --se congela la tabla, se pagan los premios-- y se abre la
 * siguiente. No hace falta un proceso aparte corriendo a medianoche, y
 * lo que no corre no se cae a las tres de la mañana de un domingo.
 *
 * El riesgo de esto es que una carrera sin visitas quede abierta de
 * más. Por eso el servidor también las revisa al arrancar y cada hora:
 * lo de arriba es la red, esto es el piso.
 */

const Race = require("../../database/models/Race");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const User = require("../../database/models/User");
const Settings = require("../../database/models/Settings");

const wallet = require("../wallet");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const TIPOS = ["daily", "weekly", "monthly"];

/* Los tipos de movimiento que suman. Los mismos que cuentan como jugar. */
const JUGAR = ["box_open", "deal"];

/*
  EL REPARTO POR DEFECTO.

  Diez puestos. El primero se lleva el 30%: menos que eso y ganar no se
  siente como ganar; mucho más y el que sale quinto deja de intentarlo.
  Suma 100 exacto, y eso se prueba.
*/
const REPARTO = [30, 18, 12, 9, 7, 6, 5, 5, 4, 4];

/* Los pozos del diseño: $2K diaria, $10K semanal, $30K mensual. */
const POZOS = { daily: 2000, weekly: 10000, monthly: 30000 };

/* ── Las ventanas ─────────────────────────────────────────────────── */

/**
 * La ventana en la que cae un momento, en UTC.
 *
 * Todo en UTC y no en la hora del servidor: una carrera que cierra a
 * "medianoche" tiene que cerrar a la misma medianoche para el que juega
 * en Tokio y para el que juega en Buenos Aires. Con la hora local del
 * servidor, mudarlo de región le cambia el horario a todo el mundo.
 */
function ventanaDe(tipo, momento = new Date()) {
  const a = momento.getUTCFullYear();
  const m = momento.getUTCMonth();
  const d = momento.getUTCDate();

  if (tipo === "daily") {
    const desde = new Date(Date.UTC(a, m, d));
    return { desde, hasta: new Date(Date.UTC(a, m, d + 1)) };
  }

  if (tipo === "weekly") {
    /* La semana arranca el lunes. `getUTCDay()` da 0 para domingo. */
    const dia = momento.getUTCDay();
    const alLunes = (dia + 6) % 7;
    const desde = new Date(Date.UTC(a, m, d - alLunes));
    return { desde, hasta: new Date(Date.UTC(a, m, d - alLunes + 7)) };
  }

  const desde = new Date(Date.UTC(a, m, 1));
  return { desde, hasta: new Date(Date.UTC(a, m + 1, 1)) };
}

/* ── La tabla ─────────────────────────────────────────────────────── */

/**
 * Quiénes van ganando, de la ventana que sea.
 *
 * Sale del libro: la suma de lo que salió en aperturas y deals.
 */
async function tablaDe({ desde, hasta, cuantos = 50 }) {
  /*
    SE PIDEN DE MAS A PROPOSITO.

    Despues se sacan los que estan trabados para las carreras, y si se
    hubieran pedido justos, cada uno que sale deja un puesto vacio al
    final de la tabla en vez de correr al que sigue.
  */
  const filas = await BalanceTransaction.aggregate([
    { $match: { type: { $in: JUGAR }, createdAt: { $gte: desde, $lt: hasta } } },
    { $group: { _id: "$user", jugadoSc: { $sum: { $abs: "$amountSc" } } } },
    { $match: { jugadoSc: { $gt: 0 } } },
    { $sort: { jugadoSc: -1, _id: 1 } },
    { $limit: cuantos + 10 },
  ]);

  if (!filas.length) return [];

  const usuarios = await User.find({ _id: { $in: filas.map((f) => f._id) } })
    .select("username trabas banned")
    .lean();
  const quien = new Map(usuarios.map((u) => [String(u._id), u]));

  /*
    FUERA DE LA CARRERA.

    El que tiene la traba puesta, y el que tiene la cuenta cerrada.
    Siguen jugando y su juego sigue contando para todo lo demas --el
    VIP, el margen, el libro-- pero no ocupan un puesto que paga.
  */
  return filas
    .filter((f) => {
      const u = quien.get(String(f._id));
      return u && !u.banned && !(u.trabas && u.trabas.carreras);
    })
    .slice(0, cuantos)
    .map((f, i) => ({
      user: f._id,
      username: (quien.get(String(f._id)) || {}).username || "?",
      puesto: i + 1,
      jugadoSc: sc(f.jugadoSc),
    }));
}

/** Lo que le toca al puesto `n` de un pozo. */
function premioDe(reparto, pozoSc, puesto) {
  const pct = reparto[puesto - 1];
  if (!pct) return 0;
  return sc((pozoSc * pct) / 100);
}

/* ── Abrir y cerrar ───────────────────────────────────────────────── */

/** El pozo configurado para un tipo, o el del diseño. */
async function pozoDe(tipo) {
  const cfg = await Settings.leer();
  const puestos = (cfg.pozosDeCarrera && cfg.pozosDeCarrera[tipo]);
  return sc(Number.isFinite(puestos) ? puestos : POZOS[tipo]);
}

/** Abre la carrera de ese tipo para la ventana que corresponda ahora. */
async function abrir(tipo, momento = new Date()) {
  const { desde, hasta } = ventanaDe(tipo, momento);

  /*
    `findOneAndUpdate` con `upsert` y no "buscar y si no hay, crear":
    dos pedidos al mismo tiempo crearían dos carreras de la misma
    ventana, y a partir de ahí los premios se pagan dos veces.
  */
  return Race.findOneAndUpdate(
    { tipo, desde },
    {
      $setOnInsert: {
        tipo, desde, hasta,
        premioTotalSc: await pozoDe(tipo),
        reparto: REPARTO,
        estado: "live",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

/**
 * Cierra una carrera vencida y paga.
 *
 * El paso que importa es el primero: marcarla `settled` CON la
 * condición de que siguiera `live` adentro del filtro. Si dos pedidos
 * llegan a la vez, uno solo gana el update y es el único que paga. Sin
 * eso, una carrera popular paga dos veces en el segundo en que vence.
 */
async function cerrar(carrera) {
  const tomada = await Race.findOneAndUpdate(
    { _id: carrera._id, estado: "live" },
    { $set: { estado: "settled", cerradaEl: new Date() } },
    { new: true }
  ).lean();

  if (!tomada) return null; // otro la cerró primero

  const tabla = await tablaDe({
    desde: tomada.desde,
    hasta: tomada.hasta,
    cuantos: tomada.reparto.length,
  });

  const ganadores = tabla.map((f) => ({
    ...f,
    premioSc: premioDe(tomada.reparto, tomada.premioTotalSc, f.puesto),
  }));

  await Race.updateOne({ _id: tomada._id }, { $set: { ganadores } });

  /*
    Se paga de a uno y cada uno en su try: que falle pagarle al séptimo
    no puede dejar sin cobrar al octavo. Lo que no se pudo pagar queda
    en el registro, con nombre y monto, para pagarlo a mano.
  */
  for (const g of ganadores) {
    if (g.premioSc <= 0) continue;
    try {
      await wallet.mover({
        userId: g.user,
        amountSc: g.premioSc,
        type: "race_prize",
        reference: { kind: "race", id: tomada._id, label: `${tomada.tipo} #${g.puesto}` },
      });
    } catch (err) {
      logger.error(`[races] premio sin pagar a ${g.username} (${g.premioSc}): ${err.message}`);
    }
  }

  logger.info(`[races] cerrada la ${tomada.tipo} de ${tomada.desde.toISOString().slice(0, 10)}: ${ganadores.length} ganadores`);
  return tomada;
}

/**
 * Cierra todas las vencidas y abre las que falten.
 *
 * Lo llama el servidor al arrancar, cada hora, y cualquiera que mire
 * una carrera.
 */
async function ponerAlDia(momento = new Date()) {
  const vencidas = await Race.find({ estado: "live", hasta: { $lte: momento } }).lean();
  for (const v of vencidas) {
    try {
      await cerrar(v);
    } catch (err) {
      logger.error(`[races] cerrar ${v._id}: ${err.message}`);
    }
  }
  for (const tipo of TIPOS) await abrir(tipo, momento);
}

/* ── Lo que se muestra ────────────────────────────────────────────── */

/**
 * Una carrera, con su tabla y el lugar del que pregunta.
 *
 * @param {object} o
 * @param {string} o.tipo
 * @param {string} [o.userId] para decirle en qué puesto va
 */
async function ver({ tipo, userId }) {
  if (!TIPOS.includes(tipo)) throw errorDe("RACE_NOT_FOUND", {}, 404);

  await ponerAlDia();

  const carrera = await Race.findOne({ tipo, estado: "live" }).sort({ desde: -1 }).lean();
  if (!carrera) throw errorDe("RACE_NOT_FOUND", {}, 404);

  const tabla = await tablaDe({ desde: carrera.desde, hasta: carrera.hasta, cuantos: 50 });

  const filas = tabla.map((f) => ({
    puesto: f.puesto,
    username: f.username,
    jugadoSc: f.jugadoSc,
    premioSc: premioDe(carrera.reparto, carrera.premioTotalSc, f.puesto),
    soyYo: userId ? String(f.user) === String(userId) : false,
  }));

  /*
    Si el que mira no entró en los cincuenta, igual se le dice cuánto
    jugó y en qué puesto va. Un jugador que no se ve en la tabla y no
    tiene un número propio no tiene forma de saber si vale la pena
    seguir, y eso es justo lo que la carrera tiene que contestarle.
  */
  let yo = filas.find((f) => f.soyYo) || null;
  if (!yo && userId) {
    const mio = await BalanceTransaction.aggregate([
      {
        $match: {
          user: userId,
          type: { $in: JUGAR },
          createdAt: { $gte: carrera.desde, $lt: carrera.hasta },
        },
      },
      { $group: { _id: null, jugadoSc: { $sum: { $abs: "$amountSc" } } } },
    ]);

    const jugadoSc = sc(mio.length ? mio[0].jugadoSc : 0);
    if (jugadoSc > 0) {
      const porDelante = await BalanceTransaction.aggregate([
        {
          $match: {
            type: { $in: JUGAR },
            createdAt: { $gte: carrera.desde, $lt: carrera.hasta },
          },
        },
        { $group: { _id: "$user", total: { $sum: { $abs: "$amountSc" } } } },
        { $match: { total: { $gt: jugadoSc } } },
        { $count: "n" },
      ]);
      yo = {
        puesto: (porDelante.length ? porDelante[0].n : 0) + 1,
        jugadoSc,
        premioSc: 0,
        fueraDeLaTabla: true,
      };
    } else {
      yo = { puesto: null, jugadoSc: 0, premioSc: 0, fueraDeLaTabla: true };
    }
  }

  return {
    tipo: carrera.tipo,
    desde: carrera.desde,
    hasta: carrera.hasta,
    premioTotalSc: sc(carrera.premioTotalSc),
    reparto: carrera.reparto,
    filas,
    yo,
  };
}

/** Las tres, resumidas, para el menú de la izquierda. */
async function resumen() {
  await ponerAlDia();
  const vivas = await Race.find({ estado: "live" }).lean();
  return TIPOS.map((tipo) => {
    const c = vivas.find((v) => v.tipo === tipo);
    return {
      tipo,
      premioTotalSc: c ? sc(c.premioTotalSc) : 0,
      hasta: c ? c.hasta : null,
    };
  });
}

/** Las que ya cerraron, para poder mirar atrás. */
async function pasadas({ tipo, cuantas = 10 }) {
  const filtro = { estado: "settled" };
  if (TIPOS.includes(tipo)) filtro.tipo = tipo;

  const filas = await Race.find(filtro).sort({ hasta: -1 }).limit(cuantas).lean();
  return filas.map((c) => ({
    _id: c._id,
    tipo: c.tipo,
    desde: c.desde,
    hasta: c.hasta,
    premioTotalSc: sc(c.premioTotalSc),
    ganadores: (c.ganadores || []).map((g) => ({
      puesto: g.puesto,
      username: g.username,
      jugadoSc: sc(g.jugadoSc),
      premioSc: sc(g.premioSc),
    })),
  }));
}

module.exports = {
  TIPOS,
  REPARTO,
  POZOS,
  ventanaDe,
  tablaDe,
  premioDe,
  abrir,
  cerrar,
  ponerAlDia,
  ver,
  resumen,
  pasadas,
};
