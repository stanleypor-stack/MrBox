const mongoose = require("mongoose");

/**
 * UN AVISO PARA UNA PERSONA.
 *
 * Lo que aparece en la campanita: entró el depósito, salió el retiro,
 * se pagó el premio de la carrera, se despachó el pedido.
 *
 * NO GUARDA LA FRASE, GUARDA LA CLAVE
 *
 * `clave` es "notif.depositOk", no "Entraron SC 25 a tu billetera". El
 * sitio está en nueve idiomas y una frase guardada acá se leería en
 * castellano para un japonés que abrió la cuenta en japonés --y
 * peor: se quedaría en castellano para siempre, aunque después cambie
 * de idioma--. Los números van en `datos` y la pantalla los mete en la
 * frase traducida. Es lo mismo que hacen los banners.
 *
 * SE BORRAN SOLOS A LOS 90 DIAS
 *
 * Un aviso de hace tres meses no se lee: se baja al final de la lista
 * y queda ocupando base para siempre. El índice `expires` los limpia
 * solo. Lo que hay que poder mirar de hace un año son los movimientos
 * de la billetera y los pedidos, y esos viven en sus propias tablas.
 */

/* Los que existen. Cada uno tiene su dibujo y su color en la pantalla. */
const TIPOS = [
  "deposito",   // entró plata
  "retiro",     // salió plata
  "carrera",    // premio de una carrera
  "desafio",    // premio de un desafío
  "envio",      // el pedido se despachó
  "rango",      // subió de rango de socio
  "aviso",      // lo que no entra en los de arriba
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    tipo: { type: String, enum: TIPOS, default: "aviso" },

    /* La clave de idioma. Ver frontend/scripts/traducir.py. */
    clave: { type: String, required: true, trim: true },

    /* Lo que la frase necesita: { monto: 25 }, { puesto: 2 }… */
    datos: { type: mongoose.Schema.Types.Mixed, default: {} },

    /* A dónde lleva el toque. Una dirección del sitio, no una externa. */
    destino: { type: String, default: "", trim: true },

    /* Cuándo la leyó. `null` = sin leer, y es lo que cuenta la bolita. */
    leidaEl: { type: Date, default: null },
  },
  { timestamps: true }
);

/*
  LA CONSULTA QUE SE HACE SIEMPRE: las mías, las últimas primero.

  Y la de la bolita: las mías sin leer. Van en el mismo índice porque
  `leidaEl` al final sirve para las dos.
*/
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, leidaEl: 1 });

/* Noventa días y se van. */
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.TIPOS = TIPOS;
