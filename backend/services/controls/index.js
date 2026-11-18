/**
 * LOS LIMITES QUE SE PONE EL JUGADOR.
 *
 * Cuánto está dispuesto a jugar por día, cuánto a perder, y la pausa.
 *
 * LA REGLA QUE HACE QUE ESTO SIRVA
 *
 *     apretar vale ya, aflojar espera 24 horas.
 *
 * Sin eso un límite es un cartel: el momento en que alguien quiere
 * sacárselo es exactamente el momento en que lo necesita. Con eso, el
 * jugador de ayer protege al de hoy, que es de lo que se trata.
 *
 * Y la pausa no se acorta ni se cancela. Si se pudiera, no sería una
 * pausa.
 *
 * DONDE SE REVISA
 *
 * Antes de cobrar, en `boxes.abrir` y en `deals.jugar`. No en el
 * `wallet`: ahí también pasan los premios, los bonos y los ajustes del
 * panel, y un jugador en pausa tiene que poder seguir cobrando lo que
 * ya ganó. Lo que se bloquea es JUGAR, no la cuenta.
 */

const User = require("../../database/models/User");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

/** Cuánto tarda en valer un límite que se afloja. */
const ESPERA_PARA_AFLOJAR_HS = 24;

/** Lo más largo que puede durar una pausa de una sola vez. */
const PAUSA_MAXIMA_DIAS = 365;

/** Los tipos de movimiento que cuentan como "jugar". */
const JUGAR = ["box_open", "deal"];

/**
 * Los límites que VALEN ahora.
 *
 * Si hay un pedido de aflojar y ya pasó su fecha, ese es el que vale y
 * de paso se guarda como el definitivo. Si no llegó la fecha, manda el
 * viejo.
 */
function vigentes(limites) {
  const l = limites || {};
  const p = l.pendiente || {};

  if (p.desde && new Date(p.desde) <= new Date()) {
    return {
      juegoDiarioSc: p.juegoDiarioSc,
      perdidaDiariaSc: p.perdidaDiariaSc,
      yaVale: true,
    };
  }

  return {
    juegoDiarioSc: l.juegoDiarioSc == null ? null : l.juegoDiarioSc,
    perdidaDiariaSc: l.perdidaDiariaSc == null ? null : l.perdidaDiariaSc,
    yaVale: false,
  };
}

/** `true` si el valor nuevo es más permisivo que el viejo. */
function esAflojar(viejo, nuevo) {
  if (nuevo == null) return viejo != null; // sacar el límite siempre afloja
  if (viejo == null) return false; // ponerle límite a algo sin límite aprieta
  return Number(nuevo) > Number(viejo);
}

/** Desde la medianoche UTC de hoy. El mismo corte para todos. */
function arranqueDelDia() {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
}

/**
 * Lo que jugó y lo que perdió hoy.
 *
 * Sale del LIBRO, no de un contador: un contador que se reinicia a
 * medianoche necesita algo que lo reinicie, y lo que no corre no falla.
 */
async function loDeHoy(userId) {
  const desde = arranqueDelDia();

  const filas = await BalanceTransaction.aggregate([
    { $match: { user: userId, createdAt: { $gte: desde } } },
    { $group: { _id: "$type", total: { $sum: "$amountSc" } } },
  ]);

  const por = Object.fromEntries(filas.map((f) => [f._id, f.total]));

  /* Lo jugado son salidas, así que vienen negativas. */
  const jugadoSc = sc(JUGAR.reduce((a, t) => a + Math.abs(por[t] || 0), 0));

  /*
    Lo perdido es lo que puso menos lo que recuperó vendiendo lo que
    ganó. No es exacto al centavo --un objeto que todavía tiene en el
    inventario no está vendido-- y a propósito: contar como "perdido"
    algo que todavía tiene sería mentirle en su contra.
  */
  const recuperadoSc = sc(por.item_sold || 0);
  const perdidaSc = sc(Math.max(0, jugadoSc - recuperadoSc));

  return { jugadoSc, recuperadoSc, perdidaSc, desde };
}

/**
 * ¿PUEDE JUGAR ESTE MONTO?
 *
 * Tira el error que corresponde si no. Se llama ANTES de cobrar.
 */
async function revisarAntesDeJugar({ userId, montoSc }) {
  const usuario = await User.findById(userId).select("limites").lean();
  if (!usuario) return;

  const l = usuario.limites || {};

  if (l.pausaHasta && new Date(l.pausaHasta) > new Date()) {
    throw errorDe("ON_A_BREAK", { hasta: l.pausaHasta }, 403);
  }

  const topes = vigentes(l);
  if (topes.juegoDiarioSc == null && topes.perdidaDiariaSc == null) return;

  const hoy = await loDeHoy(userId);
  const monto = sc(montoSc);

  if (topes.juegoDiarioSc != null && hoy.jugadoSc + monto > topes.juegoDiarioSc + 1e-9) {
    throw errorDe("DAILY_PLAY_LIMIT", {
      tope: sc(topes.juegoDiarioSc),
      jugado: hoy.jugadoSc,
      queda: sc(Math.max(0, topes.juegoDiarioSc - hoy.jugadoSc)),
    }, 403);
  }

  if (topes.perdidaDiariaSc != null && hoy.perdidaSc >= topes.perdidaDiariaSc - 1e-9) {
    throw errorDe("DAILY_LOSS_LIMIT", {
      tope: sc(topes.perdidaDiariaSc),
      perdido: hoy.perdidaSc,
    }, 403);
  }
}

