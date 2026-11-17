const mongoose = require("mongoose");

/**
 * UN CODIGO DE AFILIADO.
 *
 * Hace dos cosas a la vez, y conviene tenerlas separadas en la cabeza:
 *
 *   1. AL JUGADOR le da un bono en cada compra: 5% el tramo normal, 10%
 *      el de los socios grandes.
 *   2. AL SOCIO le deja una comisión sobre lo que juegan los que trajo.
 *
 * El tramo lo decide el CODIGO, no el jugador. Así el dueño le puede dar
 * 10% a un streamer grande sin tocar nada más.
 *
 * POR QUE ES UN MODELO Y NO UN CAMPO EN EL USUARIO
 *
 * Porque un socio puede querer varios códigos —uno por campaña, para
 * saber cuál funcionó— y porque el código tiene vida propia: se apaga, se
 * le cambia el porcentaje, se le pone un vencimiento. Metido como campo
 * del usuario, nada de eso se puede sin ensuciar el usuario.
 */

const affiliateCodeSchema = new mongoose.Schema(
  {
    /*
      El código tal como se escribe. Se guarda en mayúsculas y se compara
      en mayúsculas: nadie se acuerda de si el código del streamer era
      "FUNK" o "funk", y rechazarlo por eso es perder un registro.
    */
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    /* `normal` o `destacado`. Decide el bono, mirando Settings. */
    tramo: { type: String, enum: ["normal", "destacado"], default: "normal" },

    /**
     * El bono de ESTE código, si se le quiere poner uno propio.
     *
     * En `null` usa el del tramo que dice Settings, que es lo normal. Un
     * número acá es para el caso suelto: un trato especial con alguien
     * que no justifica inventar un tramo nuevo.
     */
    bonoPropio: { type: Number, default: null, min: 0, max: 1 },

    /**
     * Lo que se lleva el socio, sobre el MARGEN de lo que juegan los
     * suyos. No sobre lo que juegan.
     *
     * La diferencia es toda: si alguien juega SC 1.000 en cajas al 92%,
     * el margen son SC 80. Un 30% sobre el margen son SC 24; un 30% sobre
     * lo jugado serían SC 300, o sea casi cuatro veces lo que la casa
     * ganó. Lo segundo funde el sitio y no avisa hasta fin de mes.
     */
    comision: { type: Number, default: 0.3, min: 0, max: 1 },

    activo: { type: Boolean, default: true, index: true },
    venceEl: { type: Date, default: null },

    /* Contadores, para no recorrer toda la base cada vez que se mira el panel. */
    jugadores: { type: Number, default: 0 },
    jugadoPorLosSuyosSc: { type: Number, default: 0 },
    ganadoSc: { type: Number, default: 0 },
    cobradoSc: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/** Si el código se puede usar ahora mismo. */
affiliateCodeSchema.methods.sirve = function sirve() {
  if (!this.activo) return false;
  if (this.venceEl && this.venceEl.getTime() < Date.now()) return false;
  return true;
};

/** Lo que el socio tiene sin cobrar. */
affiliateCodeSchema.virtual("porCobrarSc").get(function porCobrar() {
  return Math.max(0, (this.ganadoSc || 0) - (this.cobradoSc || 0));
});

affiliateCodeSchema.set("toJSON", { virtuals: true });
affiliateCodeSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("AffiliateCode", affiliateCodeSchema);
