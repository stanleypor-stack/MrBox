const mongoose = require("mongoose");

/**
 * UN BENEFICIO DEL CLUB VIP YA COBRADO.
 *
 * Una fila por jugador, beneficio y vuelta. Existe para una sola cosa:
 * que no se pueda cobrar dos veces lo mismo. Es la misma idea que
 * `RakebackClaim`, y por el mismo motivo: la regla la decide la base
 * con un índice único, no un `if` en el código, que pierde contra dos
 * clicks rápidos.
 *
 * QUE ES UNA "VUELTA"
 *
 * Depende del beneficio, y por eso es un texto y no una fecha:
 *
 *   levelUpBox  el nombre del rango        "Gold"
 *   weeklyBox   la semana, en UTC          "2026-W47"
 *   monthlyBox  el mes, en UTC             "2026-11"
 *
 * Así la caja de subir se da UNA VEZ por rango --y no otra vez si
 * alguien baja y vuelve a subir-- y las periódicas, una por ventana.
 */
const vipBeneficioSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    clave: {
      type: String,
      enum: ["levelUpBox", "weeklyBox", "monthlyBox"],
      required: true,
    },

    /* Ver arriba: el rango, la semana o el mes. */
    vuelta: { type: String, required: true },

    /*
      EL RANGO QUE TENIA AL COBRARLO.

      Guardado para poder explicar meses después por qué le tocó esa
      caja, aunque después haya subido o la tabla haya cambiado.
    */
    rango: { type: String, default: "" },

    /* Qué caja se le dio. El slug, que es lo que no cambia. */
    cajaSlug: { type: String, default: "" },
    cajaNombre: { type: String, default: "" },
  },
  { timestamps: true }
);

/* LA regla de esta tabla. */
vipBeneficioSchema.index({ user: 1, clave: 1, vuelta: 1 }, { unique: true });

module.exports = mongoose.model("VipBeneficio", vipBeneficioSchema);
