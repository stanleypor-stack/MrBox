/**
 * LOS AFILIADOS.
 *
 * Cuatro momentos, y cada uno hace una cosa sola:
 *
 *   1. ALGUIEN SE REGISTRA con un código → queda atado a esa CAMPAÑA,
 *      para siempre. El lazo se arma una vez y no se toca más: si se
 *      pudiera cambiar después, cualquiera se cambia al código que más
 *      le conviene justo antes de un depósito grande.
 *
 *   2. ALGUIEN COMPRA → se le suma el bono, del 5% al 10% según el RANGO
 *      del socio que lo trajo. Lo paga la casa, no el socio, y va con los
 *      tres modelos: nunca se le saca el bono a un jugador para pagarle
 *      más a quien lo trajo.
 *
 *   3. ALGUIEN JUEGA → el socio se lleva su parte, calculada según el
 *      modelo de ESA campaña. Y se mira si ese jugador terminó de
 *      calificar para el pago por cabeza.
 *
 *   4. EL SOCIO COBRA → lo ganado pasa a saldo SC.
 *
 * LOS TRES MODELOS
 *
 *   cpa ........ SC fijos por jugador que CALIFICA. Nada por jugada.
 *   revshare ... % del margen REAL de cada jugada, lo que la casa de
 *                verdad ganó. Una jugada perdedora paga cero, nunca
 *                negativo: el socio no maneja la suerte de nadie.
 *   hibrido .... CPA + RevShare: un cpa más chico al calificar, más un
 *                revshare más chico de ahí en adelante.
 *
 * LOS NUMEROS SALEN DEL RANGO, NO DE LA CAMPAÑA
 *
 * Subirle el rango a un socio mejora sus cinco campañas de una, y no hay
 * cinco lugares donde un número puede quedar viejo. La campaña solo
 * elige CON CUAL de los cuatro cobra.
 */

const AffiliateCode = require("../../database/models/AffiliateCode");
const AffiliateConversion = require("../../database/models/AffiliateConversion");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const Settings = require("../../database/models/Settings");
const User = require("../../database/models/User");
const wallet = require("../wallet");
const { sc } = require("../../utils/money");
const avisos = require("../notificaciones");
const { errorDe } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const { RANGOS_AFILIADO, MODELOS_ABIERTOS } = Settings;

const MODELOS = ["cpa", "revshare", "hibrido"];

/* ── La escalera ───────────────────────────────────────────────────── */

/*
  LA ESCALERA, EN MEMORIA POR UN MINUTO.

  La mira cada jugada de cada referido: leerla de la base cada vez serían
  miles de consultas por minuto contra una tabla de ocho filas que cambia
  una vez al mes. Mismo criterio que los rangos VIP.
*/
let enMemoria = { cuando: 0, rangos: null, cfg: null };

function numeroO(v, x) {
  return v === undefined || v === null || Number.isNaN(Number(v)) ? x : Number(v);
}

/*
  Un rango guardado puede venir con huecos --el panel mandó solo lo que
  tocaron-- así que cada campo que falta cae al de fábrica de ese mismo
  puesto. Ningún `undefined` llega nunca a una multiplicación.
*/
function normalizar(r, i) {
  const base = RANGOS_AFILIADO[Math.min(i, RANGOS_AFILIADO.length - 1)];
  return {
    numero: i + 1,
    nombre: (r && r.nombre) || base.nombre,
    cpaSc: numeroO(r && r.cpaSc, base.cpaSc),
    revsharePct: numeroO(r && r.revsharePct, base.revsharePct),
    hibridoCpaSc: numeroO(r && r.hibridoCpaSc, base.hibridoCpaSc),
    hibridoPct: numeroO(r && r.hibridoPct, base.hibridoPct),
    bonoPct: numeroO(r && r.bonoPct, base.bonoPct),
    minimoCobroSc: numeroO(r && r.minimoCobroSc, base.minimoCobroSc),
    pago: (r && r.pago) || base.pago,
  };
}

const DE_FABRICA = RANGOS_AFILIADO.map(normalizar);

