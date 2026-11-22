/**
 * LO QUE COMPARTEN LOS OCHO JUEGOS.
 *
 * Cada juego pone su matemática y nada más. Cobrar, pagar, reservar
 * el nonce, anotar la ronda y respetar los límites del jugador se
 * hace UNA vez, acá. Si cada juego lo hiciera por su cuenta, ocho
 * copias de la misma cuenta serían ocho lugares donde se puede
 * escapar plata, y la octava no se parecería a la primera.
 *
 * EL ORDEN IMPORTA, Y ES ESTE
 *
 *   1. la jugada se revisa    ANTES de tocar el saldo
 *   2. los límites del jugador
 *   3. se cobra la apuesta    (la base decide si alcanza)
 *   4. se reserva el nonce    (atómico, uno por ronda)
 *   5. se sortea
 *   6. se anota la ronda
 *   7. se paga, si ganó
 *
 * LA JUGADA SE REVISA PRIMERO, Y NO ES UN DETALLE DE ORDEN.
 *
 * Antes se cobraba y después cada juego miraba lo que le habían
 * mandado. Una jugada imposible --un `between 50 51`, un modo que no
 * existe-- cobraba la apuesta y recién ahí fallaba: plata descontada,
 * ninguna ronda, nada que mostrarle al jugador. Lo agarró la prueba:
 * cuatro pedidos malos le sacaron 40 SC a una cuenta de 100.
 *
 * Cobrar antes de SORTEAR sigue estando bien, y es lo que hace que no
 * se pueda jugar sin saldo ni cancelar una ronda perdida: cuando el
 * resultado existe, la plata ya salió. Y el nonce se reserva con un
 * `$inc` que devuelve el valor nuevo, así que dos rondas al mismo
 * tiempo no pueden tomar el mismo número y dar el mismo resultado.
 */

const User = require("../../database/models/User");
const UserSeed = require("../../database/models/UserSeed");
const GameRound = require("../../database/models/GameRound");
const Settings = require("../../database/models/Settings");
const cfgJuegos = require("./config");

const wallet = require("../wallet");
const controles = require("../controls");
const fairDeCajas = require("../boxes/fair");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

/**
 * LA TANDA DE SEMILLAS DEL JUGADOR.
 *
 * La misma que usan las cajas: un jugador tiene UNA tanda activa y
 * todo lo que sortea sale de ahí. Así la pantalla de verificación no
 * tiene que saber si lo que verifica fue una caja o un dado.
 */
async function semillaDe(userId) {
  const activa = await UserSeed.findOne({ user: userId, activa: true }).select("+semillaServidor");
  if (activa) return activa;

  const semilla = fairDeCajas.semillaNueva();
  const creada = await UserSeed.create({
    user: userId,
    semillaServidor: semilla,
    semillaServidorHash: fairDeCajas.hashDeSemilla(semilla),
    semillaCliente: fairDeCajas.semillaNueva().slice(0, 16),
    nonce: 0,
    activa: true,
  });
  return UserSeed.findById(creada._id).select("+semillaServidor");
}

/**
 * RESERVA EL PROXIMO NONCE.
 *
 * Con un `$inc` que devuelve el valor nuevo. Leerlo, sortear y
 * después guardarlo dejaría que dos rondas a la vez tomaran el mismo
 * número y salieran iguales, que es justo lo que el sorteo
 * verificable tiene que hacer imposible.
 */
async function proximoNonce(tandaId) {
  const movida = await UserSeed.findOneAndUpdate(
    { _id: tandaId },
    { $inc: { nonce: 1 } },
    { new: true }
  ).select("+semillaServidor semillaCliente semillaServidorHash nonce").lean();

  if (!movida) throw errorDe("NO_SEED");
  return movida;
}

/*
  CUANTAS RONDAS COMO MINIMO PARA LIMPIAR UN BONO.

  Con un bono de SC 250 por jugar, el tope de apuesta queda en 2,50:
  hacen falta al menos cien rondas. Sin esto, una sola apuesta grande
  a algo casi parejo limpia el bono entero de una, que es jugar a cara
  o cruz con plata de la casa.

  Los dos números son los de BetSweeps.
*/
const RONDAS_MINIMAS_CON_BONO = 100;
const TOPE_MINIMO_CON_BONO = 5;

/**
 * EL TOPE DE APUESTA MIENTRAS QUEDE BONO POR JUGAR.
 *
 * En BetSweeps esto miraba la moneda, porque allá hay dos. Acá hay
 * una sola, así que la condición es más corta: si debe rollover, se
 * aplica.
 */
