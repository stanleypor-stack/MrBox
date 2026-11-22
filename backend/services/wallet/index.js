/**
 * LA BILLETERA.
 *
 * El único lugar del sitio donde se mueve un saldo. Nada más puede tocar
 * `balanceSc`: si aparece un `$inc: { balanceSc }` en otro archivo, eso es
 * un error, no un atajo.
 *
 * POR QUE TODO PASA POR ACA
 *
 * Dos razones, y las dos son caras de aprender a los golpes.
 *
 * 1. CADA MOVIMIENTO DEJA RASTRO. El saldo y la fila del libro se
 *    escriben juntos, con el saldo de antes y el de después. Así el saldo
 *    de cualquiera se puede reconstruir sumando sus movimientos, en vez
 *    de ser un número que hay que creer. El día que alguien diga que le
 *    faltan SC 40, se mira y se sabe.
 *
 * 2. NADIE GASTA DOS VECES LO MISMO. Descontar es una sola operación
 *    atómica contra la base, con la condición de saldo adentro:
 *
 *        findOneAndUpdate({ _id, balanceSc: { $gte: monto } }, { $inc: ... })
 *
 *    Si dos pedidos entran al mismo tiempo con saldo para uno solo, la
 *    base deja pasar uno y al otro no le encuentra documento. Leer el
 *    saldo, comparar en JavaScript y después guardar —que es lo natural
 *    de escribir— deja pasar los dos: los dos leen el mismo saldo antes
 *    de que ninguno escriba. Con un doble clic alcanza.
 *
 * SOBRE LAS TRANSACCIONES DE MONGO
 *
 * Mover el saldo y escribir el libro son dos operaciones. Entre una y
 * otra hay una ventana donde el proceso podría morirse y dejar un
 * movimiento sin fila. Es chiquita pero existe, así que: si la base
 * soporta transacciones (replica set), se usan; si no, se hace igual y se
 * registra el error a los gritos con todo lo necesario para repararlo a
 * mano. Preferimos un sitio que funciona en una base simple a uno que
 * exige un replica set para abrir una caja.
 */

const mongoose = require("mongoose");

const User = require("../../database/models/User");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

/** Si la base soporta transacciones. Se averigua una sola vez. */
let soportaTransacciones = null;

async function hayTransacciones() {
  if (soportaTransacciones !== null) return soportaTransacciones;
  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    soportaTransacciones = !!(info.setName || info.msg === "isdbgrid");
  } catch {
    soportaTransacciones = false;
  }
  return soportaTransacciones;
}

/**
 * Mueve el saldo de alguien y lo anota.
 *
 * @param {object}  opciones
 * @param {string}  opciones.userId
 * @param {number}  opciones.amountSc   positivo entra, negativo sale
 * @param {string}  opciones.type       uno de BalanceTransaction.TIPOS
 * @param {object}  [opciones.reference] qué lo causó
 * @param {number}  [opciones.bonoSc]   cuánto de esto es bono sin jugar
 * @param {number}  [opciones.juegaSc]  cuánto cuenta como "jugado"
 * @param {string}  [opciones.byAdmin]
 * @param {string}  [opciones.reason]
 *
 * @returns {{ balanceBefore, balanceAfter, transaction }}
 */
