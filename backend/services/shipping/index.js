/**
 * MANDAR UN OBJETO A UNA CASA.
 *
 * El jugador ganó algo y en vez de venderlo por SC pide que se lo
 * manden. Esto arma el pedido que después mira el depósito.
 *
 * LO QUE PASA, EN ORDEN
 *
 *   1. mirar que los objetos sean de él y estén en su inventario
 *   2. mirar que se puedan enviar
 *   3. mirar que tenga el nivel de verificación que hace falta
 *   4. marcarlos como pedidos, de forma que no se puedan vender
 *   5. recién ahí armar el pedido
 *
 * El 4 va antes del 5 a propósito y con una condición adentro del
 * filtro: si se armara el pedido primero y después se marcaran, entre
 * las dos cosas el jugador puede venderlos, y el depósito termina
 * mandando algo que el jugador ya cobró.
 *
 * POR QUE LA DIRECCION SE COPIA
 *
 * Porque el día que se mude no puede cambiar el destino de un paquete
 * ya despachado. La copia es la única forma de poder decir, seis meses
 * después, adónde salió.
 *
 * ENVIAR NO DEVUELVE PLATA
 *
 * El objeto se va del inventario y no entra un solo SC: ya lo pagó
 * cuando abrió la caja. Por eso esto no toca la billetera, y es la
 * única operación del inventario que no deja una línea en el libro.
 */

const InventoryItem = require("../../database/models/InventoryItem");
const Address = require("../../database/models/Address");
const Order = require("../../database/models/Order");
const User = require("../../database/models/User");

const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

/** Cuántos objetos entran en un mismo paquete. */
const MAXIMO_POR_PEDIDO = 20;

/**
 * Pide el envío de uno o varios objetos.
 *
 * @param {object} o
 * @param {object} o.user       el jugador, ya cargado
 * @param {string[]} o.ids      qué objetos del inventario
 * @param {string} o.addressId  a cuál de sus direcciones
 */
async function pedir({ user, ids, addressId }) {
  const lista = Array.isArray(ids) ? [...new Set(ids.map(String))] : [];
  if (!lista.length) throw errorDe("NOTHING_TO_SHIP");
  if (lista.length > MAXIMO_POR_PEDIDO) throw errorDe("TOO_MANY_AT_ONCE", { maximo: MAXIMO_POR_PEDIDO });

  /* La dirección: suya, y que exista. Si no mandó cuál, la que tenga
     marcada por defecto. */
  const destino = addressId
    ? await Address.findOne({ _id: addressId, user: user._id }).lean()
    : await Address.findOne({ user: user._id, predeterminada: true }).lean();

  if (!destino) throw errorDe(addressId ? "ADDRESS_NOT_FOUND" : "NO_ADDRESS", {}, addressId ? 404 : 400);

  /* Los objetos: suyos, en mano, y que se puedan enviar. */
  const objetos = await InventoryItem.find({
    _id: { $in: lista },
    user: user._id,
    state: "held",
  }).lean();

  if (objetos.length !== lista.length) throw errorDe("ITEM_ALREADY_GONE");

  const completo = await User.findById(user._id);
  if (!completo) throw errorDe("NOT_LOGGED_IN", {}, 401);

  for (const o of objetos) {
    if (o.shippable === false) throw errorDe("ITEM_NOT_SHIPPABLE", { cual: o.name });
    if (!completo.puedeEnviar(o.valueSc)) {
      throw errorDe("VERIFICATION_LEVEL_TOO_LOW", {
        cual: o.name,
        necesita: sc(o.valueSc) > 1000 ? 3 : 2,
        tiene: completo.verificationLevel,
      }, 403);
    }
  }

  /*
    SE MARCAN ANTES DE ARMAR EL PEDIDO.

    Con la condición `state: "held"` adentro del filtro: si entre la
    lectura de arriba y esto alguien vendió uno, este update no lo toca
    y la cuenta no cierra, así que el pedido no se arma.
  */
  const marcados = await InventoryItem.updateMany(
    { _id: { $in: objetos.map((o) => o._id) }, user: user._id, state: "held" },
    { $set: { state: "requested" } }
  );

  if (marcados.modifiedCount !== objetos.length) {
    /* Se devuelve lo que se haya marcado: dejar objetos trabados por un
       pedido que no existe es peor que el error. */
    await InventoryItem.updateMany(
      { _id: { $in: objetos.map((o) => o._id) }, user: user._id, state: "requested", order: null },
      { $set: { state: "held" } }
    );
    throw errorDe("ITEM_ALREADY_GONE");
  }

  const pedido = await Order.create({
    user: user._id,
    items: objetos.map((o) => ({
      inventoryItem: o._id,
      item: o.item,
      name: o.name,
      imageUrl: o.imageUrl,
      valueSc: sc(o.valueSc),
    })),
    valorSc: sc(objetos.reduce((a, o) => a + o.valueSc, 0)),
    destino: {
      nombre: destino.nombre,
      telefono: destino.telefono || "",
      calle: destino.calle,
      calle2: destino.calle2 || "",
      ciudad: destino.ciudad,
      provincia: destino.provincia || "",
      codigoPostal: destino.codigoPostal,
      pais: destino.pais,
    },
    estado: "pending",
  });

  await InventoryItem.updateMany(
    { _id: { $in: objetos.map((o) => o._id) } },
    { $set: { order: pedido._id } }
  );

  return {
    _id: pedido._id,
    estado: pedido.estado,
    cuantos: objetos.length,
    valorSc: sc(pedido.valorSc),
    destino: pedido.destino,
    createdAt: pedido.createdAt,
  };
}

/**
 * Cancela un pedido que todavía no salió, y devuelve los objetos.
 *
 * Una vez despachado no se cancela: el paquete ya está en la calle.
 */
async function cancelar({ user, orderId, motivo = "" }) {
  const pedido = await Order.findOne({ _id: orderId, user: user._id });
  if (!pedido) throw errorDe("ITEM_NOT_FOUND", {}, 404);
  if (!["pending", "packing"].includes(pedido.estado)) throw errorDe("ITEM_ALREADY_GONE");

  await InventoryItem.updateMany(
    { order: pedido._id, user: user._id, state: "requested" },
    { $set: { state: "held", order: null } }
  );

  pedido.estado = "cancelled";
  pedido.motivo = String(motivo || "").slice(0, 200);
  await pedido.save();

  return { _id: pedido._id, estado: pedido.estado };
}

module.exports = { MAXIMO_POR_PEDIDO, pedir, cancelar };
