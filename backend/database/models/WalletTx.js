const mongoose = require("mongoose");

/**
 * UN PAGO MANDADO DESDE LA BILLETERA DEL JUGADOR.
 *
 * Es una ANOTACION, no un movimiento de plata. El saldo lo acredita la
 * pasarela cuando la red confirma, igual que con cualquier depósito; acá
 * solo queda el hash que el jugador firmó.
 *
 * POR QUE EXISTE
 *
 * "Pagué y no me llegó" es la consulta más común de un cajero, y sin el
 * hash no hay nada que mirar: soporte tiene que poder abrir el
 * explorador y ver si la transferencia salió, a qué dirección fue y
 * cuántas confirmaciones lleva. Sin esto, la única respuesta posible es
 * "esperá".
 *
 * NO SE CONFIA EN LO QUE LLEGA
 *
 * El hash lo manda el navegador, así que un jugador podría inventarse
 * uno. Por eso esta fila no acredita nada ni se usa para decidir: es una
 * pista para una persona, y nada más.
 */
const walletTxSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    ticker: { type: String, required: true },
    red: { type: String, required: true },

    /* A dónde dijo la pantalla que iba: la dirección de depósito que le
       dimos. Si no coincide con la del explorador, algo anduvo mal. */
    direccion: { type: String, default: "" },

    hash: { type: String, required: true },
  },
  { timestamps: true }
);

/* Un hash es único: si el navegador lo manda dos veces, queda uno. */
walletTxSchema.index({ hash: 1 }, { unique: true });

module.exports = mongoose.model("WalletTx", walletTxSchema);