/**
 * VUELVE A LEER LA ESCALERA YA, SIN ESPERAR EL MINUTO.
 *
 * La llama el panel después de guardar: si no, alguien edita la escalera,
 * mira la pantalla y ve los números viejos durante un minuto, y lo
 * primero que piensa es que no se guardó.
 */
async function recargar() {
  const cfg = await Settings.leer();
  const puestos = (cfg && cfg.rangosAfiliado) || [];
  enMemoria = {
    cuando: Date.now(),
    rangos: puestos.length ? puestos.map(normalizar) : DE_FABRICA,
    cfg: (cfg && cfg.afiliados) || null,
  };
  return enMemoria.rangos;
}

/** Lee la escalera y las reglas, con lo último que haya si no llegó. */
function refrescar() {
  if (enMemoria.rangos && Date.now() - enMemoria.cuando < 60000) return;
  if (!enMemoria.rangos) enMemoria.rangos = DE_FABRICA;
  recargar().catch(() => {});
}

/** Los rangos de la escalera, como los ve todo el mundo. */
function rangos() {
  refrescar();
  return enMemoria.rangos || DE_FABRICA;
}

/**
 * LAS REGLAS DEL PROGRAMA, CON SUS VALORES DE FABRICA.
 *
 * `Settings.leer()` devuelve un documento plano, así que los `default:`
 * del esquema no corren sobre el que ya existía. Van acá, a mano.
 */
function reglas() {
  refrescar();
  const c = enMemoria.cfg || {};
  const abiertos = (c.modelos && c.modelos.length ? c.modelos : MODELOS_ABIERTOS).filter((m) =>
    MODELOS.includes(m)
  );

  return {
    houseEdgePct: numeroO(c.houseEdgePct, 8),
    cpaDepositoSc: numeroO(c.cpaDepositoSc, 20),
    cpaJugadoSc: numeroO(c.cpaJugadoSc, 200),
    cpaNivelKyc: numeroO(c.cpaNivelKyc, 2),
    cpaEsperaDias: numeroO(c.cpaEsperaDias, 14),
    cpaTopeDiario: numeroO(c.cpaTopeDiario, 40),
    telegram: c.telegram || "https://t.me/mrboxsupport",
    modelos: abiertos.length ? abiertos : MODELOS_ABIERTOS,
  };
}

/** El rango número `n`, contando desde 1. El primero si viene cualquier cosa. */
function rangoNumero(n) {
  const R = rangos();
  const i = Math.max(0, Math.min(R.length - 1, (Number(n) || 1) - 1));
  return R[i];
}

/** El rango de un socio, con el siguiente al lado para la UI. */
function rangoDe(usuario) {
  const R = rangos();
  const i = Math.max(
    0,
    Math.min(R.length - 1, (Number(usuario && usuario.rangoAfiliado) || 1) - 1)
  );
  return { ...R[i], siguiente: i < R.length - 1 ? R[i + 1] : null, deCuantos: R.length };
}

/* ── Lo que cobra una campaña ──────────────────────────────────────── */

/**
 * LO QUE LE DEJA UNA JUGADA AL SOCIO.
 *
 * `jugadoSc` es lo que apostó el jugador; `margenSc`, lo que la casa ganó
 * con esa jugada, que puede ser negativo --se llevó un premio más caro
 * que la caja--.
 *
 * El `cpa` puro devuelve cero acá a propósito: ese modelo cobra una sola
 * vez, cuando el jugador califica, y no por jugada.
 */
function porJugada({ modelo, rango, jugadoSc, margenSc }) {
  const jugado = sc(jugadoSc);
  if (!(jugado > 0)) return 0;
  if (modelo === "cpa") return 0;

  /*
    `revshare` e `hibrido` van sobre el margen de verdad, y nunca en rojo:
    una jugada que gana el jugador paga cero, no negativo. El socio no
    tiene control sobre la suerte de nadie.
  */
  const margen = sc(margenSc);
  if (!(margen > 0)) return 0;
  const pct = modelo === "hibrido" ? rango.hibridoPct : rango.revsharePct;
  return sc(margen * (pct / 100));
}

