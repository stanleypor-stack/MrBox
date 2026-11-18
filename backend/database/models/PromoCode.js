const mongoose = require("mongoose");

/**
 * UN CODIGO PROMOCIONAL.
 *
 * El que se reparte en un video o en un correo: se escribe una vez y
 * da saldo o aperturas gratis.
 *
 * NO ES UN CODIGO DE AFILIADO
 *
 * El de afiliado ata a un jugador con un socio para siempre y paga
 * comisión; este regala algo una sola vez y se termina. Son dos cosas
 * distintas y por eso son dos colecciones: mezclarlos termina con un
 * socio cobrando comisión de un código de campaña.
 *
 * QUIEN LO USO VIVE EN SU PROPIA FILA
 *
 * `PromoUse`, con índice único por (código, jugador). Es lo que impide
 * que alguien lo canjee dos veces: no un `if`, un índice. Y permite
 * contar canjes sin un contador que se pueda desincronizar.
 */

const promoCodeSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 24,
      index: true,
    },

    /* `saldo` acredita SC; `aperturas` regala cajas de las de bienvenida. */
    tipo: { type: String, enum: ["saldo", "aperturas"], default: "saldo" },

    montoSc: { type: Number, default: 0, min: 0 },
    aperturas: { type: Number, default: 0, min: 0 },

    /* 0 es "sin tope". */
    usosMaximos: { type: Number, default: 0, min: 0 },
    usos: { type: Number, default: 0, min: 0 },

    /** Para que un código no sea plata gratis: hay que haber jugado. */
    minimoJugadoSc: { type: Number, default: 0, min: 0 },

    hasta: { type: Date, default: null },
    activo: { type: Boolean, default: true, index: true },

    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

/** Si todavía sirve: prendido, en fecha y con usos disponibles. */
promoCodeSchema.methods.sirve = function sirve() {
  if (!this.activo) return false;
  if (this.hasta && this.hasta < new Date()) return false;
  if (this.usosMaximos > 0 && this.usos >= this.usosMaximos) return false;
  return true;
};

const promoUseSchema = new mongoose.Schema(
  {
    code: { type: mongoose.Schema.Types.ObjectId, ref: "PromoCode", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    montoSc: { type: Number, default: 0 },
    aperturas: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* UNA VEZ POR PERSONA. Lo decide la base, no una pregunta. */
promoUseSchema.index({ code: 1, user: 1 }, { unique: true });

const PromoCode = mongoose.model("PromoCode", promoCodeSchema);
const PromoUse = mongoose.model("PromoUse", promoUseSchema);

module.exports = PromoCode;
module.exports.PromoUse = PromoUse;