async function revisarTopePorBono(userId, montoSc, cfg) {
  const u = await User.findById(userId).select("+bonoPendienteSc").lean();
  const pendiente = Number(u && u.bonoPendienteSc) || 0;
  if (pendiente <= 0) return;

  const tope = Math.max(TOPE_MINIMO_CON_BONO, pendiente / RONDAS_MINIMAS_CON_BONO);
  if (montoSc > tope + 1e-9) {
    throw errorDe("ABOVE_MAXIMUM", { maximo: sc(tope), porElBono: true });
  }
}

/** La apuesta, limpia y dentro de lo que permite el sitio. */
async function revisarApuesta(apuestaSc, cfg) {
  const monto = sc(apuestaSc);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw errorDe("INVALID_AMOUNT", { campo: "apuesta" });
  }

  const { minimaSc: minimo, maximaSc: maximo } = cfgJuegos.limites(cfg);

  if (monto < minimo) throw errorDe("BELOW_MINIMUM", { minimo });
  if (maximo > 0 && monto > maximo) throw errorDe("ABOVE_MAXIMUM", { maximo });

  return monto;
}

/**
 * UNA RONDA QUE EMPIEZA Y TERMINA DE UNA.
 *
 * Dice, Keno, Reme, Plinko y Slide son así: se apuesta, sale el
 * resultado y se acabó. Mines y Towers usan `abrir` y `seguir`, que
 * están abajo y se apoyan en lo mismo.
 *
 * @param {object} o
 * @param {object} o.user      el jugador
 * @param {string} o.juego     cual de los ocho
 * @param {number} o.apuestaSc cuánto
 * @param {Function} [o.revisar] mira la jugada ANTES de cobrar y
 *                             devuelve lo que haya que pasarle al
 *                             sorteo. Tira si la jugada no se puede.
 * @param {Function} o.sortear recibe `{ apuestaSc, semillas, cfg, jugada }`
 *                             y devuelve `{ gano, multiplicador, pagoSc,
 *                             hmacs, jugada, ...resultado }`
 */
async function jugarUnaRonda({ user, juego, apuestaSc, revisar, sortear }) {
  const cfg = await Settings.leer();

  if ((cfg.juegos || {}).apagados) throw errorDe("GAMES_OFF", {}, 403);

  const monto = await revisarApuesta(apuestaSc, cfg);

  /* 1. La jugada, antes que nada: ver el comentario de arriba. */
  const jugada = typeof revisar === "function" ? revisar({ apuestaSc: monto, cfg }) : null;

  /* 2. El tope por bono sin jugar, y los límites que se puso. */
  await revisarTopePorBono(user._id, monto, cfg);
  await controles.revisarAntesDeJugar({ userId: user._id, montoSc: monto });

  const tanda = await semillaDe(user._id);

  /* 3. Se cobra. La base decide si alcanza, en el mismo update. */
  await wallet.mover({
    userId: user._id,
    amountSc: -monto,
    type: "game_bet",
    juegaSc: monto,
    reference: { kind: "game", label: juego },
  });

  /* 4. El nonce, atómico. */
  const movida = await proximoNonce(tanda._id);

  const semillas = {
    semillaServidor: movida.semillaServidor,
    semillaCliente: movida.semillaCliente,
    nonce: movida.nonce,
  };

  /*
    5. El sorteo. Si acá se rompe algo --un error nuestro, no una
    jugada mala, que ya se filtró arriba-- la apuesta vuelve. Una
    cuenta a la que le descontaron sin que pasara nada es la peor
    forma de enterarse de un bug.
  */
  let r;
  try {
    r = sortear({ apuestaSc: monto, semillas, cfg, jugada });
  } catch (err) {
    await wallet.mover({
      userId: user._id,
      amountSc: monto,
      type: "game_win",
      reason: "devolucion por error",
      reference: { kind: "game", label: juego },
    }).catch(() => {});
    throw err;
  }

  /*
    EL TOPE DE LA CASA, ANTES DE ANOTAR NADA.

    Ninguna ronda paga mas que `maximoPremioSc`, salga lo que salga.
    Es el "Max win" que muestra la pantalla y es el numero de
    BetSweeps. El margen dice lo que la casa gana EN PROMEDIO; esto
    es lo que impide que una sola ronda se lleve la caja: un Keno de
    1010x sobre la apuesta maxima paga medio millon sin esto.

    Se aplica aca, en el unico lugar por el que pasan los ocho, para
    que ningun juego pueda saltearselo por olvido. Y lo que se anota
    es el multiplicador RECORTADO, no el que salio: si se guardara el
    otro, el libro diria una cosa y la plata otra.
  */
  const acotado = cfgJuegos.acotarPago(monto, sc(r.pagoSc || 0), cfg);
  const pagoFinal = acotado.pagoSc;
  const multFinal = acotado.recortado ? acotado.multiplicador : (r.multiplicador || 0);

  /* 6. La ronda queda anotada ANTES de pagar: una ronda pagada que no
        figura en ningún lado no se puede auditar después. */
  const ronda = await GameRound.create({
    user: user._id,
    juego,
    apuestaSc: monto,
    jugada: r.jugada || {},
    resultado: r.resultado || {},
    multiplicador: multFinal,
    pagoSc: pagoFinal,
    semillaServidorHash: movida.semillaServidorHash,
    semillaCliente: movida.semillaCliente,
    nonce: movida.nonce,
    hmacs: r.hmacs || [],
    abierta: false,
    cerradaEl: new Date(),
  });

  /* 7. Y recién ahora se paga. */
  if (pagoFinal > 0) {
    await wallet.mover({
      userId: user._id,
      amountSc: pagoFinal,
      type: "game_win",
      reference: { kind: "game", id: ronda._id, label: juego },
    });
  }

  /*
    LOS DESAFIOS TODAVIA NO MIRAN LOS JUEGOS.

    `retos.revisar()` está escrito para una apertura: recibe la caja y
    el objeto que salió. Un juego no tiene ni una cosa ni la otra, así
    que llamarlo con nulos no haría nada y además taparía el día que
    alguien quiera un desafío de juegos de verdad.

    Lo jugado SI cuenta igual: sale del libro, no de acá, así que las
    carreras, el rakeback y el Club VIP ya ven estas rondas.
  */
  const saldo = await wallet.saldoDe(user._id);

  return {
    juego,
    rondaId: ronda._id,
    apuestaSc: monto,
    ...r,
    /* Lo que de verdad se pago, despues del tope. Va DESPUES de `r`
       para que pise lo que calculo el juego. */
    multiplicador: multFinal,
    pagoSc: pagoFinal,
    topeDeLaCasa: acotado.recortado,
    prueba: {
      semillaServidorHash: movida.semillaServidorHash,
      semillaCliente: movida.semillaCliente,
      nonce: movida.nonce,
      hmacs: r.hmacs || [],
    },
    ...saldo,
  };
}