/** Lo que paga esa campaña por una cabeza que califica. */
function porCabeza({ modelo, rango }) {
  if (modelo === "cpa") return sc(rango.cpaSc);
  if (modelo === "hibrido") return sc(rango.hibridoCpaSc);
  return 0;
}

/** Cómo se le cuenta al socio lo que cobra, para la UI. */
function comoCobra({ modelo, rango }) {
  if (modelo === "cpa") return { porCabezaSc: sc(rango.cpaSc), pct: 0 };
  if (modelo === "revshare") return { porCabezaSc: 0, pct: rango.revsharePct };
  return { porCabezaSc: sc(rango.hibridoCpaSc), pct: rango.hibridoPct };
}

/* ── El código ─────────────────────────────────────────────────────── */

/** Busca un código, sin importar cómo lo hayan escrito. */
async function buscarCodigo(texto) {
  const code = String(texto || "").trim().toUpperCase();
  if (!code) return null;
  return AffiliateCode.findOne({ code }).populate("owner", "username rangoAfiliado").exec();
}

/**
 * EL BONO QUE RECIBE EL JUGADOR QUE ENTRA CON ESE CODIGO.
 *
 * Sale del rango del socio: 5% abajo, 10% arriba. Va con los cuatro
 * modelos, siempre. Un número puesto a mano en el código manda sobre eso,
 * para el trato suelto que se negoció aparte; `0` es un número puesto a
 * mano y quiere decir cero, no "usá el del rango".
 *
 * Devuelve una proporción (0.06), no un porcentaje (6).
 */
async function bonoDe(codigo) {
  if (!codigo) return 0;
  if (codigo.bonoPropio !== null && codigo.bonoPropio !== undefined) {
    return Number(codigo.bonoPropio) || 0;
  }

  let dueno = codigo.owner;
  if (!dueno || dueno.rangoAfiliado === undefined) {
    const id = dueno && dueno._id ? dueno._id : codigo.owner;
    dueno = await User.findById(id).select("rangoAfiliado").lean();
  }

  return rangoNumero(dueno && dueno.rangoAfiliado).bonoPct / 100;
}

/**
 * Ata a un jugador recién registrado con la campaña que lo trajo.
 *
 * Devuelve el código usado, o `null` si no puso ninguno. Que un código no
 * exista NO rompe el registro: es un error del jugador escribiendo, no
 * una razón para no dejarlo entrar. Se avisa y se sigue.
 */
async function atarAlSocio(usuario, textoDelCodigo) {
  const codigo = await buscarCodigo(textoDelCodigo);
  if (!codigo || !codigo.sirve()) return null;

  /* Nadie se trae a sí mismo. Es el autofraude más viejo que hay. */
  if (String(codigo.owner && codigo.owner._id) === String(usuario._id)) return null;

  await User.updateOne(
    { _id: usuario._id, referredBy: null },
    { $set: { referredBy: codigo.owner._id, affiliateCode: codigo.code } }
  );
  await AffiliateCode.updateOne({ _id: codigo._id }, { $inc: { jugadores: 1 } });

  /*
    La ficha del referido nace acá, en "nuevo". Si ya existía --el índice
    único (code, user) la protege-- queda como estaba, que es lo correcto:
    un jugador le paga una sola vez a una sola campaña.
  */
  await AffiliateConversion.create({
    code: codigo._id,
    owner: codigo.owner._id,
    user: usuario._id,
    modelo: codigo.modelo,
  }).catch(() => {});

  return codigo;
}

/**
 * El bono que le toca a una compra.
 *
 * Devuelve `{ bonoSc, codigo, porcentaje }`. No acredita nada: eso lo
 * hace quien confirma la compra, para que el saldo y el bono se muevan
 * juntos.
 */
