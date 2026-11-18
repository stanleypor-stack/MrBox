const mongoose = require("mongoose");

/**
 * EL REGISTRO DE LO QUE HACE EL PANEL.
 *
 * Cada cosa que alguien del equipo cambia desde el panel deja una fila
 * acá: quién, qué, sobre quién, y el antes y el después.
 *
 * POR QUE ESTO NO ES OPCIONAL
 *
 * El panel puede sumarle saldo a una cuenta, aprobar una verificación,
 * publicar una caja y cerrar un pedido. Sin un registro, la pregunta
 * "¿quién le puso SC 5.000 a esta cuenta?" no tiene respuesta, y el
 * día que haya que hacerla va a ser un día malo.
 *
 * Y vale igual para el dueño: un registro con excepciones no es un
 * registro.
 *
 * NO SE PUEDE BORRAR DESDE EL PANEL
 *
 * A propósito. No hay ruta que borre de acá. Lo que se borra solo es lo
 * que cumple dos años, y eso lo hace Mongo.
 */
const adminLogSchema = new mongoose.Schema(
  {
    /* Quién lo hizo. Nunca es nulo: si no hay admin, no hay acción. */
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    adminNombre: { type: String, default: "" },

    /* Qué hizo: "balance.adjust", "box.publish", "order.ship"... */
    evento: { type: String, required: true, index: true },

    /* Sobre qué. El tipo y el id, más algo legible. */
    sobre: {
      tipo: { type: String, default: "" },
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
      nombre: { type: String, default: "" },
    },

    /* El antes y el después, para poder deshacerlo a mano. */
    antes: { type: mongoose.Schema.Types.Mixed, default: null },
    despues: { type: mongoose.Schema.Types.Mixed, default: null },

    /* Por qué. Obligatorio en lo que toca plata. */
    motivo: { type: String, default: "" },

    /* Desde dónde, recortada igual que en las sesiones. */
    desde: { type: String, default: "" },
  },
  { timestamps: true }
);

adminLogSchema.index({ createdAt: -1 });
adminLogSchema.index({ "sobre.id": 1, createdAt: -1 });

/* Dos años. Más que eso no lo mira nadie, y una tabla que solo crece
   termina siendo la más grande de la base por nada. */
adminLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

module.exports = mongoose.model("AdminLog", adminLogSchema);
