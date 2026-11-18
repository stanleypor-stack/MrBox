/**
 * EL CLUB VIP Y EL RAKEBACK.
 *
 * Nueve rangos. Se sube jugando y no gastando, y el rango que se
 * alcanza no se pierde nunca: ni dejando de jugar seis meses.
 *
 * QUE ES EL RAKEBACK
 *
 * Una parte de lo que jugaste, devuelta. La casa se queda con 8 de
 * cada 100 que entran --el otro 92 vuelve en premios-- y de esos 8
 * devuelve entre 0 y 1,2 según el rango. Al que más juega le quedan
 * 6,8 de margen en vez de 8; es lo que cuesta que siga jugando acá.
 *
 * SE ACUMULA SOLO Y SE COBRA EN TRES VENTANAS
 *
 * Diaria, semanal y mensual, como el "Play Boost" del diseño. Cada una
 * se puede cobrar UNA vez por ventana, y lo que se cobra sale de lo
 * jugado en esa ventana.
 *
 * Las tres se superponen a propósito: lo mismo que jugaste suma para
 * la diaria, la semanal y la mensual. No es un error de cuenta, es el
 * diseño: tres recompensas chicas que llegan seguido se sienten mejor
 * que una sola grande que llega una vez al mes. Lo que hay que mirar
 * es la SUMA de los tres porcentajes contra el margen, y eso está
 * probado.
 */

const RakebackClaim = require("../../database/models/RakebackClaim");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const User = require("../../database/models/User");

const wallet = require("../wallet");
const Settings = require("../../database/models/Settings");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

/*
  LOS NUEVE RANGOS DEL DISEÑO.

  `desde` es lo jugado en SC que hace falta. `rakeback` son los tres
  porcentajes --diario, semanal, mensual-- sobre lo jugado en cada
  ventana.

  La suma de los tres nunca pasa de 1,2%, contra un margen de 8%. Eso
  se prueba, porque el día que alguien suba un número de acá sin mirar
  los otros dos, el sitio empieza a perder plata en silencio.
*/
const RANGOS = [
  { nombre: "Bronze", desde: 0, color: "#8a5a2b", rakeback: { daily: 0, weekly: 0, monthly: 0 } },
  { nombre: "Silver", desde: 25000, color: "#6f7f96", rakeback: { daily: 0.0002, weekly: 0.0004, monthly: 0.0004 } },
  { nombre: "Gold", desde: 50000, color: "#b8862a", rakeback: { daily: 0.0004, weekly: 0.0008, monthly: 0.0008 } },
  { nombre: "Sapphire", desde: 75000, color: "#1f56c9", rakeback: { daily: 0.0006, weekly: 0.0012, monthly: 0.0012 } },
  { nombre: "Emerald", desde: 100000, color: "#16936d", rakeback: { daily: 0.0008, weekly: 0.0016, monthly: 0.0016 } },
  { nombre: "Ruby", desde: 250000, color: "#c42a45", rakeback: { daily: 0.001, weekly: 0.002, monthly: 0.002 } },
  { nombre: "Diamond", desde: 500000, color: "#2a9fd6", rakeback: { daily: 0.0014, weekly: 0.0028, monthly: 0.0028 } },
  { nombre: "Onyx", desde: 750000, color: "#2b2f3a", rakeback: { daily: 0.0018, weekly: 0.0036, monthly: 0.0036 } },
  { nombre: "Opal", desde: 1500000, color: "#7a5af5", rakeback: { daily: 0.0024, weekly: 0.0048, monthly: 0.0048 } },
];

/*
  LOS SIETE BENEFICIOS, Y DESDE QUE RANGO.

  El numero es cuantos tiene ese rango: Bronze 1, Silver 2, y asi. Es
  como lo dibuja el diseno.
*/
const BENEFICIOS = [
  "levelUpBox", "welcomeBalance", "monthlyBox", "weeklyBox", "rakeback", "vipManager", "reload",
];

const CUANTOS_BENEFICIOS = [1, 2, 3, 4, 4, 5, 6, 7, 7];

const PERIODOS = ["daily", "weekly", "monthly"];

/* Los tipos de movimiento que cuentan como jugar. */
const JUGAR = ["box_open", "deal"];