async function bonoDeCompra(usuario, montoSc) {
  const monto = sc(montoSc);
  if (!(monto > 0) || !usuario || !usuario.affiliateCode) return { bonoSc: 0, codigo: null };

  const codigo = await buscarCodigo(usuario.affiliateCode);
  if (!codigo || !codigo.sirve()) return { bonoSc: 0, codigo: null };

  const porcentaje = await bonoDe(codigo);
  return { bonoSc: sc(monto * porcentaje), codigo, porcentaje };
}

/**
 * Le anota al socio lo que le dejó una jugada de uno de los suyos.
 *
 * NO MUEVE EL SALDO DEL SOCIO. Lo anota como ganado, y el socio lo cobra
 * cuando quiere. Acreditarlo al instante dejaría el saldo del socio
 * subiendo solo cada vez que alguien abre una caja, y eso convierte el
 * libro de movimientos en algo ilegible.
 */
async function anotarComision({ jugador, jugadoSc, margenSc }) {
  if (!jugador || !jugador.affiliateCode) return null;

  const jugado = sc(jugadoSc);
  if (!(jugado > 0)) return null;

  const codigo = await AffiliateCode.findOne({ code: jugador.affiliateCode });
  if (!codigo || !codigo.sirve()) return null;

  const dueno = await User.findById(codigo.owner).select("rangoAfiliado").lean();
  const rango = rangoNumero(dueno && dueno.rangoAfiliado);

  /*
    EL MARGEN SE ACUMULA, NEGATIVO INCLUIDO.

    Antes el revshare se pagaba sobre el margen de ESA jugada con el
    negativo pisado en cero: el socio cobraba de las jugadas buenas y
    la casa se comia sola las malas. Con una caja de premio gordo eso
    alcanza para dejar a la casa en rojo.

    Ahora se suma --en la base, atomico-- y se reparte solo cuando el
    acumulado esta en verde.
  */
  let paraRepartir = 0;

  if (codigo.modelo !== "cpa") {
    const sumado = await AffiliateCode.findOneAndUpdate(
      { _id: codigo._id },
      { $inc: { margenPendienteSc: sc(margenSc) } },
      { new: true }
    ).select("margenPendienteSc").lean();

    const acumulado = sc((sumado && sumado.margenPendienteSc) || 0);

    if (acumulado > 0) {
      /* La condicion adentro del filtro: dos jugadas a la vez no se
         llevan el mismo acumulado dos veces. */
      const consumido = await AffiliateCode.findOneAndUpdate(
        { _id: codigo._id, margenPendienteSc: { $gte: acumulado } },
        { $inc: { margenPendienteSc: -acumulado } }
      ).lean();
      if (consumido) paraRepartir = acumulado;
    }
  }

  const ganado = porJugada({
    modelo: codigo.modelo,
    rango,
    jugadoSc: jugado,
    margenSc: paraRepartir,
  });

  await AffiliateCode.updateOne(
    { _id: codigo._id },
    { $inc: { jugadoPorLosSuyosSc: jugado, ganadoSc: ganado } }
  );

  /*
    Y se mira si ese jugador terminó de calificar para el pago por cabeza.
    Va acá y no en un reloj porque lo que lo hace calificar es justamente
    esta jugada. Si falla, la jugada igual quedó bien anotada: la
    calificación se vuelve a mirar en la jugada siguiente.
  */
  await mirarCalificacion({ jugador, codigo, rango }).catch((err) => {
    logger.error("[afiliados] calificar:", err.message);
  });

  return { ganado, codigo: codigo.code, modelo: codigo.modelo };
}

/* ── El pago por cabeza ────────────────────────────────────────────── */

/** Lo que un jugador lleva depositado y jugado, según el LIBRO. */
async function numerosDelReferido(userId) {
  const filas = await BalanceTransaction.aggregate([
    { $match: { user: userId } },
    { $group: { _id: "$type", total: { $sum: "$amountSc" } } },
  ]);

  const de = (t) => {
    const f = filas.find((x) => x._id === t);
    return f ? Math.abs(sc(f.total)) : 0;
  };

  return { depositadoSc: de("purchase"), jugadoSc: sc(de("box_open") + de("deal")) };
}