/** Lo que ve el jugador en la pestaña Controls. */
async function leer(userId) {
  const usuario = await User.findById(userId).select("limites").lean();
  const l = (usuario && usuario.limites) || {};
  const topes = vigentes(l);
  const hoy = await loDeHoy(userId);
  const p = l.pendiente || {};

  return {
    juegoDiarioSc: topes.juegoDiarioSc,
    perdidaDiariaSc: topes.perdidaDiariaSc,

    /* Lo que pidió aflojar y todavía no vale. */
    pendiente: p.desde && new Date(p.desde) > new Date()
      ? { juegoDiarioSc: p.juegoDiarioSc, perdidaDiariaSc: p.perdidaDiariaSc, desde: p.desde }
      : null,

    pausaHasta: l.pausaHasta && new Date(l.pausaHasta) > new Date() ? l.pausaHasta : null,

    hoy: { jugadoSc: hoy.jugadoSc, perdidaSc: hoy.perdidaSc },
    esperaHs: ESPERA_PARA_AFLOJAR_HS,
    pausaMaximaDias: PAUSA_MAXIMA_DIAS,
  };
}

/** Deja un monto que sea un monto, o `null`. */
function montoOnulo(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) throw errorDe("INVALID_AMOUNT", { campo: "limite" });
  if (n > 1e7) throw errorDe("ABOVE_MAXIMUM", { maximo: 1e7 });
  return sc(n);
}

/**
 * Guarda los límites.
 *
 * Lo que aprieta se guarda directo. Lo que afloja va al pedido
 * pendiente con su fecha. Si el pedido mezcla las dos cosas --baja uno
 * y sube el otro-- cada campo sigue su propio camino.
 */
async function guardar({ userId, juegoDiarioSc, perdidaDiariaSc }) {
  const usuario = await User.findById(userId).select("limites").lean();
  if (!usuario) throw errorDe("NOT_LOGGED_IN", {}, 401);

  const l = usuario.limites || {};
  const topes = vigentes(l);

  const pedido = {
    juegoDiarioSc: montoOnulo(juegoDiarioSc),
    perdidaDiariaSc: montoOnulo(perdidaDiariaSc),
  };

  const ahora = {
    juegoDiarioSc: topes.juegoDiarioSc,
    perdidaDiariaSc: topes.perdidaDiariaSc,
  };

  const nuevos = { ...ahora };
  const pendiente = { juegoDiarioSc: null, perdidaDiariaSc: null, desde: null };
  let hayPendiente = false;

  for (const campo of ["juegoDiarioSc", "perdidaDiariaSc"]) {
    if (esAflojar(ahora[campo], pedido[campo])) {
      pendiente[campo] = pedido[campo];
      hayPendiente = true;
    } else {
      nuevos[campo] = pedido[campo];
      pendiente[campo] = pedido[campo];
    }
  }

  if (hayPendiente) {
    pendiente.desde = new Date(Date.now() + ESPERA_PARA_AFLOJAR_HS * 60 * 60 * 1000);
  }

  await User.updateOne({ _id: userId }, {
    $set: {
      "limites.juegoDiarioSc": nuevos.juegoDiarioSc,
      "limites.perdidaDiariaSc": nuevos.perdidaDiariaSc,
      "limites.pendiente": hayPendiente ? pendiente : { juegoDiarioSc: null, perdidaDiariaSc: null, desde: null },
      "limites.actualizadoEl": new Date(),
    },
  });

  return leer(userId);
}

/**
 * Tomarse un descanso.
 *
 * Solo se puede ALARGAR: pedir una pausa más corta que la que ya tiene
 * no hace nada. Acortarla sería lo mismo que cancelarla.
 */
async function tomarseUnDescanso({ userId, dias }) {
  const n = Number(dias);
  if (!Number.isFinite(n) || n < 1) throw errorDe("INVALID_AMOUNT", { campo: "dias" });
  if (n > PAUSA_MAXIMA_DIAS) throw errorDe("ABOVE_MAXIMUM", { maximo: PAUSA_MAXIMA_DIAS });

  const usuario = await User.findById(userId).select("limites").lean();
  const actual = usuario && usuario.limites && usuario.limites.pausaHasta
    ? new Date(usuario.limites.pausaHasta) : null;

  const pedida = new Date(Date.now() + Math.floor(n) * 24 * 60 * 60 * 1000);
  const hasta = actual && actual > pedida ? actual : pedida;

  await User.updateOne({ _id: userId }, { $set: { "limites.pausaHasta": hasta } });
  return leer(userId);
}

module.exports = {
  ESPERA_PARA_AFLOJAR_HS,
  PAUSA_MAXIMA_DIAS,
  vigentes,
  esAflojar,
  loDeHoy,
  revisarAntesDeJugar,
  leer,
  guardar,
  tomarseUnDescanso,
};
