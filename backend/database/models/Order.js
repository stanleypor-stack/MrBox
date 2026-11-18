const mongoose = require("mongoose");

/**
 * UN PEDIDO DE ENVIO.
 *
 * El jugador ganó algo y en vez de venderlo por SC pidió que se lo
 * manden. Esto es lo que mira el depósito para armar el paquete.
 *
 * LA DIRECCION VA COPIADA, NO REFERENCIADA
 *
 * Si apuntara a una fila de `Address`, el día que el jugador se mude
 * cambiaría el destino de los pedidos YA DESPACHADOS. Cuando uno se
 * pierda, nadie va a poder decir adónde salió.
 *
 * Lo mismo con el nombre y el valor del objeto: un pedido tiene que
 * poder leerse solo, seis meses después, sin depender de que el
 * catálogo y la libreta de direcciones sigan como estaban.
 *
 * LOS ESTADOS SON POCOS A PROPOSITO
 *
 * `pending` lo pidió, `packing` lo están armando, `shipped` salió,
 * `delivered` llegó, `cancelled` no va. Cada estado nuevo es una
 * pantalla más en el panel y una pregunta más que contestar; cinco
 * alcanzan para saber dónde está algo.
 */
const ESTADOS = ["pending", "packing", "shipped", "delivered", "cancelled"];

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    /* Los objetos del inventario que van en este paquete. */
    items: [{
      inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
      item: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
      name: { type: String, default: "" },
      imageUrl: { type: String, default: "" },
      valueSc: { type: Number, default: 0 },
    }],

    /* Lo que valía todo junto el día que se pidió. */
    valorSc: { type: Number, default: 0 },

    /* La dirección COMO ESTABA. Ver arriba. */
    destino: {
      nombre: String,
      telefono: String,
      calle: String,
      calle2: String,
      ciudad: String,
      provincia: String,
      codigoPostal: String,
      pais: String,
    },

    estado: { type: String, enum: ESTADOS, default: "pending", index: true },

    /* Quién lo lleva y con qué número. Lo llena el panel. */
    transportista: { type: String, default: "" },
    seguimiento: { type: String, default: "" },

    /* Por qué se canceló, para poder decírselo. */
    motivo: { type: String, default: "" },

    despachadoEl: { type: Date, default: null },
    entregadoEl: { type: Date, default: null },
  },
  { timestamps: true }
);

/* El depósito mira los pendientes del más viejo al más nuevo: el que
   más esperó se despacha primero. */
orderSchema.index({ estado: 1, createdAt: 1 });
orderSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
module.exports.ESTADOS = ESTADOS;
