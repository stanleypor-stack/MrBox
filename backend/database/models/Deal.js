const mongoose = require("mongoose");

/**
 * UN TIRO DE LA RULETA DE DEALS.
 *
 * Deals es el otro juego del sitio. En vez de abrir una caja con muchos
 * premios, el jugador elige UN objeto del catálogo y pone cuánta chance
 * quiere de llevárselo. La rueda gira: o se lo lleva, o pierde lo que
 * puso.
 *
 * POR QUE SE GUARDA EL TIRO ENTERO
 *
 * Por lo mismo que se guarda el recibo de una apertura: para que tres
 * meses después se pueda rehacer la cuenta sin depender de que el
 * catálogo siga igual. Si mañana ese objeto baja de precio, el tiro de
 * hoy tiene que seguir verificándose con el valor de hoy.
 *
 * Por eso van copiados acá el nombre, el valor y la chance: no es
 * duplicar por duplicar, es congelar la prueba.
 */
const dealSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    /* A qué objeto apuntó. La referencia, para los informes. */
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", index: true },

    /* Y una copia de cómo estaba, para la prueba. */
    itemName: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    rarity: { type: String, default: "blue" },
    valueSc: { type: Number, required: true, min: 0 },

    /* La chance que eligió, entre 0 y 1. */
    chance: { type: Number, required: true, min: 0, max: 1 },

    /* Lo que le costó ese tiro. Sale de la chance, no al revés. */
    stakeSc: { type: Number, required: true, min: 0 },

    gano: { type: Boolean, required: true, index: true },

    /* ── La prueba ────────────────────────────────────────────────── */
    semillaServidorHash: { type: String, default: "" },
    semillaCliente: { type: String, default: "" },
    nonce: { type: Number, default: 0 },
    hmac: { type: String, default: "" },
    numero: { type: Number, default: 0 },

    /* El objeto que se llevó, si se lo llevó. */
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", default: null },

    /* Un tiro de prueba: no cobra, no paga, no cuenta para nada. */
    demo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

/* El historial del jugador, y el feed de ganadores. */
dealSchema.index({ user: 1, createdAt: -1 });
dealSchema.index({ demo: 1, gano: 1, createdAt: -1 });

module.exports = mongoose.model("Deal", dealSchema);
