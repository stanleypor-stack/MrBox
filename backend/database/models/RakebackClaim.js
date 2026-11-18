const mongoose = require("mongoose");

/**
 * UN COBRO DE RAKEBACK.
 *
 * Una fila por jugador, periodo y ventana. Existe para una sola cosa:
 * que no se pueda cobrar dos veces lo mismo.
 *
 * EL INDICE UNICO ES LA REGLA, NO UN `if`
 *
 * Un `if (yaCobro) return` en el código pierde contra dos clicks
 * rápidos: los dos leen "no cobró" antes de que ninguno escriba. El
 * índice único no pierde nunca, porque la que decide es la base.
 *
 * Por eso la fila se crea ANTES de mover la plata, y si choca contra el
 * índice, no se mueve nada.
 */
const rakebackClaimSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    periodo: { type: String, enum: ["daily", "weekly", "monthly"], required: true },

    /* La ventana, en UTC. `desde` es lo que hace única a la fila. */
    desde: { type: Date, required: true },
    hasta: { type: Date, required: true },

    /* Lo que jugó en esa ventana y el porcentaje de su rango, guardados
       para poder explicar el monto meses después aunque el rango o la
       tabla de porcentajes hayan cambiado. */
    jugadoSc: { type: Number, default: 0 },
    pct: { type: Number, default: 0 },

    montoSc: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

/* LA regla de esta tabla. */
rakebackClaimSchema.index({ user: 1, periodo: 1, desde: 1 }, { unique: true });

module.exports = mongoose.model("RakebackClaim", rakebackClaimSchema);
