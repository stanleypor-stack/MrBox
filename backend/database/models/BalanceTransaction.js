const mongoose = require("mongoose");

/**
 * UN MOVIMIENTO DE SALDO.
 *
 * LA REGLA: EL SALDO NO SE TOCA SIN ESCRIBIR ACA.
 *
 * Cada peso que entra o sale de una cuenta deja una fila, y la fila guarda
 * el saldo ANTES y DESPUES. Eso convierte el saldo en algo que se puede
 * reconstruir: si alguien reclama que le faltan SC 40, se suman sus
 * movimientos y se ve dónde se fueron. Sin esto, el saldo es un número que
 * hay que creer.
 *
 * Es también lo que hace útil la pantalla de Movements del panel y lo que
 * deja auditar un ajuste hecho a mano, que es justo el que más conviene
 * poder auditar.
 */

/*
  Los tipos. Cada uno dice de dónde salió la plata, no solo si subió o
  bajó: "bajó SC 13,77" no sirve para nada, "abrió la caja Day Trader" sí.
*/
const TIPOS = [
  "purchase", //     compró SC con cripto
  "redemption", //   canjeó SC por cripto
  "box_open", //     abrió una caja
  "item_sold", //    vendió un objeto del inventario
  "deal", //         jugó en Deals
  "rakeback", //     devolución por rango VIP
  "race_prize", //   premio de una carrera
  "challenge", //    premio de un desafío
  "affiliate", //    comisión de referidos
  "promo_code", //   canjeó un código
  "creator_share", //parte del creador de una caja de comunidad
  "manual", //       ajuste hecho desde el panel
];

const balanceTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    type: { type: String, enum: TIPOS, required: true, index: true },

    /* Positivo entra, negativo sale. Nunca cero. */
    amountSc: { type: Number, required: true },

    /* El saldo antes y después. Es lo que hace reconstruible la cuenta. */
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },

    /* Qué lo causó: una apertura, un canje, una compra. */
    reference: {
      kind: { type: String, default: "" },
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
      label: { type: String, default: "" },
    },

    /* Para los ajustes a mano: quién y por qué. Sin esto no son auditables. */
    byAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, default: "" },
  },
  { timestamps: true }
);

/* El extracto de un jugador, y la pantalla de Movements filtrando por tipo. */
balanceTransactionSchema.index({ user: 1, createdAt: -1 });
balanceTransactionSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model("BalanceTransaction", balanceTransactionSchema);
module.exports.TIPOS = TIPOS;
