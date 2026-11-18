const mongoose = require("mongoose");

/**
 * UN CANJE: SC QUE SALEN DEL SITIO.
 *
 * El jugador pide, una persona del equipo mira, y recién entonces se
 * paga. No es automático a propósito: es la única puerta por la que
 * sale plata de verdad, y del otro lado hay gente probando todo el día.
 *
 * EL SALDO SE DESCUENTA AL PEDIR, NO AL PAGAR
 *
 * Si se descontara al aprobar, alguien podría pedir diez canjes de todo
 * su saldo y, aprobados de a uno, cobrarlos todos. Descontando al pedir,
 * el segundo pedido ya no tiene con qué. Si se rechaza, se devuelve.
 *
 * LA DIRECCION SE COPIA, NO SE REFERENCIA
 *
 * Igual que el domicilio de un envío: la dirección de cobro queda
 * congelada en el pedido. Si el jugador la cambia después, lo que se
 * revisó y lo que se pagó tienen que seguir siendo lo mismo.
 */

const redemptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    /* Lo que pidió. SC 1 = USD 1, así que es también el importe. */
    montoSc: { type: Number, required: true, min: 0 },

    /* A dónde va. Copiado, no referenciado. */
    moneda: { type: String, required: true, trim: true, uppercase: true },
    red: { type: String, required: true, trim: true, uppercase: true },
    direccion: { type: String, required: true, trim: true, maxlength: 200 },

    estado: {
      type: String,
      enum: ["pending", "approved", "paid", "rejected"],
      default: "pending",
      index: true,
    },

    /* Quién lo miró, cuándo y por qué, para poder auditarlo. */
    revisadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    revisadoEl: { type: Date, default: null },
    motivo: { type: String, default: "", maxlength: 300 },

    /* Lo que devuelve la pasarela cuando se paga de verdad. */
    pasarela: { type: String, default: "oxapay" },
    pasarelaId: { type: String, default: "" },
    pagadoEl: { type: Date, default: null },

    /*
      LO QUE SABIAMOS DEL JUGADOR CUANDO PIDIO.

      El nivel de verificación y lo jugado, congelados. Sirven para
      mirar un canje viejo sin tener que adivinar cómo estaba la cuenta
      ese día.
    */
    alPedir: {
      verificationLevel: { type: Number, default: 0 },
      jugadoSc: { type: Number, default: 0 },
      balanceSc: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

/* La cola del panel: lo que espera primero, lo más viejo arriba. */
redemptionSchema.index({ estado: 1, createdAt: 1 });
redemptionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Redemption", redemptionSchema);
