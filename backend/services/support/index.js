const SupportThread = require("../../database/models/SupportThread");
const Settings = require("../../database/models/Settings");
const User = require("../../database/models/User");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const Redemption = require("../../database/models/Redemption");
const Order = require("../../database/models/Order");
const ia = require("../ia");
const { errorDe } = require("../../utils/errors");
const { sc } = require("../../utils/money");

/**
 * SOPORTE.
 *
 * El globito del sitio y la bandeja del panel son el mismo mostrador
 * visto de los dos lados: acá están las reglas y las dos pantallas solo
 * las usan.
 *
 * LA RESPUESTA AUTOMATICA ES UN CODIGO
 *
 * "Gracias, te contestamos en unos minutos" no se guarda como frase: se
 * guarda `SUPPORT_AUTO_REPLY` y la pantalla lo dice en el idioma del que
 * escribió. Alguien que escribe en alemán y recibe la respuesta
 * automática en inglés ya entendió que del otro lado no hay nadie.
 *
 * UNA CONVERSACION ABIERTA POR VEZ
 *
 * Abrir diez conversaciones por el mismo problema no ayuda a nadie: ni
 * al que escribe --le contestan en tres lugares-- ni al equipo. Si hay
 * una abierta, el mensaje nuevo va ahí.
 */

/* Cuántas conversaciones puede llegar a tener una cuenta. */
const TOPE_POR_JUGADOR = 50;

/** El resumen que va en la lista. */
function resumir(hilo, opciones) {
  const paraElEquipo = !!(opciones && opciones.paraElEquipo);
  const ultimo = hilo.mensajes.length ? hilo.mensajes[hilo.mensajes.length - 1] : null;
  const visto = paraElEquipo ? hilo.leidoPorElEquipoEl : hilo.leidoPorElJugadorEl;
  const esperaRespuesta = paraElEquipo ? hilo.ultimoFueDelJugador : !hilo.ultimoFueDelJugador;

  return {
    _id: hilo._id,
    asunto: hilo.asunto,
    estado: hilo.estado,
    ultimo: ultimo ? { texto: ultimo.texto, codigo: ultimo.codigo, deAdmin: ultimo.deAdmin } : null,
    ultimoMensajeEl: hilo.ultimoMensajeEl,
    /* El puntito: hay algo que no vi y que no escribí yo. */
    sinLeer: esperaRespuesta && (!visto || visto < hilo.ultimoMensajeEl),
    cuantosMensajes: hilo.mensajes.length,
  };
}

/** La conversación entera, para dibujarla. */
function completo(hilo) {
  return Object.assign(resumir(hilo), {
    asignado: hilo.asignado || null,
    mensajes: hilo.mensajes.map((m) => ({
      _id: m._id,
      deAdmin: m.deAdmin,
      nombre: m.nombre,
      texto: m.texto,
      codigo: m.codigo,
      createdAt: m.createdAt,
    })),
  });
}

/* ── Lo que hace el jugador ────────────────────────────────────────── */

async function mias(userId) {
  const hilos = await SupportThread.find({ user: userId })
    .sort({ ultimoMensajeEl: -1 })
    .limit(TOPE_POR_JUGADOR)
    .lean();

  return hilos.map((h) => resumir(h));
}

async function ver(userId, hiloId) {
  const hilo = await SupportThread.findOne({ _id: hiloId, user: userId });
  if (!hilo) throw errorDe("NOT_FOUND");

  /* Abrirlo es haberlo leído. */
  hilo.leidoPorElJugadorEl = new Date();
  await hilo.save();

  return completo(hilo);
}

/**
 * Escribe el jugador.
 *
 * Sin `hiloId`, sigue la conversación abierta si hay una y abre una
 * nueva si no. Con `hiloId`, escribe en esa.
 */
