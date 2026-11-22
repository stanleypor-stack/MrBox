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
const VipBeneficio = require("../../database/models/VipBeneficio");
const Box = require("../../database/models/Box");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const User = require("../../database/models/User");

const wallet = require("../wallet");
const Settings = require("../../database/models/Settings");
const { sc } = require("../../utils/money");
const controles = require("../controls");
const cajas = require("../boxes");
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
  /*
    `desde` es el NUMERO de rango en el que se desbloquea: 1 es Bronze,
    2 Silver, y asi.

    Antes esto era una lista de nombres y un arreglo aparte que decia
    "cuantos tiene cada rango", siempre los primeros N. Eso obligaba a
    que el orden del dibujo fuera el orden en que se desbloquean, y por
    eso el rakeback figuraba recien en Ruby cuando los porcentajes de
    `RANGOS` lo pagan DESDE SILVER: la tarjeta prometia menos de lo que
    el servidor ya daba. Con el minimo escrito al lado de cada uno, las
    dos cosas no se pueden separar de nuevo.

    `automatico` dice si lo entrega el sitio solo. Los que no, los da
    una persona desde el panel, y la tarjeta no tiene por que mentir
    sobre eso.
  */
  { clave: "levelUpBox", desde: 1, automatico: true },
  { clave: "welcomeBalance", desde: 2, automatico: false },
  { clave: "monthlyBox", desde: 3, automatico: true },
  { clave: "weeklyBox", desde: 4, automatico: true },
  { clave: "rakeback", desde: 2, automatico: true },
  { clave: "vipManager", desde: 7, automatico: false },
  { clave: "reload", desde: 8, automatico: false },
];

/** Las que se cobran apretando un boton y entregan una caja. */
const BENEFICIOS_DE_CAJA = ["levelUpBox", "weeklyBox", "monthlyBox"];

/* Cuantos tiene cada rango. Sale de `BENEFICIOS`, no al reves. */
const CUANTOS_BENEFICIOS = RANGOS.map(
  (_, i) => BENEFICIOS.filter((b) => b.desde <= i + 1).length
);

const PERIODOS = ["daily", "weekly", "monthly"];

/* Los tipos de movimiento que cuentan como jugar. */
const JUGAR = BalanceTransaction.TIPOS_QUE_JUEGAN;

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
/**
 * LO QUE CUENTA PARA EL VIP.
 *
 * Lo jugado de verdad mas el piso que se le dio al ponerle el rango a
 * mano. Es una funcion y no una suma suelta para que las seis
 * pantallas que muestran el rango usen exactamente la misma cuenta.
 */
function jugadoParaVip(usuario) {
  if (!usuario) return 0;
  return (Number(usuario.jugadoSc) || 0) + (Number(usuario.jugadoBaseSc) || 0);
}

/**
 * EL PISO DE UN RANGO, POR NOMBRE.
 *
 * Lo usa el panel al mover a alguien de rango a mano.
 */
function pisoDelRango(nombre) {
  const r = rangos().find((x) => x.nombre === nombre);
  return r ? Number(r.desde) || 0 : 0;
}

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
    beneficios: BENEFICIOS.map((b) => ({
      clave: b.clave,
      tiene: b.desde <= i + 1,
      automatico: b.automatico,
    })),
  }));
}

/* ── El rango que se GANO jugando ────────────────────────── */

/**
 * EL RANGO QUE DA DERECHO A LOS BENEFICIOS.
 *
 * No es el mismo que muestra la pantalla, y la diferencia es a
 * proposito.
 *
 * `rangoDe(jugadoParaVip(u), u.rangoManual)` es el que se VE: suma el
 * piso que le pusieron a mano y respeta el rango que le asignaron. Eso
 * esta bien para un jugador trasladado de otro sitio, que tiene que
 * ver su rango de siempre.
 *
 * Pero los beneficios se GANAN, y de una sola manera: jugando con
 * plata propia. Por eso este mira `jugadoPagoSc` --lo que de verdad
 * salio del saldo, sin las aperturas de regalo-- y no mira ni el piso
 * a mano ni el rango asignado.
 *
 * Y PIDE HABER COMPRADO ALGUNA VEZ.
 *
 * Sin eso, los tres regalos de bienvenida mas un codigo promocional
 * son saldo de la casa, y jugarlo empujaria hacia un rango con sus
 * cajas gratis sin que el jugador haya puesto un peso. Una cuenta
 * nueva por persona y a repetir.
 */
