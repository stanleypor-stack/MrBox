const mongoose = require("mongoose");

/**
 * UN OBJETO QUE ALGUIEN GANO.
 *
 * Cada fila es un objeto concreto en manos de un jugador. No hay cantidad:
 * ganar dos GoPro son dos filas. Parece derrochador y no lo es — cada una
 * tiene su propio destino (una se vende, la otra se envía) y su propia
 * historia, y eso con un contador no se puede.
 *
 * EL VALOR SE CONGELA
 *
 * `valueSc` es una copia de lo que valía el objeto EL DIA QUE SALIO, no un
 * puntero al catálogo. Si el iPhone baja de precio el mes que viene, al
 * que lo ganó no se le achica lo que tiene: lo ganó cuando valía lo que
 * valía, y por eso se le paga eso si lo vende.
 *
 * LOS ESTADOS
 *
 *   held       está en el inventario, sin hacer nada
 *   sold       lo vendió por SC; `soldFor` dice cuánto se le pagó
 *   requested  pidió que se lo manden, esperando que el depósito lo arme
 *   shipped    salió, con seguimiento
 *   delivered  llegó
 *
 * No hay vuelta atrás desde `sold`: la plata ya está en el saldo.
 */

const ESTADOS = ["held", "sold", "requested", "shipped", "delivered"];

const inventoryItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true, index: true },

    /* La copia congelada. */
    name: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    rarity: { type: String, default: "blue" },
    valueSc: { type: Number, required: true, min: 0 },
    shippable: { type: Boolean, default: true },

    state: { type: String, enum: ESTADOS, default: "held", index: true },

    /* De dónde salió: una caja, un deal, un regalo del panel. */
    source: {
      kind: { type: String, enum: ["box", "deal", "manual"], default: "box" },
      box: { type: mongoose.Schema.Types.ObjectId, ref: "Box", default: null },
      boxOpen: { type: mongoose.Schema.Types.ObjectId, ref: "BoxOpen", default: null },
    },

    /* Lo que se le pagó al venderlo. Se llena una sola vez. */
    soldFor: { type: Number, default: null },
    soldAt: { type: Date, default: null },

    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
  },
  { timestamps: true }
);

/* La pantalla del inventario: lo de este jugador, lo nuevo primero. */
inventoryItemSchema.index({ user: 1, state: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);
module.exports.ESTADOS = ESTADOS;
