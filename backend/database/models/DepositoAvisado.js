const mongoose = require("mongoose");

/**
 * UN AVISO DE PAGO YA PROCESADO.
 *
 * Las pasarelas reintentan: el mismo pago puede llegar dos, tres o diez
 * veces. Lo que impide acreditarlo dos veces no puede ser un "¿ya está?"
 * seguido de un "entonces acredito": dos avisos a la vez leen los dos
 * que no está y los dos acreditan.
 *
 * Esta fila se crea ANTES de mover la plata, con el `trackId` único. El
 * segundo aviso choca contra el índice y no acredita nada. Es la misma
 * idea que la fila de uso de un código promocional.
 */
const depositoAvisadoSchema = new mongoose.Schema(
  {
    /* El id del pago en la pasarela. Es lo que no se puede repetir. */
    trackId: { type: String, required: true, unique: true, index: true },

    pasarela: { type: String, default: "oxapay" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    montoSc: { type: Number, default: 0 },

    /* Si la acreditación terminó bien. Un aviso que entró pero falló al
       acreditar queda acá en `false` y se ve en el panel. */
    acreditado: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DepositoAvisado", depositoAvisadoSchema);
