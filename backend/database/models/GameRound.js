const mongoose = require("mongoose");

/**
 * UNA RONDA DE UN JUEGO.
 *
 * Una fila por tiro, con todo lo que hace falta para rehacerlo: las
 * semillas del momento, el nonce, la jugada y el resultado. Es lo
 * mismo que `BoxOpen` para las cajas, y existe por los mismos tres
 * motivos:
 *
 *   - el jugador puede verificar cada ronda cuando rota su semilla
 *   - el panel puede mirar qué pasó sin recalcular nada
 *   - las carreras, el rakeback y el margen salen del libro, no de acá
 *
 * EL HASH SE GUARDA, LA SEMILLA NO
 *
 * `semillaServidorHash` es lo que el jugador vio ANTES de jugar. La
 * semilla en claro vive en `UserSeed` y se revela cuando rota, no
 * acá: una copia más de la semilla es una forma más de filtrarla.
 *
 * LAS RONDAS ABIERTAS
 *
 * Mines y Dragon's Tower duran varios clicks. Mientras la ronda está
 * abierta, el resultado YA ESTA SORTEADO y guardado --las minas están
 * puestas desde el primer momento-- pero no se le muestra al jugador.
 * `abierta` dice si todavía se puede seguir jugando, y `oculto` es la
 * parte del resultado que no se manda hasta que la ronda termina.
 */
const gameRoundSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    juego: {
      type: String,
      enum: ["dice", "crash", "slide", "keno", "reme", "mines", "towers", "plinko"],
      required: true,
      index: true,
    },

    /* ── Lo que se apostó ─────────────────────────────────────────── */
    apuestaSc: { type: Number, required: true, min: 0 },

    /* La jugada tal cual la pidió: el objetivo del dice, los números
       del keno, cuántas minas. Cambia por juego, así que es libre. */
    jugada: { type: mongoose.Schema.Types.Mixed, default: {} },

    /* ── Lo que salió ─────────────────────────────────────────────── */
    resultado: { type: mongoose.Schema.Types.Mixed, default: {} },

    /*
      Lo que el jugador todavía no tiene que ver. Nunca sale al
      cliente mientras `abierta` sea true: ver el comentario de
      arriba.
    */
    oculto: { type: mongoose.Schema.Types.Mixed, default: {}, select: false },

    multiplicador: { type: Number, default: 0 },
    pagoSc: { type: Number, default: 0, min: 0 },

    /* ── La prueba ────────────────────────────────────────────────── */
    semillaServidorHash: { type: String, default: "" },
    semillaCliente: { type: String, default: "" },
    nonce: { type: Number, default: 0 },
    hmacs: { type: [String], default: [] },

    /* ── El estado ────────────────────────────────────────────────── */
    abierta: { type: Boolean, default: false, index: true },
    cerradaEl: { type: Date, default: null },

  },
  { timestamps: true }
);

/* El historial de un jugador, que es la consulta de siempre. */
gameRoundSchema.index({ user: 1, createdAt: -1 });

/*
  UNA SOLA RONDA ABIERTA POR JUEGO Y POR JUGADOR.

  Mines, Towers, Crash y Slide se juegan de a una por vuelta, que es
  la regla de BetSweeps: "you can only bet one time per round". Sin
  esto, dos pestañas abren dos rondas y la segunda pisa a la primera:
  el jugador paga dos veces y cobra una.

  El índice parcial deja convivir todas las cerradas.

  Si alguna vez se cambia este filtro, hay que tirar el índice viejo
  antes: Mongo no cambia las opciones de uno que ya existe. Eso lo
  hace `asegurarIndices`, en database/index.js.
*/
gameRoundSchema.index(
  { user: 1, juego: 1 },
  { unique: true, partialFilterExpression: { abierta: true } }
);

module.exports = mongoose.model("GameRound", gameRoundSchema);