async function escribir(datos) {
  const texto = String(datos.texto || "").trim();
  if (!texto) throw errorDe("MESSAGE_REQUIRED");

  let hilo = null;

  if (datos.hiloId) {
    hilo = await SupportThread.findOne({ _id: datos.hiloId, user: datos.userId });
    if (!hilo) throw errorDe("NOT_FOUND");
  } else if (!datos.nueva) {
    /* Sin decir cuál y sin pedir una nueva: sigue la que está abierta. */
    hilo = await SupportThread.findOne({ user: datos.userId, estado: { $ne: "closed" } })
      .sort({ ultimoMensajeEl: -1 });
  }

  if (!hilo) {
    const cuantos = await SupportThread.countDocuments({ user: datos.userId });
    if (cuantos >= TOPE_POR_JUGADOR) throw errorDe("TOO_MANY_THREADS");

    hilo = new SupportThread({ user: datos.userId, asunto: texto.slice(0, 120) });
  }

  /*
    DONDE CAE UN MENSAJE.

    Con un hilo: ahí, aunque esté cerrado --y volverlo a abrir es lo
    correcto: "volvió a pasar lo del pedido" tiene que seguir donde
    está el contexto, no en una conversación nueva vacía.

    Con "Nueva": una nueva, siempre. Es un tema distinto.

    Sin nada: la que esté abierta. Es el caso del que escribe desde el
    inicio del globito sin mirar la lista.

    Pero solo si se escribe ADENTRO de esa conversación: "volvió a
    pasar lo del pedido" sigue el hilo donde está todo el contexto. El
    botón "Nueva" del globito no manda ningún hilo y entonces abre una
    nueva, que es lo correcto para un problema distinto: una sola
    conversación eterna con cuatro temas mezclados no la puede contestar
    nadie.
  */
  hilo.agregar({ deAdmin: false, autor: datos.userId, nombre: datos.nombre || "", texto });
  hilo.leidoPorElJugadorEl = new Date();

  /* Y la respuesta automática, una sola vez por conversación: en cada
     mensaje sería un loro. */
  const cfg = await Settings.leer();
  const prendida = !(cfg && cfg.soporte && cfg.soporte.respuestaAutomatica === false);
  const yaEsta = hilo.mensajes.some((m) => m.codigo === "SUPPORT_AUTO_REPLY");

  if (prendida && !yaEsta) {
    hilo.agregar({
      deAdmin: true,
      texto: "Thanks! An agent will reply here shortly.",
      codigo: "SUPPORT_AUTO_REPLY",
    });
  }

  await hilo.save();
  return completo(hilo);
}

async function cerrarDelJugador(userId, hiloId) {
  const hilo = await SupportThread.findOne({ _id: hiloId, user: userId });
  if (!hilo) throw errorDe("NOT_FOUND");

  hilo.estado = "closed";
  await hilo.save();
  return completo(hilo);
}

/** Para el puntito del globito, sin traerse las conversaciones. */
async function sinLeer(userId) {
  const hilos = await SupportThread.find({ user: userId })
    .select("ultimoMensajeEl ultimoFueDelJugador leidoPorElJugadorEl")
    .lean();

  return hilos.filter((h) => !h.ultimoFueDelJugador
    && (!h.leidoPorElJugadorEl || h.leidoPorElJugadorEl < h.ultimoMensajeEl)).length;
}

/* ── Lo que hace el equipo ─────────────────────────────────────────── */