async function mover({
  userId,
  amountSc,
  type,
  reference = {},
  bonoSc = 0,
  vecesAJugarElBono = 1,
  juegaSc = 0,
  byAdmin = null,
  reason = "",
  soloCanjeable = false,
}) {
  const monto = sc(amountSc);

  /*
    Un movimiento de cero no es un movimiento: ensucia el libro, no cambia
    nada y suele ser el síntoma de una cuenta que dio mal más arriba.

    LA UNICA EXCEPCION: UNA JUGADA QUE NO CUESTA.

    Una apertura gratis es eso. Tiene que quedar en el libro --de ahi
    salen lo jugado del Club VIP, las carreras y el margen del panel--
    pero no mueve el saldo. Antes se resolvia acreditando el precio y
    cobrandolo acto seguido, y esos dos pasos en paralelo creaban
    plata. Un solo asiento de cero con `juegaSc` dice lo mismo sin
    ventana entre medio.
  */
  if (!Number.isFinite(monto) || (monto === 0 && !(juegaSc > 0))) {
    throw errorDe("INVALID_AMOUNT", { amountSc });
  }

  const filtro = { _id: userId };
  const cambios = { $inc: { balanceSc: monto } };

  /*
    Descontar pide saldo suficiente, y la condición va EN EL FILTRO para
    que la decida la base y no nosotros. Ver el comentario de arriba.
  */
  if (monto < 0) filtro.balanceSc = { $gte: -monto };

  /*
    SACAR PLATA PIDE ADEMAS QUE SEA CANJEABLE.

    El bono que todavia hay que jugar esta en el saldo pero no se puede
    sacar. Mirarlo antes y descontar despues deja una ventana: dos
    pedidos a la vez leen el mismo canjeable y los dos pasan, porque lo
    unico que la base exige al descontar es que alcance el saldo.

    Con `$expr` la condicion la decide la base en el mismo momento en
    que descuenta, que es lo unico que no tiene ventana.
  */
  if (monto < 0 && soloCanjeable) {
    filtro.$expr = {
      $gte: [
        { $subtract: ["$balanceSc", { $max: [{ $ifNull: ["$bonoAtadoSc", 0] }, 0] }] },
        -monto,
      ],
    };
  }

  /*
    EL BONO QUE ENTRA: DOS NUMEROS.

    Lo que falta JUGAR es el bono por el multiplicador. Lo que queda
    ATADO es el bono y nada mas. Usar el primero para trabar el saldo
    ataba tambien la plata del jugador.
  */
  if (bonoSc > 0) {
    const veces = Number(vecesAJugarElBono);
    cambios.$inc.bonoPendienteSc = sc(bonoSc * (Number.isFinite(veces) && veces > 0 ? veces : 1));
    cambios.$inc.bonoAtadoSc = sc(bonoSc);
  }

  /*
    Lo jugado baja el bono pendiente. El `$max` con 0 no existe en Mongo
    dentro de un `$inc`, así que se acota después: ver `acotarBono`.
  */
  if (juegaSc > 0) {
    cambios.$inc.jugadoSc = sc(juegaSc);
    cambios.$inc.bonoPendienteSc = sc((cambios.$inc.bonoPendienteSc || 0) - juegaSc);

    /*
      LO QUE PAGO EL JUGADOR, APARTE DE LO QUE JUGO.

      Una apertura de regalo tambien es jugar --cuenta para las
      carreras, el rakeback y el margen-- pero la pago la casa: su
      asiento es de monto cero. `monto < 0` es exactamente "esto salio
      del saldo", asi que separa una cosa de la otra sin tener que
      mirar de que tipo es cada fila.

      De aca salen los beneficios del Club VIP, que se ganan jugando
      con plata propia (ver services/vip).
    */
    if (monto < 0) cambios.$inc.jugadoPagoSc = sc(juegaSc);
  }

  /*
    LO COMPRADO, APARTE.

    Es el unico lugar por el que entra plata comprada, asi que es el
    unico lugar donde puede llevarse la cuenta sin que se escape nada.
    Se usa para una cosa sola: la comision del socio se paga sobre lo
    que entro y no sobre lo que la casa regalo (ver `anotarComision`).

    `monto > 0` ademas del tipo: un `purchase` en negativo seria una
    devolucion, y una devolucion no es una compra.
  */
  if (type === "purchase" && monto > 0) {
    cambios.$inc.compradoSc = sc(monto);
  }

  const sesion = (await hayTransacciones())
    ? await mongoose.startSession()
    : null;

  try {
    if (sesion) sesion.startTransaction();

    /*
      `new: false` devuelve el documento COMO ESTABA. De ahí sale
      `balanceBefore` exacto: leerlo aparte sería otra carrera.
    */
    const antes = await User.findOneAndUpdate(filtro, cambios, {
      new: false,
      session: sesion || undefined,
    })
      .select("+balanceSc +bonoPendienteSc")
      .lean();

    if (!antes) {
      /*
        O el jugador no existe o no le alcanza. Se distingue, porque
        "no te alcanza" y "no existís" son problemas muy distintos.
      */
      if (sesion) await sesion.abortTransaction();
      const existe = await User.exists({ _id: userId });
      if (!existe) throw errorDe("SESSION_EXPIRED", {}, 401);

      const actual = await User.findById(userId).select("+balanceSc").lean();
      throw errorDe("NOT_ENOUGH_COINS", {
        tiene: sc(actual ? actual.balanceSc : 0),
        necesita: sc(-monto),
        faltan: sc(-monto - (actual ? actual.balanceSc : 0)),
      });
    }

    const balanceBefore = sc(antes.balanceSc);
    const balanceAfter = sc(balanceBefore + monto);

    const [transaction] = await BalanceTransaction.create(
      [
        {
          user: userId,
          type,
          amountSc: monto,
          /* Lo que cuenta como jugado, que en una apertura gratis NO
             es el importe: ver el comentario del campo en el modelo. */
          juegaSc: sc(juegaSc) || 0,
          balanceBefore,
          balanceAfter,
          reference,
          byAdmin,
          reason,
        },
      ],
      { session: sesion || undefined }
    );

    if (sesion) await sesion.commitTransaction();

    /* El bono pendiente nunca puede quedar negativo. */
    await acotarBono(userId, sesion);

    return { balanceBefore, balanceAfter, transaction };
  } catch (err) {
    if (sesion && sesion.inTransaction()) {
      await sesion.abortTransaction().catch(() => {});
    }
    throw err;
  } finally {
    if (sesion) await sesion.endSession().catch(() => {});
  }
}