/* ── Las rondas que duran varios clicks ───────────────────────────── */

/**
 * ABRE UNA RONDA.
 *
 * Mines, Dragon's Tower y Crash no terminan en el mismo pedido en que
 * empiezan: el jugador destapa, sube o espera, y recién después
 * cobra. Eso cambia tres cosas, y ninguna es de adorno.
 *
 * EL RESULTADO YA ESTA SORTEADO, PERO TAPADO
 *
 * El tablero entero --o el punto de reventón-- se sortea ACA, cuando
 * se abre, y se guarda en `oculto`, que el modelo no devuelve nunca.
 * Decidir en cada click, sabiendo cuánto va ganando el jugador, es
 * exactamente lo que un sorteo verificable tiene que hacer
 * imposible.
 *
 * SE COBRA AL ABRIR
 *
 * La apuesta sale del saldo acá y no al cobrar. Así no se puede
 * abandonar una ronda perdida: cuando el tablero existe, la plata ya
 * salió.
 *
 * UNA SOLA ABIERTA POR JUEGO
 *
 * Lo garantiza el índice único de `GameRound`, no un `if`: dos
 * pestañas abriendo a la vez chocan contra la base, y la segunda
 * recibe el error en vez de pisar la primera.
 */
async function abrirRonda({ user, juego, apuestaSc, revisar, repartir }) {
  const cfg = await Settings.leer();

  if ((cfg.juegos || {}).apagados) throw errorDe("GAMES_OFF", {}, 403);

  const monto = await revisarApuesta(apuestaSc, cfg);
  const jugada = typeof revisar === "function" ? revisar({ apuestaSc: monto, cfg }) : {};

  await revisarTopePorBono(user._id, monto, cfg);
  await controles.revisarAntesDeJugar({ userId: user._id, montoSc: monto });

  /*
    SE MIRA ANTES DE COBRAR SI YA TENIA UNA ABIERTA.

    El índice único alcanza para que no queden dos, pero si se cobra
    primero y el índice rebota después, la apuesta quedó descontada
    por una ronda que no existe.
  */
  const abierta = await GameRound.findOne({ user: user._id, juego, abierta: true }).lean();
  if (abierta) throw errorDe("ROUND_OPEN", { juego, rondaId: abierta._id }, 409);

  const tanda = await semillaDe(user._id);

  await wallet.mover({
    userId: user._id,
    amountSc: -monto,
    type: "game_bet",
    juegaSc: monto,
    reference: { kind: "game", label: juego },
  });

  const movida = await proximoNonce(tanda._id);
  const semillas = {
    semillaServidor: movida.semillaServidor,
    semillaCliente: movida.semillaCliente,
    nonce: movida.nonce,
  };

  let r;
  try {
    r = repartir({ apuestaSc: monto, semillas, cfg, jugada });
  } catch (err) {
    /* Igual que en una ronda de una sola vuelta: si el reparto se
       rompe por un error nuestro, la apuesta vuelve. */
    await wallet.mover({
      userId: user._id, amountSc: monto, type: "game_win",
      reason: "devolucion por error", reference: { kind: "game", label: juego },
    }).catch(() => {});
    throw err;
  }

  let ronda;
  try {
    ronda = await GameRound.create({
      user: user._id,
      juego,
      apuestaSc: monto,
      jugada: { ...jugada, ...(r.jugada || {}) },
      resultado: r.publico || {},
      oculto: r.oculto || {},
      multiplicador: 0,
      pagoSc: 0,
      semillaServidorHash: movida.semillaServidorHash,
      semillaCliente: movida.semillaCliente,
      nonce: movida.nonce,
      hmacs: r.hmacs || [],
      abierta: true,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      await wallet.mover({
        userId: user._id, amountSc: monto, type: "game_win",
        reason: "devolucion: ya tenia una ronda abierta",
        reference: { kind: "game", label: juego },
      }).catch(() => {});
      throw errorDe("ROUND_OPEN", { juego }, 409);
    }
    throw err;
  }

  return {
    juego,
    rondaId: ronda._id,
    apuestaSc: monto,
    ...(r.publico || {}),
    prueba: {
      semillaServidorHash: movida.semillaServidorHash,
      semillaCliente: movida.semillaCliente,
      nonce: movida.nonce,
    },
    ...(await wallet.saldoDe(user._id)),
  };
}

/** La ronda abierta de un jugador, con lo tapado adentro. */
async function rondaAbierta(userId, juego) {
  const r = await GameRound.findOne({ user: userId, juego, abierta: true })
    .select("+oculto")
    .lean();
  if (!r) throw errorDe("NO_ROUND", { juego }, 404);
  return r;
}

/**
 * CIERRA UNA RONDA Y PAGA, SI HAY QUE PAGAR.
 *
 * El cierre va con la condición `abierta: true` adentro del update:
 * dos pedidos de cobrar al mismo tiempo --dos clicks, dos pestañas--
 * y solo uno encuentra la ronda abierta. El otro no paga.
 */
async function cerrarRonda({ userId, ronda, multiplicador, pagoSc, resultado }) {
  /* El mismo tope que en las de una sola vuelta: ver el comentario
     de `jugarUnaRonda`. Mines y Towers son justamente los que mas
     alto pueden llegar. */
  const cfg = await Settings.leer();
  const acotado = cfgJuegos.acotarPago(ronda.apuestaSc, sc(pagoSc || 0), cfg);
  const pagoFinal = acotado.pagoSc;
  const multFinal = acotado.recortado ? acotado.multiplicador : (multiplicador || 0);

  const cerrada = await GameRound.findOneAndUpdate(
    { _id: ronda._id, abierta: true },
    {
      $set: {
        abierta: false,
        cerradaEl: new Date(),
        multiplicador: multFinal,
        pagoSc: pagoFinal,
        resultado: resultado || ronda.resultado || {},
      },
    },
    { returnDocument: "after" },
  ).lean();

  if (!cerrada) throw errorDe("NO_ROUND", { juego: ronda.juego }, 409);

  if (pagoFinal > 0) {
    await wallet.mover({
      userId,
      amountSc: pagoFinal,
      type: "game_win",
      reference: { kind: "game", id: ronda._id, label: ronda.juego },
    });
  }

  return cerrada;
}

/** Guarda el avance de una ronda que sigue abierta. */
async function guardarAvance({ ronda, resultado, oculto }) {
  const cambios = { resultado };
  if (oculto) cambios.oculto = oculto;

  const r = await GameRound.findOneAndUpdate(
    { _id: ronda._id, abierta: true },
    { $set: cambios },
    { returnDocument: "after" },
  ).lean();

  if (!r) throw errorDe("NO_ROUND", { juego: ronda.juego }, 409);
  return r;
}

module.exports = {
  RONDAS_MINIMAS_CON_BONO,
  TOPE_MINIMO_CON_BONO,
  revisarTopePorBono,
  semillaDe,
  proximoNonce,
  revisarApuesta,
  jugarUnaRonda,
  abrirRonda,
  rondaAbierta,
  cerrarRonda,
  guardarAvance,
};
