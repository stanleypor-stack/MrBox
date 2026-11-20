const mongoose = require("mongoose");

/**
 * LA DIRECCION DE DEPOSITO DE UN JUGADOR, GUARDADA.
 *
 * `/payment/static-address` de OxaPay no devuelve la direccion que ya
 * tenia ese jugador: CREA UNA NUEVA EN CADA LLAMADA. Tres pedidos
 * seguidos dan tres direcciones distintas, cada una con su track_id.
 *
 * Sin guardarla, cada vez que alguien abria el cajon de deposito --o
 * cambiaba de moneda, o tocaba atras y volvia-- nacia una direccion
 * mas. Un jugador que mira el cajon diez veces se lleva diez
 * direcciones, todas suyas y todas vivas.
 *
 * No es que se pierda plata: las viejas siguen vigiladas y lo que
 * llegue a cualquiera de ellas acredita igual. Lo que se rompe es todo
 * lo demas: la cuenta de direcciones del comercio crece sin techo, y
 * soporte no puede contestar "a que direccion pagaste" porque hay
 * catorce.
 *
 * Asi que la primera se guarda y se vuelve a usar siempre. Son
 * permanentes --OxaPay no les pone vencimiento-- y una por jugador,
 * moneda y red es exactamente lo que hace falta.
 */

const esquema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ticker: { type: String, required: true, uppercase: true, trim: true },
    red: { type: String, required: true, trim: true },

    direccion: { type: String, required: true, trim: true },
    /* Las cadenas que lo piden lo necesitan para saber de quien es el
       pago: sin el, llega a la direccion y no se sabe de quien. */
    memo: { type: String, default: "" },
    trackId: { type: String, default: "" },
  },
  { timestamps: true }
);

/* Una sola por jugador, moneda y red. El indice es lo que impide que
   dos pedidos al mismo tiempo guarden dos. */
esquema.index({ user: 1, ticker: 1, red: 1 }, { unique: true });

module.exports = mongoose.model("DireccionDeDeposito", esquema);
