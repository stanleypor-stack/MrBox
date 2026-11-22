const mongoose = require("mongoose");

/**
 * UNA RONDA COMPARTIDA.
 *
 * Slide y Crash no son de a uno: todos los jugadores apuestan a la
 * MISMA rueda y al MISMO gráfico, como en el diseño --cuenta
 * regresiva, historial de las últimas y, en Crash, las apuestas de
 * los demás a la vista.
 *
 * EL RESULTADO SE SORTEA AL CREAR LA RONDA
 *
 * Y se guarda tapado hasta que la ronda gira. Eso es lo que hace que
 * nadie --ni la casa-- pueda mirar quién apostó a qué antes de
 * decidir el resultado: cuando se abren las apuestas, el resultado ya
 * está.
 *
 * El `semillaHash` se publica apenas se abre la ronda y la semilla en
 * claro se revela cuando termina. Con las dos, cualquiera rehace el
 * resultado y comprueba que es el que estaba desde el principio.
 *
 * LA RONDA AVANZA SOLA, SIN NINGUN RELOJ CORRIENDO
 *
 * El estado es una cuenta de fechas: `abiertaHasta`, `giraHasta`.
 * Cuando alguien mira, se calcula en qué momento está y, si hace
 * falta, se cierra y se crea la siguiente. Un reloj de fondo que se
 * cae una noche deja el juego trabado sin que nadie se entere; esto
 * no se puede caer, porque no está corriendo.
 */
const gameTandaSchema = new mongoose.Schema(
  {
    juego: { type: String, enum: ["slide", "crash"], required: true, index: true },

    /* Un número que sube de a uno, para que la pantalla sepa si la
       ronda que tiene es la de ahora o una vieja. */
    numero: { type: Number, required: true },

    /* ── La prueba ────────────────────────────────────────────────── */
    semillaHash: { type: String, required: true },
    /* En claro. No sale de acá hasta que la ronda termina. */
    semilla: { type: String, required: true, select: false },

    /* ── El resultado, tapado hasta que gira ──────────────────────── */
    resultado: { type: mongoose.Schema.Types.Mixed, default: {}, select: false },

    /* Lo mismo, pero ya destapado. Se copia al girar. */
    resultadoVisible: { type: mongoose.Schema.Types.Mixed, default: null },

    /* ── Los tiempos ──────────────────────────────────────────────── */
    abiertaHasta: { type: Date, required: true },

    /*
      CUANDO TERMINA EL VUELO.

      En Slide es siempre lo mismo --la cinta tarda lo que tarda-- pero
      en Crash depende de donde reviente, y ahi esta el problema: si el
      unico reloj fuera `giraHasta`, cualquiera que mire lo que viaja
      por la red saca el punto de reventon con una resta, y cobrar un
      milisegundo antes del final deja de ser suerte.

      Con los dos tiempos separados, mientras vuela solo sale cuanto
      hace que arranco. El punto aparece cuando ya revento.
    */
    vuelaHasta: { type: Date, required: true },

    giraHasta: { type: Date, required: true },

    /*
      PAGADA.

      Las apuestas de una ronda se pagan UNA vez. El índice y esta
      bandera son lo que lo garantiza cuando dos jugadores miran la
      pantalla en el mismo milisegundo y los dos disparan el cierre.
    */
    pagada: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

/* La ronda de ahora de cada juego, que es la consulta de siempre. */
gameTandaSchema.index({ juego: 1, numero: -1 });

/* Dos rondas no pueden tener el mismo número en el mismo juego: es lo
   que impide que dos pedidos a la vez creen dos rondas. */
gameTandaSchema.index({ juego: 1, numero: 1 }, { unique: true });

module.exports = mongoose.model("GameTanda", gameTandaSchema);