/*
  LOS DE ARRIBA SON LOS DE FABRICA.

  El panel los puede mover (Settings.rangosVip) y entonces mandan esos.
  Se guardan en memoria un minuto: `rangoDe` se llama en cada apertura
  y cada carrera, y leer las perillas en cada llamada seria un viaje a
  la base por apertura.

  Del panel viene el rakeback SEMANAL; el diario y el mensual salen de
  ahi con la misma proporcion que tienen los de fabrica. Es para que
  nadie tenga que entender tres numeros para mover uno, y para que la
  suma de los tres no se despegue del margen sin que se note.
*/
let enMemoria = { cuando: 0, rangos: RANGOS };

function rangos() {
  if (Date.now() - enMemoria.cuando < 60000) return enMemoria.rangos;

  /* Lectura al vuelo: si todavia no llego, se usa lo ultimo que haya. */
  Settings.leer()
    .then((cfg) => {
      const puestos = (cfg && cfg.rangosVip) || [];
      enMemoria = {
        cuando: Date.now(),
        rangos: puestos.length
          ? puestos.map((r, i) => {
            const base = RANGOS[Math.min(i, RANGOS.length - 1)];
            const semanal = Number(r.rakebackSemanal) || 0;

            /*
              El diario y el mensual usan SU numero si lo tienen. Si no
              --un rango guardado antes de que existiera el campo-- se
              estiran desde el semanal, que es lo que se hacia siempre.
            */
            const proporcion = base.rakeback.weekly > 0 ? semanal / base.rakeback.weekly : 0;
            const propio = (v, deFabrica) => (
              v === null || v === undefined ? Math.round(deFabrica * proporcion * 1e6) / 1e6 : Number(v)
            );

            return {
              nombre: r.nombre,
              desde: r.desde,
              color: r.color || base.color,
              rakeback: {
                daily: propio(r.rakebackDiario, base.rakeback.daily),
                weekly: semanal,
                monthly: propio(r.rakebackMensual, base.rakeback.monthly),
              },
            };
          })
          : RANGOS,
      };
    })
    .catch(() => {});

  return enMemoria.rangos;
}

/**
 * En qué rango cae alguien que jugó tanto.
 *
 * `puesto` es el rango que le pusieron a mano desde el panel --el
 * traslado desde otro sitio-- y manda sobre lo jugado: si lo jugado
 * ya le da mas, gana lo jugado. Nunca se baja a nadie de rango.
 */
function rangoDe(jugadoSc, puesto) {
  const R = rangos();
  const j = Number(jugadoSc) || 0;
  let i = 0;
  for (let k = 0; k < R.length; k += 1) if (j >= R[k].desde) i = k;

  if (puesto) {
    const aMano = R.findIndex((r) => r.nombre === puesto);
    if (aMano > i) i = aMano;
  }
  const siguiente = R[Math.min(i + 1, R.length - 1)];
  const esElUltimo = i === R.length - 1;

  const desde = R[i].desde;
  const hasta = siguiente.desde;
  const pct = esElUltimo || hasta <= desde ? 100 : ((j - desde) / (hasta - desde)) * 100;

  return {
    ...R[i],
    numero: i + 1,
    cuantosBeneficios: CUANTOS_BENEFICIOS[i],
    siguiente: esElUltimo ? null : siguiente.nombre,
    faltaPara: esElUltimo ? null : hasta,
    progreso: Math.max(0, Math.min(100, Math.round(pct * 10) / 10)),
  };
}

/** La lista entera, para la pantalla del club. */
function tabla() {
  return rangos().map((r, i) => ({
    numero: i + 1,
    nombre: r.nombre,
    desde: r.desde,
    color: r.color,
    rakeback: r.rakeback,
    beneficios: BENEFICIOS.map((b, k) => ({ clave: b, tiene: k < CUANTOS_BENEFICIOS[i] })),
  }));
}

/* ── Las ventanas del rakeback ────────────────────────────────────── */

/** La ventana de un periodo, en UTC. La misma regla que las carreras. */
function ventanaDe(periodo, momento = new Date()) {
  const a = momento.getUTCFullYear();
  const m = momento.getUTCMonth();
  const d = momento.getUTCDate();

  if (periodo === "daily") {
    return { desde: new Date(Date.UTC(a, m, d)), hasta: new Date(Date.UTC(a, m, d + 1)) };
  }
  if (periodo === "weekly") {
    const alLunes = (momento.getUTCDay() + 6) % 7;
    return {
      desde: new Date(Date.UTC(a, m, d - alLunes)),
      hasta: new Date(Date.UTC(a, m, d - alLunes + 7)),
    };
  }
  return { desde: new Date(Date.UTC(a, m, 1)), hasta: new Date(Date.UTC(a, m + 1, 1)) };
}