function rangoGanado(usuario) {
  if (!usuario) return rangoDe(0, "");
  if (!(Number(usuario.compradoSc) > 0)) return rangoDe(0, "");
  return rangoDe(Number(usuario.jugadoPagoSc) || 0, "");
}

/** Los campos que hacen falta para calcularlo, en un solo lugar. */
const CAMPOS_DEL_RANGO = "jugadoSc jugadoPagoSc jugadoBaseSc compradoSc rangoManual";

/**
 * LA VUELTA DE UN BENEFICIO: lo que lo hace unico.
 *
 * La caja de subir, una por rango: el nombre del rango. Asi no se
 * cobra dos veces el mismo escalon, ni de nuevo si manana baja y
 * vuelve a subir.
 *
 * Las periodicas, una por ventana: el dia en que la ventana empieza,
 * en UTC, que es la misma regla del rakeback y de las carreras.
 */
function vueltaDe(clave, rango, momento = new Date()) {
  if (clave === "levelUpBox") return rango.nombre;
  const periodo = clave === "weeklyBox" ? "weekly" : "monthly";
  return ventanaDe(periodo, momento).desde.toISOString().slice(0, 10);
}

/** Que caja da cada beneficio. Sale de las perillas. */
async function cajaDelBeneficio(clave) {
  const cfg = await Settings.leer();
  const elegidas = cfg.cajasDelClub || {};
  const porClave = {
    levelUpBox: elegidas.alSubir,
    weeklyBox: elegidas.semanal,
    monthlyBox: elegidas.mensual,
  };

  /* Vacia quiere decir "la primera de las de regalo": que el beneficio
     siga entregando algo en vez de romperse. */
  const deRegalo = (cfg.cajasDeRegalo || []).length
    ? cfg.cajasDeRegalo
    : Settings.CAJAS_DE_REGALO;

  return porClave[clave] || deRegalo[0] || "";
}

/**
 * EN QUE ESTADO ESTA CADA BENEFICIO.
 *
 * Los siete, con su rango minimo, si el jugador lo tiene y --para los
 * tres que dan una caja-- si lo puede cobrar ahora.
 */
async function beneficiosDe(userId) {
  const usuario = await User.findById(userId).select(CAMPOS_DEL_RANGO).lean();
  if (!usuario) throw errorDe("NOT_LOGGED_IN", {}, 401);

  const rango = rangoGanado(usuario);
  const visible = rangoDe(jugadoParaVip(usuario), usuario.rangoManual);

  const cobrados = await VipBeneficio.find({ user: userId })
    .select("clave vuelta cajaSlug cajaNombre createdAt")
    .sort({ createdAt: -1 })
    .lean();

  /*
    Los nombres de las cajas, de una sola consulta. El nombre sale de
    la caja y no de la copia guardada en el cobro: una caja a la que
    le cambiaron el nombre no tiene por que seguir figurando con el
    viejo en la pantalla.
  */
  const slugs = [...new Set([
    ...(await Promise.all(BENEFICIOS_DE_CAJA.map((c) => cajaDelBeneficio(c)))),
    ...cobrados.map((c) => c.cajaSlug),
  ].filter(Boolean))];

  const cajasDeLaLista = await Box.find({ slug: { $in: slugs } }).select("slug name").lean();
  const porSlug = new Map(cajasDeLaLista.map((c) => [c.slug, { slug: c.slug, nombre: c.name }]));

  const lista = await Promise.all(BENEFICIOS.map(async (b) => {
    const tiene = b.desde <= rango.numero;
    const base = {
      clave: b.clave,
      desde: b.desde,
      desdeRango: RANGOS[b.desde - 1] ? RANGOS[b.desde - 1].nombre : "",
      automatico: b.automatico,
      tiene,
    };

    if (!BENEFICIOS_DE_CAJA.includes(b.clave)) return base;

    const vuelta = vueltaDe(b.clave, rango);
    const ya = cobrados.find((c) => c.clave === b.clave && c.vuelta === vuelta);

    /*
      La caja de subir no se da en Bronze: ahi no se subio de ningun
      lado, y los tres regalos de bienvenida ya son eso.
    */
    const corresponde = b.clave === "levelUpBox" ? tiene && rango.numero >= 2 : tiene;

    const slug = ya ? ya.cajaSlug : await cajaDelBeneficio(b.clave);

    return {
      ...base,
      vuelta,
      yaCobrado: !!ya,
      caja: slug ? (porSlug.get(slug) || { slug, nombre: slug }) : null,
      sePuedeCobrar: corresponde && !ya,
    };
  }));

  return {
    /* El que se ve y el que manda, por separado y dicho. */
    rango: visible,
    rangoGanado: rango,
    jugadoPagoSc: sc(usuario.jugadoPagoSc),
    compro: Number(usuario.compradoSc) > 0,
    beneficios: lista,
  };
}