/**
 * ¿ESTE REFERIDO YA CALIFICA?
 *
 * Mira lo que pide el programa --depósito, jugado, verificación-- y
 * avanza la ficha. Cuando califica, congela lo que le toca al socio y le
 * pone fecha de liberación.
 *
 * NO PAGA ACA. Pagar es otra cosa y pasa después (`liberarCalificados` o
 * el botón del panel), porque entre calificar y pagar hay una espera a
 * propósito: es el tiempo que tarda en notarse un depósito que se va en
 * retiro sin jugar.
 */
async function mirarCalificacion({ jugador, codigo, rango }) {
  if (!jugador || !codigo) return null;

  const elRango = rango || rangoNumero(1);
  const paga = porCabeza({ modelo: codigo.modelo, rango: elRango });
  if (!(paga > 0)) return null; /* el revshare puro no paga por cabeza */

  const ficha = await AffiliateConversion.findOne({ code: codigo._id, user: jugador._id });
  if (!ficha) return null;
  if (ficha.estado !== "nuevo" && ficha.estado !== "deposito") return null;

  const r = reglas();
  const nums = await numerosDelReferido(jugador._id);
  const nivel = Number(jugador.verificationLevel) || 0;

  const cumple =
    nums.depositadoSc >= r.cpaDepositoSc &&
    nums.jugadoSc >= r.cpaJugadoSc &&
    nivel >= r.cpaNivelKyc;

  const cambios = {
    depositadoSc: nums.depositadoSc,
    jugadoSc: nums.jugadoSc,
    nivelKyc: nivel,
    estado: cumple ? "califica" : nums.depositadoSc > 0 ? "deposito" : "nuevo",
    modelo: codigo.modelo,
  };

  if (cumple) {
    cambios.montoSc = paga;
    cambios.calificoEl = new Date();
    cambios.liberaEl = new Date(Date.now() + r.cpaEsperaDias * 24 * 60 * 60 * 1000);
    cambios.senales = await senalesDe(jugador, codigo);
  }

  /*
    La condición va adentro del filtro: si dos jugadas del mismo jugador
    entran a la vez, una sola la hace calificar.
  */
  return AffiliateConversion.findOneAndUpdate(
    { _id: ficha._id, estado: { $in: ["nuevo", "deposito"] } },
    { $set: cambios },
    { new: true }
  );
}

/**
 * LO QUE HAY QUE MIRAR ANTES DE PAGAR UNA CABEZA.
 *
 * Señales, no sentencias: una dirección repetida puede ser una familia, y
 * un depósito que se retira puede ser alguien que se arrepintió. Se
 * anotan para que una persona decida; nada se anula solo.
 */
async function senalesDe(jugador, codigo) {
  const senales = [];

  try {
    const SessionEvent = require("../../database/models/SessionEvent");
    const mias = (await SessionEvent.find({ user: jugador._id }).distinct("desde")).filter(Boolean);

    if (mias.length) {
      const otras = await SessionEvent.find({
        desde: { $in: mias },
        user: { $ne: jugador._id },
      }).distinct("user");
      if (otras.length) senales.push(`misma_direccion_que_${otras.length}`);
    }

    /* Depositó y ya pidió retiro: puede ser un depósito que entra y sale. */
    const retiros = await BalanceTransaction.countDocuments({
      user: jugador._id,
      type: "redemption",
    });
    if (retiros > 0) senales.push("pidio_retiro_temprano");

    /* Varias altas de la misma campaña en pocos minutos. */
    const hace15 = new Date(Date.now() - 15 * 60 * 1000);
    const enRafaga = await AffiliateConversion.countDocuments({
      code: codigo._id,
      createdAt: { $gte: hace15 },
    });
    if (enRafaga >= 5) senales.push(`${enRafaga}_altas_en_15_min`);
  } catch (err) {
    logger.error("[afiliados] senales:", err.message);
  }

  return senales;
}

/**
 * PAGA LAS CABEZAS QUE YA CUMPLIERON LA ESPERA.
 *
 * Las que tienen señales NO se pagan solas: quedan esperando a que
 * alguien del panel las mire.
 */