/** Lo que jugó alguien en una ventana. Del libro, como siempre. */
async function jugadoEn(userId, desde, hasta) {
  const filas = await BalanceTransaction.aggregate([
    {
      $match: {
        user: userId,
        type: { $in: JUGAR },
        createdAt: { $gte: desde, $lt: hasta },
      },
    },
    { $group: { _id: null, total: { $sum: { $abs: "$amountSc" } } } },
  ]);
  return sc(filas.length ? filas[0].total : 0);
}

/**
 * LOS TRES BOTONES DE "PLAY BOOST".
 *
 * Cuánto hay para cobrar en cada ventana, y si ya se cobró.
 */
async function rakebackDe(userId) {
  const usuario = await User.findById(userId).select("jugadoSc").lean();
  if (!usuario) throw errorDe("NOT_LOGGED_IN", {}, 401);

  const rango = rangoDe(usuario.jugadoSc, usuario.rangoManual);
  const ahora = new Date();

  const cobrados = await RakebackClaim.find({ user: userId }).sort({ hasta: -1 }).limit(60).lean();

  const cajas = await Promise.all(PERIODOS.map(async (periodo) => {
    const { desde, hasta } = ventanaDe(periodo, ahora);
    const jugado = await jugadoEn(userId, desde, hasta);
    const pct = rango.rakeback[periodo];
    const monto = sc(jugado * pct);

    const yaCobrado = cobrados.some(
      (c) => c.periodo === periodo && new Date(c.desde).getTime() === desde.getTime()
    );

    return {
      periodo,
      desde,
      hasta,
      jugadoSc: jugado,
      pct,
      montoSc: yaCobrado ? 0 : monto,
      yaCobrado,
      /* Abajo de un centavo no se puede cobrar: una transacción de
         SC 0,00 en el libro no dice nada y ensucia el extracto. */
      sePuedeCobrar: !yaCobrado && monto >= 0.01,
    };
  }));

  const total = await RakebackClaim.aggregate([
    { $match: { user: userId } },
    { $group: { _id: "$periodo", total: { $sum: "$montoSc" } } },
  ]);

  return {
    rango,
    cajas,
    cobradoPorPeriodo: Object.fromEntries(total.map((t) => [t._id, sc(t.total)])),
    cobradoTotalSc: sc(total.reduce((a, t) => a + t.total, 0)),
  };
}

/**
 * COBRAR UNA VENTANA.
 *
 * La fila del cobro se crea PRIMERO, con un índice único por
 * (jugador, periodo, desde). Si dos pedidos llegan juntos, el segundo
 * choca contra el índice y no paga.
 *
 * Al revés --pagar y después anotar-- dos clicks rápidos cobran dos
 * veces, y eso en una pantalla con un botón grande que dice "COBRAR"
 * pasa todos los días.
 */
async function cobrarRakeback({ userId, periodo }) {
  if (!PERIODOS.includes(periodo)) throw errorDe("INVALID_AMOUNT", { campo: "periodo" });

  const usuario = await User.findById(userId).select("jugadoSc").lean();
  if (!usuario) throw errorDe("NOT_LOGGED_IN", {}, 401);

  const rango = rangoDe(usuario.jugadoSc, usuario.rangoManual);
  const pct = rango.rakeback[periodo];
  if (!pct) throw errorDe("RANK_TOO_LOW", { rango: rango.nombre }, 403);

  const { desde, hasta } = ventanaDe(periodo);
  const jugado = await jugadoEn(userId, desde, hasta);
  const monto = sc(jugado * pct);

  if (monto < 0.01) throw errorDe("NOTHING_TO_CLAIM", { periodo });

  let fila;
  try {
    fila = await RakebackClaim.create({
      user: userId, periodo, desde, hasta,
      jugadoSc: jugado, pct, montoSc: monto,
    });
  } catch (err) {
    /* 11000 es "clave duplicada": ya lo cobró. */
    if (err && err.code === 11000) throw errorDe("ALREADY_CLAIMED", { periodo });
    throw err;
  }

  await wallet.mover({
    userId,
    amountSc: monto,
    type: "rakeback",
    reference: { kind: "rakeback", id: fila._id, label: periodo },
  });

  return { periodo, montoSc: monto, ...(await wallet.saldoDe(userId)) };
}

module.exports = {
  RANGOS,
  BENEFICIOS,
  CUANTOS_BENEFICIOS,
  PERIODOS,
  rangoDe,
  tabla,
  ventanaDe,
  jugadoEn,
  rakebackDe,
  cobrarRakeback,
};
