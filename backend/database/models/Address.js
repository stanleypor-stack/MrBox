const mongoose = require("mongoose");

/**
 * UNA DIRECCION DE ENVIO.
 *
 * Donde el jugador quiere que le lleguen los objetos que no vende.
 *
 * POR QUE ES UNA COLECCION Y NO UN CAMPO DEL JUGADOR
 *
 * Porque la gente tiene más de una --la casa y el trabajo-- y porque un
 * pedido tiene que guardar A DONDE SE MANDO, no a dónde manda hoy.
 *
 * Si la dirección viviera en el usuario, mudarse reescribiría el destino
 * de los pedidos ya despachados, y el día que uno se pierda no habría
 * forma de saber adónde salió. Por eso `Order` se guarda una COPIA de
 * los campos, no una referencia a esta fila.
 */
const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    /* A nombre de quién llega el paquete. No tiene por qué ser el
       nombre de usuario, y casi nunca lo es. */
    nombre: { type: String, required: true, trim: true, maxlength: 80 },

    telefono: { type: String, default: "", trim: true, maxlength: 32 },

    calle: { type: String, required: true, trim: true, maxlength: 120 },
    calle2: { type: String, default: "", trim: true, maxlength: 120 },
    ciudad: { type: String, required: true, trim: true, maxlength: 80 },
    provincia: { type: String, default: "", trim: true, maxlength: 80 },
    codigoPostal: { type: String, required: true, trim: true, maxlength: 20 },

    /* Dos letras, como las usa cualquier transportista. */
    pais: { type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 2 },

    /* La que se propone sola al pedir un envío. Una sola por jugador: lo
       asegura `marcarPredeterminada`. */
    predeterminada: { type: Boolean, default: false },
  },
  { timestamps: true }
);

addressSchema.index({ user: 1, createdAt: -1 });

/**
 * Deja UNA sola marcada como predeterminada.
 *
 * Se hace en dos pasos y no en uno porque Mongo no tiene "único
 * parcial por usuario" sin un índice que también bloquearía el caso de
 * no tener ninguna. Dos escrituras seguidas, la de apagar primero: si
 * algo explota en el medio, el jugador queda sin predeterminada --que
 * se arregla eligiendo-- y no con dos, que no se arregla solo.
 */
addressSchema.statics.marcarPredeterminada = async function marcarPredeterminada(userId, addressId) {
  await this.updateMany({ user: userId }, { $set: { predeterminada: false } });
  await this.updateOne({ _id: addressId, user: userId }, { $set: { predeterminada: true } });
};

module.exports = mongoose.model("Address", addressSchema);