async function liberarCalificados({ ahora = new Date(), tope = 200 } = {}) {
  const listas = await AffiliateConversion.find({
    estado: "califica",
    liberaEl: { $lte: ahora },
    senales: { $size: 0 },
  })
    .limit(tope)
    .lean();

  let pagadas = 0;
  for (const f of listas) {
    const ok = await pagarCabeza({ fichaId: f._id }).catch((err) => {
      logger.error("[afiliados] liberar:", err.message);
      return null;
    });
    if (ok) pagadas += 1;
  }

  if (pagadas) logger.info(`[afiliados] ${pagadas} pagos por cabeza liberados`);
  return pagadas;
}

/**
 * Le anota al socio una cabeza, una sola vez.
 *
 * El `estado: "califica"` adentro del filtro es lo que hace que dos
 * pedidos al mismo tiempo no paguen dos veces: el segundo no encuentra
 * documento.
 */
async function pagarCabeza({ fichaId, porQuien = null }) {
  const movida = await AffiliateConversion.findOneAndUpdate(
    { _id: fichaId, estado: "califica" },
    { $set: { estado: "pagado", pagadoEl: new Date(), porQuien } },
    { new: true }
  );
  if (!movida) return null;

  /*
    EL TOPE DIARIO DE LA CAMPAÑA.

    Se cuenta DESPUES de marcar, no antes: contar antes deja que dos
    pedidos simultáneos vean el mismo número y se pasen los dos. Si se
    pasó, la ficha vuelve a "califica" y se paga mañana.
  */
  const r = reglas();
  if (r.cpaTopeDiario > 0) {
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    const hechas = await AffiliateConversion.countDocuments({
      code: movida.code,
      estado: "pagado",
      pagadoEl: { $gte: hoy },
    });

    if (hechas > r.cpaTopeDiario) {
      await AffiliateConversion.updateOne(
        { _id: movida._id },
        { $set: { estado: "califica", pagadoEl: null, porQuien: null } }
      );
      return null;
    }
  }

  await AffiliateCode.updateOne({ _id: movida.code }, { $inc: { ganadoSc: sc(movida.montoSc) } });

  return movida;
}

/** Alguien del equipo frena una cabeza. Pide motivo. */
async function anularCabeza({ fichaId, motivo, porQuien }) {
  const texto = String(motivo || "").trim();
  if (texto.length < 3) throw errorDe("REASON_REQUIRED");

  const movida = await AffiliateConversion.findOneAndUpdate(
    { _id: fichaId, estado: { $in: ["nuevo", "deposito", "califica"] } },
    { $set: { estado: "anulado", motivo: texto, porQuien } },
    { new: true }
  );
  if (!movida) throw errorDe("NOT_FOUND");

  return movida;
}

/* ── Las campañas ──────────────────────────────────────────────────── */

const COMO_MAXIMO = 10;

/** Crea una campaña del socio. El modelo queda fijo. */
async function crearCampana({ usuario, nombre, code, canal, modelo }) {
  const limpio = String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 16);
  if (limpio.length < 3) throw errorDe("CODE_TOO_SHORT", { code: limpio });

  const elegido = MODELOS.includes(modelo) ? modelo : "hibrido";

  /* Lo que el socio puede elegir solo; el resto lo habilita el equipo. */
  if (!reglas().modelos.includes(elegido)) throw errorDe("MODEL_NOT_OPEN", { modelo: elegido });

  const cuantas = await AffiliateCode.countDocuments({ owner: usuario._id });
  if (cuantas >= COMO_MAXIMO) throw errorDe("TOO_MANY_CAMPAIGNS", { tope: COMO_MAXIMO });

  const repetido = await AffiliateCode.findOne({ code: limpio }).lean();
  if (repetido) throw errorDe("CODE_TAKEN", { code: limpio });

  return AffiliateCode.create({
    code: limpio,
    owner: usuario._id,
    nombre: String(nombre || "").trim().slice(0, 60) || limpio,
    canal: String(canal || "").trim().slice(0, 30),
    modelo: elegido,
  });
}

