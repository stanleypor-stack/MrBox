const mongoose = require("mongoose");

/**
 * LAS SEMILLAS DE UN JUGADOR.
 *
 * Tres datos que, juntos, deciden cada sorteo: la semilla del servidor (la
 * nuestra, tapada), la del cliente (la suya, que cambia cuando quiera) y
 * un contador que sube de a uno en cada apertura.
 *
 * COMO SE COMPROMETE EL RESULTADO ANTES DE JUGAR
 *
 * Al jugador le mostramos el HASH de la semilla del servidor, nunca la
 * semilla. Con el hash no puede adivinar qué le va a salir, pero sí puede
 * comprobar después que la semilla que le revelamos es la misma que estaba
 * comprometida desde el principio. Nosotros quedamos atados: cambiarla
 * rompería el hash que ya vio.
 *
 * CUANDO ROTA
 *
 * El jugador pide una semilla nueva cuando quiera. Ahí le revelamos la
 * vieja —ya no la vamos a usar, revelarla no compromete nada futuro— y
 * puede rehacer cada una de las aperturas que hizo con ella. El contador
 * vuelve a cero y empieza otra tanda.
 *
 * Por eso hay una fila por tanda y no un campo en el usuario: la vieja se
 * guarda para siempre, porque es lo que hace verificables las aperturas
 * que ya pasaron.
 */

const userSeedSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    /*
      `select: false`: la semilla del servidor NO sale de la base por
      descuido. Se lee a propósito, en el sorteo y al revelarla. Si se
      filtrara antes de tiempo, el jugador podría calcular qué le va a
      salir y abrir solo cuando conviene.
    */
    semillaServidor: { type: String, required: true, select: false },
    semillaServidorHash: { type: String, required: true },

    semillaCliente: { type: String, required: true },

    nonce: { type: Number, default: 0 },

    /* La tanda en uso. Solo una por jugador tiene esto en `true`. */
    activa: { type: Boolean, default: true, index: true },

    /* Cuándo se reveló, al rotar. Mientras sea `null`, sigue tapada. */
    reveladaEn: { type: Date, default: null },
  },
  { timestamps: true }
);

/*
  UN JUGADOR, UNA TANDA ACTIVA.

  El índice parcial lo garantiza en la base y no solo en el código: dos
  tandas activas a la vez significarían dos contadores, y dos aperturas
  distintas podrían compartir nonce. Dos resultados con la misma prueba es
  exactamente lo que este mecanismo tiene que hacer imposible.
*/
userSeedSchema.index(
  { user: 1, activa: 1 },
  { unique: true, partialFilterExpression: { activa: true } }
);

module.exports = mongoose.model("UserSeed", userSeedSchema);
