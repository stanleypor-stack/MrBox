const Notification = require("../../database/models/Notification");
const { logger } = require("../../utils/logger");

/**
 * LOS AVISOS DE LA CAMPANITA.
 *
 * Un aviso es la consecuencia de algo que ya pasó: la plata ya entró,
 * el premio ya se pagó, el pedido ya salió. Por eso `avisar` NUNCA
 * tira: si falla escribir el aviso, lo que pasó pasó igual, y tumbar
 * un depósito porque no se pudo guardar una notificación sería
 * cambiar algo que importa por algo que no.
 *
 * Es la misma regla que ya usa la comisión del socio en una apertura.
 */

/* Cuántos se le muestran. Más abajo no mira nadie. */
const COMO_MAXIMO = 30;

/**
 * Deja un aviso. No tira nunca: si falla, lo anota en el registro.
 *
 * @param {object}  o
 * @param {string}  o.userId   a quién
 * @param {string}  o.tipo     deposito | retiro | carrera | desafio | envio | rango
 * @param {string}  o.clave    la clave de idioma ("notif.depositOk")
 * @param {object} [o.datos]   lo que la frase necesita ({ monto: 25 })
 * @param {string} [o.destino] a dónde lleva el toque
 */
async function avisar({ userId, tipo, clave, datos = {}, destino = "" }) {
  if (!userId || !clave) return null;

  try {
    return await Notification.create({
      user: userId,
      tipo: tipo || "aviso",
      clave,
      datos,
      destino,
    });
  } catch (err) {
    logger.error(`[avisos] ${clave} a ${userId}: ${err.message}`);
    return null;
  }
}

/** Los últimos, los sin leer arriba del todo por fecha. */
async function listar(userId, limite = COMO_MAXIMO) {
  const cuantos = Math.max(1, Math.min(COMO_MAXIMO, Number(limite) || COMO_MAXIMO));

  const filas = await Notification.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(cuantos)
    .lean();

  return filas.map((f) => ({
    _id: f._id,
    tipo: f.tipo,
    clave: f.clave,
    datos: f.datos || {},
    destino: f.destino || "",
    leida: !!f.leidaEl,
    cuando: f.createdAt,
  }));
}

/** Cuántos no leyó. Es el número de la bolita. */
function sinLeer(userId) {
  return Notification.countDocuments({ user: userId, leidaEl: null });
}

/**
 * Marca como leídos.
 *
 * Sin `ids` marca todos los que tenga sin leer. La condición
 * `leidaEl: null` va en el filtro para no pisar la fecha de uno que ya
 * estaba leído: la primera vez que se lo vio es un dato, no un detalle.
 */
async function marcar(userId, ids = null) {
  const filtro = { user: userId, leidaEl: null };
  if (Array.isArray(ids) && ids.length) filtro._id = { $in: ids.slice(0, COMO_MAXIMO) };

  const r = await Notification.updateMany(filtro, { $set: { leidaEl: new Date() } });
  return r.modifiedCount || 0;
}

module.exports = { avisar, listar, sinLeer, marcar, COMO_MAXIMO };
