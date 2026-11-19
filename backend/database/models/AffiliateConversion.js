const mongoose = require("mongoose");

/**
 * UN REFERIDO, Y COMO VA.
 *
 * Una fila por jugador traído, desde que se registra hasta que el socio
 * cobra por él. Es la memoria del pago por cabeza: sin esto no hay
 * manera de saber si a alguien ya se le pagó por ese jugador.
 *
 * LOS CINCO ESTADOS
 *
 *   nuevo ........ se registró con el código y todavía no hizo nada
 *   deposito ..... puso plata, pero le falta jugar o verificarse
 *   califica ..... cumplió todo; está esperando los días de espera
 *   pagado ....... el socio ya tiene la plata anotada como ganada
 *   anulado ...... alguien del equipo lo frenó, con motivo
 *
 * SOLO SE PUEDE AVANZAR
 *
 * Nunca se vuelve de `pagado` a `califica`. Si hay que deshacer un
 * pago, se anula --que deja rastro y motivo-- y nunca se reescribe la
 * historia.
 *
 * POR QUE EL INDICE UNICO ES EL CORAZON DE ESTO
 *
 * `(code, user)` único quiere decir que un jugador puede pagarle UNA
 * vez a UNA campaña. Es una regla de la base de datos, no un `if`: con
 * un `if`, dos pedidos al mismo tiempo pagan dos veces, y en un
 * programa de afiliados eso no se descubre hasta que alguien mira la
 * factura del mes.
 */
const affiliateConversionSchema = new mongoose.Schema(
  {
    code: { type: mongoose.Schema.Types.ObjectId, ref: "AffiliateCode", required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    estado: {
      type: String,
      enum: ["nuevo", "deposito", "califica", "pagado", "anulado"],
      default: "nuevo",
      index: true,
    },

    /* Cómo viene contra lo que pide el programa. Sale del LIBRO. */
    depositadoSc: { type: Number, default: 0 },
    jugadoSc: { type: Number, default: 0 },
    nivelKyc: { type: Number, default: 0 },

    /* El modelo con el que se creó. Si la campaña cambia después, lo
       que ya calificó sigue valiendo lo que valía. */
    modelo: { type: String, default: "hibrido" },

    /* Lo que le toca al socio por esta cabeza, congelado al calificar. */
    montoSc: { type: Number, default: 0 },

    calificoEl: { type: Date, default: null },
    /* Desde cuándo se puede pagar: calificó + los días de espera. */
    liberaEl: { type: Date, default: null, index: true },
    pagadoEl: { type: Date, default: null },

    /* Por qué se anuló, y quién. */
    motivo: { type: String, default: "", maxlength: 300 },
    porQuien: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    /*
      LO QUE HAY QUE MIRAR ANTES DE PAGAR.

      Señales, no acusaciones: una dirección repetida puede ser una
      familia. Se guardan para que una persona decida, no para anular
      sola.
    */
    senales: { type: [String], default: [] },
  },
  { timestamps: true }
);

/* Un jugador paga una sola vez, y a una sola campaña. */
affiliateConversionSchema.index({ code: 1, user: 1 }, { unique: true });

/* Para la cola del panel: lo que está esperando que alguien lo mire. */
affiliateConversionSchema.index({ estado: 1, liberaEl: 1 });

module.exports = mongoose.model("AffiliateConversion", affiliateConversionSchema);