/* ── Cobrar ────────────────────────────────────────────────────────── */

/**
 * El socio cobra lo que tiene ganado.
 *
 * Mueve de "ganado" a "cobrado" y le acredita el saldo, las dos cosas
 * atadas: la condición adentro del filtro impide que dos pedidos al mismo
 * tiempo cobren lo mismo dos veces.
 */
async function cobrar({ userId, codigoId }) {
  const codigo = await AffiliateCode.findOne({ _id: codigoId, owner: userId });
  if (!codigo) throw errorDe("CODE_NOT_FOUND");

  const porCobrar = sc((codigo.ganadoSc || 0) - (codigo.cobradoSc || 0));
  if (!(porCobrar > 0)) throw errorDe("NOTHING_TO_CLAIM");

  const dueno = await User.findById(userId).select("rangoAfiliado").lean();
  const minimo = rangoNumero(dueno && dueno.rangoAfiliado).minimoCobroSc;
  if (porCobrar < minimo) throw errorDe("BELOW_MINIMUM", { minimoSc: minimo, porCobrar });

  const movido = await AffiliateCode.findOneAndUpdate(
    { _id: codigo._id, cobradoSc: codigo.cobradoSc },
    { $inc: { cobradoSc: porCobrar } },
    { new: true }
  );
  if (!movido) throw errorDe("SOMETHING_WENT_WRONG");

  try {
    await wallet.mover({
      userId,
      amountSc: porCobrar,
      type: "affiliate",
      reference: { kind: "affiliateCode", id: codigo._id, label: codigo.code },
    });
  } catch (err) {
    /* Si el saldo no se pudo mover, devolver lo cobrado: si no, el socio
       pierde la plata y el contador dice que ya la cobró. */
    await AffiliateCode.updateOne({ _id: codigo._id }, { $inc: { cobradoSc: -porCobrar } });
    throw err;
  }

  return { cobradoSc: porCobrar };
}

/* ── Subir de rango ────────────────────────────────────────────────── */

/**
 * El socio pide que le miren el rango.
 *
 * Queda anotado y nada más: el rango lo otorga una persona. Un programa
 * de afiliados donde el rango sube solo es un programa donde el margen lo
 * decide quien más tráfico compra, no quien mejor trae.
 */
async function pedirRango(userId) {
  await User.updateOne({ _id: userId }, { $set: { pidioRangoEl: new Date() } });
  return { telegram: reglas().telegram };
}

/** El equipo le otorga un rango. */
async function otorgarRango({ userId, numero }) {
  const R = rangos();
  const n = Math.max(1, Math.min(R.length, Number(numero) || 1));

  const antes = await User.findOneAndUpdate(
    { _id: userId },
    { $set: { rangoAfiliado: n, pidioRangoEl: null } }
  ).select("rangoAfiliado").lean();

  const rango = rangoNumero(n);

  /* Solo cuando SUBE. Bajar de rango tambien pasa --una campana que se
     apaga, un socio que se pasa de la raya-- y avisarlo con la misma
     campanita que las buenas noticias seria una crueldad inutil: eso
     se habla, no se notifica. */
  if (!antes || n > (Number(antes.rangoAfiliado) || 1)) {
    await avisos.avisar({
      userId,
      tipo: "rango",
      clave: "notif.rankUp",
      datos: { rango: rango.nombre },
      destino: "/affiliates",
    });
  }

  return rango;
}

module.exports = {
  MODELOS,
  COMO_MAXIMO,
  rangos,
  recargar,
  reglas,
  rangoDe,
  rangoNumero,
  porJugada,
  porCabeza,
  comoCobra,
  buscarCodigo,
  bonoDe,
  atarAlSocio,
  bonoDeCompra,
  anotarComision,
  mirarCalificacion,
  senalesDe,
  liberarCalificados,
  pagarCabeza,
  anularCabeza,
  crearCampana,
  cobrar,
  pedirRango,
  otorgarRango,
  numerosDelReferido,
};