/**
 * COBRAR UNO DE LOS TRES QUE DAN CAJA.
 *
 * La fila se crea PRIMERO, con su indice unico, por lo mismo que el
 * rakeback: dos clicks rapidos leen los dos "no lo cobro".
 *
 * Y si despues la caja no se puede entregar --la sacaron del
 * catalogo-- la fila se borra. Un cobro anotado sin caja entregada es
 * peor que un cobro que no se pudo hacer: el jugador se queda sin las
 * dos cosas y nadie se entera.
 */
async function cobrarBeneficio({ userId, clave }) {
  if (!BENEFICIOS_DE_CAJA.includes(clave)) {
    throw errorDe("INVALID_AMOUNT", { campo: "beneficio" });
  }

  await controles.revisarPausa(userId);

  const usuario = await User.findById(userId).select(CAMPOS_DEL_RANGO).lean();
  if (!usuario) throw errorDe("NOT_LOGGED_IN", {}, 401);

  const b = BENEFICIOS.find((x) => x.clave === clave);
  const rango = rangoGanado(usuario);

  const minimo = clave === "levelUpBox" ? Math.max(2, b.desde) : b.desde;
  if (rango.numero < minimo) {
    throw errorDe("RANK_TOO_LOW", {
      rango: rango.nombre,
      hace: RANGOS[minimo - 1] ? RANGOS[minimo - 1].nombre : "",
    }, 403);
  }

  const slug = await cajaDelBeneficio(clave);
  const vuelta = vueltaDe(clave, rango);

  let fila;
  try {
    fila = await VipBeneficio.create({
      user: userId, clave, vuelta, rango: rango.nombre, cajaSlug: slug,
    });
  } catch (err) {
    if (err && err.code === 11000) throw errorDe("ALREADY_CLAIMED", { clave });
    throw err;
  }

  const regalo = await cajas.regalarCaja(userId, slug);
  if (!regalo) {
    await VipBeneficio.deleteOne({ _id: fila._id });
    throw errorDe("BOX_NOT_FOUND", { slug });
  }

  await VipBeneficio.updateOne({ _id: fila._id }, { $set: { cajaNombre: regalo.nombre } });

  return { clave, vuelta, caja: { slug: regalo.slug, nombre: regalo.nombre } };
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
  /*
    EL RANGO GANADO, NO EL QUE SE VE.

    El rakeback es uno de los siete beneficios, asi que se gana igual
    que los otros seis: jugando con plata propia. Un rango puesto a
    mano muestra la insignia, no paga.
  */
  const usuario = await User.findById(userId).select(CAMPOS_DEL_RANGO).lean();
  if (!usuario) throw errorDe("NOT_LOGGED_IN", {}, 401);

  const rango = rangoGanado(usuario);
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
    /* El que se ve arriba de todo; el que paga es `rangoGanado`. */
    rango: rangoDe(jugadoParaVip(usuario), usuario.rangoManual),
    rangoGanado: rango,
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

  /* Cobrar coin back es plata que entra: a un autoexcluido no le entra
     nada hasta que se le termine la pausa. */
  await controles.revisarPausa(userId);

  /* El rango GANADO, igual que arriba. */
  const usuario = await User.findById(userId).select(CAMPOS_DEL_RANGO).lean();
  if (!usuario) throw errorDe("NOT_LOGGED_IN", {}, 401);

  const rango = rangoGanado(usuario);
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
  jugadoParaVip,
  pisoDelRango,
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
  rangoGanado,
  beneficiosDe,
  cobrarBeneficio,
  BENEFICIOS_DE_CAJA,
};