/**
 * Deja el bono pendiente en cero si quedó negativo.
 *
 * Pasa cuando alguien juega más de lo que le regalaron, que es lo normal
 * y lo que queremos. Se arregla con una operación aparte porque `$inc` no
 * sabe acotar, y se hace condicionada para no escribir cuando no hace
 * falta.
 */
async function acotarBono(userId, sesion = null) {
  await User.updateOne(
    { _id: userId, bonoPendienteSc: { $lt: 0 } },
    { $set: { bonoPendienteSc: 0 } },
    { session: sesion || undefined }
  );

  /* Cumplido lo de jugar, el bono se suelta. */
  await User.updateOne(
    { _id: userId, bonoPendienteSc: { $lte: 0 }, bonoAtadoSc: { $gt: 0 } },
    { $set: { bonoAtadoSc: 0 } },
    { session: sesion || undefined }
  );
}

/** El saldo de alguien, y cuánto de eso puede sacar. */
async function saldoDe(userId) {
  const u = await User.findById(userId)
    .select("+balanceSc +bonoPendienteSc +bonoAtadoSc jugadoSc freeOpens")
    .lean();
  if (!u) throw errorDe("SESSION_EXPIRED", {}, 401);

  const balance = sc(u.balanceSc);
  const porJugar = Math.max(0, sc(u.bonoPendienteSc));
  const atado = Math.max(0, sc(u.bonoAtadoSc));

  return {
    balanceSc: balance,
    /* Cuanto falta JUGAR para soltar el bono. */
    bonoPendienteSc: porJugar,
    /* Y cuanto del saldo esta trabado, que es el bono y nada mas. */
    bonoAtadoSc: atado,
    /*
      Lo que se puede pedir para canjear: todo menos el bono trabado.

      Antes restaba lo que falta jugar, que con 10x es diez veces mas
      grande: un bono de 50 trababa 500 de un saldo de 150 y el jugador
      no podia sacar ni lo suyo.
    */
    canjeableSc: sc(Math.max(0, balance - atado)),
    /*
      Y lo jugado, que viaja con el saldo a proposito.

      De el salen el rango VIP, el puesto en la carrera y el rakeback, y
      la pantalla los muestra arriba de todo. Sin esto, alguien abria
      una caja y el cartel del Club VIP seguia diciendo el numero de
      antes hasta recargar la pagina.
    */
    jugadoSc: sc(u.jugadoSc),
    freeOpens: u.freeOpens,
  };
}

module.exports = { mover, saldoDe, acotarBono, hayTransacciones };
