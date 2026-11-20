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

const mongoose = require("mongoose");

const InventoryItem = require("../../database/models/InventoryItem");
const Address = require("../../database/models/Address");
const Settings = require("../../database/models/Settings");
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
  const cfg = await Settings.leer();
  /* El piso de verificacion para enviar lo dice el panel, no el codigo. */
  const nivelEnvio = Number(cfg.envioNivelMinimo) || 3;

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

  /*
    La traba va aparte del nivel de verificacion: las dos frenan el
    envio, pero por motivos distintos, y al jugador hay que decirle
    cual de los dos es. "Subi el documento" cuando el problema es que
    soporte freno la cuenta manda a alguien a dar vueltas.
  */
  if (completo.trabas && completo.trabas.envio) throw errorDe("SHIPPING_LOCKED", {}, 403);

  for (const o of objetos) {
    if (o.shippable === false) throw errorDe("ITEM_NOT_SHIPPABLE", { cual: o.name });
    if (!completo.puedeEnviar(o.valueSc, nivelEnvio, cfg.envioQuePideNivel3Sc)) {
      throw errorDe("VERIFICATION_LEVEL_TOO_LOW", {
        cual: o.name,
        necesita: sc(o.valueSc) > sc(cfg.envioQuePideNivel3Sc) ? 3 : nivelEnvio,
        tiene: completo.verificationLevel,
      }, 403);
    }
  }

  /*
    SE TOMAN Y SE FIRMAN EN EL MISMO MOVIMIENTO.

    El numero del pedido se decide ACA, antes de crearlo, y se escribe
    junto con el estado. Asi cada objeto queda tomado y con el nombre
    de su dueño a la vez.

    Antes eran dos pasos --marcar, y mucho despues escribir `order`-- y
    en el medio otro pedido solapado hacia rollback de "todo lo que
    este `requested` sin `order`", que incluia lo que este pedido
    acababa de tomar. El objeto terminaba `held` (vendible) adentro de
    un pedido que el deposito iba a despachar igual.
  */
  const numeroDelPedido = new mongoose.Types.ObjectId();

  const marcados = await InventoryItem.updateMany(
    { _id: { $in: objetos.map((o) => o._id) }, user: user._id, state: "held", order: null },
    { $set: { state: "requested", order: numeroDelPedido } }
  );

  if (marcados.modifiedCount !== objetos.length) {
    /*
      Se devuelve SOLO lo que lleva este numero. Dejar objetos trabados
      por un pedido que no existe es peor que el error, pero tocar los
      de otro pedido es mucho peor que las dos cosas.
    */
    await InventoryItem.updateMany(
      { order: numeroDelPedido },
      { $set: { state: "held", order: null } }
    );
    throw errorDe("ITEM_ALREADY_GONE");
  }

  const pedido = await Order.create({
    _id: numeroDelPedido,
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

  /* El `order` ya quedó escrito arriba, en el mismo update que tomó
     los objetos. No hay segundo paso que pueda pisar nada. */

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
  /*
    EL CAMBIO DE ESTADO VA EN EL FILTRO.

    Antes se leia el pedido, se miraba el estado y despues se
    guardaba: dos cancelaciones a la vez contestaban 200 las dos y
    devolvian los objetos dos veces. Asi, la segunda no encuentra
    pedido que cumpla y dice lo que corresponde.
  */
  const pedido = await Order.findOneAndUpdate(
    { _id: orderId, user: user._id, estado: { $in: ["pending", "packing"] } },
    { $set: { estado: "cancelled", motivo: String(motivo || "").slice(0, 200) } },
    { new: true }
  ).lean();

  if (!pedido) {
    /* O no es suyo, o no existe, o ya no se puede cancelar. */
    const existe = await Order.exists({ _id: orderId, user: user._id });
    throw existe ? errorDe("ITEM_ALREADY_GONE") : errorDe("ITEM_NOT_FOUND", {}, 404);
  }

  await InventoryItem.updateMany(
    { order: pedido._id, user: user._id, state: "requested" },
    { $set: { state: "held", order: null } }
  );

  return { _id: pedido._id, estado: pedido.estado };
}

module.exports = { MAXIMO_POR_PEDIDO, pedir, cancelar };