async function bandeja(opciones) {
  const o = opciones || {};
  const perPage = Math.min(100, Math.max(1, Number(o.perPage) || 25));
  const page = Math.max(1, Number(o.page) || 1);

  const filtro = {};
  if (o.estado) filtro.estado = o.estado;
  if (o.asignado === "nadie") filtro.asignado = null;
  else if (o.asignado) filtro.asignado = o.asignado;
  if (o.q) filtro.asunto = { $regex: String(o.q).slice(0, 60), $options: "i" };

  const [hilos, total, porEstado] = await Promise.all([
    SupportThread.find(filtro)
      .sort({ ultimoMensajeEl: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate("user", "username email")
      .populate("asignado", "username")
      .lean(),
    SupportThread.countDocuments(filtro),
    SupportThread.aggregate([{ $group: { _id: "$estado", n: { $sum: 1 } } }]),
  ]);

  const cuenta = {};
  for (const f of porEstado) cuenta[f._id] = f.n;

  /*
    LOS NUMEROS DE LA BANDEJA.

    Cuántas esperan respuesta nuestra, cuántas no tienen dueño, cuántas
    se cerraron hoy y --el que de verdad importa-- cuánto tarda la
    PRIMERA respuesta. Una bandeja sin ese número se ve igual de
    ordenada esté o no esté contestando alguien.
  */
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);

  const [sinDueno, cerradasHoy, ultimas] = await Promise.all([
    SupportThread.countDocuments({ estado: { $ne: "closed" }, asignado: null }),
    SupportThread.countDocuments({ estado: "closed", ultimoMensajeEl: { $gte: hoy } }),
    /* Las últimas cincuenta alcanzan: es una mediana, no una auditoría. */
    SupportThread.find({ "mensajes.deAdmin": true })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("createdAt mensajes.deAdmin mensajes.el")
      .lean(),
  ]);

  const esperas = [];
  for (const h of ultimas) {
    const primera = (h.mensajes || []).find((m) => m.deAdmin);
    if (primera && primera.el) esperas.push(new Date(primera.el) - new Date(h.createdAt));
  }
  esperas.sort((a, b) => a - b);
  const mediana = esperas.length ? esperas[Math.floor(esperas.length / 2)] : null;

  return {
    numeros: {
      esperandoNos: cuenta.waiting_us || 0,
      esperandoAlJugador: cuenta.waiting_player || 0,
      cerradas: cuenta.closed || 0,
      sinDueno,
      cerradasHoy,
      /* En minutos, que es como se lee. */
      primeraRespuestaMin: mediana === null ? null : Math.round(mediana / 60000),
    },
    items: hilos.map((h) => Object.assign(resumir(h, { paraElEquipo: true }), {
      userId: h.user && h.user._id,
      username: (h.user && h.user.username) || "",
      email: (h.user && h.user.email) || "",
      asignadoA: (h.asignado && h.asignado.username) || "",
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    porEstado: cuenta,
    esperando: cuenta.waiting_us || 0,
  };
}

/**
 * LO QUE HAY QUE SABER DEL QUE ESCRIBIO.
 *
 * Sale al lado de la conversación porque el 90% de lo que se pregunta
 * en soporte se contesta mirando esto: cuánto tiene, cuánto jugó, si
 * está verificado, si tiene un canje esperando y si alguien le puso
 * una traba. Sin esto hay que abrir la ficha del jugador en otra
 * pestaña, leerla, y volver.
 *
 * TODO SALE DEL LIBRO
 *
 * Lo comprado y lo canjeado se suman de las transacciones, no de un
 * contador: si soporte le dice a alguien "vos depositaste 200" tiene
 * que ser lo mismo que diga su extracto.
 */
async function fichaDelJugador(userId) {
  if (!userId) return null;

  const vip = require("../vip");

  const [u, porTipo, canjes, pedidos, ultimos] = await Promise.all([
    User.findById(userId).select("+balanceSc +bonoPendienteSc").lean(),
    BalanceTransaction.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$type", total: { $sum: "$amountSc" } } },
    ]),
    Redemption.countDocuments({ user: userId, estado: { $in: ["pending", "approved"] } }),
    Order.countDocuments({ user: userId, estado: { $in: ["pending", "packing"] } }),
    BalanceTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  if (!u) return null;

  const de = (tipo) => {
    const f = porTipo.find((x) => x._id === tipo);
    return f ? sc(Math.abs(f.total)) : 0;
  };

  const rango = vip.rangoDe(vip.jugadoParaVip(u), u.rangoManual);

  return {
    _id: u._id,
    username: u.username,
    email: u.email,
    createdAt: u.createdAt,
    banned: !!u.banned,
    verificationLevel: u.verificationLevel,
    balanceSc: sc(u.balanceSc),
    bonoPendienteSc: sc(u.bonoPendienteSc),
    jugadoSc: sc(u.jugadoSc),
    compradoSc: de("purchase"),
    canjeadoSc: de("redemption"),
    freeOpens: u.freeOpens,
    rango: rango.nombre,
    rangoColor: rango.color,
    trabas: u.trabas || {},
    notaInterna: u.notaInterna || "",
    canjesAbiertos: canjes,
    pedidosAbiertos: pedidos,
    ultimos: ultimos.map((m) => ({
      _id: m._id,
      createdAt: m.createdAt,
      type: m.type,
      amountSc: sc(m.amountSc),
    })),
  };
}

async function verDelEquipo(hiloId) {
  const hilo = await SupportThread.findById(hiloId)
    .populate("user", "username email jugadoSc verificationLevel banned createdAt")
    .populate("asignado", "username");
  if (!hilo) throw errorDe("NOT_FOUND");

  hilo.leidoPorElEquipoEl = new Date();
  await hilo.save();

  const j = hilo.user || {};

  /*
    EL BORRADOR VA EN `verDelEquipo` Y NO EN `completo`.

    `completo` tambien arma lo que ve el JUGADOR en su chat. Si el
    borrador saliera de ahi, cualquiera podria leer en la respuesta de
    la API la propuesta que todavia no le mandamos --y el motivo, que
    a veces dice "ojo que este viene enojado, derivalo".
  */
  const b = hilo.borradorIa || {};
  const borrador = b.creadoEl
    ? {
      texto: b.texto || "",
      confianza: b.confianza || 0,
      categoria: b.categoria || "",
      derivar: !!b.derivar,
      motivo: b.motivo || "",
      modelo: b.modelo || "",
      creadoEl: b.creadoEl,
      /* Si llegaron mensajes despues, esto ya no contesta lo ultimo. */
      viejo: (b.sobreMensajes || 0) < hilo.mensajes.length,
    }
    : null;

  return Object.assign(completo(hilo), {
    borrador,
    asignadoA: (hilo.asignado && hilo.asignado.username) || "",
    jugador: (await fichaDelJugador(j._id)) || {
      _id: j._id, username: j.username, email: j.email,
    },
  });
}

/**
 * PIDE EL BORRADOR Y LO GUARDA EN LA CONVERSACION.
 *
 * Lo llama el panel, nunca el jugador. Si la IA esta apagada o no hay
 * llave, revienta con AI_OFF y la pantalla lo dice: no hay un camino
 * silencioso donde el boton no haga nada.
 */
async function escribirBorrador({ hiloId, admin }) {
  const cfg = await Settings.leer();
  if (cfg && cfg.soporte && cfg.soporte.borradorDeIa === false) {
    throw errorDe("AI_OFF", {}, 503);
  }

  const hilo = await SupportThread.findById(hiloId);
  if (!hilo) throw errorDe("NOT_FOUND");

  const ficha = await fichaDelJugador(hilo.user);
  const b = await ia.borradorDeSoporte({ hilo, ficha });

  hilo.borradorIa = {
    texto: b.texto,
    confianza: b.confianza,
    categoria: b.categoria,
    derivar: b.derivar,
    motivo: b.motivo,
    modelo: b.modelo,
    sobreMensajes: hilo.mensajes.length,
    creadoEl: b.creadoEl,
    pedidoPor: admin ? admin._id : null,
  };

  /*
    `validateBeforeSave: false` NO, a proposito: si el borrador viene
    con algo que el esquema no acepta, se quiere el error ahora y no
    una conversacion guardada a medias.

    Y no toca `ultimoMensajeEl` ni el estado: escribir un borrador no
    es contestar, y la conversacion tiene que seguir apareciendo como
    pendiente hasta que alguien la conteste de verdad.
  */
  await hilo.save();

  return {
    texto: b.texto,
    confianza: b.confianza,
    categoria: b.categoria,
    derivar: b.derivar,
    motivo: b.motivo,
    modelo: b.modelo,
    creadoEl: b.creadoEl,
    viejo: false,
    costoUsd: ia.costoAproximado(b.tokens),
    tokens: b.tokens,
  };
}

async function responder(datos) {
  const texto = String(datos.texto || "").trim();
  if (!texto) throw errorDe("MESSAGE_REQUIRED");

  const hilo = await SupportThread.findById(datos.hiloId);
  if (!hilo) throw errorDe("NOT_FOUND");

  hilo.agregar({
    deAdmin: true,
    autor: datos.admin._id,
    nombre: datos.admin.username,
    texto,
  });

  /* Contestar es hacerse cargo: si no lo tenía nadie, queda suyo. */
  if (!hilo.asignado) hilo.asignado = datos.admin._id;
  hilo.leidoPorElEquipoEl = new Date();
  if (datos.cerrar) hilo.estado = "closed";

  await hilo.save();
  return completo(hilo);
}

async function mover(datos) {
  const hilo = await SupportThread.findById(datos.hiloId);
  if (!hilo) throw errorDe("NOT_FOUND");

  if (datos.estado) hilo.estado = datos.estado;
  if (datos.asignado !== undefined) hilo.asignado = datos.asignado || null;
  hilo.leidoPorElEquipoEl = new Date();

  await hilo.save();
  return completo(hilo);
}

/** Las respuestas guardadas, que viven en las perillas del sitio. */
async function respuestasGuardadas() {
  const cfg = await Settings.leer();
  const guardadas = (cfg && cfg.soporte && cfg.soporte.respuestas) || [];
  /* Vacia quiere decir "nadie las toco todavia", no "no quiero
     ninguna": el documento de perillas es mas viejo que el campo. */
  return guardadas.length ? guardadas : Settings.RESPUESTAS_POR_DEFECTO;
}

module.exports = {
  mias,
  ver,
  escribir,
  cerrarDelJugador,
  sinLeer,
  bandeja,
  verDelEquipo,
  fichaDelJugador,
  escribirBorrador,
  responder,
  mover,
  respuestasGuardadas,
  TOPE_POR_JUGADOR,
};
