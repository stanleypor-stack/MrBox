const mongoose = require("mongoose");

/**
 * UNA CARRERA.
 *
 * Diaria, semanal o mensual. Todo lo que el jugador juega en la ventana
 * suma, y al cerrarse los primeros se reparten el pozo.
 *
 * POR QUE ES UNA FILA Y NO UNA CUENTA AL VUELO
 *
 * Porque una carrera que ya cerró tiene que poder mirarse como quedó, y
 * no como quedaría si la recalculáramos hoy. El libro cambia --alguien
 * se hace un reembolso, un ajuste a mano-- y una tabla recalculada
 * cambiaría de ganadores seis meses después.
 *
 * Mientras está al aire, las posiciones SI se calculan al vuelo desde
 * el libro: es lo que la hace "en vivo". Al cerrarse se congelan acá.
 */
const raceSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: ["daily", "weekly", "monthly"], required: true, index: true },

    /* La ventana, en UTC. `hasta` no entra: [desde, hasta). */
    desde: { type: Date, required: true },
    hasta: { type: Date, required: true, index: true },

    premioTotalSc: { type: Number, required: true, min: 0 },

    /*
      COMO SE REPARTE.

      Un porcentaje por puesto, del primero al último que cobra. Se
      guarda EN LA CARRERA y no en la configuración porque el día que
      se cambie el reparto, las carreras viejas tienen que seguir
      explicándose con el suyo.
    */
    reparto: { type: [Number], default: [] },

    estado: { type: String, enum: ["live", "settled"], default: "live", index: true },

    /* Cómo quedó. Se llena al cerrar y no se toca más. */
    ganadores: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: String,
      puesto: Number,
      jugadoSc: Number,
      premioSc: Number,
    }],

    cerradaEl: { type: Date, default: null },
  },
  { timestamps: true }
);

/* Buscar la que está al aire de cada tipo es LA consulta de esta tabla. */
raceSchema.index({ tipo: 1, estado: 1, hasta: 1 });

module.exports = mongoose.model("Race", raceSchema);
